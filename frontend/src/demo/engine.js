/*
 * Preview engine: a faithful in-browser port of the FastAPI backend (same endpoints, response
 * shapes, rules, pace maths, permissions and report builder). It is used ONLY by the hosted
 * preview build (VITE_DEMO=1). The real app talks to the Python API and PostgreSQL.
 */
import SPEC from "../modules.json";
import PLATFORM from "../platform.json";
import { SEED } from "./seed";

const KEY = "kept_preview_db_v12";
export const TODAY = "2026-10-13";
const AT_RISK_GAP = 15, DUE_SOON = 3, ESCALATE = 2;

let db = null;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16));
const nowIso = () => `${TODAY}T${new Date().toISOString().slice(11)}`;
const dnum = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const addDays = (iso, n) => new Date((dnum(iso) + n) * 86400000).toISOString().slice(0, 10);
const fmt = (iso) => { const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; const [, m, d] = iso.split("-").map(Number); return `${d} ${M[m - 1]}`; };
const n = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10));

class HttpError extends Error { constructor(status, detail) { super(typeof detail === "string" ? detail : detail.message); this.status = status; this.data = { detail }; } }
const E = (s, d) => { throw new HttpError(s, d); };

function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked: keep in memory */ } }
function load() {
  if (db) return db;
  try { const raw = localStorage.getItem(KEY); if (raw) db = JSON.parse(raw); } catch { db = null; }
  if (!db) { db = SEED(); evaluateAll(); save(); }
  return db;
}
// Several preview tabs (a manager's tracker and a field officer's form) share one browser store, like they would share one server.
if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (e.key === KEY && e.newValue) { try { db = JSON.parse(e.newValue); } catch { /* ignore */ } } });

export function resetPreview() { try { localStorage.removeItem(KEY); localStorage.removeItem("kept_token"); } catch { /* ignore */ } db = null; }

// ---------- lookups ----------
const T = (name) => db[name];
const byId = (name, id) => db[name].find((x) => x.id === id);
const mini = (u) => (u ? { id: u.id, full_name: u.full_name } : null);
const userMini = (id) => mini(byId("users", id));
const stake = (id) => { const s = id && byId("stakeholders", id); return s ? { ...s } : null; };
const commitmentsOf = (pid) => T("commitments").filter((c) => c.project_id === pid).sort((a, b) => a.due_on.localeCompare(b.due_on));
const activitiesOf = (cid) => T("activities").filter((a) => a.commitment_id === cid).sort((a, b) => a.due_on.localeCompare(b.due_on));
const reqsOf = (aid) => T("requirements").filter((r) => r.activity_id === aid).sort((a, b) => a.position - b.position);
const evOf = (aid) => T("evidence").filter((e) => e.activity_id === aid).sort((a, b) => a.captured_at.localeCompare(b.captured_at));
const projectOfActivity = (a) => byId("projects", byId("commitments", a.commitment_id).project_id);

function log(org, actor, action, stype, sid, summary, changes = {}) {
  db.audit.push({ id: ++db.seq, organization_id: org, actor_id: actor, action, subject_type: stype, subject_id: sid, summary, changes, at: nowIso() });
}

// ---------- pace ----------
const doneBy = (a, asOf) => a.status === "done" && (!a.completed_at || a.completed_at.slice(0, 10) <= asOf);
function actualValue(c, asOf) {
  const acts = activitiesOf(c.id);
  if (c.measure === "activities") return acts.filter((a) => doneBy(a, asOf)).length;
  let t = 0;
  for (const a of acts) {
    if (!doneBy(a, asOf)) continue;
    const reqs = Object.fromEntries(reqsOf(a.id).map((r) => [r.id, r]));
    for (const e of evOf(a.id)) if (e.value_number != null && reqs[e.requirement_id]?.counts_toward_target) t += Number(e.value_number);
  }
  return t;
}
function pace(c, asOf = TODAY) {
  const p = byId("projects", c.project_id);
  const target = Number(c.target_value) || 1;
  const actual = actualValue(c, asOf);
  const span = dnum(c.due_on) - dnum(p.starts_on);
  const frac = span <= 0 ? (asOf >= c.due_on ? 1 : 0) : Math.min(Math.max((dnum(asOf) - dnum(p.starts_on)) / span, 0), 1);
  const expected = target * frac;
  const aPct = Math.min((actual / target) * 100, 100), ePct = Math.min((expected / target) * 100, 100);
  const gap = Math.round((ePct - aPct) * 10) / 10;
  const status = actual >= target ? "done" : asOf > c.due_on ? "overdue" : gap >= AT_RISK_GAP ? "at_risk" : "on_track";
  const acts = activitiesOf(c.id);
  return { actual: Math.round(actual * 100) / 100, expected: Math.round(expected * 10) / 10, target: Number(c.target_value),
    actual_pct: Math.round(aPct * 10) / 10, expected_pct: Math.round(ePct * 10) / 10, gap_pts: gap, status,
    done_activities: acts.filter((a) => a.status === "done").length, total_activities: acts.length };
}
const missing = (a) => { const have = new Set(evOf(a.id).map((e) => e.requirement_id)); return reqsOf(a.id).filter((r) => r.is_required && !have.has(r.id)).map((r) => r.label); };

// ---------- rules engine (same rules as app/services/rules.py) ----------
function evaluateOrg(org) {
  const desired = new Map();
  const put = (rule, stype, sid, v) => desired.set(`${rule}|${stype}|${sid}`, { rule, subject_type: stype, subject_id: sid, ...v });
  for (const p of T("projects").filter((x) => x.organization_id === org && x.status === "active")) {
    for (const c of commitmentsOf(p.id)) for (const a of activitiesOf(c.id)) {
      if (a.status === "done") continue;
      const dep = a.depends_on_id && byId("activities", a.depends_on_id);
      const waiting = dep && dep.status !== "done" && dep.due_on < TODAY;
      if (waiting && a.status !== "blocked") { a.status = "blocked"; log(org, null, "auto_blocked", "activity", a.id, `Blocked: waits on '${dep.title}', which is past due`); }
      else if (!waiting && a.status === "blocked") { a.status = evOf(a.id).length ? "in_progress" : "not_started"; log(org, null, "auto_unblocked", "activity", a.id, "Unblocked: dependency cleared"); }
    }
    for (const c of commitmentsOf(p.id)) {
      const pc = pace(c);
      if (pc.status === "at_risk") put("behind_pace", "commitment", c.id, { severity: pc.gap_pts >= 25 ? "high" : "medium", owner_id: p.manager_id, title: c.title,
        detail: `${n(pc.gap_pts)} points behind: ${n(pc.actual)} of ${n(pc.target)} ${c.unit}, ${n(pc.expected)} expected by today.`, data: pc, project_id: p.id });
      if (pc.status === "overdue") put("overdue", "commitment", c.id, { severity: "high", owner_id: p.manager_id, title: c.title,
        detail: `Was due ${fmt(c.due_on)}; ${n(pc.actual)} of ${n(pc.target)} ${c.unit} done.`, data: pc, project_id: p.id });
      for (const a of activitiesOf(c.id)) {
        if (a.status === "done") continue;
        if (a.status === "blocked") {
          const dep = byId("activities", a.depends_on_id);
          put("blocked", "activity", a.id, { severity: "medium", owner_id: a.owner_id, title: a.title, detail: dep ? `Waits on '${dep.title}', due ${fmt(dep.due_on)}.` : "Blocked.", data: {}, project_id: p.id });
        } else if (a.due_on < TODAY) {
          const days = dnum(TODAY) - dnum(a.due_on); const esc = days > ESCALATE && p.manager_id;
          put("overdue", "activity", a.id, { severity: esc ? "high" : "medium", owner_id: esc ? p.manager_id : a.owner_id, title: a.title,
            detail: `Due ${fmt(a.due_on)}, ${days} day${days !== 1 ? "s" : ""} late.${esc ? " Escalated to the project manager." : ""}`, data: { days_late: days }, project_id: p.id });
        } else if (a.status === "not_started" && dnum(a.due_on) - dnum(TODAY) <= DUE_SOON) {
          const d = dnum(a.due_on) - dnum(TODAY);
          put("due_soon", "activity", a.id, { severity: "low", owner_id: a.owner_id, title: a.title, detail: `Due ${fmt(a.due_on)}${d === 0 ? " (today)" : `, in ${d} day${d !== 1 ? "s" : ""}`}, not started.`, data: {}, project_id: p.id });
        }
        const miss = missing(a);
        if (a.completion_refused_at && miss.length) put("missing_proof", "activity", a.id, { severity: "medium", owner_id: a.owner_id, title: a.title, detail: `Completion refused. Missing: ${miss.join(", ")}.`, data: { missing: miss }, project_id: p.id });
      }
    }
  }
  erpDesired(org, (rule, stype, sid, v) => desired.set(`${rule}|${stype}|${sid}`, { rule, subject_type: stype, subject_id: sid, ...v }));
  const mine = T("flags").filter((f) => f.organization_id === org);
  const live = new Map(mine.filter((f) => f.status !== "resolved").map((f) => [`${f.rule}|${f.subject_type}|${f.subject_id}`, f]));
  const quiet = new Set(mine.filter((f) => f.status === "resolved" && f.resolved_by_id && f.resolved_at && dnum(TODAY) - dnum(f.resolved_at) < 3).map((f) => `${f.rule}|${f.subject_type}|${f.subject_id}`));
  let closed = 0;
  for (const [k, v] of desired) {
    const f = live.get(k);
    if (f) { Object.assign(f, { severity: v.severity, owner_id: v.owner_id, title: v.title, detail: v.detail, data: v.data });
      if (f.status === "snoozed" && f.snoozed_until && f.snoozed_until <= TODAY) { f.status = "open"; f.snoozed_until = null; } }
    else if (!quiet.has(k)) { const nf = { id: uid(), organization_id: org, status: "open", opened_at: nowIso(), snoozed_until: null, resolved_at: null, resolved_by_id: null, resolution_note: null, ...v };
      db.flags.push(nf); log(org, null, "flag_opened", "flag", nf.id, `${v.rule}: ${v.title}`); }
  }
  for (const [k, f] of live) if (!desired.has(k)) {
    Object.assign(f, { status: "resolved", resolved_at: nowIso(), resolution_note: "Closed automatically: the condition no longer applies." });
    log(org, null, "flag_auto_resolved", "flag", f.id, `${f.rule}: ${f.title}`); closed++;
  }
  return closed;
}
function evaluateAll() { for (const o of db.orgs) evaluateOrg(o.id); }

// ---------- serializers ----------
const orgOf = (u) => byId("orgs", u.organization_id);
const meOut = (u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role, is_active: u.is_active, organization: { ...orgOf(u) } });
const userOut = (u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role, is_active: u.is_active });
const tplOut = (t) => (t ? { ...t } : null);
const commitmentOut = (c) => ({ id: c.id, project_id: c.project_id, title: c.title, unit: c.unit, measure: c.measure, target_value: Number(c.target_value), due_on: c.due_on, stakeholder: stake(c.stakeholder_id), pace: pace(c) });
const projectOut = (p) => ({ id: p.id, name: p.name, description: p.description, status: p.status, starts_on: p.starts_on, ends_on: p.ends_on,
  stakeholder: stake(p.stakeholder_id), manager: userMini(p.manager_id), template: tplOut(byId("templates", p.template_id)), commitments: commitmentsOf(p.id).map(commitmentOut) });
const evidenceOut = (e) => ({ ...e, captured_by: userMini(e.captured_by_id) });
function row(a) {
  const c = byId("commitments", a.commitment_id), p = byId("projects", c.project_id);
  const have = new Set(evOf(a.id).map((e) => e.requirement_id)); const need = reqsOf(a.id).filter((r) => r.is_required);
  return { id: a.id, title: a.title, due_on: a.due_on, status: a.status, owner: userMini(a.owner_id), commitment_id: c.id, commitment_title: c.title,
    project_id: p.id, project_name: p.name, proof_have: need.filter((r) => have.has(r.id)).length, proof_need: need.length };
}
const auditOut = (e) => ({ ...e, actor: userMini(e.actor_id) });
function activityOut(a) {
  const c = byId("commitments", a.commitment_id), p = byId("projects", c.project_id), dep = a.depends_on_id && byId("activities", a.depends_on_id);
  const history = T("audit").filter((h) => h.subject_type === "activity" && h.subject_id === a.id).sort((x, y) => y.at.localeCompare(x.at) || y.id - x.id).slice(0, 50).map(auditOut);
  return { id: a.id, title: a.title, notes: a.notes, due_on: a.due_on, status: a.status, completed_at: a.completed_at, completion_refused_at: a.completion_refused_at,
    owner: userMini(a.owner_id), depends_on: dep ? { id: dep.id, title: dep.title, status: dep.status, due_on: dep.due_on } : null,
    commitment: { id: c.id, title: c.title, unit: c.unit, pace: pace(c) }, project: { id: p.id, name: p.name },
    requirements: reqsOf(a.id), evidence: evOf(a.id).map(evidenceOut), missing: missing(a), history };
}
const flagOut = (f) => ({ ...f, owner: userMini(f.owner_id), resolved_by: userMini(f.resolved_by_id), project_name: byId("projects", f.project_id)?.name || null });

// ---------- guards ----------
function current(token) { const u = token && byId("users", token); if (!u) E(401, "Sign in to continue."); if (!u.is_active) E(401, "This account is no longer active."); return u; }
const manage = (u) => { if (!["admin", "manager"].includes(u.role)) E(403, "Your role does not allow this action."); };
const adminOnly = (u) => { if (u.role !== "admin") E(403, "Your role does not allow this action."); };
const inOrg = (u, p, what) => { if (!p || p.organization_id !== u.organization_id) E(404, `${what} not found.`); return p; };
const getProject = (u, id) => inOrg(u, byId("projects", id), "Project");
const getCommitment = (u, id) => { const c = byId("commitments", id); if (!c) E(404, "Commitment not found."); inOrg(u, byId("projects", c.project_id), "Commitment"); return c; };
const getActivity = (u, id) => { const a = byId("activities", id); if (!a) E(404, "Activity not found."); inOrg(u, projectOfActivity(a), "Activity"); return a; };
const workOn = (a, u) => { if (["admin", "manager"].includes(u.role) || (u.role === "member" && a.owner_id === u.id)) return; E(403, "Only the owner or a manager can change this activity."); };
const need = (cond, msg) => { if (!cond) E(422, msg); };
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || "");

