import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { notifyChanged } from "../components/Shell";
import { Dialog, Empty, ErrorNotice, Field, Loading, Shape } from "../components/ui";
import { fmtDate } from "../format";
import { useApi } from "../hooks";

export default function Projects() {
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("attention");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi("/projects", { q: query, status, sort, page, page_size: 10 });
  const showNew = sp.get("new") === "1" && can.manage;
  useEffect(() => { const t = setTimeout(() => { setQuery(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <div className="spread">
        <h1 className="page-title">Projects</h1>
        {can.manage && <button className="btn btn-primary" onClick={() => setSp({ new: "1" })}>New project</button>}
      </div>
      <div className="panel">
        <div className="panel-head">
          <label className="row" style={{ border: "1px solid var(--control)", borderRadius: 6, padding: "0 10px", height: 40, flex: "1 1 240px", maxWidth: 360 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4" /></svg>
            <span className="sr-only">Search projects</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by project or funder" style={{ border: 0, outline: "none", flex: 1, minWidth: 0 }} />
          </label>
          <div className="row wrap">
            <label className="row small muted">Status
              <select className="select" style={{ width: "auto" }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Active and completed</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option>
              </select>
            </label>
            <label className="row small muted">Sort
              <select className="select" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="attention">Most flags first</option><option value="ends_on">Ending soonest</option><option value="name">Name</option>
              </select>
            </label>
          </div>
        </div>
        <ErrorNotice error={error} onRetry={reload} />
        {loading && !data ? <div className="panel-body"><Loading /></div> : data.items.length === 0 ? (
          <Empty title={query ? "No projects match that search" : "No projects yet"}
            action={can.manage && !query && <button className="btn btn-primary" onClick={() => setSp({ new: "1" })}>Create the first project</button>}>
            {query ? "Try another name or funder." : "A project holds the promises you made to a funder or client and the work behind them."}
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 720 }}>
                <thead><tr><th>Project</th><th>Owed to</th><th>Dates</th><th>Manager</th><th>Commitments</th><th style={{ textAlign: "right" }}>Open flags</th></tr></thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td><Link className="row-link" to={`/app/projects/${p.id}`}>{p.name}</Link>{p.status !== "active" && <span className="small muted"> · {p.status}</span>}</td>
                      <td>{p.stakeholder?.name || <span className="muted">None</span>}</td>
                      <td className="muted">{fmtDate(p.starts_on)} to {fmtDate(p.ends_on, true)}</td>
                      <td>{p.manager?.full_name}</td>
                      <td>{p.commitments_attention > 0
                        ? <span className="status" style={{ color: "var(--risk)" }}><Shape kind="at_risk" />{p.commitments_attention} of {p.commitments_total} need attention</span>
                        : <span className="status" style={{ color: "var(--ok)" }}><Shape kind="on_track" />{p.commitments_total} on track</span>}</td>
                      <td style={{ textAlign: "right" }}>{p.open_flags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>{data.total} project{data.total === 1 ? "" : "s"}</span>
              <div className="row">
                <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {page} of {pages}</span>
                <button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
      {showNew && <NewProjectDialog onClose={() => setSp({})} />}
    </>
  );
}

function NewProjectDialog({ onClose }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", starts_on: "", ends_on: "", template_id: "", stakeholder_id: "", manager_id: user.id });
  const [commitments, setCommitments] = useState([]);
  const [newFunder, setNewFunder] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/templates").then((t) => { setTemplates(t); if (t[0]) pick(t[0].id, t); });
    api("/stakeholders").then(setStakeholders);
    api("/users").then(setPeople);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tpl = templates.find((t) => t.id === form.template_id);
  const vocab = tpl?.vocabulary || { stakeholder: "Funder or client", commitment: "Commitment" };
  function pick(id, list = templates) {
    const t = list.find((x) => x.id === id);
    setForm((f) => ({ ...f, template_id: id }));
    setCommitments((t?.blueprint?.commitments || []).map((c) => ({ ...c, due_on: "" })));
  }
  const setC = (i, k, v) => setCommitments(commitments.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let stakeholder_id = form.stakeholder_id || null;
      if (stakeholder_id === "__new") {
        const kind = tpl?.key === "client_engagement" ? "client" : "funder";
        stakeholder_id = (await api("/stakeholders", { method: "POST", body: { name: newFunder, kind } })).id;
      }
      const body = {
        ...form, stakeholder_id, template_id: form.template_id || null,
        commitments: commitments.filter((c) => c.title.trim()).map((c) => ({ ...c, target_value: Number(c.target_value), due_on: c.due_on || form.ends_on })),
      };
      const p = await api("/projects", { method: "POST", body });
      notifyChanged();
      nav(`/app/projects/${p.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="New project" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !form.name || !form.starts_on || !form.ends_on} onClick={submit}>{busy ? "Creating…" : "Create project"}</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error} />
        <Field label="Template" hint="Sets vocabulary and the proof each kind of work needs">
          <select className="select" value={form.template_id} onChange={(e) => pick(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Project name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Women in Agribusiness, Machakos" /></Field>
        <div className="form-grid">
          <Field label="Starts"><input className="input" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></Field>
          <Field label="Ends"><input className="input" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></Field>
          <Field label={`Owed to (${vocab.stakeholder.toLowerCase()})`}>
            <select className="select" value={form.stakeholder_id} onChange={(e) => setForm({ ...form, stakeholder_id: e.target.value })}>
              <option value="">None yet</option>
              {stakeholders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new">Add a new one…</option>
            </select>
          </Field>
          <Field label="Manager">
            <select className="select" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              {people.filter((u) => ["admin", "manager"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
        </div>
        {form.stakeholder_id === "__new" && <Field label={`New ${vocab.stakeholder.toLowerCase()} name`}><input className="input" value={newFunder} onChange={(e) => setNewFunder(e.target.value)} /></Field>}
        <div className="stack-sm">
          <b>{vocab.commitment}s</b>
          <span className="small muted">What you promised. Edit the suggestions; leave a due date empty to use the project end date.</span>
          {commitments.map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 140px 40px", gap: 8, alignItems: "end" }}>
              <input className="input" aria-label="Title" value={c.title} onChange={(e) => setC(i, "title", e.target.value)} />
              <input className="input" aria-label="Target" type="number" min="1" value={c.target_value} onChange={(e) => setC(i, "target_value", e.target.value)} />
              <input className="input" aria-label="Unit" value={c.unit} onChange={(e) => setC(i, "unit", e.target.value)} />
              <input className="input" aria-label="Due" type="date" value={c.due_on} onChange={(e) => setC(i, "due_on", e.target.value)} />
              <button className="btn btn-quiet" aria-label="Remove" onClick={() => setCommitments(commitments.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className="btn btn-quiet" style={{ alignSelf: "flex-start" }} onClick={() => setCommitments([...commitments, { title: "", unit: "", measure: "sum", target_value: 1, due_on: "" }])}>Add another</button>
        </div>
      </div>
    </Dialog>
  );
}
