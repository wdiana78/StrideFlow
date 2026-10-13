import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { notifyChanged } from "../components/Shell";
import { Dialog, Empty, ErrorNotice, Field, Loading, PaceLine, Shape, Status, Toast } from "../components/ui";
import { fmtDate, fmtDateTime, fmtNum, isoToday } from "../format";
import { useApi } from "../hooks";

const PACE_STATUS = { on_track: "on_track", done: "done", at_risk: "at_risk", overdue: "overdue" };

export default function Project() {
  const { id } = useParams();
  const { can } = useAuth();
  const nav = useNavigate();
  const { data: p, error, loading, reload } = useApi(`/projects/${id}`);
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const [actKey, setActKey] = useState(0);
  const refresh = (msg) => { reload(); setActKey((k) => k + 1); notifyChanged(); if (msg) setToast(msg); };

  if (loading && !p) return <Loading rows={8} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const attention = p.commitments.filter((c) => ["at_risk", "overdue"].includes(c.pace.status)).length;
  const vocab = p.template?.vocabulary || { commitment: "Commitment", activity: "Activity", stakeholder: "Funder" };

  return (
    <>
      <div className="crumbs"><Link to="/app/projects">Projects</Link> / {p.name}</div>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="stack-sm">
          <h1 className="page-title">{p.name}</h1>
          <div className="row wrap" style={{ gap: 20, fontSize: 14, color: "var(--ink-2)" }}>
            {p.stakeholder && <span>Owed to <b>{p.stakeholder.name}</b></span>}
            <span>{fmtDate(p.starts_on)} to {fmtDate(p.ends_on, true)}</span>
            {p.manager && <span>Manager <b>{p.manager.full_name}</b></span>}
            {attention > 0 ? <Status kind="at_risk" label={`${attention} of ${p.commitments.length} ${vocab.commitment.toLowerCase()}s need attention`} />
              : p.commitments.length > 0 && <Status kind="on_track" label="All on track" />}
          </div>
        </div>
        {can.manage && (
          <div className="row wrap">
            <button className="btn" onClick={() => setDialog("activity")} disabled={!p.commitments.length} title={p.commitments.length ? undefined : "Add a commitment first"}>Add {vocab.activity.toLowerCase()}</button>
            <button className="btn btn-primary" onClick={() => setDialog("report")}>Generate report</button>
          </div>
        )}
      </div>
      {p.description && <p className="muted" style={{ maxWidth: 760 }}>{p.description}</p>}

      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === "overview"} onClick={() => setTab("overview")}>Overview</button>
        <button className="tab" role="tab" aria-selected={tab === "reports"} onClick={() => setTab("reports")}>Reports</button>
      </div>

      {tab === "overview" ? (
        <>
          <section className="panel" aria-labelledby="c-h">
            <div className="panel-head">
              <h2 id="c-h">{vocab.commitment}s</h2>
              <div className="row wrap">
                <span className="small muted">The bar is actual progress. The dark tick is where it should be today.</span>
                {can.manage && <button className="btn btn-quiet" onClick={() => setDialog("commitment")}>Add {vocab.commitment.toLowerCase()}</button>}
              </div>
            </div>
            {p.commitments.length === 0 ? <Empty title="No commitments yet">Add what you promised, with a target and a due date, to start tracking pace.</Empty> :
              p.commitments.map((c) => (
                <div className="commit-row" key={c.id}>
                  <div style={{ flex: "1 1 280px", minWidth: 0 }} className="stack-sm">
                    <b style={{ fontSize: 16 }}>{c.title}</b>
                    <span className="small muted">{c.pace.done_activities} of {c.pace.total_activities} activities done · due {fmtDate(c.due_on)}</span>
                  </div>
                  <div style={{ flex: "2 1 320px" }} className="stack-sm">
                    <PaceLine pace={c.pace} />
                    <div className="spread small muted">
                      <span>{fmtNum(c.pace.actual)} of {fmtNum(c.pace.target)} {c.unit}, {Math.round(c.pace.actual_pct)}%</span>
                      <span>Expected {fmtNum(c.pace.expected)} by today</span>
                    </div>
                  </div>
                  <div style={{ flex: "0 0 120px" }}><Status kind={PACE_STATUS[c.pace.status]} /></div>
                </div>
              ))}
          </section>
          <ActivitiesPanel key={actKey} project={p} vocab={vocab} />
        </>
      ) : <ProjectReports projectId={p.id} />}

      {dialog === "activity" && <ActivityDialog project={p} onClose={() => setDialog(null)} onDone={(a) => { setDialog(null); refresh(); nav(`/app/activities/${a.id}`); }} />}
      {dialog === "commitment" && <CommitmentDialog project={p} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh("Commitment added"); }} />}
      {dialog === "report" && <ReportDialog project={p} onClose={() => setDialog(null)} />}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}

