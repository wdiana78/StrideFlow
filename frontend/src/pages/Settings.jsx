import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog, ErrorNotice, Field, Loading, Toast } from "../components/ui";
import { fmtDateTime } from "../format";
import { useApi } from "../hooks";

export default function Settings() {
  const [tab, setTab] = useState("people");
  return (
    <>
      <h1 className="page-title">Settings</h1>
      <div className="tabs" role="tablist">
        {[["people", "People and roles"], ["stakeholders", "Funders and clients"], ["audit", "Audit log"]].map(([k, l]) => (
          <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "people" && <People />}
      {tab === "stakeholders" && <Stakeholders />}
      {tab === "audit" && <Audit />}
    </>
  );
}

function People() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi("/users");
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState(null);
  const update = async (u, body, msg) => {
    setErr(null);
    try { await api(`/users/${u.id}`, { method: "PATCH", body }); setToast(msg); reload(); } catch (e) { setErr(e); }
  };
  if (loading && !data) return <Loading />;
  return (
    <section className="panel">
      <div className="panel-head"><h2>People</h2><button className="btn btn-primary" onClick={() => setInvite(true)}>Add person</button></div>
      <ErrorNotice error={error || err} onRetry={reload} />
      <div className="table-wrap"><table className="table" style={{ minWidth: 640 }}>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th style={{ textAlign: "right" }}>Access</th></tr></thead>
        <tbody>{data.map((u) => (
          <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
            <td className="strong">{u.full_name}{u.id === user.id && <span className="muted" style={{ fontWeight: 400 }}> (you)</span>}</td>
            <td className="muted">{u.email}</td>
            <td><select className="select" style={{ width: "auto" }} aria-label={`Role for ${u.full_name}`} value={u.role} disabled={u.id === user.id}
              onChange={(e) => update(u, { role: e.target.value }, `${u.full_name} is now ${e.target.value}`)}>
              <option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option><option value="viewer">Viewer</option>
            </select></td>
            <td style={{ textAlign: "right" }}>{u.id !== user.id && (
              <button className={"btn" + (u.is_active ? " btn-danger" : "")} onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? "Access removed" : "Access restored")}>{u.is_active ? "Remove access" : "Restore access"}</button>
            )}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="panel-body small muted">Admins manage people and settings. Managers plan work and resolve flags. Members work on activities assigned to them. Viewers can read everything and change nothing.</div>
      {invite && <InviteDialog onClose={() => setInvite(false)} onDone={() => { setInvite(false); setToast("Person added"); reload(); }} />}
      <Toast message={toast} onDone={() => setToast("")} />
    </section>
  );
}

function InviteDialog({ onClose, onDone }) {
  const [form, setForm] = useState({ full_name: "", email: "", role: "member", temporary_password: "" });
  const [error, setError] = useState(null);
  const submit = async () => { try { await api("/users", { method: "POST", body: form }); onDone(); } catch (e) { setError(e); } };
  return (
    <Dialog title="Add person" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Add person</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error} />
        <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Role"><select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="member">Member</option><option value="manager">Manager</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></Field>
          <Field label="Temporary password" hint="Share it privately"><input className="input" value={form.temporary_password} onChange={(e) => setForm({ ...form, temporary_password: e.target.value })} /></Field>
        </div>
      </div>
    </Dialog>
  );
}

function Stakeholders() {
  const { data, error, loading, reload } = useApi("/stakeholders");
  const [form, setForm] = useState({ name: "", kind: "funder", contact_email: "" });
  const [err, setErr] = useState(null);
  const add = async () => {
    setErr(null);
    try { await api("/stakeholders", { method: "POST", body: { ...form, contact_email: form.contact_email || null } }); setForm({ name: "", kind: "funder", contact_email: "" }); reload(); } catch (e) { setErr(e); }
  };
  if (loading && !data) return <Loading />;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Funders, clients and partners</h2></div>
      <ErrorNotice error={error || err} onRetry={reload} />
      <div className="panel-body row wrap" style={{ alignItems: "flex-end", gap: 12, borderBottom: "1px solid var(--rule-soft)" }}>
        <div style={{ flex: "2 1 220px" }}><Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
        <div style={{ flex: "1 1 140px" }}><Field label="Kind"><select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="funder">Funder</option><option value="client">Client</option><option value="partner">Partner</option><option value="supplier">Supplier</option></select></Field></div>
        <div style={{ flex: "2 1 220px" }}><Field label="Contact email" hint="Optional"><input className="input" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field></div>
        <button className="btn btn-primary" disabled={form.name.trim().length < 2} onClick={add}>Add</button>
      </div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Kind</th><th>Contact</th><th /></tr></thead>
        <tbody>{data.map((s) => (
          <tr key={s.id}><td className="strong">{s.name}</td><td style={{ textTransform: "capitalize" }}>{s.kind}</td><td className="muted">{s.contact_email || "None"}</td>
            <td style={{ textAlign: "right" }}><button className="btn btn-quiet" style={{ color: "var(--bad)" }} onClick={async () => { if (confirm(`Remove ${s.name}? Projects keep their records.`)) { await api(`/stakeholders/${s.id}`, { method: "DELETE" }); reload(); } }}>Remove</button></td></tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi("/audit", { page, page_size: 25 });
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  return (
    <section className="panel">
      <div className="panel-head"><h2>Audit log</h2><span className="small muted">Every meaningful change, including the ones the rules make.</span></div>
      <div className="table-wrap"><table className="table" style={{ minWidth: 640 }}>
        <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
        <tbody>{data.items.map((e) => (
          <tr key={e.id}><td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.at)}</td><td>{e.actor?.full_name || <span className="muted">Rules</span>}</td><td>{e.summary || e.action}</td></tr>
        ))}</tbody>
      </table></div>
      <div className="pager"><span>{data.total} events</span><div className="row"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </section>
  );
}