// ---------- router ----------
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:\w+/g, "([^/]+)") + "$"), fn });

on("POST", "/auth/login", (_, { body }) => {
  const u = T("users").find((x) => x.email.toLowerCase() === (body.email || "").toLowerCase());
  if (!u || u.password !== body.password) E(401, "Email or password is incorrect.");
  if (!u.is_active) E(403, "This account has been deactivated by an administrator.");
  if (body.site_slug) { const st = mrows("site_settings").find((x) => String(x.slug).toLowerCase() === String(body.site_slug).toLowerCase()); if (!st || st.organization_id !== u.organization_id) E(401, "Email or password is incorrect."); }
  return { access_token: u.id, token_type: "bearer", user: meOut(u) };
});
on("POST", "/auth/register", (_, { body }) => {
  need((body.organization_name || "").trim().length >= 2, "String should have at least 2 characters");
  need((body.full_name || "").trim().length >= 2, "String should have at least 2 characters");
  need(emailOk(body.email), "value is not a valid email address");
  need((body.password || "").length >= 8, "String should have at least 8 characters");
  if (T("users").some((x) => x.email.toLowerCase() === body.email.toLowerCase())) E(409, "An account with this email already exists. Sign in instead.");
  const org = { id: uid(), name: body.organization_name.trim(), sector: body.sector || "", currency: body.currency || "KES" };
  const u = { id: uid(), organization_id: org.id, full_name: body.full_name.trim(), email: body.email.toLowerCase(), password: body.password, role: "admin", is_active: true };
  db.orgs.push(org); db.users.push(u); log(org.id, u.id, "organization_created", "organization", org.id, `Created ${org.name}`);
  return { access_token: u.id, token_type: "bearer", user: meOut(u) };
});
on("GET", "/auth/me", (u) => meOut(u));

on("GET", "/users", (u) => T("users").filter((x) => x.organization_id === u.organization_id).sort((a, b) => a.full_name.localeCompare(b.full_name)).map(userOut));
on("POST", "/users", (u, { body }) => {
  adminOnly(u);
  need((body.full_name || "").trim().length >= 2, "Enter a full name."); need(emailOk(body.email), "value is not a valid email address");
  need((body.temporary_password || "").length >= 8, "The temporary password needs at least 8 characters.");
  if (T("users").some((x) => x.email.toLowerCase() === body.email.toLowerCase())) E(409, "Someone already uses this email.");
  const nu = { id: uid(), organization_id: u.organization_id, full_name: body.full_name.trim(), email: body.email.toLowerCase(), password: body.temporary_password, role: body.role || "member", is_active: true };
  db.users.push(nu); log(u.organization_id, u.id, "user_invited", "user", nu.id, `Added ${nu.full_name} as ${nu.role}`); return userOut(nu);
});
on("PATCH", "/users/:id", (u, { body }, id) => {
  adminOnly(u); const t = byId("users", id); inOrg(u, t, "Person");
  if (t.id === u.id && ((body.role && body.role !== "admin") || body.is_active === false)) E(400, "You cannot remove your own admin access.");
  if (body.role) t.role = body.role; if (body.is_active != null) t.is_active = body.is_active;
  log(u.organization_id, u.id, "user_updated", "user", t.id, `Updated ${t.full_name}`); return userOut(t);
});
on("GET", "/stakeholders", (u) => T("stakeholders").filter((s) => s.organization_id === u.organization_id).sort((a, b) => a.name.localeCompare(b.name)));
on("POST", "/stakeholders", (u, { body }) => {
  manage(u); need((body.name || "").trim().length >= 2, "Enter a name."); if (body.contact_email) need(emailOk(body.contact_email), "value is not a valid email address");
  const s = { id: uid(), organization_id: u.organization_id, name: body.name.trim(), kind: body.kind, contact_email: body.contact_email || null };
  db.stakeholders.push(s); log(u.organization_id, u.id, "stakeholder_created", "stakeholder", s.id, `Added ${s.name}`); return s;
});
on("DELETE", "/stakeholders/:id", (u, _, id) => {
  manage(u); const s = inOrg(u, byId("stakeholders", id), "Stakeholder");
  db.stakeholders = db.stakeholders.filter((x) => x.id !== s.id);
  for (const x of [...db.projects, ...db.commitments]) if (x.stakeholder_id === s.id) x.stakeholder_id = null;
  log(u.organization_id, u.id, "stakeholder_deleted", "stakeholder", s.id, `Removed ${s.name}`); return null;
});
on("GET", "/templates", () => T("templates").map(tplOut));
on("GET", "/audit", (u, { params }) => {
  adminOnly(u); const page = Number(params.page || 1), size = Number(params.page_size || 30);
  const all = T("audit").filter((e) => e.organization_id === u.organization_id).sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
  return { items: all.slice((page - 1) * size, page * size).map(auditOut), total: all.length, page, page_size: size };
});

on("GET", "/projects", (u, { params }) => {
  let ps = T("projects").filter((p) => p.organization_id === u.organization_id);
  ps = params.status ? ps.filter((p) => p.status === params.status) : ps.filter((p) => p.status !== "archived");
  if (params.q) { const q = params.q.toLowerCase(); ps = ps.filter((p) => p.name.toLowerCase().includes(q) || (stake(p.stakeholder_id)?.name || "").toLowerCase().includes(q)); }
  const items = ps.map((p) => { const st = commitmentsOf(p.id).map((c) => pace(c).status);
    return { id: p.id, name: p.name, status: p.status, starts_on: p.starts_on, ends_on: p.ends_on, stakeholder: stake(p.stakeholder_id), manager: userMini(p.manager_id),
      commitments_total: st.length, commitments_attention: st.filter((s) => s === "at_risk" || s === "overdue").length,
      open_flags: T("flags").filter((f) => f.project_id === p.id && f.status === "open").length }; });
  const sort = params.sort || "ends_on";
  items.sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) : sort === "attention" ? (a, b) => b.open_flags - a.open_flags || a.name.localeCompare(b.name) : (a, b) => a[sort].localeCompare(b[sort]));
  const page = Number(params.page || 1), size = Number(params.page_size || 20);
  return { items: items.slice((page - 1) * size, page * size), total: items.length, page, page_size: size };
});
function checkDue(p, due) { need(due && p.starts_on < due && due <= p.ends_on, `Due date must fall inside the project, ${p.starts_on} to ${p.ends_on}.`); }
on("POST", "/projects", (u, { body }) => {
  manage(u);
  need((body.name || "").trim().length >= 2, "Enter a project name."); need(body.starts_on && body.ends_on, "Enter start and end dates.");
  need(body.ends_on > body.starts_on, "The end date must be after the start date.");
  const p = { id: uid(), organization_id: u.organization_id, template_id: body.template_id || null, stakeholder_id: body.stakeholder_id || null,
    manager_id: body.manager_id || u.id, name: body.name.trim(), description: body.description || "", starts_on: body.starts_on, ends_on: body.ends_on, status: "active" };
  const tpl = byId("templates", p.template_id);
  const cs = body.commitments?.length ? body.commitments : (tpl?.blueprint.commitments || []).map((c) => ({ ...c, due_on: body.ends_on }));
  for (const c of cs) { checkDue(p, c.due_on); need(Number(c.target_value) > 0, "Targets must be greater than zero."); need((c.title || "").trim().length >= 2, "Every commitment needs a title."); }
  db.projects.push(p);
  for (const c of cs) db.commitments.push({ id: uid(), project_id: p.id, stakeholder_id: c.stakeholder_id || p.stakeholder_id, title: c.title.trim(), unit: c.unit || "", measure: c.measure || "sum", target_value: Number(c.target_value), due_on: c.due_on });
  log(u.organization_id, u.id, "project_created", "project", p.id, `Created ${p.name}`); evaluateOrg(u.organization_id); return projectOut(p);
});
on("GET", "/projects/:id", (u, _, id) => projectOut(getProject(u, id)));
on("POST", "/projects/:id/commitments", (u, { body }, id) => {
  manage(u); const p = getProject(u, id); need((body.title || "").trim().length >= 2, "Enter what was promised."); need(Number(body.target_value) > 0, "The target must be greater than zero."); checkDue(p, body.due_on);
  const c = { id: uid(), project_id: p.id, stakeholder_id: body.stakeholder_id || p.stakeholder_id, title: body.title.trim(), unit: body.unit || "", measure: body.measure || "sum", target_value: Number(body.target_value), due_on: body.due_on };
  db.commitments.push(c); log(u.organization_id, u.id, "commitment_created", "commitment", c.id, `Added commitment ${c.title}`); evaluateOrg(u.organization_id); return commitmentOut(c);
});

