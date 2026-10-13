import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { notifyChanged } from "../components/Shell";
import { Empty, ErrorNotice, Loading, Toast } from "../components/ui";
import { fmtDate } from "../format";
import { useApi } from "../hooks";
import { display, MODS } from "../modules";

export default function Approvals() {
  const { data, error, loading, reload } = useApi("/approvals");
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState("");
  const act = async (r, a) => {
    if (a.note && !(notes[r.id] || "").trim()) { setErr({ message: `Add a note before you ${a.label.toLowerCase()}.` }); return; }
    setBusy(r.id); setErr(null);
    try { await api(`/m/${r._module}/${r.id}/transition`, { method: "POST", body: { to: a.to, note: notes[r.id] || null } }); setToast(`${a.label}: ${r._title}`); reload(); notifyChanged(); }
    catch (e) { setErr(e); } finally { setBusy(null); }
  };
  const groups = {};
  (data || []).forEach((r) => { (groups[r._module] ||= []).push(r); });
  return (
    <>
      <div className="stack-sm" style={{ gap: 4 }}>
        <h1 className="page-title">Approvals</h1>
        <span className="muted">Expenses, purchase requests and leave that need a decision from someone other than the person who submitted them.</span>
      </div>
      <ErrorNotice error={error || err} onRetry={error ? reload : undefined} />
      {loading && !data ? <Loading /> : !data.length ? <div className="panel"><Empty title="Nothing waiting for you">New requests land here as soon as they are submitted.</Empty></div> :
        Object.entries(groups).map(([key, rows]) => {
          const m = MODS[key]; const cols = m.fields.filter((f) => f.list && f.key !== m.title_field).slice(0, 4);
          return (
            <section key={key} className="panel">
              <div className="panel-head"><h2>{m.label}</h2><span className="small muted">{rows.length} waiting</span></div>
              {rows.map((r) => (
                <div key={r.id} style={{ padding: "16px 22px", borderTop: "1px solid var(--rule-soft)", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                  <div className="stack-sm" style={{ flex: "2 1 300px", gap: 4, minWidth: 0 }}>
                    <Link to={`/app/m/${key}/${r.id}`} className="row-link strong" style={{ color: "var(--ink)" }}>{r._title}</Link>
                    <span className="small muted">{cols.map((f) => display(f, r) && `${f.label}: ${display(f, r)}`).filter(Boolean).join(" · ")}</span>
                    <span className="small muted">Submitted by {r.created_by_label || "the website"} on {fmtDate(r.created_at, true)}{r.receipt === null || r.receipt === undefined ? (key === "expenses" ? " · no receipt attached yet" : "") : ""}</span>
                  </div>
                  <input className="input" style={{ flex: "1 1 200px" }} placeholder="Note (needed to reject)" aria-label="Note" value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                  <div className="row">{r._actions.map((a) => <button key={a.to} className={"btn" + (a.note ? "" : " btn-primary")} disabled={busy === r.id} onClick={() => act(r, a)}>{a.label}</button>)}</div>
                </div>
              ))}
            </section>
          );
        })}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