function ActivitiesPanel({ project, vocab }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [commitment, setCommitment] = useState("");
  const [state, setState] = useState("open");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setQuery(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useApi("/activities", { project_id: project.id, commitment_id: commitment, state, q: query, page, page_size: 8 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const t = isoToday();
  return (
    <section className="panel" aria-labelledby="a-h">
      <div className="panel-head">
        <h2 id="a-h">{vocab.activity === "Activity" ? "Activities" : `${vocab.activity}s`}</h2>
        <div className="row wrap">
          <input className="input" style={{ width: 200 }} placeholder="Search" aria-label="Search activities" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: "auto" }} aria-label="Commitment" value={commitment} onChange={(e) => { setCommitment(e.target.value); setPage(1); }}>
            <option value="">All {vocab.commitment.toLowerCase()}s</option>
            {project.commitments.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} aria-label="Status" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
            <option value="open">Not done</option><option value="overdue">Overdue</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="all">All</option>
          </select>
        </div>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <div className="panel-body"><Loading /></div> : data.items.length === 0 ? <Empty title="Nothing here">No activities match these filters.</Empty> : (
        <>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 760 }}>
              <thead><tr><th>Activity</th><th>{vocab.commitment}</th><th>Owner</th><th>Due</th><th>Status</th><th style={{ textAlign: "right" }}>Proof</th></tr></thead>
              <tbody>
                {data.items.map((a) => {
                  const late = a.status !== "done" && a.due_on < t;
                  const kind = a.status === "done" ? "done" : late ? "overdue" : a.status;
                  return (
                    <tr key={a.id}>
                      <td><Link className="row-link" to={`/app/activities/${a.id}`}>{a.title}</Link></td>
                      <td className="muted">{a.commitment_title}</td>
                      <td>{a.owner?.full_name || <span className="muted">Unassigned</span>}</td>
                      <td style={{ color: late ? "var(--bad)" : undefined }}>{fmtDate(a.due_on)}</td>
                      <td><Status kind={kind} label={late && a.status !== "blocked" ? "Overdue" : undefined} /></td>
                      <td style={{ textAlign: "right", color: a.proof_have < a.proof_need ? "var(--risk)" : "var(--slate)" }}>{a.proof_need ? `${a.proof_have} of ${a.proof_need}` : "None needed"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>{data.total} activit{data.total === 1 ? "y" : "ies"}</span>
            <div className="row"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
          </div>
        </>
      )}
    </section>
  );
}

function ActivityDialog({ project, onClose, onDone }) {
  const types = project.template?.blueprint?.activity_types || [];
  const [people, setPeople] = useState([]);
  const [deps, setDeps] = useState([]);
  const [form, setForm] = useState({ title: "", commitment_id: project.commitments[0]?.id, due_on: "", owner_id: "", activity_type: types[0]?.key || "", depends_on_id: "", notes: "" });
  const [error, setError] = useState(null);
  useEffect(() => {
    api("/users").then(setPeople);
    api("/activities", { params: { project_id: project.id, state: "all", page_size: 100 } }).then((d) => setDeps(d.items));
  }, [project.id]);
  const type = types.find((t) => t.key === form.activity_type);
  const submit = async () => {
    try {
      const a = await api("/activities", { method: "POST", body: { ...form, owner_id: form.owner_id || null, depends_on_id: form.depends_on_id || null, activity_type: form.activity_type || null } });
      onDone(a);
    } catch (e) { setError(e); }
  };
  return (
    <Dialog title="Add activity" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!form.title || !form.due_on} onClick={submit}>Add activity</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error} />
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Session 12, Yatta group" /></Field>
        <div className="form-grid">
          <Field label="Counts toward"><select className="select" value={form.commitment_id} onChange={(e) => setForm({ ...form, commitment_id: e.target.value })}>{project.commitments.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
          <Field label="Kind of work"><select className="select" value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })}>{types.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></Field>
          <Field label="Owner"><select className="select" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}><option value="">Unassigned</option>{people.filter((u) => u.role !== "viewer").map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
          <Field label="Due"><input className="input" type="date" min={project.starts_on} max={project.ends_on} value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} /></Field>
        </div>
        <Field label="Depends on" hint="Optional"><select className="select" value={form.depends_on_id} onChange={(e) => setForm({ ...form, depends_on_id: e.target.value })}><option value="">Nothing</option>{deps.filter((d) => d.status !== "done").map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        {type && (
          <div className="notice" style={{ background: "var(--stone)" }}>
            <b>Proof required to complete</b>
            <div className="small" style={{ marginTop: 4 }}>{type.requirements.length ? type.requirements.map((r) => `${r.label}${r.required ? "" : " (optional)"}${r.counts ? ", counts toward target" : ""}`).join(" · ") : "None"}</div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function CommitmentDialog({ project, onClose, onDone }) {
  const [form, setForm] = useState({ title: "", unit: "", target_value: "", due_on: "", measure: "sum" });
  const [error, setError] = useState(null);
  const submit = async () => {
    try { await api(`/projects/${project.id}/commitments`, { method: "POST", body: { ...form, target_value: Number(form.target_value) } }); onDone(); } catch (e) { setError(e); }
  };
  return (
    <Dialog title="Add commitment" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!form.title || !form.target_value || !form.due_on} onClick={submit}>Add commitment</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error} />
        <Field label="What was promised"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Train 120 women in agribusiness" /></Field>
        <div className="form-grid">
          <Field label="Target"><input className="input" type="number" min="1" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} /></Field>
          <Field label="Unit"><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="women" /></Field>
          <Field label="Measured by"><select className="select" value={form.measure} onChange={(e) => setForm({ ...form, measure: e.target.value })}><option value="sum">Counted values in proof</option><option value="activities">Completed activities</option></select></Field>
          <Field label="Due"><input className="input" type="date" min={project.starts_on} max={project.ends_on} value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} /></Field>
        </div>
      </div>
    </Dialog>
  );
}