on("GET", "/activities", (u, { params }) => {
  let rows = T("activities").filter((a) => projectOfActivity(a).organization_id === u.organization_id);
  if (params.project_id) rows = rows.filter((a) => byId("commitments", a.commitment_id).project_id === params.project_id);
  if (params.commitment_id) rows = rows.filter((a) => a.commitment_id === params.commitment_id);
  if (params.owner === "me") rows = rows.filter((a) => a.owner_id === u.id); else if (params.owner) rows = rows.filter((a) => a.owner_id === params.owner);
  const st = params.state || "open";
  rows = rows.filter((a) => st === "all" || (st === "open" && a.status !== "done") || (st === "done" && a.status === "done") || (st === "overdue" && a.status !== "done" && a.due_on < TODAY) || (st === "blocked" && a.status === "blocked"));
  if (params.q) { const q = params.q.toLowerCase(); rows = rows.filter((a) => a.title.toLowerCase().includes(q) || byId("commitments", a.commitment_id).title.toLowerCase().includes(q)); }
  rows.sort((a, b) => a.due_on.localeCompare(b.due_on) || a.title.localeCompare(b.title));
  const page = Number(params.page || 1), size = Number(params.page_size || 25);
  return { items: rows.slice((page - 1) * size, page * size).map(row), total: rows.length, page, page_size: size };
});
function checkDep(projectId, aid, depId) {
  if (!depId) return; need(depId !== aid, "An activity cannot depend on itself.");
  let cur = byId("activities", depId); need(cur && projectOfActivity(cur).id === projectId, "It can only depend on an activity in the same project.");
  const seen = new Set(); while (cur) { need(cur.id !== aid && !seen.has(cur.id), "That dependency would create a loop."); seen.add(cur.id); cur = cur.depends_on_id && byId("activities", cur.depends_on_id); }
}
on("POST", "/activities", (u, { body }) => {
  manage(u); const c = getCommitment(u, body.commitment_id); const p = byId("projects", c.project_id);
  need((body.title || "").trim().length >= 2, "Enter a title."); need(body.due_on && p.starts_on <= body.due_on && body.due_on <= p.ends_on, "Due date must fall inside the project dates.");
  const a = { id: uid(), commitment_id: c.id, owner_id: body.owner_id || null, depends_on_id: null, title: body.title.trim(), notes: body.notes || "", due_on: body.due_on, status: "not_started", completed_at: null, completion_refused_at: null };
  checkDep(p.id, a.id, body.depends_on_id); a.depends_on_id = body.depends_on_id || null; db.activities.push(a);
  const tpl = byId("templates", p.template_id); const type = tpl?.blueprint.activity_types.find((t) => t.key === body.activity_type);
  (type?.requirements || []).forEach((r, i) => db.requirements.push({ id: uid(), activity_id: a.id, kind: r.kind, label: r.label, is_required: r.required, counts_toward_target: r.counts, position: i }));
  log(u.organization_id, u.id, "activity_created", "activity", a.id, `Created by ${u.full_name}`); evaluateOrg(u.organization_id); return activityOut(a);
});
on("GET", "/activities/:id", (u, _, id) => activityOut(getActivity(u, id)));
on("PATCH", "/activities/:id", (u, { body }, id) => {
  const a = getActivity(u, id); workOn(a, u);
  if (!["admin", "manager"].includes(u.role) && Object.keys(body).some((k) => !["status", "notes"].includes(k))) E(403, "Members can change status and notes only.");
  if ("depends_on_id" in body) checkDep(projectOfActivity(a).id, a.id, body.depends_on_id);
  if (body.status && ["done", "blocked"].includes(a.status)) E(409, `This activity is ${a.status}; its status is managed for you.`);
  const changed = Object.keys(body).filter((k) => a[k] !== body[k]); Object.assign(a, body);
  if (changed.length) log(u.organization_id, u.id, "activity_updated", "activity", a.id, `${u.full_name} changed ${changed.join(", ")}`);
  evaluateOrg(u.organization_id); return activityOut(a);
});
on("DELETE", "/activities/:id", (u, _, id) => {
  manage(u); const a = getActivity(u, id);
  db.activities = db.activities.filter((x) => x.id !== a.id); db.requirements = db.requirements.filter((r) => r.activity_id !== a.id); db.evidence = db.evidence.filter((e) => e.activity_id !== a.id);
  for (const x of db.activities) if (x.depends_on_id === a.id) x.depends_on_id = null;
  db.flags = db.flags.filter((f) => !(f.subject_type === "activity" && f.subject_id === a.id));
  log(u.organization_id, u.id, "activity_deleted", "activity", a.id, `Deleted ${a.title}`); evaluateOrg(u.organization_id); return null;
});
on("POST", "/activities/:id/complete", (u, _, id) => {
  const a = getActivity(u, id); workOn(a, u);
  if (a.status === "done") E(409, "This activity is already complete.");
  const dep = a.depends_on_id && byId("activities", a.depends_on_id); if (dep && dep.status !== "done") E(409, `Finish '${dep.title}' first; this activity depends on it.`);
  const c = byId("commitments", a.commitment_id); const before = pace(c); const miss = missing(a);
  if (miss.length) { a.completion_refused_at = nowIso(); log(u.organization_id, u.id, "completion_refused", "activity", a.id, `Completion refused. Missing: ${miss.join(", ")}`); evaluateOrg(u.organization_id);
    E(422, { message: "Attach the required proof before completing.", missing: miss }); }
  a.status = "done"; a.completed_at = nowIso(); log(u.organization_id, u.id, "activity_completed", "activity", a.id, `Marked complete by ${u.full_name}`);
  const closed = evaluateOrg(u.organization_id);
  return { activity: activityOut(a), pace_before: before, pace_after: pace(c), flags_closed: closed };
});
on("POST", "/activities/:id/reopen", (u, _, id) => {
  manage(u); const a = getActivity(u, id); if (a.status !== "done") E(409, "Only completed activities can be reopened.");
  a.status = "in_progress"; a.completed_at = null; log(u.organization_id, u.id, "activity_reopened", "activity", a.id, `Reopened by ${u.full_name}`); evaluateOrg(u.organization_id); return activityOut(a);
});
function reqFor(a, rid, kind) { if (!rid) return null; const r = reqsOf(a.id).find((x) => x.id === rid); need(r, "That proof item does not belong to this activity."); need(r.kind === kind, `'${r.label}' expects a ${r.kind}, not a ${kind}.`); return r; }
function afterEvidence(u, a, summary) { if (a.status === "not_started") a.status = "in_progress"; log(u.organization_id, u.id, "evidence_added", "activity", a.id, summary); evaluateOrg(u.organization_id); return activityOut(a); }
on("POST", "/activities/:id/evidence", (u, { body }, id) => {
  const a = getActivity(u, id); workOn(a, u); if (a.status === "done") E(409, "Reopen the activity before changing its proof.");
  if (body.kind === "value") { need(body.value_number != null && !Number.isNaN(body.value_number), "Enter a number."); need(body.value_number >= 0, "The number cannot be negative."); }
  if (body.kind === "note") need((body.text || "").trim(), "Write the note before saving it.");
  const r = reqFor(a, body.requirement_id, body.kind); const ex = r && evOf(a.id).find((e) => e.requirement_id === r.id);
  if (ex) Object.assign(ex, { value_number: body.value_number ?? null, text: body.text ?? null, captured_by_id: u.id, captured_at: nowIso() });
  else db.evidence.push({ id: uid(), activity_id: a.id, requirement_id: r?.id || null, kind: body.kind, value_number: body.value_number ?? null, text: body.text ?? null, file_name: null, file_url: null, file_size: null, captured_by_id: u.id, captured_at: nowIso() });
  return afterEvidence(u, a, `${u.full_name} recorded ${r ? r.label : body.kind}: ${body.kind === "value" ? body.value_number : "note"}`);
});
on("POST", "/activities/:id/evidence/file", async (u, { form }, id) => {
  const a = getActivity(u, id); workOn(a, u); if (a.status === "done") E(409, "Reopen the activity before changing its proof.");
  const file = form.get("file"); const r = reqFor(a, form.get("requirement_id"), "file");
  need(file && file.size, "That file is empty."); if (file.size > 10 * 1024 * 1024) E(413, "Files must be 10 MB or smaller.");
  need(/\.(jpe?g|png|webp|heic|pdf|docx?|xlsx?|csv|txt)$/i.test(file.name), "Upload a photo, PDF, Word, Excel, CSV or text file.");
  let url = null;
  if (file.size < 600 * 1024) url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(file); });
  db.evidence.push({ id: uid(), activity_id: a.id, requirement_id: r?.id || null, kind: "file", value_number: null, text: null, file_name: file.name, file_url: url, file_size: file.size, captured_by_id: u.id, captured_at: nowIso() });
  return afterEvidence(u, a, `${u.full_name} attached ${file.name}`);
});
on("DELETE", "/evidence/:id", (u, _, id) => {
  const e = byId("evidence", id); if (!e) E(404, "Evidence not found."); const a = getActivity(u, e.activity_id); workOn(a, u);
  if (a.status === "done") E(409, "Reopen the activity before removing its proof.");
  db.evidence = db.evidence.filter((x) => x.id !== e.id); log(u.organization_id, u.id, "evidence_removed", "activity", a.id, `${u.full_name} removed ${e.file_name || e.kind}`);
  evaluateOrg(u.organization_id); return activityOut(a);
});

const RANK = { high: 0, medium: 1, low: 2 };
on("GET", "/flags", (u, { params }) => {
  evaluateOrg(u.organization_id);
  const state = params.state || "open";
  let fs = T("flags").filter((f) => f.organization_id === u.organization_id && f.status === state);
  if (params.mine) fs = fs.filter((f) => f.owner_id === u.id);
  if (params.rule) fs = fs.filter((f) => f.rule === params.rule);
  if (params.project_id) fs = fs.filter((f) => f.project_id === params.project_id);
  fs.sort(state === "resolved" ? (a, b) => b.resolved_at.localeCompare(a.resolved_at) : (a, b) => RANK[a.severity] - RANK[b.severity] || a.opened_at.localeCompare(b.opened_at));
  const counts = {}; for (const f of T("flags")) if (f.organization_id === u.organization_id && f.status === "open") counts[f.rule] = (counts[f.rule] || 0) + 1;
  return { items: fs.slice(0, 100).map(flagOut), counts };
});
const getFlag = (u, id) => inOrg(u, byId("flags", id), "Flag");
on("GET", "/flags/:id/history", (u, _, id) => { const f = getFlag(u, id); return T("audit").filter((e) => e.subject_id === f.id || e.subject_id === f.subject_id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30).map(auditOut); });
on("POST", "/flags/:id/resolve", (u, { body }, id) => {
  manage(u); const f = getFlag(u, id); if (f.status === "resolved") E(409, "This flag is already resolved."); need((body.note || "").trim().length >= 3, "Write a short resolution note.");
  Object.assign(f, { status: "resolved", resolved_at: nowIso(), resolved_by_id: u.id, resolution_note: body.note });
  log(u.organization_id, u.id, "flag_resolved", "flag", f.id, `${u.full_name} resolved: ${body.note}`); return flagOut(f);
});
on("POST", "/flags/:id/snooze", (u, { body }, id) => {
  manage(u); const f = getFlag(u, id); if (f.status === "resolved") E(409, "Resolved flags cannot be snoozed.");
  Object.assign(f, { status: "snoozed", snoozed_until: addDays(TODAY, body.days) }); log(u.organization_id, u.id, "flag_snoozed", "flag", f.id, `Snoozed ${body.days} days by ${u.full_name}`); return flagOut(f);
});
on("POST", "/flags/:id/reassign", (u, { body }, id) => {
  manage(u); const f = getFlag(u, id); const nu = byId("users", body.owner_id); need(nu && nu.organization_id === u.organization_id, "Choose someone in your organization.");
  f.owner_id = nu.id; if (f.subject_type === "activity") { const a = byId("activities", f.subject_id); if (a) { a.owner_id = nu.id; log(u.organization_id, u.id, "activity_reassigned", "activity", a.id, `Reassigned to ${nu.full_name}`); } }
  log(u.organization_id, u.id, "flag_reassigned", "flag", f.id, `Reassigned to ${nu.full_name}`); return flagOut(f);
});
on("POST", "/flags/:id/follow-up", (u, { body }, id) => {
  manage(u); const f = getFlag(u, id);
  const c = f.subject_type === "commitment" ? byId("commitments", f.subject_id) : byId("commitments", byId("activities", f.subject_id)?.commitment_id);
  if (!c) E(409, "The item this flag was about no longer exists."); const p = byId("projects", c.project_id);
  need((body.title || "").trim().length >= 2, "Enter a title."); need(body.due_on && p.starts_on <= body.due_on && body.due_on <= p.ends_on, "Due date must fall inside the project dates.");
  const a = { id: uid(), commitment_id: c.id, owner_id: body.owner_id || f.owner_id, depends_on_id: null, title: body.title.trim(), notes: `Follow-up to flag: ${f.title}`, due_on: body.due_on, status: "not_started", completed_at: null, completion_refused_at: null };
  db.activities.push(a); db.requirements.push({ id: uid(), activity_id: a.id, kind: "note", label: "What was done", is_required: true, counts_toward_target: false, position: 0 });
  log(u.organization_id, u.id, "activity_created", "activity", a.id, `Follow-up created from flag '${f.title}'`); log(u.organization_id, u.id, "follow_up_added", "flag", f.id, `Follow-up: ${a.title}`);
  evaluateOrg(u.organization_id); return { activity_id: a.id };
});

