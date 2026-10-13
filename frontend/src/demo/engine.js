/*
 * Preview engine: a faithful in-browser port of the FastAPI backend (same endpoints, response
 * shapes, rules, pace maths, permissions and report builder). It is used ONLY by the hosted
 * preview build (VITE_DEMO=1). The real app talks to the Python API and PostgreSQL.
 */
import { SEED } from "./seed";

const KEY = "kept_preview_db_v2";
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
    const isPublic = path === "/auth/login" || path === "/auth/register";
    const user = isPublic ? null : current(token);
    try {
      const out = await rt.fn(user, { body: body || {}, form, params: params || {} }, ...m.slice(1));
      save();
      return out == null ? null : JSON.parse(JSON.stringify(out));
    } catch (e) { save(); throw e; }
  }
  E(404, "Not found.");
}
