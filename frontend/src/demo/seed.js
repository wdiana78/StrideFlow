import SPEC from "../modules.json";
import TIMIZA from "./timiza.json";
// Same fictional data and templates as backend/seed.py and backend/app/templates_builtin.py.
const R = (kind, label, required = true, counts = false) => ({ kind, label, required, counts });
export const TEMPLATES = [
  { id: "tpl-community", key: "community_programme", name: "Community programme",
    description: "Funded programmes that train, equip or organize people and report to a grantor.",
    vocabulary: { stakeholder: "Funder", commitment: "Commitment", activity: "Activity", project: "Programme" },
    blueprint: {
      commitments: [
        { title: "Train participants", unit: "participants", measure: "sum", target_value: 100 },
        { title: "Deliver inputs to households", unit: "households", measure: "sum", target_value: 50 },
        { title: "Mid-term learning review", unit: "parts", measure: "activities", target_value: 3 },
      ],
      activity_types: [
        { key: "training_session", name: "Training session", requirements: [R("value", "Attendance count", true, true), R("file", "Signed attendance sheet"), R("note", "Session note", false)] },
        { key: "distribution", name: "Distribution", requirements: [R("value", "Households reached", true, true), R("file", "Delivery note")] },
        { key: "field_visit", name: "Field visit", requirements: [R("note", "Visit report"), R("file", "Photos")] },
        { key: "registration", name: "Group registration", requirements: [R("value", "Groups registered", true, true), R("file", "Registration certificate")] },
        { key: "purchase", name: "Purchase", requirements: [R("file", "Receipt"), R("value", "Amount spent", false)] },
        { key: "deliverable", name: "Deliverable", requirements: [R("file", "Final document")] },
        { key: "task", name: "General task", requirements: [] },
      ],
    } },
  { id: "tpl-youth", key: "youth_advocacy", name: "Youth advocacy programme",
    description: "Youth-led CBOs running outreach, dialogues, trainings and campaigns across several programme areas.",
    vocabulary: { stakeholder: "Funder", commitment: "Commitment", activity: "Activity", project: "Programme" },
    blueprint: {
      commitments: [
        { title: "Reach young people with information", unit: "young people", measure: "sum", target_value: 1000 },
        { title: "Hold community dialogues", unit: "dialogues", measure: "activities", target_value: 10 },
      ],
      activity_types: [
        { key: "outreach", name: "Community outreach", requirements: [R("value", "People reached", true, true), R("file", "Attendance list or photos"), R("note", "Outreach note", false)] },
        { key: "dialogue", name: "Community dialogue", requirements: [R("value", "Participants", true, true), R("file", "Signed attendance list"), R("note", "Key resolutions")] },
        { key: "training", name: "Training", requirements: [R("value", "Participants trained", true, true), R("file", "Signed attendance sheet")] },
        { key: "referral", name: "Referral log", requirements: [R("value", "Referrals", true, true), R("note", "Partner summary (no names)")] },
        { key: "planting", name: "Tree planting", requirements: [R("value", "Seedlings planted", true, true), R("file", "Photos")] },
        { key: "audit", name: "Accessibility audit", requirements: [R("value", "Facilities assessed", true, true), R("file", "Audit forms")] },
        { key: "purchase", name: "Purchase", requirements: [R("file", "Receipt"), R("value", "Amount spent", false)] },
        { key: "deliverable", name: "Deliverable", requirements: [R("file", "Final document")] },
        { key: "task", name: "General task", requirements: [] },
      ],
    } },
  { id: "tpl-client", key: "client_engagement", name: "Client engagement",
    description: "Agencies and service firms delivering work to a client on agreed dates.",
    vocabulary: { stakeholder: "Client", commitment: "Deliverable", activity: "Task", project: "Engagement" },
    blueprint: {
      commitments: [
        { title: "Deliver campaign assets", unit: "assets", measure: "sum", target_value: 12 },
        { title: "Monthly status reports", unit: "reports", measure: "activities", target_value: 3 },
      ],
      activity_types: [
        { key: "design_round", name: "Design round", requirements: [R("value", "Assets delivered", true, true), R("file", "Approved file"), R("note", "Client sign-off")] },
        { key: "review_meeting", name: "Review meeting", requirements: [R("note", "Meeting notes")] },
        { key: "status_report", name: "Status report", requirements: [R("file", "Report sent")] },
        { key: "task", name: "General task", requirements: [] },
      ],
    } },
];