function snapshot(p, start, end, u) {
  const asOf = end < TODAY ? end : TODAY; const W = { on_track: "On track", at_risk: "At risk", overdue: "Overdue", done: "Complete" };
  const rows = [], series = [], items = [];
  for (const c of commitmentsOf(p.id)) {
    const pc = pace(c, asOf);
    rows.push({ commitment_id: c.id, title: c.title, unit: c.unit, target: pc.target, expected: pc.expected, actual: pc.actual, variance: Math.round((pc.actual - pc.expected) * 10) / 10, status: pc.status, status_label: W[pc.status], due_on: c.due_on });
    if (c.measure === "sum") { const pts = []; for (let d = p.starts_on; d < asOf; d = addDays(d, 7)) pts.push({ date: d, value: actualValue(c, d) }); pts.push({ date: asOf, value: actualValue(c, asOf) });
      series.push({ commitment_id: c.id, title: c.title, unit: c.unit, target: pc.target, start: p.starts_on, due_on: c.due_on, points: pts }); }
    for (const a of activitiesOf(c.id)) for (const e of evOf(a.id)) { const d = e.captured_at.slice(0, 10); if (d >= start && d <= end) {
      const r = e.requirement_id && byId("requirements", e.requirement_id);
      items.push({ id: e.id, activity: a.title, commitment: c.title, label: r ? r.label : e.kind, kind: e.kind, value: e.value_number, text: e.text, file_name: e.file_name, file_url: e.file_url, date: d }); } }
  }
  const counts = {}; items.forEach((i) => { counts[i.label] = (counts[i.label] || 0) + 1; });
  const issues = T("flags").filter((f) => f.project_id === p.id && ["behind_pace", "overdue", "missing_proof", "blocked"].includes(f.rule) && f.opened_at.slice(0, 10) <= end && (!f.resolved_at || f.resolved_at.slice(0, 10) >= start))
    .sort((a, b) => a.opened_at.localeCompare(b.opened_at)).map((f) => ({ rule: f.rule, title: f.title, detail: f.detail, opened: f.opened_at.slice(0, 10), status: f.status, resolution: f.resolution_note }));
  const good = rows.filter((r) => r.status === "on_track" || r.status === "done");
  const parts = [`${good.length} of ${rows.length} commitments are on track or complete.`];
  rows.filter((r) => r.status === "at_risk" || r.status === "overdue").forEach((r) => parts.push(`${r.title} stands at ${n(r.actual)} of ${n(r.target)} ${r.unit} against ${n(r.expected)} expected${r.status === "overdue" ? " and is past its due date." : "."}`));
  parts.push(`${items.length} pieces of evidence were recorded in the period.`);
  return { project: { id: p.id, name: p.name, starts_on: p.starts_on, ends_on: p.ends_on }, stakeholder: stake(p.stakeholder_id)?.name || null,
    period: { start, end, as_of: asOf }, summary: parts.join(" "), rows, series, issues,
    evidence: { total: items.length, by_label: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })), items },
    organization: orgOf(u).name, generated_by: u.full_name };
}
const reportItem = (r) => ({ id: r.id, project_id: r.project_id, period_start: r.period_start, period_end: r.period_end, created_at: r.created_at, generated_by: userMini(r.generated_by_id) });
on("POST", "/projects/:id/reports", (u, { body }, id) => {
  manage(u); const p = getProject(u, id); need(body.period_start && body.period_end, "Choose the period."); need(body.period_end >= body.period_start, "The period must end after it starts.");
  evaluateOrg(u.organization_id);
  const r = { id: uid(), project_id: p.id, period_start: body.period_start, period_end: body.period_end, generated_by_id: u.id, created_at: nowIso(), snapshot: snapshot(p, body.period_start, body.period_end, u) };
  db.reports.push(r); log(u.organization_id, u.id, "report_generated", "report", r.id, `Report for ${p.name}, ${r.period_start} to ${r.period_end}`); return { ...reportItem(r), snapshot: r.snapshot };
});
on("GET", "/projects/:id/reports", (u, _, id) => { const p = getProject(u, id); return T("reports").filter((r) => r.project_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(reportItem); });
on("GET", "/reports", (u) => T("reports").filter((r) => byId("projects", r.project_id)?.organization_id === u.organization_id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(reportItem));
on("GET", "/reports/:id", (u, _, id) => { const r = byId("reports", id); if (!r || byId("projects", r.project_id)?.organization_id !== u.organization_id) E(404, "Report not found."); return { ...reportItem(r), snapshot: r.snapshot }; });

export async function handle(method, path, { body, form, params, token }) {
  load();
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call so loading states are visible
  for (const rt of routes) {
    if (rt.method !== method) continue;
    const m = path.match(rt.re); if (!m) continue;
    const isPublic = path === "/auth/login" || path === "/auth/register" || path.startsWith("/public/") || path.startsWith("/platform");
    const user = isPublic ? null : current(token);
    try {
      const out = await rt.fn(user, { body: body || {}, form, params: params || {} }, ...m.slice(1));
      save();
      return out == null ? null : JSON.parse(JSON.stringify(out));
    } catch (e) { save(); throw e; }
  }
  E(404, "Not found.");
}

// =====================================================================================
// ERP modules (mirror of backend/app/erp.py and routers/erp.py), driven by modules.json
// =====================================================================================
const MODS = Object.fromEntries(SPEC.modules.map((m) => [m.key, m]));
const CORE_LABEL = { stakeholders: ["stakeholders", "name"], projects: ["projects", "name"], users: ["users", "full_name"] };
const mrows = (key) => (db.m[key] ||= []);
function refLabel(ref, id) {
  if (!id) return null;
  if (CORE_LABEL[ref]) { const [t, c] = CORE_LABEL[ref]; return byId(t, id)?.[c] ?? null; }
  const r = mrows(ref).find((x) => x.id === id); return r ? String(r[MODS[ref].title_field] ?? "") : null;
}
function computed(key, r) {
  if (key === "budget_lines") {
    const spent = mrows("expenses").filter((e) => e.budget_line_id === r.id && ["approved", "paid"].includes(e.status)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const a = Number(r.amount || 0); return { spent, remaining: a - spent, used_pct: a ? Math.round((spent / a) * 1000) / 10 : 0 };
  }
  if (key === "items") return { stock: mrows("stock_moves").filter((x) => x.item_id === r.id).reduce((s, x) => s + Number(x.quantity) * (x.direction === "in" ? 1 : -1), 0) };
  if (key === "customers") { const inv = mrows("invoices").filter((i) => i.customer_id === r.id);
    return { billed: inv.filter((i) => i.status !== "void").reduce((a, i) => a + Number(i.amount), 0), outstanding: inv.filter((i) => i.status === "sent").reduce((a, i) => a + Number(i.amount), 0) }; }
  if (key === "volunteers") return { hours: mrows("volunteer_hours").filter((x) => x.volunteer_id === r.id).reduce((s, x) => s + Number(x.hours), 0) };
  return {};
}
function mser(key, r) {
  const m = MODS[key]; const d = { ...r };
  for (const f of m.fields) if (f.type === "ref") d[`${f.key}_label`] = refLabel(f.ref, r[f.key]);
  d.created_by_label = refLabel("users", r.created_by_id);
  d._title = String(r[m.title_field] ?? "") || m.singular;
  return { ...d, ...computed(key, r) };
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function coerce(org, f, v) {
  if (v === null || v === undefined || v === "") return null;
  const bad = (msg) => { throw Object.assign(new HttpError(422, msg), { data: { detail: msg, errors: [{ field: f.key, message: msg }] } }); };
  switch (f.type) {
    case "number": case "money": {
      const n2 = Number(v); if (Number.isNaN(n2)) bad(`${f.label} is not valid.`);
      if (f.type === "money" && n2 < 0) bad(`${f.label} cannot be negative.`);
      if (f.min != null && n2 < f.min) bad(`${f.label} must be at least ${f.min}.`);
      if (f.max != null && n2 > f.max) bad(`${f.label} must be at most ${f.max}.`);
      return n2; }
    case "date": if (!/^\d{4}-\d{2}-\d{2}/.test(String(v))) bad(`${f.label} is not valid.`); return String(v).slice(0, 10);
    case "bool": return !!v;
    case "select": if (!f.options.some((o) => o[0] === String(v))) bad(`Choose a valid ${f.label.toLowerCase()}.`); return String(v);
    case "email": if (!EMAIL_RE.test(String(v))) bad("Enter a valid email address."); return String(v).trim().toLowerCase();
    case "file": if (typeof v !== "object" || !v.url && v.url !== "") bad(`Upload a file for ${f.label.toLowerCase()}.`); return { name: v.name || "file", url: v.url, size: v.size ?? null };
    case "ref": {
      const ok = CORE_LABEL[f.ref] ? byId(CORE_LABEL[f.ref][0], v)?.organization_id === org : mrows(f.ref).some((x) => x.id === v && x.organization_id === org);
      if (!ok) bad(`Choose a ${f.label.toLowerCase()} from your organization.`); return v; }
    default: { const s2 = String(v).trim(); if (f.type === "text" && s2.length > 500) bad(`${f.label} is too long.`); return s2; }
  }
}
function mvalidate(org, m, data, existing, rid) {
  const known = Object.fromEntries(m.fields.map((f) => [f.key, f])); const clean = {};
  for (const [k, v] of Object.entries(data)) if (known[k]) clean[k] = coerce(org, known[k], v);
  const merged = { ...(existing || {}), ...clean };
  const fail = (code, msg, field) => { throw Object.assign(new HttpError(code, msg), { data: { detail: msg, errors: field ? [{ field, message: msg }] : [] } }); };
  for (const f of m.fields) {
    if (f.required && (merged[f.key] === null || merged[f.key] === undefined || merged[f.key] === "")) fail(422, `${f.label} is required.`, f.key);
    if (f.after && merged[f.key] && merged[f.after] && merged[f.key] < merged[f.after]) fail(422, `${f.label} must be on or after ${known[f.after].label.toLowerCase()}.`, f.key);
    if (f.unique && clean[f.key] && mrows(m.key).some((x) => x.organization_id === org && x.id !== rid && String(x[f.key] || "").toLowerCase() === String(clean[f.key]).toLowerCase())) fail(409, `That ${f.label.toLowerCase()} is already used.`, f.key);
  }
  const ov = m.no_overlap;
  if (ov && merged[ov.resource] && merged[ov.start] && merged[ov.end] && !(m.status && existing && ov.ignore_status.includes(existing[m.status.field]))) {
    const clash = mrows(m.key).find((x) => x.organization_id === org && x.id !== rid && x[ov.resource] === merged[ov.resource] && x[ov.start] <= merged[ov.end] && x[ov.end] >= merged[ov.start] && !(m.status && ov.ignore_status.includes(x[m.status.field])));
    if (clash) fail(409, `Already booked by ${clash[m.title_field]} from ${fmt(clash[ov.start])} to ${fmt(clash[ov.end])}. Choose other dates.`, ov.start);
  }
  if (m.single && !existing && mrows(m.key).some((x) => x.organization_id === org)) fail(409, `${m.label} already exist. Edit them instead.`);
  return clean;
}
const roleOk = (u, roles) => roles.includes(u.role);
const getRec = (u, key, id) => { const r = mrows(key).find((x) => x.id === id && x.organization_id === u.organization_id); if (!r) E(404, `${MODS[key].singular} not found.`); return r; };
const needMod = (key) => { if (!MODS[key]) E(404, "Unknown module."); return MODS[key]; };

on("GET", "/modules", () => SPEC);
on("GET", "/m/:key", (u, { params }, key) => {
  const m = needMod(key); let rs = mrows(key).filter((r) => r.organization_id === u.organization_id);
  if (params.q) { const q = params.q.toLowerCase(); const cols = m.fields.filter((f) => f.search).map((f) => f.key); rs = rs.filter((r) => cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))); }
  if (m.status && params.status) rs = rs.filter((r) => r[m.status.field] === params.status);
  for (const f of m.fields) { const v = params[f.key]; if (f.filter && v !== undefined && v !== "") rs = rs.filter((r) => f.type === "bool" ? !!r[f.key] === (v === "true") : ["text", "email"].includes(f.type) ? String(r[f.key] ?? "").toLowerCase().includes(v.toLowerCase()) : String(r[f.key] ?? "") === v); }
  const sort = params.sort || "created_at", dir = params.dir === "asc" ? 1 : -1;
  rs = rs.map((r) => mser(key, r)).sort((a, b) => { const x = a[sort], y = b[sort]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; });
  const page = Number(params.page || 1), size = Number(params.page_size || 25);
  return { items: rs.slice((page - 1) * size, page * size), total: rs.length, page, page_size: size };
});
on("GET", "/m/:key/:id", (u, _, key, id) => { needMod(key); const r = getRec(u, key, id);
  return { ...mser(key, r), _history: T("audit").filter((h) => h.organization_id === u.organization_id && h.subject_id === id).sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).slice(0, 40).map(auditOut) }; });
on("POST", "/m/:key", (u, { body }, key) => {
  const m = needMod(key); if (!roleOk(u, m.create)) E(403, "Your role does not allow this action.");
  const data = { ...body }; for (const f of m.fields) if (f.default_me && !data[f.key]) data[f.key] = u.id;
  const clean = mvalidate(u.organization_id, m, data, null);
  const r = { id: uid(), organization_id: u.organization_id, created_by_id: u.id, created_at: nowIso(), updated_at: nowIso(), ...clean };
  if (m.status) r[m.status.field] = m.status.default;
  mrows(key).push(r); log(u.organization_id, u.id, `${key}_created`, key, r.id, `${u.full_name} added ${m.singular.toLowerCase()}: ${clean[m.title_field] ?? m.singular}`);
  evaluateOrg(u.organization_id); return mser(key, r);
});
on("PATCH", "/m/:key/:id", (u, { body }, key, id) => {
  const m = needMod(key); if (!roleOk(u, m.edit)) E(403, "Your role does not allow this action.");
  const r = getRec(u, key, id); const clean = mvalidate(u.organization_id, m, body, r, id);
  const changed = Object.keys(clean).filter((k) => JSON.stringify(r[k] ?? null) !== JSON.stringify(clean[k]));
  if (changed.length) { Object.assign(r, clean, { updated_at: nowIso() }); const lab = Object.fromEntries(m.fields.map((f) => [f.key, f.label.toLowerCase()]));
    log(u.organization_id, u.id, `${key}_updated`, key, id, `${u.full_name} changed ${changed.map((k) => lab[k]).join(", ")}`); }
  evaluateOrg(u.organization_id); return mser(key, r);
});
on("DELETE", "/m/:key/:id", (u, { params }, key, id) => {
  const m = needMod(key);
  if (!roleOk(u, m.delete)) E(403, `Only ${m.delete.map((r) => r + "s").join(" or ")} can delete ${m.label.toLowerCase()}.`);
  const r = getRec(u, key, id);
  const deps = [];
  for (const om of SPEC.modules) for (const f of om.fields) if (f.type === "ref" && f.ref === key && (f.required || f.cascade)) {
    const n2 = mrows(om.key).filter((x) => x[f.key] === id).length; if (n2) deps.push({ module: om.key, label: om.label.toLowerCase(), count: n2, field: f.key, cascade: !!f.cascade });
  }
  const blocking = deps.filter((d) => !d.cascade);
  if (blocking.length) E(409, `${r[m.title_field]} is still used by ${blocking.map((d) => `${d.count} ${d.label}`).join(", ")}. Remove or reassign those first.`);
  if (deps.length && params.cascade !== "true") E(409, `CASCADE:${r[m.title_field]} has ${deps.map((d) => `${d.count} ${d.label}`).join(", ")}. Delete them too?`);
  for (const d of deps) db.m[d.module] = mrows(d.module).filter((x) => x[d.field] !== id);
  for (const om of SPEC.modules) for (const f of om.fields) if (f.type === "ref" && f.ref === key) mrows(om.key).forEach((x) => { if (x[f.key] === id) x[f.key] = null; });
  db.m[key] = mrows(key).filter((x) => x.id !== id); db.flags = db.flags.filter((f) => f.subject_id !== id);
  log(u.organization_id, u.id, `${key}_deleted`, key, id, `${u.full_name} deleted ${m.singular.toLowerCase()}: ${r[m.title_field] ?? ""}`); evaluateOrg(u.organization_id); return null;
});
on("POST", "/m/:key/:id/transition", (u, { body }, key, id) => {
  const m = needMod(key); const st = m.status; if (!st) E(400, "This record has no workflow.");
  const r = getRec(u, key, id); const cur = r[st.field]; const labels = Object.fromEntries(st.options);
  const tr = st.transitions.find((x) => x.to === body.to && x.from.includes(cur)); if (!tr) E(409, `Cannot move from ${labels[cur]} to ${labels[body.to] || body.to}.`);
  if (!roleOk(u, tr.roles)) E(403, "Your role does not allow this step.");
  if (tr.not_creator && r.created_by_id === u.id) E(403, "Someone else must approve what you submitted.");
  const note = (body.note || "").trim();
  const fail = (msg, field) => { throw Object.assign(new HttpError(422, msg), { data: { detail: msg, errors: [{ field, message: msg }] } }); };
  if (tr.note && !note) fail("Add a short note explaining this.", "note");
  for (const k of tr.requires || []) if (!r[k]) fail(`Set ${m.fields.find((f) => f.key === k).label.toLowerCase()} first.`, k);
  for (const f of m.fields) if ((f.required_for || []).includes(body.to) && !r[f.key]) fail(`${f.label} is required before this can be ${labels[body.to].toLowerCase()}.`, f.key);
  r[st.field] = body.to; r.updated_at = nowIso();
  log(u.organization_id, u.id, `${key}_${body.to}`, key, id, `${u.full_name}: ${labels[cur]} → ${labels[body.to]}${note ? `. Note: ${note}` : ""}`);
  evaluateOrg(u.organization_id); return mser(key, r);
});
on("GET", "/options/:ref", (u, _, ref) => {
  if (CORE_LABEL[ref]) { const [t, c] = CORE_LABEL[ref]; return T(t).filter((x) => x.organization_id === u.organization_id && (ref !== "users" || x.is_active)).map((x) => ({ id: x.id, label: x[c] })).sort((a, b) => a.label.localeCompare(b.label)); }
  needMod(ref); return mrows(ref).filter((x) => x.organization_id === u.organization_id).map((x) => ({ id: x.id, label: String(x[MODS[ref].title_field] ?? "") })).sort((a, b) => a.label.localeCompare(b.label));
});
function approvalsFor(u) {
  const out = [];
  for (const m of SPEC.modules) {
    if (!m.status) continue; const steps = m.status.transitions.filter((x) => x.not_creator && roleOk(u, x.roles)); if (!steps.length) continue;
    const waiting = new Set(steps.flatMap((x) => x.from));
    for (const r of mrows(m.key).filter((x) => x.organization_id === u.organization_id && waiting.has(x[m.status.field]) && x.created_by_id !== u.id).sort((a, b) => a.created_at.localeCompare(b.created_at)))
      out.push({ ...mser(m.key, r), _module: m.key, _actions: steps.filter((x) => x.from.includes(r[m.status.field])).map((x) => ({ to: x.to, label: x.label, note: !!x.note })) });
  }
  return out;
}
on("GET", "/approvals", (u) => approvalsFor(u));
on("POST", "/uploads", async (u, { form }) => {
  const file = form.get("file"); if (!file || !file.size) E(422, "That file is empty.");
  if (file.size > 10 * 1024 * 1024) E(413, "Files must be 10 MB or smaller.");
  if (!/\.(jpe?g|png|webp|pdf|docx?|xlsx?|csv|txt)$/i.test(file.name)) E(422, "Upload a photo, PDF, Word, Excel, CSV or text file.");
  const url = file.size < 1200 * 1024 ? await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(""); fr.readAsDataURL(file); }) : "";
  return { name: file.name, url, size: file.size };
});

