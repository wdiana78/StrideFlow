import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorNotice, Field, Loading } from "../components/ui";
import { fmtDate, fmtDateTime, isoToday } from "../format";
import { useApi } from "../hooks";

export default function Reports() {
  const { can } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi("/reports");
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ project_id: "", period_start: "", period_end: isoToday() });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/projects", { params: { page_size: 100 } }).then((d) => {
      setProjects(d.items);
      if (d.items[0]) setForm((f) => ({ ...f, project_id: d.items[0].id, period_start: d.items[0].starts_on }));
    });
  }, []);
  const names = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const generate = async () => {
    setBusy(true);
    setErr(null);
    try { const r = await api(`/projects/${form.project_id}/reports`, { method: "POST", body: { period_start: form.period_start, period_end: form.period_end } }); nav(`/app/reports/${r.id}`); }
    catch (e) { setErr(e); setBusy(false); }
  };
  return (
    <>
      <h1 className="page-title">Reports</h1>
      {can.manage && projects.length > 0 && (
        <section className="panel panel-body stack" aria-label="Generate a report">
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Generate a report</h2>
          <ErrorNotice error={err} />
          <div className="row wrap" style={{ alignItems: "flex-end", gap: 16 }}>
            <div style={{ flex: "2 1 260px" }}><Field label="Project"><select className="select" value={form.project_id} onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); setForm({ ...form, project_id: e.target.value, period_start: p.starts_on }); }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
            <div style={{ flex: "1 1 150px" }}><Field label="From"><input className="input" type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></Field></div>
            <div style={{ flex: "1 1 150px" }}><Field label="To"><input className="input" type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field></div>
            <button className="btn btn-primary" disabled={busy || !form.project_id} onClick={generate}>{busy ? "Building…" : "Generate report"}</button>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Report history</h2></div>
        <ErrorNotice error={error} onRetry={reload} />
        {loading && !data ? <div className="panel-body"><Loading /></div> : data.length === 0 ? <Empty title="No reports yet">Generated reports are saved here as snapshots you can reopen, print or share.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Project</th><th>Period</th><th>Generated</th><th>By</th></tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.id}><td><Link className="row-link" to={`/app/reports/${r.id}`}>{names[r.project_id] || "Project"}</Link></td><td>{fmtDate(r.period_start)} to {fmtDate(r.period_end, true)}</td><td>{fmtDateTime(r.created_at)}</td><td>{r.generated_by?.full_name}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