export const PASSWORD = "kept-demo-2026";

export function SEED() {
  let i = 0;
  const id = (p) => `${p}-${(++i).toString(36)}`;
  const db = { orgs: [], users: [], stakeholders: [], templates: JSON.parse(JSON.stringify(TEMPLATES)), projects: [], commitments: [], activities: [], requirements: [], evidence: [], flags: [], reports: [], audit: [], seq: 0, m: {} };
  const at = (d, h = 15) => `${d}T${String(h).padStart(2, "0")}:00:00.000Z`;
  const tplTypes = (tid) => Object.fromEntries(db.templates.find((t) => t.id === tid).blueprint.activity_types.map((t) => [t.key, t]));
  const audit = (org, actor, action, sid, summary) => db.audit.push({ id: ++db.seq, organization_id: org, actor_id: actor, action, subject_type: "activity", subject_id: sid, summary, changes: {}, at: at("2026-10-01", 9) });

  function org(name, sector) { const o = { id: id("org"), name, sector, currency: "KES" }; db.orgs.push(o); return o; }
  function user(o, full_name, email, role) { const u = { id: id("usr"), organization_id: o.id, full_name, email, password: PASSWORD, role, is_active: true }; db.users.push(u); return u; }
  function stake(o, name, kind, contact_email = null) { const s = { id: id("stk"), organization_id: o.id, name, kind, contact_email }; db.stakeholders.push(s); return s; }
  function project(o, tid, s, m, name, starts_on, ends_on, description = "") { const p = { id: id("prj"), organization_id: o.id, template_id: tid, stakeholder_id: s.id, manager_id: m.id, name, description, starts_on, ends_on, status: "active" }; db.projects.push(p); return p; }
  function commit(p, title, unit, measure, target_value, due_on) { const c = { id: id("cmt"), project_id: p.id, stakeholder_id: p.stakeholder_id, title, unit, measure, target_value, due_on }; db.commitments.push(c); return c; }
  function act(o, tid, c, title, due_on, owner, kind, o2 = {}) {
    const { status = "not_started", values = {}, files = {}, notes = {}, done_on, depends_on, refused_on } = o2;
    const a = { id: id("act"), commitment_id: c.id, owner_id: owner.id, depends_on_id: depends_on?.id || null, title, notes: "", due_on, status, completed_at: null, completion_refused_at: null };
    db.activities.push(a);
    const reqs = {};
    tplTypes(tid)[kind].requirements.forEach((r, k) => { const q = { id: id("req"), activity_id: a.id, kind: r.kind, label: r.label, is_required: r.required, counts_toward_target: r.counts, position: k }; db.requirements.push(q); reqs[r.label] = q; });
    const when = at(done_on || (due_on < "2026-10-13" ? due_on : "2026-10-13"));
    const ev = (label, extra) => db.evidence.push({ id: id("evd"), activity_id: a.id, requirement_id: reqs[label].id, value_number: null, text: null, file_name: null, file_url: null, file_size: null, captured_by_id: owner.id, captured_at: when, ...extra });
    Object.entries(values).forEach(([l, v]) => ev(l, { kind: "value", value_number: v }));
    Object.entries(files).forEach(([l, f]) => ev(l, { kind: "file", file_name: f, file_size: 240000 }));
    Object.entries(notes).forEach(([l, t]) => ev(l, { kind: "note", text: t }));
    if (status === "done") a.completed_at = at(done_on || due_on, 17);
    if (refused_on) {
      a.completion_refused_at = at(refused_on, 16);
      const miss = Object.values(reqs).filter((r) => r.is_required && !(r.label in values) && !(r.label in files) && !(r.label in notes)).map((r) => r.label);
      audit(o.id, owner.id, "completion_refused", a.id, `Completion refused. Missing: ${miss.join(", ")}`);
    }
    audit(o.id, owner.id, "activity_created", a.id, "Created from template");
    return a;
  }

  // ---------- Tumaini Community Network ----------
  const t = org("Tumaini Community Network", "Community development");
  user(t, "Grace Nduta", "admin@tumaini.example", "admin");
  const achieng = user(t, "Achieng Otieno", "achieng@tumaini.example", "manager");
  const brian = user(t, "Brian Mutua", "brian@tumaini.example", "member");
  const faith = user(t, "Faith Wanjiru", "faith@tumaini.example", "member");
  const kevin = user(t, "Kevin Kiprop", "kevin@tumaini.example", "member");
  user(t, "Board Observer", "viewer@tumaini.example", "viewer");
  const ubuntu = stake(t, "Ubuntu Futures Fund", "funder", "grants@ubuntufutures.example");
  const nuru = stake(t, "Nuru Youth Foundation", "funder");
  stake(t, "Mavuno Agro Supplies", "supplier");
  const C = "tpl-community";
  const wa = project(t, C, ubuntu, achieng, "Women in Agribusiness, Machakos", "2026-08-01", "2026-12-31", "Training, inputs and savings groups for 120 women farmers in four Machakos groups.");
  const train = commit(wa, "Train 120 women in agribusiness", "women", "sum", 120, "2026-11-06");
  const kits = commit(wa, "Seed kits to 80 households", "households", "sum", 80, "2026-11-13");
  const groups = commit(wa, "Establish 6 savings groups", "groups", "sum", 6, "2026-11-27");
  const review = commit(wa, "Mid-term learning review", "parts", "activities", 3, "2026-10-10");
  act(t, C, train, "Recruit and register participants", "2026-08-10", achieng, "task", { status: "done", done_on: "2026-08-09" });
  [["Session 1, Kangundo group", "2026-08-15", 8, brian], ["Session 2, Matuu group", "2026-08-29", 14, faith], ["Session 3, Mwala group", "2026-09-05", 8, kevin],
    ["Session 4, Kangundo group", "2026-09-19", 9, brian], ["Session 5, Yatta group", "2026-09-19", 7, faith], ["Session 6, Matuu group", "2026-09-26", 6, faith],
    ["Session 7, Mwala group", "2026-10-03", 7, kevin], ["Session 8, Yatta group", "2026-10-09", 5, faith]].forEach(([title, d, v, who]) =>
    act(t, C, train, title, d, who, "training_session", { status: "done", done_on: d, values: { "Attendance count": v }, files: { "Signed attendance sheet": `${title.split(",")[0].toLowerCase().replace(" ", "-")}-signin.jpg` } }));
  act(t, C, train, "Session 9, Kangundo group", "2026-10-11", brian, "training_session", { status: "in_progress", done_on: "2026-10-11", refused_on: "2026-10-11",
    values: { "Attendance count": 21 }, notes: { "Session note": "Covered post-harvest storage. Three participants asked for a follow-up on hermetic bags." } });
  const venue = act(t, C, train, "Book venue for Kangundo session", "2026-10-12", brian, "task");
  act(t, C, train, "Field visit, Matuu group", "2026-10-16", faith, "field_visit");
  act(t, C, train, "Session 10, Kangundo group", "2026-10-28", brian, "training_session", { depends_on: venue });
  act(t, C, train, "Session 11, Matuu group", "2026-11-03", faith, "training_session");
  [["2026-08-22", 20], ["2026-09-12", 22], ["2026-10-02", 20]].forEach(([d, v], k) =>
    act(t, C, kits, `Seed kits, batch ${k + 1}`, d, faith, "distribution", { status: "done", done_on: d, values: { "Households reached": v }, files: { "Delivery note": `delivery-note-batch-${k + 1}.pdf` } }));
  act(t, C, kits, "Purchase seed kits, batch 4", "2026-10-14", achieng, "purchase", { status: "in_progress", done_on: "2026-10-09", refused_on: "2026-10-09", values: { "Amount spent": 184000 } });
  act(t, C, kits, "Seed kits, batch 4", "2026-10-20", faith, "distribution");
  [["Kangundo", "2026-08-28"], ["Matuu", "2026-09-10"], ["Yatta", "2026-09-24"], ["Mwala", "2026-10-06"]].forEach(([name, d]) =>
    act(t, C, groups, `Register ${name} savings group`, d, kevin, "registration", { status: "done", done_on: d, values: { "Groups registered": 1 }, files: { "Registration certificate": `${name.toLowerCase()}-certificate.pdf` } }));
  act(t, C, groups, "Register Kivaani savings group", "2026-10-24", kevin, "registration", { status: "in_progress", done_on: "2026-10-12", values: { "Groups registered": 1 } });
  act(t, C, groups, "Register Ekalakala savings group", "2026-11-20", kevin, "registration");
  act(t, C, review, "Baseline comparison", "2026-09-30", achieng, "deliverable", { status: "done", done_on: "2026-09-29", files: { "Final document": "baseline-comparison.pdf" } });
  act(t, C, review, "Focus group summary", "2026-10-10", achieng, "deliverable");
  act(t, C, review, "Participant survey", "2026-10-10", achieng, "deliverable");

  const yd = project(t, C, nuru, achieng, "Youth Digital Skills, Mlolongo", "2026-09-01", "2026-12-20", "Twelve-week digital skills course for out-of-school youth.");
  const ytrain = commit(yd, "Train 60 youth in digital skills", "youth", "sum", 60, "2026-12-10");
  const ycert = commit(yd, "Certify 50 graduates", "graduates", "sum", 50, "2026-12-20");
  [["2026-09-08", 22], ["2026-09-22", 19]].forEach(([d, v], k) =>
    act(t, C, ytrain, `Cohort ${k + 1} intake week`, d, kevin, "training_session", { status: "done", done_on: d, values: { "Attendance count": v }, files: { "Signed attendance sheet": `cohort-${k + 1}-register.pdf` } }));
  const assess = act(t, C, ycert, "Final assessment, cohort 1", "2026-10-12", kevin, "deliverable");
  act(t, C, ycert, "Issue completion certificates, cohort 1", "2026-10-24", kevin, "registration", { depends_on: assess });
  act(t, C, ytrain, "Cohort 3 intake week", "2026-11-02", kevin, "training_session");

  // ---------- Mwangaza Creative Studio (contrasting example) ----------
  const m = org("Mwangaza Creative Studio", "Creative agency");
  const lead = user(m, "Wairimu Kamau", "wairimu@mwangaza.example", "admin");
  const designer = user(m, "Otieno Were", "otieno@mwangaza.example", "member");
  const kilele = stake(m, "Kilele Coffee Co.", "client");
  const K = "tpl-client";
  const camp = project(m, K, kilele, lead, "Kilele Coffee launch campaign", "2026-09-01", "2026-12-15");
  const assets = commit(camp, "Deliver 12 campaign assets", "assets", "sum", 12, "2026-11-30");
  const reps = commit(camp, "Monthly status reports", "reports", "activities", 3, "2026-12-01");
  act(m, K, assets, "Design round 1: brand look", "2026-09-25", designer, "design_round", { status: "done", done_on: "2026-09-25", values: { "Assets delivered": 3 }, files: { "Approved file": "kilele-round1.pdf" }, notes: { "Client sign-off": "Approved by marketing lead on call." } });
  act(m, K, assets, "Design round 2: social set", "2026-10-16", designer, "design_round");
  act(m, K, reps, "September status report", "2026-10-01", lead, "status_report", { status: "done", done_on: "2026-10-01", files: { "Report sent": "kilele-sept-status.pdf" } });
  // ---------- Timiza Youth Initiative (case study, shared with backend/seed_data/timiza.json) ----------
  const tz = org(TIMIZA.organization.name, TIMIZA.organization.sector);
  const ppl = Object.fromEntries(TIMIZA.users.map((x) => [x.key, user(tz, x.name, x.email, x.role)]));
  const sk = Object.fromEntries(TIMIZA.stakeholders.map((x) => [x.key, stake(tz, x.name, x.kind)]));
  const projByName = {};
  for (const pj of TIMIZA.projects) {
    const pr = project(tz, "tpl-youth", sk[pj.stakeholder], ppl[pj.manager], pj.name, pj.starts_on, pj.ends_on, pj.description);
    projByName[pj.name] = pr;
    const cs = Object.fromEntries(pj.commitments.map((c) => [c.key, commit(pr, c.title, c.unit, c.measure, c.target, c.due)]));
    const keyed = {};
    for (const a of pj.activities) {
      const made = act(tz, "tpl-youth", cs[a.c], a.title, a.due, ppl[a.owner], a.kind, {
        status: a.status || "not_started", values: a.values, files: a.files, notes: a.notes,
        done_on: a.done_on || (a.status === "done" ? a.due : undefined), depends_on: keyed[a.depends_on], refused_on: a.refused_on });
      if (a.key) keyed[a.key] = made;
    }
  }
  seedErp(db, id, tz, ppl, sk, projByName);
  return db;
}