function erpDesired(org, put) {
  const mine = (k) => mrows(k).filter((r) => r.organization_id === org);
  for (const r of mine("budget_lines")) { const c = computed("budget_lines", r); const a = Number(r.amount || 0);
    if (a && c.spent > a) put("over_budget", "budget_lines", r.id, { severity: "high", owner_id: r.created_by_id, title: r.name, detail: `Spent ${c.spent.toLocaleString()} of ${a.toLocaleString()} budgeted (${c.used_pct}%).`, data: c, project_id: r.project_id || null });
    else if (a && c.used_pct >= 90) put("over_budget", "budget_lines", r.id, { severity: "medium", owner_id: r.created_by_id, title: r.name, detail: `${c.used_pct}% used: ${c.remaining.toLocaleString()} left.`, data: c, project_id: r.project_id || null }); }
  for (const [k, f, w] of [["expenses", "status", "submitted"], ["purchase_requests", "status", "submitted"], ["leave_requests", "status", "pending"]])
    for (const r of mine(k)) { const days = dnum(TODAY) - dnum(r.created_at); if (r[f] !== w || days <= 3) continue;
      const title = k === "leave_requests" ? `${refLabel("users", r.user_id)}: ${r.kind} leave` : String(r[MODS[k].title_field] || MODS[k].singular);
      put("approval_waiting", k, r.id, { severity: "medium", owner_id: null, title, detail: `${MODS[k].singular} waiting ${days} days for approval.`, data: {}, project_id: null }); }
  for (const r of mine("invoices")) { if (r.status !== "sent" || r.due_on >= TODAY) continue; const days = dnum(TODAY) - dnum(r.due_on);
    put("invoice_overdue", "invoices", r.id, { severity: days > 14 ? "high" : "medium", owner_id: r.created_by_id, title: `Invoice ${r.number}`, detail: `KES ${Number(r.amount).toLocaleString()} unpaid, ${days} days past due.`, data: {}, project_id: r.project_id || null }); }
  for (const r of mine("documents")) { if (!r.expires_on) continue; const days = dnum(r.expires_on) - dnum(TODAY); if (days > 30) continue;
    put("expiring", "documents", r.id, { severity: days < 0 ? "high" : "medium", owner_id: r.owner_id, title: r.title, detail: days < 0 ? `Expired ${-days} days ago.` : `Expires in ${days} days, on ${fmt(r.expires_on)}.`, data: {}, project_id: null }); }
  for (const r of mine("items")) { const s2 = computed("items", r).stock; if (r.reorder_level != null && s2 <= Number(r.reorder_level))
    put("low_stock", "items", r.id, { severity: s2 <= 0 ? "high" : "medium", owner_id: r.created_by_id, title: r.name, detail: `${s2} ${r.unit || ""} left; reorder at ${r.reorder_level}.`, data: {}, project_id: null }); }
  for (const r of mine("grants")) {
    if (["awarded", "reporting"].includes(r.stage) && r.next_report_due && dnum(r.next_report_due) - dnum(TODAY) <= 14) { const days = dnum(r.next_report_due) - dnum(TODAY);
      put("report_due", "grants", r.id, { severity: days < 0 ? "high" : "medium", owner_id: r.owner_id, title: r.title, detail: days < 0 ? `Report overdue by ${-days} days.` : `Report due in ${days} days, ${fmt(r.next_report_due)}.`, data: {}, project_id: r.project_id || null }); }
    else if (["prospect", "drafting"].includes(r.stage) && r.deadline && dnum(r.deadline) - dnum(TODAY) <= 10) { const days = dnum(r.deadline) - dnum(TODAY);
      put("report_due", "grants", r.id, { severity: days < 3 ? "high" : "medium", owner_id: r.owner_id, title: r.title, detail: days < 0 ? `Application deadline passed ${-days} days ago.` : `Application due in ${days} days, ${fmt(r.deadline)}.`, data: {}, project_id: r.project_id || null }); }
  }
}

