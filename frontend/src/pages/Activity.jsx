import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fileUrl } from "../api";
import { useAuth } from "../auth";
import { notifyChanged } from "../components/Shell";
import { ErrorNotice, Loading, PaceLine, Status } from "../components/ui";
import { fmtDate, fmtDateTime, fmtNum, fmtSize, isoToday } from "../format";
import { useApi } from "../hooks";

export default function Activity() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const { data: a, setData, error, loading, reload } = useApi(`/activities/${id}`);
  const [msg, setMsg] = useState(null); // {tone, text}
  const [busy, setBusy] = useState(false);

  if (loading && !a) return <Loading rows={8} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const canWork = can.workOn(a) && a.status !== "done";
  const late = a.status !== "done" && a.due_on < isoToday();
  const kind = a.status === "done" ? "done" : a.missing.length && a.completion_refused_at ? "needs_proof" : late && a.status !== "blocked" ? "overdue" : a.status;

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      const out = await fn();
      if (out) setData(out.activity || out);
      if (okText) setMsg({ tone: "ok", text: typeof okText === "function" ? okText(out) : okText });
      notifyChanged();
      return out;
    } catch (e) {
      const missing = e.data?.detail?.missing;
      setMsg({ tone: "error", text: missing ? `Not completed. Still needed: ${missing.join(", ")}. A count alone is not accepted as proof.` : e.message });
      reload();
    } finally {
      setBusy(false);
    }
  };
  const complete = () => run(() => api(`/activities/${a.id}/complete`, { method: "POST" }), (out) => {
    const b = out.pace_before, f = out.pace_after;
    const moved = f.actual - b.actual;
    return `Completed.${moved ? ` ${fmtNum(moved)} added to ${a.commitment.title}, now ${fmtNum(f.actual)} of ${fmtNum(f.target)}.` : ""}${out.flags_closed ? ` ${out.flags_closed} flag${out.flags_closed > 1 ? "s" : ""} closed automatically.` : ""}`;
  });
  const pace = a.commitment.pace;

  return (
    <>
      <div className="crumbs"><Link to={`/app/projects/${a.project.id}`}>{a.project.name}</Link> / {a.commitment.title}</div>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="stack-sm">
          <h1 className="page-title">{a.title}</h1>
          <div className="row wrap" style={{ gap: 20, fontSize: 14, color: "var(--ink-2)" }}>
            <Status kind={kind} />
            <span>Owner <b>{a.owner?.full_name || "Unassigned"}</b></span>
            <span style={{ color: late ? "var(--bad)" : undefined }}>Due {fmtDate(a.due_on, true)}</span>
            {a.depends_on && <span>Waits on <b>{a.depends_on.title}</b> ({a.depends_on.status.replace("_", " ")})</span>}
          </div>
        </div>
        <div className="row wrap no-print">
          {canWork && a.status === "not_started" && <button className="btn" disabled={busy} onClick={() => run(() => api(`/activities/${a.id}`, { method: "PATCH", body: { status: "in_progress" } }), "Marked in progress")}>Start work</button>}
          {can.manage && a.status === "done" && <button className="btn" disabled={busy} onClick={() => run(() => api(`/activities/${a.id}/reopen`, { method: "POST" }), "Reopened")}>Reopen</button>}
          {can.manage && <button className="btn btn-danger" disabled={busy} onClick={async () => { if (confirm("Delete this activity and its proof?")) { await api(`/activities/${a.id}`, { method: "DELETE" }); notifyChanged(); nav(`/app/projects/${a.project.id}`); } }}>Delete</button>}
        </div>
      </div>

      <div className="two-col">
        <section className="wide panel" aria-labelledby="proof-h">
          <div className="panel-head"><h2 id="proof-h">Proof of work</h2><span className="small muted">{a.requirements.length ? "Required items must be present before this can be completed." : "No proof is required for this activity."}</span></div>
          {a.requirements.map((r) => <ProofItem key={r.id} activity={a} req={r} canWork={canWork} onChange={(updated) => { setData(updated); notifyChanged(); }} onError={(e) => setMsg({ tone: "error", text: e.message })} />)}
          <div className="proof-item" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            {a.status !== "done" ? (
              <button className="btn btn-primary btn-lg" disabled={busy || !canWork || a.status === "blocked"} onClick={complete}>Mark complete</button>
            ) : <Status kind="done" label={`Completed ${fmtDateTime(a.completed_at)}`} />}
            <span role="status" style={{ flex: "1 1 260px", fontSize: 14 }}>
              {msg ? <span style={{ color: msg.tone === "ok" ? "var(--ok)" : "var(--bad)", fontWeight: 500 }}>{msg.text}</span>
                : a.status === "blocked" ? <span className="muted">Blocked until "{a.depends_on?.title}" is done.</span>
                : a.status !== "done" && (a.missing.length ? <span className="muted">Still needed: {a.missing.join(", ")}.</span> : <span style={{ color: "var(--ok)" }}>All required proof is present.</span>)}
            </span>
          </div>
          {!can.workOn(a) && a.status !== "done" && <div className="proof-item small muted">Only the owner or a manager can add proof here.</div>}
        </section>

        <aside className="narrow stack">
          <section className="panel panel-body stack-sm">
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>Counts toward</h2>
            <span style={{ fontSize: 14 }}>{a.commitment.title}</span>
            <PaceLine pace={pace} />
            <div className="spread small muted"><span>{fmtNum(pace.actual)} of {fmtNum(pace.target)} {a.commitment.unit}</span><span>Expected {fmtNum(pace.expected)} today</span></div>
            <Status kind={pace.status} />
          </section>
          <section className="panel panel-body stack-sm">
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>History</h2>
            {a.history.length === 0 ? <span className="small muted">No changes yet.</span> :
              a.history.map((h) => <div key={h.id} className="history-item"><span className="muted">{fmtDate(h.at)}</span><span>{h.summary}</span></div>)}
          </section>
        </aside>
      </div>
    </>
  );
}