function ReportDialog({ project, onClose }) {
  const nav = useNavigate();
  const t = isoToday();
  const [form, setForm] = useState({ period_start: project.starts_on, period_end: t < project.ends_on ? t : project.ends_on });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const r = await api(`/projects/${project.id}/reports`, { method: "POST", body: form }); nav(`/app/reports/${r.id}`); }
    catch (e) { setError(e); setBusy(false); }
  };
  return (
    <Dialog title="Generate report" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Building…" : "Generate report"}</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error} />
        <div className="form-grid">
          <Field label="From"><input className="input" type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></Field>
          <Field label="To"><input className="input" type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field>
        </div>
        <p className="small muted">The report is built from your records and saved as a snapshot, so it will not change if records are edited later.</p>
      </div>
    </Dialog>
  );
}

function ProjectReports({ projectId }) {
  const { data, error, loading, reload } = useApi(`/projects/${projectId}/reports`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (!data.length) return <div className="panel"><Empty title="No reports yet">Use Generate report to build one from this project's records.</Empty></div>;
  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead><tr><th>Period</th><th>Generated</th><th>By</th></tr></thead>
        <tbody>{data.map((r) => (
          <tr key={r.id}><td><Link className="row-link" to={`/app/reports/${r.id}`}>{fmtDate(r.period_start)} to {fmtDate(r.period_end, true)}</Link></td><td>{fmtDateTime(r.created_at)}</td><td>{r.generated_by?.full_name}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export { Shape };