const sumOf = (rs, k) => rs.reduce((s, r) => s + Number(r[k] || 0), 0);
on("GET", "/dashboard", (u) => {
  const org = u.organization_id; evaluateOrg(org); const mine = (k) => mrows(k).filter((r) => r.organization_id === org);
  const programmes = []; const statuses = [];
  for (const p of T("projects").filter((x) => x.organization_id === org && x.status === "active").sort((a, b) => a.name.localeCompare(b.name))) {
    const cs = commitmentsOf(p.id).map((c) => ({ id: c.id, title: c.title, unit: c.unit, due_on: c.due_on, pace: pace(c) }));
    statuses.push(...cs.map((c) => c.pace.status)); programmes.push({ id: p.id, name: p.name, commitments: cs });
  }
  const spentRows = mine("expenses").filter((e) => ["approved", "paid"].includes(e.status));
  const budget = sumOf(mine("budget_lines"), "amount"), spent = sumOf(spentRows, "amount");
  const months = []; const [ty, tm] = TODAY.split("-").map(Number);
  for (let i = 5; i >= 0; i--) { let y = ty, mm = tm - i; while (mm <= 0) { mm += 12; y--; } const key = `${y}-${String(mm).padStart(2, "0")}`;
    months.push({ month: `${key}-01`, spent: sumOf(spentRows.filter((e) => e.spent_on.startsWith(key)), "amount") }); }
  const byGender = {}; mine("participants").forEach((p) => { byGender[p.gender] = (byGender[p.gender] || 0) + 1; });
  const cnt = (s2) => statuses.filter((x) => x === s2).length;
  const org2 = byId("orgs", org); const inv = mine("invoices"), bk = mine("bookings");
  const low = mine("items").filter((r) => r.reorder_level != null && computed("items", r).stock <= Number(r.reorder_level)).length;
  const sev = { high: 0, medium: 1, low: 2 };
  return {
    installed: org2.installed_apps || [], industry: org2.industry,
    top_flags: T("flags").filter((f) => f.organization_id === org && f.status === "open").sort((a, b) => sev[a.severity] - sev[b.severity] || a.opened_at.localeCompare(b.opened_at)).slice(0, 6).map((f) => ({ rule: f.rule, title: f.title, detail: f.detail, severity: f.severity })),
    sales: { outstanding: sumOf(inv.filter((i) => i.status === "sent"), "amount"), paid: sumOf(inv.filter((i) => i.status === "paid"), "amount"), overdue: inv.filter((i) => i.status === "sent" && i.due_on < TODAY).length, drafts: inv.filter((i) => i.status === "draft").length },
    inventory: { items: mine("items").length, low_stock: low, units: mine("items").reduce((a, r) => a + computed("items", r).stock, 0) },
    bookings: { active: bk.filter((b) => ["confirmed", "checked_in"].includes(b.status) && b.ends_on >= TODAY).length, in_house: bk.filter((b) => b.status === "checked_in").length, value: sumOf(bk.filter((b) => b.status !== "cancelled" && b.ends_on >= TODAY), "amount") },
    today: TODAY, programmes,
    commitments: { total: statuses.length, on_track: cnt("on_track") + cnt("done"), at_risk: cnt("at_risk"), overdue: cnt("overdue") },
    finance: { awarded: sumOf(mine("grants").filter((g) => ["awarded", "reporting", "closed"].includes(g.stage)), "amount"),
      pipeline: sumOf(mine("grants").filter((g) => ["prospect", "drafting", "submitted"].includes(g.stage)), "amount"),
      received: sumOf(mine("income"), "amount"), budget, spent, used_pct: budget ? Math.round((spent / budget) * 1000) / 10 : 0, months },
    people: { volunteers_active: mine("volunteers").filter((v) => v.status === "active").length, volunteer_applicants: mine("volunteers").filter((v) => v.status === "applicant").length,
      hours_this_month: sumOf(mine("volunteer_hours").filter((h) => h.worked_on >= TODAY.slice(0, 8) + "01"), "hours"),
      participants: mine("participants").length, participants_by_gender: byGender },
    open_flags: T("flags").filter((f) => f.organization_id === org && f.status === "open").length,
    approvals_waiting: approvalsFor(u).length,
    upcoming_events: mine("events").filter((e) => e.status === "planned" && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((r) => mser("events", r)),
    reports_due: mine("grants").filter((g) => ["awarded", "reporting"].includes(g.stage) && g.next_report_due).sort((a, b) => a.next_report_due.localeCompare(b.next_report_due)).slice(0, 5).map((r) => mser("grants", r)),
  };
});
on("GET", "/finance/summary", (u) => {
  const org = u.organization_id; const lines = mrows("budget_lines").filter((r) => r.organization_id === org).map((r) => mser("budget_lines", r)).sort((a, b) => a.name.localeCompare(b.name));
  const withLines = new Set(lines.map((l) => l.grant_id).filter(Boolean));
  const grants = mrows("grants").filter((g) => g.organization_id === org && (withLines.has(g.id) || ["awarded", "reporting", "closed"].includes(g.stage))).map((g) => mser("grants", g)).sort((a, b) => a.title.localeCompare(b.title));
  const out = [];
  for (const gr of [...grants, { id: null, title: "Not linked to a grant", amount: 0 }]) {
    const ls = lines.filter((l) => (l.grant_id || null) === gr.id); if (!ls.length && gr.id === null) continue;
    const budget = sumOf(ls, "amount"), spent = ls.reduce((s, l) => s + l.spent, 0);
    out.push({ grant: gr, budget, spent, remaining: budget - spent, used_pct: budget ? Math.round((spent / budget) * 1000) / 10 : 0, lines: ls });
  }
  return out;
});
on("GET", "/calendar", (u, { params }) => {
  const org = u.organization_id, s2 = params.start, e2 = params.end, inR = (d) => d && d >= s2 && d <= e2, items = [], mine = (k) => mrows(k).filter((r) => r.organization_id === org);
  for (const r of mine("events")) if (inR(r.date)) items.push({ date: r.date, kind: "event", title: r.title, detail: r.venue || "", status: r.status, link: `/app/m/events/${r.id}` });
  for (const a of T("activities")) if (inR(a.due_on) && projectOfActivity(a).organization_id === org) items.push({ date: a.due_on, kind: "activity", title: a.title, detail: projectOfActivity(a).name, status: a.status, link: `/app/activities/${a.id}` });
  for (const g of mine("grants")) { const fl = refLabel("stakeholders", g.funder_id) || "";
    if (inR(g.next_report_due)) items.push({ date: g.next_report_due, kind: "report", title: `Report due: ${g.title}`, detail: fl, status: g.stage, link: `/app/m/grants/${g.id}` });
    if (inR(g.deadline)) items.push({ date: g.deadline, kind: "report", title: `Application deadline: ${g.title}`, detail: fl, status: g.stage, link: `/app/m/grants/${g.id}` }); }
  for (const l of mine("leave_requests")) if (l.status !== "declined" && l.starts_on <= e2 && l.ends_on >= s2) items.push({ date: l.starts_on > s2 ? l.starts_on : s2, kind: "leave", title: `${refLabel("users", l.user_id)} on leave to ${l.ends_on}`, detail: l.kind, status: l.status, link: `/app/m/leave_requests/${l.id}` });
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
});
const siteFor = (slug) => { const s2 = mrows("site_settings").find((r) => String(r.slug).toLowerCase() === String(slug).toLowerCase()); if (!s2) E(404, "This organization has no public page."); return s2; };
on("GET", "/public/:slug", (_, __, slug) => {
  const site = siteFor(slug), org = site.organization_id; const mine = (k) => mrows(k).filter((r) => r.organization_id === org);
  const programmes = mine("site_programmes").filter((r) => r.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((r) => ({ id: r.id, title: r.title, summary: r.summary, focus: r.focus, photo: r.photo, slug: r.slug || r.id,
    results: site.show_impact && r.project_id ? commitmentsOf(r.project_id).map((c) => ({ title: c.title, unit: c.unit, target: Number(c.target_value), actual: pace(c).actual })) : [] }));
  const projs = T("projects").filter((p) => p.organization_id === org);
  const people = ["people", "young", "youth", "participants", "educators", "leaders"];
  const impact = site.show_impact ? {
    people_reached: Math.round(projs.flatMap((p) => commitmentsOf(p.id)).filter((c) => c.measure === "sum" && people.some((w) => (c.unit || "").includes(w))).reduce((s3, c) => s3 + pace(c).actual, 0)),
    activities_done: projs.flatMap((p) => commitmentsOf(p.id)).flatMap((c) => activitiesOf(c.id)).filter((a) => a.status === "done").length,
    events_held: mine("events").filter((e) => e.status === "held").length, volunteer_hours: sumOf(mine("volunteer_hours"), "hours"),
    participants_registered: mine("participants").length,
    evidence_items: projs.flatMap((p) => commitmentsOf(p.id)).flatMap((c) => activitiesOf(c.id)).reduce((s3, a) => s3 + evOf(a.id).length, 0), as_of: TODAY } : null;
  const o = byId("orgs", org);
  return { organization: o.name, slug: site.slug, tagline: site.tagline, intro: site.intro, about: site.about, location: site.location, contact_email: site.contact_email, phone: site.phone,
    social: { facebook: site.facebook, twitter: site.twitter, instagram: site.instagram }, programmes,
    team: mine("site_team").filter((r) => r.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((r) => ({ name: r.name, role: r.role, bio: r.bio, photo: r.photo })),
    partners: T("stakeholders").filter((s3) => s3.organization_id === org && s3.kind === "partner").map((s3) => s3.name).sort(), impact };
});
function publicInsert(site, key, values, summary) {
  const m = MODS[key]; const r = { id: uid(), organization_id: site.organization_id, created_by_id: null, created_at: nowIso(), updated_at: nowIso(), [m.status.field]: m.status.default, ...values };
  mrows(key).push(r); log(site.organization_id, null, `${key}_created`, key, r.id, summary);
}
on("POST", "/public/:slug/volunteer", (_, { body }, slug) => {
  const site = siteFor(slug);
  if ((body.name || "").trim().length < 2) E(422, "Enter your name."); if ((body.phone || "").trim().length < 7) E(422, "Enter a phone number we can call.");
  if (body.email && !EMAIL_RE.test(body.email)) E(422, "Enter a valid email address.");
  publicInsert(site, "volunteers", { name: body.name.trim(), phone: body.phone.trim(), email: body.email || null, ward: body.ward || "", interest: body.interest || "any", skills: body.skills || "", source: "website" }, `Website: ${body.name.trim()} applied to volunteer`);
  return { ok: true, message: "Thank you. The team will call you within a week." };
});
on("POST", "/public/:slug/inquiry", (_, { body }, slug) => {
  const site = siteFor(slug);
  if ((body.name || "").trim().length < 2) E(422, "Enter your name."); if ((body.contact || "").trim().length < 5) E(422, "Enter an email or phone number.");
  if ((body.message || "").trim().length < 10) E(422, "Write a little more so we can help.");
  publicInsert(site, "inquiries", { name: body.name.trim(), contact: body.contact.trim(), kind: body.kind || "other", message: body.message.trim() }, `Website: message from ${body.name.trim()}`);
  return { ok: true, message: "Thank you. We have your message and will reply soon." };
});

// =====================================================================================
// Donations, stats, analytics, data collection, password change (mirror of backend)
// =====================================================================================
function postDonationIncome(d, actor) {
  const method = ["mpesa", "bank", "cash"].includes(d.method) ? d.method : "bank";
  mrows("income").push({ id: uid(), organization_id: d.organization_id, created_by_id: actor || null, created_at: nowIso(), updated_at: nowIso(),
    source: `Donation: ${d.anonymous ? "Anonymous donor" : d.donor_name}`, amount: Number(d.amount), received_on: TODAY, method, reference: d.reference, notes: d.message || null });
}
const _transitionRoute = routes.find((r) => r.method === "POST" && String(r.re) === String(/^\/m\/([^/]+)\/([^/]+)\/transition$/));
if (_transitionRoute) {
  const inner = _transitionRoute.fn;
  _transitionRoute.fn = (u, req, key, id) => {
    const before = key === "donations" ? mrows("donations").find((x) => x.id === id)?.status : null;
    const out = inner(u, req, key, id);
    if (key === "donations" && before === "pending" && out.status === "confirmed") postDonationIncome(mrows("donations").find((x) => x.id === id), u.id);
    return out;
  };
}
on("GET", "/m/:key/stats", (u, { params }, key) => {
  const m = needMod(key); const by = params.by, sumF = params.sum; const f = m.fields.find((x) => x.key === by);
  if (!f && !(m.status && m.status.field === by)) E(422, "Choose a field to group by.");
  let rs = mrows(key).filter((r) => r.organization_id === u.organization_id);
  for (const ff of m.fields) { const v = params[ff.key]; if (ff.filter && v && ff.key !== by) rs = rs.filter((r) => String(r[ff.key] ?? "") === v); }
  const g = {};
  for (const r of rs) { const k = r[by] ?? null; const kk = JSON.stringify(k); (g[kk] ||= { key: k, count: 0, sum: 0 }); g[kk].count++; if (sumF) g[kk].sum += Number(r[sumF] || 0); }
  const lab = (v) => {
    if (v === null) return "None";
    if (f?.type === "ref") return refLabel(f.ref, v) || "None";
    if (f?.type === "select") return Object.fromEntries(f.options)[v] || v;
    if (f?.type === "bool") return v ? "Yes" : "No";
    if (!f && m.status) return Object.fromEntries(m.status.options)[v] || v;
    return String(v);
  };
  return Object.values(g).map((x) => ({ ...x, label: lab(x.key), sum: sumF ? x.sum : x.count })).sort((a, b) => b.count - a.count);
});
routes.unshift(routes.pop()); // literal "/stats" must win over "/m/:key/:id"
on("GET", "/analytics", (u) => {
  const org = u.organization_id; const series = [];
  for (const p of T("projects").filter((x) => x.organization_id === org && x.status === "active").sort((a, b) => a.name.localeCompare(b.name)))
    for (const c of commitmentsOf(p.id)) {
      if (c.measure !== "sum") continue;
      const pts = []; for (let d = p.starts_on; d < TODAY; d = addDays(d, 14)) pts.push({ date: d, value: actualValue(c, d) });
      pts.push({ date: TODAY, value: actualValue(c, TODAY) });
      series.push({ programme: p.name, title: c.title, unit: c.unit, target: Number(c.target_value), start: p.starts_on, due_on: c.due_on, points: pts, pace: pace(c) });
    }
  const pts2 = mrows("participants").filter((r) => r.organization_id === org);
  const grp = (k, map = (v) => String(v)) => { const g = {}; pts2.forEach((r) => { const kk = map(r[k]); g[kk] = (g[kk] || 0) + 1; }); return Object.entries(g).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count); };
  const byProg = {}; pts2.forEach((r) => { const n2 = byId("projects", r.project_id)?.name || "None"; (byProg[n2] ||= { label: n2, female: 0, male: 0, other: 0 })[r.gender]++; });
  const sumBy = (rows, keyFn, valFn) => { const g = {}; rows.forEach((r) => { const k = keyFn(r); g[k] = (g[k] || 0) + valFn(r); }); return Object.entries(g).map(([label, value]) => ({ label, value })); };
  const lines = Object.fromEntries(mrows("budget_lines").map((b) => [b.id, b]));
  return {
    today: TODAY, series,
    participants: { gender: grp("gender"), age_band: grp("age_band"), ward: grp("ward"), disability: grp("disability", (v) => (v ? "Yes" : "No")), by_programme: Object.values(byProg) },
    volunteer_hours: sumBy(mrows("volunteer_hours").filter((r) => r.organization_id === org), (r) => byId("projects", r.project_id)?.name || "Not linked", (r) => Number(r.hours)),
    spending_by_category: sumBy(mrows("expenses").filter((r) => r.organization_id === org && ["approved", "paid"].includes(r.status)), (r) => lines[r.budget_line_id]?.category || "Other", (r) => Number(r.amount)),
    events: mrows("events").filter((r) => r.organization_id === org && r.status === "held").sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ title: r.title, date: r.date, expected: Number(r.expected || 0), attended: Number(r.attended || 0) })),
  };
});
// ---- public portfolio additions (services, stories, brand, donations progress)
const _portfolioRoute = routes.find((r) => r.method === "GET" && String(r.re) === String(/^\/public\/([^/]+)$/));
if (_portfolioRoute) {
  const inner = _portfolioRoute.fn;
  _portfolioRoute.fn = (u, req, slug) => {
    const out = inner(u, req, slug); const site = siteFor(slug); const org = site.organization_id; const mine = (k) => mrows(k).filter((r) => r.organization_id === org);
    const conf = mine("donations").filter((d) => d.status === "confirmed");
    const names = Object.fromEntries(T("projects").filter((p) => p.organization_id === org).map((p) => [p.id, p.name]));
    return { ...out, mission: site.mission, vision: site.vision, founded: site.founded, address: site.address, map_query: site.map_query,
      heading_font: site.heading_font || "inter", industry: byId("orgs", org).industry,
      logo: site.logo, phone2: site.phone2, work_intro: site.work_intro, story: site.story, goal: site.goal,
      values: (site.values || "").split("\n").map((v) => v.trim()).filter(Boolean), objectives: (site.objectives || "").split("\n").map((v) => v.trim()).filter(Boolean),
      images: Object.fromEntries(["hero_image", "about_image", "story_image", "objectives_image", "hero_work", "hero_contact", "hero_gallery", "goal_icon", "mission_icon", "vision_icon", "about_hero"].map((k) => [k, site[k] || null])),
      partner_logos: mine("site_partners").filter((r) => r.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((r) => ({ name: r.name, logo: r.logo, website: r.website })),
      brand: { primary: site.brand_primary || "#6D3FC9", accent: site.brand_accent || "#FFB020", deep: site.brand_deep || "#1B1530" },
      gallery: mine("site_gallery").filter((r) => r.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((r) => ({ id: r.id, caption: r.caption, photo: r.photo, place: r.place, taken_on: r.taken_on, programme: names[r.project_id] })),
      services: mine("site_services").filter((r) => r.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((r) => ({ title: r.title, description: r.description, icon: r.icon })),
      stories: mine("site_stories").filter((r) => r.published).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((r) => ({ id: r.id, title: r.title, programme: names[r.project_id], summary: r.summary, body: r.body, quote: r.quote, quote_by: r.quote_by, stat_value: r.stat_value, stat_label: r.stat_label })),
      donations: { campaign: site.donation_campaign, goal: Number(site.donation_goal || 0), raised: sumOf(conf, "amount"), donors: conf.length,
        recent: [...conf].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5).map((d) => ({ name: d.anonymous ? "Anonymous" : d.donor_name.split(" ")[0], amount: Number(d.amount) })) },
      projects: Object.entries(names).map(([id2, name]) => ({ id: id2, name })) };
  };
}
const DREF = () => `DN-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
on("POST", "/public/:slug/donations", (_, { body }, slug) => {
  const site = siteFor(slug);
  if (body.website) E(422, "Something went wrong. Please try again.");
  if ((body.name || "").trim().length < 2) E(422, "Enter your name."); if ((body.contact || "").trim().length < 5) E(422, "Enter your phone number or email.");
  const amt = Number(body.amount); if (!(amt >= 50 && amt <= 1000000)) E(422, "Donations are between KES 50 and KES 1,000,000.");
  if (!["mpesa", "card"].includes(body.method)) E(422, "Choose M-Pesa or card.");
  if (body.method === "mpesa") { const dg = String(body.contact).replace(/\D/g, ""); if (!/^(0[17]\d{8}|254[17]\d{8}|[17]\d{8})$/.test(dg)) E(422, "Enter a Safaricom number like 0712 345 678."); }
  const d = { id: uid(), organization_id: site.organization_id, created_by_id: null, created_at: nowIso(), updated_at: nowIso(), donor_name: body.name.trim(), contact: body.contact.trim(),
    amount: amt, method: body.method, project_id: body.project_id || null, anonymous: !!body.anonymous, reference: DREF(), provider_ref: null, message: (body.message || "").trim() || null, status: "pending" };
  d.provider_ref = `SIM-${d.reference}`; mrows("donations").push(d);
  log(site.organization_id, null, "donations_created", "donations", d.id, `Website: donation of ${amt.toLocaleString()} started (${body.method})`);
  return { id: d.id, reference: d.reference, status: "pending", mode: "sandbox", instructions: "Sandbox payment: no money will move. Use the buttons to complete or cancel it." };
});
const findDonation = (slug, id2, ref) => { const site = siteFor(slug); const d = mrows("donations").find((x) => x.id === id2 && x.organization_id === site.organization_id); if (!d || d.reference !== ref) E(404, "Donation not found."); return d; };
const dOut = (d) => ({ id: d.id, reference: d.reference, status: d.status, amount: Number(d.amount), method: d.method });
on("GET", "/public/:slug/donations/:id", (_, { params }, slug, id2) => dOut(findDonation(slug, id2, params.ref)));
on("POST", "/public/:slug/donations/:id/simulate", (_, { body }, slug, id2) => {
  const d = findDonation(slug, id2, body.ref);
  if (d.status === "pending") {
    const ok = body.outcome === "success"; d.status = ok ? "confirmed" : "failed"; d.updated_at = nowIso();
    if (ok) postDonationIncome(d);
    log(d.organization_id, null, `donations_${d.status}`, "donations", d.id, `Sandbox payment ${ok ? "completed" : "cancelled"} for ${d.reference}`);
  }
  return dOut(d);
});
// ---- data collection and field tracking (mirror of routers/forms.py)
const FTYPES = new Set(["text", "textarea", "number", "select", "multi", "yesno", "rating", "date", "gps", "photo"]);
const forms = () => (db.forms ||= []); const subs = () => (db.form_submissions ||= []);
function vErr(msg, field) { throw Object.assign(new HttpError(422, msg), { data: { detail: { message: msg, field }, errors: field ? [{ field, message: msg }] : [] } }); }
function validateForm(b) {
  if ((b.title || "").trim().length < 2) vErr("Give the form a title.", "title");
  if (!Array.isArray(b.fields) || !b.fields.length) vErr("Add at least one question.");
  if (b.fields.length > 60) vErr("Up to 60 questions.");
  const ids = new Set();
  for (const f of b.fields) {
    if (!/^[a-z0-9_]{1,40}$/.test(f.id || "")) vErr("Question ids use lowercase letters, numbers and underscores.");
    if (ids.has(f.id)) vErr("Each question needs a different id.");
    if (!(f.label || "").trim()) vErr("Every question needs a label.");
    if (!FTYPES.has(f.type)) vErr("Unknown question type.");
    if (["select", "multi"].includes(f.type) && (f.options || []).filter((o) => o.trim()).length < 2) vErr(`'${f.label}' needs at least two choices.`);
    if (f.show_if && !ids.has(f.show_if.field)) vErr(`'${f.label}' can only depend on a question that comes before it.`);
    ids.add(f.id);
  }
  const target = b.target ? Number(b.target) : null; if (target !== null && !(target >= 1)) vErr("Target must be a positive number.", "target");
  return { title: b.title.trim(), description: b.description || "", project_id: b.project_id || null, is_public: !!b.is_public, status: ["draft", "open", "closed"].includes(b.status) ? b.status : "open",
    target, collect_gps: !!b.collect_gps,
    fields: b.fields.map((f) => ({ id: f.id, label: f.label.trim(), type: f.type, required: !!f.required, options: (f.options || []).map((o) => o.trim()).filter(Boolean), min: f.min ?? null, max: f.max ?? null, show_if: f.show_if && f.show_if.field ? { field: f.show_if.field, equals: String(f.show_if.equals) } : null })) };
}
function visibleQ(f, data) {
  const c = f.show_if; if (!c) return true; const v = data[c.field];
  if (Array.isArray(v)) return v.includes(c.equals); if (typeof v === "boolean") return c.equals.toLowerCase() === (v ? "yes" : "no");
  return v !== undefined && v !== null && String(v) === c.equals;
}
function parseGps(v) {
  if (typeof v === "string") { const p2 = v.replace(";", ",").split(",").map((x) => x.trim()); if (p2.length < 2) throw new Error("bad"); v = { lat: p2[0], lng: p2[1] }; }
  const lat = Number(v.lat), lng = Number(v.lng); if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) || Number.isNaN(lat) || Number.isNaN(lng)) throw new Error("bad");
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, accuracy: v.accuracy == null || v.accuracy === "" ? null : Math.round(Number(v.accuracy) * 10) / 10 };
}
function validateAnswers(fields, data) {
  const out = {};
  for (const f of fields) {
    if (!visibleQ(f, { ...data, ...out })) continue;
    let v = data[f.id]; const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && v && !Array.isArray(v) && !Object.keys(v).length);
    if (empty) { if (f.required) vErr(`Answer '${f.label}'.`, f.id); continue; }
    const bad = () => vErr(`Check your answer to '${f.label}'.`, f.id);
    try {
      if (f.type === "number") { v = Number(v); if (Number.isNaN(v) || (f.min != null && v < f.min) || (f.max != null && v > f.max)) bad(); }
      else if (f.type === "rating") { v = Number(v); if (!(v >= 1 && v <= 5)) bad(); }
      else if (f.type === "yesno") { if (typeof v === "string") v = v.trim().toLowerCase(); if (![true, false, "yes", "no", "y", "n", "true", "false", "1", "0"].includes(v)) bad(); v = [true, "yes", "y", "true", "1"].includes(v); }
      else if (f.type === "select") { const m2 = f.options.find((o) => o.toLowerCase() === String(v).trim().toLowerCase()); if (!m2) bad(); v = m2; }
      else if (f.type === "multi") { const items = Array.isArray(v) ? v : String(v).split(";").map((x) => x.trim()).filter(Boolean); const norm = Object.fromEntries(f.options.map((o) => [o.toLowerCase(), o])); if (items.some((x) => !norm[x.toLowerCase()])) bad(); v = [...new Set(items.map((x) => norm[x.toLowerCase()]))]; }
      else if (f.type === "gps") v = parseGps(v);
      else if (f.type === "photo") { if (!v || typeof v !== "object" || !String(v.url || "").match(/^(\/files\/[0-9a-f]{32}\.(jpg|jpeg|png|webp)|data:image\/(jpeg|png|webp);base64,)/)) bad(); v = { url: v.url, name: String(v.name || "photo").slice(0, 120) }; }
      else if (f.type === "date") v = String(v).slice(0, 10);
      else v = String(v).trim().slice(0, f.type === "text" ? 200 : 4000);
    } catch (e) { if (e instanceof HttpError) throw e; bad(); }
    out[f.id] = v;
  }
  return out;
}
const formOut = (f) => { const ss = subs().filter((s2) => s2.form_id === f.id); const last = ss.map((s2) => s2.created_at).sort().pop();
  return { ...f, project_name: f.project_id ? byId("projects", f.project_id)?.name : null, responses: ss.length, last_response_at: last || null, target: f.target ?? null, collect_gps: !!f.collect_gps, sheet_url: f.sheet_url || null, sheet_synced_at: f.sheet_synced_at || null }; };
const subOut = (s2) => ({ id: s2.id, data: s2.data, source: s2.source, collector: s2.collector || refLabel("users", s2.submitted_by_id), submitted_by: refLabel("users", s2.submitted_by_id), location: s2.location || null, created_at: s2.created_at, captured_at: s2.captured_at || null });
const getForm = (u, id2) => { const f = forms().find((x) => x.id === id2 && x.organization_id === u.organization_id); if (!f) E(404, "Form not found."); return f; };
const payloadOf = (body) => (body && typeof body.data === "object" && body.data && !Array.isArray(body.data) ? body : { data: body || {} });
function saveSub(f, p, source, u) {
  if (p.client_id) { const dup = subs().find((x) => x.form_id === f.id && x.client_id === p.client_id); if (dup) return [dup, false]; }
  const data = validateAnswers(f.fields, p.data);
  let loc = null;
  if (p.location) { try { loc = parseGps(p.location); } catch { E(422, "The location sent with this response is not valid."); } }
  else { const g = f.fields.find((x) => x.type === "gps" && data[x.id]); if (g) loc = data[g.id]; }
  const s2 = { id: uid(), form_id: f.id, organization_id: f.organization_id, data, source, submitted_by_id: u ? u.id : null, collector: (p.collector || "").trim().slice(0, 120) || (u ? u.full_name : null),
    client_id: p.client_id || null, location: loc, captured_at: p.captured_at || null, created_at: nowIso() };
  subs().push(s2); return [s2, true];
}
on("GET", "/forms", (u) => forms().filter((f) => f.organization_id === u.organization_id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(formOut));
on("POST", "/forms", (u, { body }) => { manage(u); const f = { id: uid(), organization_id: u.organization_id, created_by_id: u.id, created_at: nowIso(), ...validateForm(body) };
  forms().push(f); log(u.organization_id, u.id, "form_created", "form", f.id, `${u.full_name} created form '${f.title}'`); return formOut(f); });
on("GET", "/forms/:id", (u, _, id2) => formOut(getForm(u, id2)));
on("PUT", "/forms/:id", (u, { body }, id2) => { manage(u); const f = getForm(u, id2); Object.assign(f, validateForm(body)); log(u.organization_id, u.id, "form_updated", "form", f.id, `${u.full_name} updated form '${f.title}'`); return formOut(f); });
on("DELETE", "/forms/:id", (u, _, id2) => { adminOnly(u); const f = getForm(u, id2); db.forms = forms().filter((x) => x.id !== id2); db.form_submissions = subs().filter((s2) => s2.form_id !== id2);
  log(u.organization_id, u.id, "form_deleted", "form", f.id, `${u.full_name} deleted form '${f.title}' and its responses`); return null; });
on("GET", "/forms/:id/submissions", (u, { params }, id2) => { const f = getForm(u, id2);
  let ss = subs().filter((s2) => s2.form_id === f.id); if (params.since) ss = ss.filter((s2) => s2.created_at > params.since);
  ss.sort((a, b) => b.created_at.localeCompare(a.created_at)); return { total: ss.length, items: ss.map(subOut), server_time: nowIso() }; });
on("POST", "/forms/:id/submissions", (u, { body }, id2) => { if (u.role === "viewer") E(403, "Viewers cannot submit responses."); const f = getForm(u, id2); if (f.status !== "open") E(409, "This form is not accepting responses.");
  const [s2, created] = saveSub(f, payloadOf(body), "app", u); return { id: s2.id, duplicate: !created }; });
on("DELETE", "/forms/:id/submissions/:sid", (u, _, id2, sid) => { manage(u); const f = getForm(u, id2); if (!subs().some((s2) => s2.id === sid && s2.form_id === f.id)) E(404, "Response not found.");
  db.form_submissions = subs().filter((s2) => s2.id !== sid); log(u.organization_id, u.id, "form_response_deleted", "form", f.id, `${u.full_name} deleted a response to '${f.title}'`); return null; });
on("GET", "/forms/:id/tracker", (u, { params }, id2) => {
  const f = getForm(u, id2); const rows = subs().filter((s2) => s2.form_id === f.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const day = (r) => (r.captured_at || r.created_at).slice(0, 10); const coll = (r) => r.collector || refLabel("users", r.submitted_by_id) || "Public link";
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 13)); const perDay = {}; rows.forEach((r) => { perDay[day(r)] = (perDay[day(r)] || 0) + 1; });
  const choice = f.fields.filter((x) => ["select", "yesno"].includes(x.type)); const by = choice.some((x) => x.id === params.by) ? params.by : choice[0]?.id || null;
  const bd = {}; if (by) rows.forEach((r) => { const v = r.data[by]; if (v !== undefined && v !== null) { const k = v === true ? "Yes" : v === false ? "No" : String(v); bd[k] = (bd[k] || 0) + 1; } });
  const all = {}, tod = {}; rows.forEach((r) => { all[coll(r)] = (all[coll(r)] || 0) + 1; if (day(r) >= TODAY) tod[coll(r)] = (tod[coll(r)] || 0) + 1; });
  return { server_time: nowIso(), total: rows.length, today: rows.filter((r) => day(r) >= TODAY).length, week: rows.filter((r) => day(r) > addDays(TODAY, -7)).length, target: f.target ?? null,
    with_location: rows.filter((r) => r.location).length, per_day: days.map((d) => ({ date: d, count: perDay[d] || 0 })),
    collectors: Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, total]) => ({ name, total, today: tod[name] || 0 })),
    by, by_options: choice.map((x) => ({ id: x.id, label: x.label })), breakdown: Object.entries(bd).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, count]) => ({ label, count })),
    points: rows.filter((r) => r.location).slice(0, 2000).map((r) => ({ lat: r.location.lat, lng: r.location.lng, collector: coll(r), at: r.created_at, label: by && r.data[by] !== undefined ? String(r.data[by]) : "" })),
    latest: rows.slice(0, 12).map(subOut) };
});
const hashRow = (row) => { const str = JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k]])); let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return String(h); };
on("POST", "/forms/:id/import", (u, { body }, id2) => {
  manage(u); const f = getForm(u, id2); if (!Array.isArray(body.rows) || !body.rows.length) E(422, "Nothing to import."); if (body.rows.length > 5000) E(422, "Up to 5,000 rows at a time.");
  let created = 0, skipped = 0; const errors = [];
  body.rows.forEach((row, i) => { try { const data = Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("_"))); const [, n2] = saveSub(f, { data, client_id: "import:" + hashRow(row), collector: row._collector }, "import", u); n2 ? created++ : skipped++; }
    catch (e) { errors.push({ row: i + 1, message: e.data?.detail?.message || e.message }); } });
  log(u.organization_id, u.id, "form_imported", "form", f.id, `${u.full_name} imported ${created} responses into '${f.title}'`);
  return { created, skipped_duplicates: skipped, errors: errors.slice(0, 200), failed: errors.length };
});
function sheetUrlOk(url) { try { const x = new URL(String(url).trim()); return x.protocol === "https:" && x.hostname === "docs.google.com" && x.pathname.startsWith("/spreadsheets/d/"); } catch { return false; } }
on("PUT", "/forms/:id/sheet", (u, { body }, id2) => { manage(u); const f = getForm(u, id2); if (!sheetUrlOk(body.url)) E(422, "Paste a Google Sheets link that starts with https://docs.google.com/spreadsheets/");
  f.sheet_url = String(body.url).trim(); log(u.organization_id, u.id, "form_sheet_connected", "form", f.id, `${u.full_name} connected a Google Sheet to '${f.title}'`); return formOut(f); });
on("POST", "/forms/:id/sheet-sync", (u, _, id2) => { manage(u); const f = getForm(u, id2); if (!f.sheet_url) E(409, "Connect a Google Sheet first.");
  E(503, "Google Sheets sync runs on the live server. In this preview, download the sheet as CSV and use Import instead."); });
const publicForm = (id2) => { const f = forms().find((x) => x.id === id2); if (!f || !f.is_public || f.status !== "open") E(404, "This form is not available."); return f; };
on("POST", "/public/forms/:id/photo", async (_, { form }, id2) => {
  const f = publicForm(id2); if (!f.fields.some((x) => x.type === "photo")) E(404, "This form does not take photos.");
  const file = form.get("file"); if (!file || !file.size) E(422, "That file is empty."); if (file.size > 5 * 1024 * 1024) E(413, "Photos must be 5 MB or smaller.");
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) E(422, "Upload a JPG, PNG or WebP photo.");
  const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(""); fr.readAsDataURL(file); });
  return { name: file.name, url };
});
on("GET", "/public/forms/:id", (_, __, id2) => { const f = publicForm(id2); const site = mrows("site_settings").find((s2) => s2.organization_id === f.organization_id);
  return { id: f.id, title: f.title, description: f.description, fields: f.fields, collect_gps: !!f.collect_gps, organization: byId("orgs", f.organization_id).name, brand: { primary: site?.brand_primary || "#5B4CDB", accent: site?.brand_accent || "#18181B" } }; });
on("POST", "/public/forms/:id", (_, { body }, id2) => { const f = publicForm(id2); const p = payloadOf(body); if (p.website || body.website) return { ok: true }; delete p.data.website;
  const [s2, created] = saveSub(f, p, "public", null); return { ok: true, id: s2.id, duplicate: !created }; });
on("POST", "/auth/password", (u, { body }) => {
  if (u.password !== body.current_password) E(400, "Your current password is not right.");
  const pw = body.new_password || ""; if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) vErr("Password needs at least 10 characters and letters and numbers.", "password");
  u.password = pw; log(u.organization_id, u.id, "password_changed", "user", u.id, `${u.full_name} changed their password; other sessions signed out`);
  return { access_token: u.id, token_type: "bearer", user: meOut(u) };
});

// =====================================================================================
// Apps and industries, event forms, sales, bookings, search (mirror of backend)
// =====================================================================================
const APPDEFS = PLATFORM.apps, INDS = Object.fromEntries(PLATFORM.industries.map((i) => [i.key, i]));
const appName = (k) => APPDEFS.find((a) => a.key === k)?.name || k;
function requireApp(u, key) {
  const app = MODS[key]?.app; const org = byId("orgs", u.organization_id);
  if (app && !(org.installed_apps || []).includes(app)) E(404, `Install the ${appName(app)} app to use this.`);
}
on("GET", "/platform", () => ({ apps: APPDEFS, palettes: PLATFORM.palettes, industries: PLATFORM.industries.map((i) => ({ ...i, app_names: i.apps.map(appName) })) }));
const SHOW_ORDER = { timiza: 1, tumaini: 2, hatua: 3, mwangaza: 4, pwani: 5 };
on("GET", "/platform/showcase", () => mrows("site_settings").map((s2) => { const o = byId("orgs", s2.organization_id);
  return { slug: s2.slug, organization: o.name, industry: INDS[o.industry]?.name || o.industry, kind: ["retail", "hospitality", "agency"].includes(o.industry) ? "Business" : "Organization",
    tagline: s2.tagline, primary: s2.brand_primary, accent: s2.brand_accent, deep: s2.brand_deep }; }).sort((a, b) => (SHOW_ORDER[a.slug] || 99) - (SHOW_ORDER[b.slug] || 99)));
on("GET", "/apps", (u) => { const org = byId("orgs", u.organization_id); const inst = new Set(org.installed_apps || []);
  return { industry: org.industry, installed: [...inst].sort(), apps: APPDEFS.map((a) => ({ ...a, installed: inst.has(a.key), modules: SPEC.modules.filter((m) => m.app === a.key).map((m) => ({ key: m.key, label: m.label })) })) }; });
function setApp(u, key, on2) {
  adminOnly(u); if (!APPDEFS.some((a) => a.key === key)) E(404, "Unknown app.");
  const org = byId("orgs", u.organization_id); const s2 = new Set(org.installed_apps || []); on2 ? s2.add(key) : s2.delete(key); org.installed_apps = [...s2].sort();
  log(org.id, u.id, on2 ? "app_installed" : "app_removed", "organization", org.id, `${u.full_name} ${on2 ? "installed" : "removed"} ${appName(key)}${on2 ? "" : " (data kept)"}`);
  return { installed: org.installed_apps };
}
on("POST", "/apps/:key/install", (u, _, key) => setApp(u, key, true));
on("POST", "/apps/:key/uninstall", (u, _, key) => setApp(u, key, false));
function eventForm(u, ev) {
  const f = { id: uid(), organization_id: u.organization_id, event_id: ev.id, project_id: ev.project_id || null, title: `${ev.title}: attendance and feedback`,
    description: "Takes one minute. No names needed.", fields: PLATFORM.event_form_fields.map((x) => ({ ...x, options: x.options || [], min: null, max: null })),
    is_public: true, status: "open", created_by_id: u.id, created_at: nowIso() };
  forms().push(f); log(u.organization_id, u.id, "form_created", "events", ev.id, `Attendance and feedback form created for ${ev.title}`); return f;
}
on("POST", "/events/:id/form", (u, _, id2) => { manage(u); requireApp(u, "events"); const ev = getRec(u, "events", id2); return { id: (forms().find((f) => f.event_id === id2) || eventForm(u, ev)).id }; });
on("GET", "/search", (u, { params }) => {
  const q = (params.q || "").trim().toLowerCase(); if (q.length < 2) return [];
  const org = byId("orgs", u.organization_id); const inst = new Set(org.installed_apps || []); const out = [];
  for (const m of SPEC.modules) {
    if (!inst.has(m.app)) continue; const cols = m.fields.filter((f) => f.search).map((f) => f.key); if (!cols.length) continue;
    mrows(m.key).filter((r) => r.organization_id === u.organization_id && cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))).slice(0, 5)
      .forEach((r) => out.push({ kind: m.singular, app: m.app, title: String(r[m.title_field] ?? m.singular), link: `/app/m/${m.key}/${r.id}` }));
  }
  if (inst.has("projects")) {
    T("projects").filter((p) => p.organization_id === u.organization_id && p.name.toLowerCase().includes(q)).slice(0, 5).forEach((p) => out.push({ kind: "Project", app: "projects", title: p.name, link: `/app/projects/${p.id}` }));
    T("activities").filter((a) => projectOfActivity(a).organization_id === u.organization_id && a.title.toLowerCase().includes(q)).slice(0, 8).forEach((a) => out.push({ kind: "Activity", app: "projects", title: a.title, link: `/app/activities/${a.id}` }));
  }
  return out.slice(0, 40);
});
routes.unshift(routes.pop()); // /search before generic routes
// --- wrap generic module routes: app gating, event forms, hooks
function wrap(method, pattern, fn) { const r = routes.find((x) => x.method === method && String(x.re) === String(new RegExp("^" + pattern.replace(/:\w+/g, "([^/]+)") + "$"))); if (r) { const inner = r.fn; r.fn = (...a) => fn(inner, ...a); } }
for (const [mth, pat] of [["GET", "/m/:key"], ["GET", "/m/:key/stats"], ["PATCH", "/m/:key/:id"], ["DELETE", "/m/:key/:id"]]) wrap(mth, pat, (inner, u, req, key, ...rest) => { requireApp(u, key); return inner(u, req, key, ...rest); });
wrap("POST", "/m/:key", (inner, u, req, key) => { requireApp(u, key); const rec = inner(u, req, key); if (key === "events") eventForm(u, mrows("events").find((e) => e.id === rec.id)); return rec; });
wrap("GET", "/m/:key/:id", (inner, u, req, key, id2) => { requireApp(u, key); const rec = inner(u, req, key, id2);
  if (key === "events") { const f = forms().find((x) => x.event_id === id2); if (f) rec._form = { id: f.id, title: f.title, is_public: f.is_public, responses: subs().filter((s2) => s2.form_id === f.id).length }; }
  return rec; });
wrap("POST", "/m/:key/:id/transition", (inner, u, req, key, id2) => {
  requireApp(u, key);
  const r = mrows(key).find((x) => x.id === id2 && x.organization_id === u.organization_id);
  if (key === "events" && req.body.to === "held" && r && (r.attended === null || r.attended === undefined)) {
    const f = forms().find((x) => x.event_id === id2); const n2 = f ? subs().filter((s2) => s2.form_id === f.id).length : 0; if (n2) r.attended = n2;
  }
  const before = r?.status; const out = inner(u, req, key, id2);
  if (key === "invoices" && before === "sent" && out.status === "paid") {
    const inv = mrows("invoices").find((x) => x.id === id2);
    mrows("income").push({ id: uid(), organization_id: inv.organization_id, created_by_id: u.id, created_at: nowIso(), updated_at: nowIso(), source: `Invoice ${inv.number}: ${refLabel("customers", inv.customer_id)}`,
      amount: Number(inv.amount), received_on: TODAY, method: "bank", reference: inv.number, notes: inv.description });
  }
  return out;
});
const _forms = ["/forms", "/forms/:id", "/forms/:id/submissions", "/forms/:id/tracker", "/forms/:id/import", "/forms/:id/sheet", "/forms/:id/sheet-sync"];
for (const pat of _forms) for (const mth of ["GET", "POST", "PUT", "DELETE"]) wrap(mth, pat, (inner, u, ...a) => {
  if (!(byId("orgs", u.organization_id).installed_apps || []).includes("forms")) E(404, "Install the Data collection app to use this.");
  if (mth === "GET" && pat === "/forms" && a[0].params?.event_id) return inner(u, ...a).filter((f) => f.event_id === a[0].params.event_id);
  return inner(u, ...a);
});
// --- registration with industry, site and palette
wrap("POST", "/auth/register", (inner, u, req) => {
  const ind = INDS[req.body.industry || "community"]; if (!ind) E(422, "Choose an industry.");
  const slug = req.body.site_slug;
  if (slug && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) E(422, "Web address: lowercase letters, numbers and dashes.");
  if (slug && mrows("site_settings").some((s2) => s2.slug === slug)) E(409, { message: "That web address is taken. Try another.", field: "site_slug" });
  const pw = req.body.password || ""; if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) E(422, "Password needs at least 10 characters with letters and numbers.");
  const out = inner(u, req); const org = byId("orgs", out.user.organization.id);
  org.industry = ind.key; org.installed_apps = [...new Set(ind.apps)].sort();
  if (slug) { const pal = PLATFORM.palettes[req.body.palette] || PLATFORM.palettes.royal;
    mrows("site_settings").push({ id: uid(), organization_id: org.id, created_by_id: out.user.id, created_at: nowIso(), updated_at: nowIso(), slug, tagline: `Welcome to ${org.name}`, intro: `${org.name} on Kept.`, show_impact: true, brand_primary: pal.primary, brand_accent: pal.accent }); }
  return { ...out, user: meOut(byId("users", out.user.id)) };
});

// ---------- public shop and bookings (business websites) ----------
on("GET", "/public/:slug/products", (_, __, slug) => { const site = siteFor(slug);
  return mrows("items").filter((r) => r.organization_id === site.organization_id && r.show_on_site).sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => { const st = computed("items", r).stock; return { id: r.id, name: r.name, description: r.description, price: Number(r.price || 0), unit: r.unit, in_stock: Math.max(0, st), low: st <= Number(r.reorder_level || 0) }; }); });
on("POST", "/public/:slug/order", (_, { body }, slug) => {
  const site = siteFor(slug); if (body.website) return { ok: true, message: "Thank you." };
  if ((body.name || "").trim().length < 2) E(422, "Enter your name."); if ((body.contact || "").trim().length < 5) E(422, "Enter a phone number or email.");
  if (!Array.isArray(body.items) || !body.items.length) E(422, "Add at least one product.");
  const lines = []; let total = 0;
  for (const ln of body.items) { const r = mrows("items").find((x) => x.id === ln.id && x.organization_id === site.organization_id && x.show_on_site); if (!r) E(422, "One of those products is no longer available.");
    const st = computed("items", r).stock; if (ln.qty > st) E(409, `Only ${st} ${r.unit} of ${r.name} left.`); total += Number(r.price || 0) * ln.qty; lines.push(`${ln.qty} x ${r.name} @ KES ${Number(r.price || 0).toLocaleString()}`); }
  const ref = `ORD-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  publicInsert(site, "inquiries", { name: body.name.trim(), contact: body.contact.trim(), kind: "order", message: `${ref}\n${lines.join("\n")}\nTotal KES ${total.toLocaleString()}${body.message ? `\nNote: ${body.message}` : ""}` }, `Website order ${ref}: KES ${total.toLocaleString()}`);
  return { ok: true, reference: ref, total, message: `Order ${ref} received. We'll confirm on ${body.contact.trim()} within the hour.` };
});
const roomFree = (org, rid, s2, e2) => !mrows("bookings").some((b) => b.organization_id === org && b.resource_id === rid && b.status !== "cancelled" && b.starts_on <= e2 && b.ends_on >= s2);
on("GET", "/public/:slug/rooms", (_, { params }, slug) => { const site = siteFor(slug);
  return mrows("resources").filter((r) => r.organization_id === site.organization_id && r.show_on_site).sort((a, b) => Number(a.rate) - Number(b.rate))
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: Number(r.capacity || 0), rate: Number(r.rate || 0), description: r.description, amenities: r.amenities,
      available: params.start && params.end ? roomFree(site.organization_id, r.id, params.start, params.end) : null })); });