function ProofItem({ activity, req, canWork, onChange, onError }) {
  const items = activity.evidence.filter((e) => e.requirement_id === req.id);
  const current = items[0];
  const [val, setVal] = useState(current?.value_number ?? current?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const save = async (fn) => { setBusy(true); try { onChange(await fn()); } catch (e) { onError(e); } finally { setBusy(false); } };
  const upload = (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("requirement_id", req.id);
    save(() => api(`/activities/${activity.id}/evidence/file`, { method: "POST", form }));
  };
  const remove = (eid) => save(() => api(`/evidence/${eid}`, { method: "DELETE" }));
  const have = items.length > 0;
  return (
    <div className="proof-item">
      <div className="spread">
        <b style={{ fontSize: 14 }}>{req.label} <span className="muted" style={{ fontWeight: 400 }}>{req.is_required ? "Required" : "Optional"}{req.counts_toward_target ? ", counts toward the target" : ""}</span></b>
        {have && <Status kind="done" label="Provided" />}
      </div>
      {req.kind === "value" && (
        <div className="row wrap">
          <input className="input" style={{ width: 160 }} type="number" min="0" inputMode="decimal" aria-label={req.label} value={val} disabled={!canWork || busy} onChange={(e) => setVal(e.target.value)} />
          {canWork && <button className="btn" disabled={busy || val === "" || Number(val) === current?.value_number} onClick={() => save(() => api(`/activities/${activity.id}/evidence`, { method: "POST", body: { requirement_id: req.id, kind: "value", value_number: Number(val) } }))}>Save</button>}
          {current && <span className="small muted">Recorded by {current.captured_by?.full_name}, {fmtDateTime(current.captured_at)}</span>}
        </div>
      )}
      {req.kind === "note" && (
        <>
          <textarea className="textarea" rows={3} aria-label={req.label} value={val} disabled={!canWork || busy} onChange={(e) => setVal(e.target.value)} />
          {canWork && <button className="btn" style={{ alignSelf: "flex-start" }} disabled={busy || !String(val).trim() || val === current?.text} onClick={() => save(() => api(`/activities/${activity.id}/evidence`, { method: "POST", body: { requirement_id: req.id, kind: "note", text: val } }))}>Save note</button>}
        </>
      )}
      {req.kind === "file" && (
        <>
          {items.map((e) => (
            <div key={e.id} className="file-chip">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--slate)" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /></svg>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {e.file_url ? <a href={fileUrl(e.file_url)} target="_blank" rel="noreferrer" className="strong">{e.file_name}</a> : <span className="strong">{e.file_name}</span>}
                <span className="small muted">{e.file_size ? `${fmtSize(e.file_size)} · ` : ""}{e.captured_by?.full_name}, {fmtDateTime(e.captured_at)}</span>
              </span>
              {canWork && <button className="btn btn-quiet" style={{ color: "var(--bad)" }} disabled={busy} onClick={() => remove(e.id)}>Remove</button>}
            </div>
          ))}
          {canWork && (
            <button type="button" className={"dropzone" + (drag ? " drag" : "")} disabled={busy}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}>
              <b>{busy ? "Uploading…" : have ? "Add another file" : `Attach ${req.label.toLowerCase()}`}</b>
              <span className="small" style={{ color: "var(--ink-2)" }}>Drop a file, choose one, or take a photo on your phone. Up to 10 MB.</span>
            </button>
          )}
          <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" capture="environment" onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
        </>
      )}
    </div>
  );
}