// ---------- ERP records for the case study (same as backend seed_erp) ----------
const WARDS = ["Sokoni", "Mnarani", "Tezo", "Matsangoni", "Watamu", "Jaribuni", "Ganze", "Kaloleni", "Malindi Town", "Mtwapa"];
function participantsFor(spec) {
  let st = 20261013n; const next = () => { st = (st * 1103515245n + 12345n) % 2147483648n; return Number(st) / 2147483648; };
  const out = []; let n = 0;
  for (const [project, count] of Object.entries(spec)) for (let k = 0; k < count; k++) {
    n++; const [r1, r2, r3, r4, r5] = [next(), next(), next(), next(), next()];
    const gender = r1 < 0.58 ? "female" : r1 < 0.97 ? "male" : "other";
    const ages = project !== "Climate Change" ? ["15-19", "20-24", "25-35", "10-14", "36+"] : ["10-14", "15-19", "20-24", "25-35", "36+"];
    const age = r2 < 0.4 ? ages[0] : r2 < 0.7 ? ages[1] : r2 < 0.88 ? ages[2] : r2 < 0.96 ? ages[3] : ages[4];
    const enrolled = new Date(Date.UTC(2026, 6, 1) + Math.floor(r5 * 100) * 86400000).toISOString().slice(0, 10);
    out.push({ code: `TYI-${String(n).padStart(4, "0")}`, project_id: project, gender, age_band: age, ward: WARDS[Math.floor(r4 * WARDS.length)],
      disability: r3 < (project === "Disability Inclusion" ? 0.6 : 0.06), consent: true, enrolled_on: enrolled });
  }
  return out;
}
function seedErp(db, id, org, ppl, sk, projects) {
  const mods = Object.fromEntries(SPEC.modules.map((m) => [m.key, m]));
  const keys = {};
  const order = ["site_settings", "site_programmes", "site_team", "grants", "income", "budget_lines", "vendors", "expenses", "purchase_requests", "items",
    "stock_moves", "assets", "volunteers", "volunteer_hours", "leave_requests", "events", "documents", "inquiries", "meetings", "decisions", "participants"];
  const records = { ...TIMIZA.erp, participants: participantsFor(TIMIZA.participants) };
  const stampDays = (n2) => new Date(Date.UTC(2026, 9, 13, 9) - n2 * 86400000).toISOString();
  for (const key of order) {
    const m = mods[key]; const fields = Object.fromEntries(m.fields.map((f) => [f.key, f])); db.m[key] = db.m[key] || [];
    for (const rec of records[key] || []) {
      const row = {};
      for (const [k, v] of Object.entries(rec)) {
        if (k.startsWith("_") || !fields[k]) continue; const f = fields[k];
        row[k] = f.type === "ref" ? (f.ref === "users" ? ppl[v].id : f.ref === "stakeholders" ? sk[v].id : f.ref === "projects" ? projects[v].id : keys[v])
          : f.type === "file" ? { name: v.name, url: "", size: null } : v;
      }
      const created = stampDays(rec._age_days ?? 6);
      const r = { id: id(key.slice(0, 3)), organization_id: org.id, created_by_id: (rec._by ? ppl[rec._by] : ppl.zawadi).id, created_at: created, updated_at: created, ...row };
      if (m.status) r[m.status.field] = rec._status || m.status.default;
      db.m[key].push(r); if (rec._key) keys[rec._key] = r.id;
    }
  }
}