on("POST", "/public/:slug/booking-request", (_, { body }, slug) => {
  const site = siteFor(slug); if (body.website) return { ok: true };
  if ((body.name || "").trim().length < 2) E(422, "Enter your name."); if ((body.contact || "").trim().length < 5) E(422, "Enter a phone number or email.");
  if (!body.starts_on || !body.ends_on || body.ends_on <= body.starts_on) E(422, "Check-out must be after check-in.");
  if (body.starts_on < TODAY) E(422, "Choose dates from today onwards.");
  const nights = dnum(body.ends_on) - dnum(body.starts_on); if (nights > 30) E(422, "For stays longer than 30 nights, send us a message.");
  const r = mrows("resources").find((x) => x.id === body.resource_id && x.organization_id === site.organization_id && x.show_on_site); if (!r) E(422, "Choose one of our rooms.");
  if (!roomFree(site.organization_id, r.id, body.starts_on, body.ends_on)) E(409, `${r.name} is already booked for some of those dates. Try other dates or another room.`);
  const amount = Number(r.rate || 0) * nights;
  const b = { id: uid(), organization_id: site.organization_id, created_by_id: null, created_at: nowIso(), updated_at: nowIso(), guest: body.name.trim(), resource_id: r.id, starts_on: body.starts_on, ends_on: body.ends_on, contact: body.contact.trim(), amount, notes: body.notes || "Booked on the website", status: "tentative" };
  mrows("bookings").push(b); log(site.organization_id, null, "bookings_created", "bookings", b.id, `Website booking request: ${r.name}, ${nights} nights`);
  return { ok: true, nights, amount, message: `${r.name} is held for you: ${nights} nights, KES ${amount.toLocaleString()}. We'll confirm within a few hours.` };
});
