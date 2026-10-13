import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { notifyChanged } from "../components/Shell";
import { Dialog, Empty, ErrorNotice, Field, Loading, PaceLine, Shape, Toast } from "../components/ui";
import { fmtDate, fmtDateTime, RULE_LABEL, RULE_WHY } from "../format";
import { useApi } from "../hooks";

const RULES = ["behind_pace", "overdue", "missing_proof", "blocked", "due_soon"];

function age(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`;
}

export default function Attention() {
  const { user, can } = useAuth();
  const [view, setView] = useState("team");
  const [rule, setRule] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState("");
  const params = { state: view === "resolved" ? "resolved" : "open", mine: view === "mine" || undefined, rule: rule || undefined };
  const { data, error, loading, reload } = useApi("/flags", params);
  const items = data?.items || [];
  const selected = items.find((f) => f.id === selectedId) || items[0];

  const done = (msg) => { setToast(msg); reload(); notifyChanged(); };
  return (
    <>
      <div className="spread" style={{ alignItems: "flex-end" }}>
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1 className="page-title">Attention</h1>
          <span className="muted">{loading ? "Checking rules…" : view === "resolved" ? "Recently resolved flags." : `${items.length} open${rule ? ` · ${RULE_LABEL[rule]}` : ""}. Rules were checked just now.`}</span>
        </div>
        <div className="seg" role="group" aria-label="Whose flags">
          {[["team", "Team"], ["mine", "Mine"], ["resolved", "Resolved"]].map(([k, l]) => (
            <button key={k} aria-pressed={view === k} onClick={() => { setView(k); setSelectedId(null); }}>{l}</button>
          ))}
        </div>
      </div>

      {view !== "resolved" && (
        <div className="row wrap" role="group" aria-label="Filter by rule">
          {RULES.map((r) => (
            <button key={r} className="chip" aria-pressed={rule === r} onClick={() => setRule(rule === r ? null : r)}>
              <Shape kind={r} size={10} />{RULE_LABEL[r]}<b>{data?.counts?.[r] || 0}</b>
            </button>
          ))}
        </div>
      )}

      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <div className="panel panel-body"><Loading rows={6} /></div> : items.length === 0 ? (
        <div className="panel">
          <Empty title={view === "resolved" ? "Nothing resolved yet" : "Nothing needs attention"}>
            {view === "resolved" ? "Flags you or the rules close will appear here." : "Every activity is on time, proven and on pace. Rules re-check after every change."}
          </Empty>
        </div>
      ) : (
        <div className="two-col">
          <div className="wide panel" style={{ overflow: "hidden" }}>
            <div className="flag-row flag-head" style={{ background: "var(--stone)", cursor: "default", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", paddingTop: 10, paddingBottom: 10, borderTop: 0 }} aria-hidden="true">
              <span>Flag</span><span>About</span><span>Owner</span><span style={{ textAlign: "right" }}>{view === "resolved" ? "Closed" : "Open"}</span>
            </div>
            {items.map((f) => (
              <button key={f.id} className="flag-row" aria-current={selected?.id === f.id} onClick={() => setSelectedId(f.id)}>
                <span className="status" style={{ color: f.rule === "overdue" ? "var(--bad)" : f.rule === "blocked" ? "var(--slate)" : f.rule === "due_soon" ? "var(--cobalt)" : "var(--risk)" }}>
                  <Shape kind={f.rule} />{RULE_LABEL[f.rule]}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <b>{f.title}</b>
                  <span className="small muted">{f.project_name} · {f.detail}</span>
                </span>
                <span style={{ fontSize: 14 }}>{f.owner?.full_name || "Unassigned"}</span>
                <span className="muted" style={{ fontSize: 14, textAlign: "right" }}>{age(view === "resolved" ? f.resolved_at : f.opened_at)}</span>
              </button>
            ))}
          </div>
          {selected && <FlagPanel key={selected.id} flag={selected} canAct={can.manage && view !== "resolved"} me={user} onDone={done} />}
        </div>
      )}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}

function FlagPanel({ flag, canAct, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [people, setPeople] = useState([]);
  const [followUp, setFollowUp] = useState(false);
  useEffect(() => {
    api(`/flags/${flag.id}/history`).then(setHistory).catch(() => setHistory([]));
    if (canAct) api("/users").then(setPeople).catch(() => {});
  }, [flag.id, canAct]);

  const act = async (fn, msg) => {
    setBusy(true);
    setError(null);
    try { await fn(); onDone(msg); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const p = flag.data;
  const subjectLink = flag.subject_type === "activity" ? `/app/activities/${flag.subject_id}` : `/app/projects/${flag.project_id}`;
  return (
    <aside className="narrow panel panel-body stack" aria-label="Selected flag">
      <div className="stack-sm">
        <h2 style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600 }}>{flag.title}</h2>
        <span className="small" style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: "21px" }}>{RULE_WHY[flag.rule]}</span>
      </div>
      {flag.rule === "behind_pace" && p?.target != null && (
        <div className="stack-sm">
          <PaceLine pace={p} />
          <div className="spread small muted"><span>{p.actual} done, {Math.round(p.actual_pct)}%</span><span>Expected {p.expected} today</span></div>
        </div>
      )}
      <dl className="facts">
        <dt>What</dt><dd>{flag.detail}</dd>
        <dt>Project</dt><dd>{flag.project_name}</dd>
        <dt>Owner</dt><dd>{flag.owner?.full_name || "Unassigned"}</dd>
        <dt>Opened</dt><dd>{fmtDateTime(flag.opened_at)}</dd>
        {flag.resolution_note && <><dt>Resolution</dt><dd>{flag.resolution_note}{flag.resolved_by && ` (${flag.resolved_by.full_name})`}</dd></>}
      </dl>
      <Link className="btn" to={subjectLink} style={{ alignSelf: "flex-start" }}>Open {flag.subject_type}</Link>
      {history.length > 0 && (
        <div className="stack-sm" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 14 }}>
          <b>History</b>
          {history.slice(0, 6).map((h) => <div key={h.id} className="history-item"><span className="muted">{fmtDate(h.at)}</span><span>{h.summary}</span></div>)}
        </div>
      )}
      {canAct && (
        <div className="stack" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 14 }}>
          <ErrorNotice error={error} />
          <Field label="Reassign to">
            <select className="select" value={flag.owner?.id || ""} disabled={busy}
              onChange={(e) => act(() => api(`/flags/${flag.id}/reassign`, { method: "POST", body: { owner_id: e.target.value } }), "Reassigned")}>
              <option value="" disabled>Choose a person</option>
              {people.filter((u) => u.is_active && u.role !== "viewer").map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
          <Field label="Resolution note" hint="Required to resolve">
            <textarea className="textarea" rows={2} value={note} placeholder="What was decided, and by whom" onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="row wrap">
            <button className="btn btn-primary" disabled={busy} onClick={() => setFollowUp(true)}>Add follow-up activity</button>
            <button className="btn" disabled={busy || note.trim().length < 3} onClick={() => act(() => api(`/flags/${flag.id}/resolve`, { method: "POST", body: { note } }), "Flag resolved")}>Resolve</button>
            <button className="btn btn-quiet" disabled={busy} onClick={() => act(() => api(`/flags/${flag.id}/snooze`, { method: "POST", body: { days: 3 } }), "Snoozed for 3 days")}>Snooze 3 days</button>
          </div>
        </div>
      )}
      {followUp && <FollowUpDialog flag={flag} people={people} onClose={() => setFollowUp(false)} onDone={() => { setFollowUp(false); onDone("Follow-up activity added"); }} />}
    </aside>
  );
}

function FollowUpDialog({ flag, people, onClose, onDone }) {
  const [form, setForm] = useState({ title: `Follow up: ${flag.title}`.slice(0, 200), due_on: "", owner_id: flag.owner?.id || "" });
  const [error, setError] = useState(null);
  const submit = async () => {
    try {
      await api(`/flags/${flag.id}/follow-up`, { method: "POST", body: { ...form, owner_id: form.owner_id || null } });
      onDone();
    } catch (e) { setError(e); }
  };
  return (
    <Dialog title="Add follow-up activity" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={!form.due_on}>Add activity</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error} />
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Due"><input className="input" type="date" value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} /></Field>
          <Field label="Owner"><select className="select" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
            <option value="">Same as the flag</option>{people.filter((u) => u.role !== "viewer").map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select></Field>
        </div>
        <p className="small muted">It is added to the same commitment and needs a short note on what was done to complete.</p>
      </div>
    </Dialog>
  );
}
