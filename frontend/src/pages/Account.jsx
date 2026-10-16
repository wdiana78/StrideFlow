import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ThemeToggle from "../components/ThemeToggle";
import { ErrorNotice, Field, PasswordInput, PasswordRules } from "../components/ui";
import { initials } from "../format";
import { roleLabel } from "./Overview";

const CAN = {
  admin: ["Everything a manager can do", "Invite people, change roles and deactivate accounts", "Install and remove apps", "Read the full audit log", "Edit the website and brand"],
  manager: ["Plan projects, tasks and targets", "Approve expenses, purchase requests and leave", "Build Tazama forms and see every response", "Generate and share reports", "Resolve alerts for the team"],
  member: ["Record your work and attach evidence", "Collect Tazama responses in the field, online or offline", "Raise expenses and purchase requests for approval", "See alerts assigned to you"],
  viewer: ["See results, budgets and reports", "Download reports", "Nothing can be changed from a read-only account"],
};

export default function Account() {
  const { user, signIn, signOut } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [state, setState] = useState({ busy: false, error: null, ok: "" });
  const change = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) { setState({ busy: false, error: new Error("The new passwords do not match."), ok: "" }); return; }
    setState({ busy: true, error: null, ok: "" });
    try { signIn(await api("/auth/password", { method: "POST", body: { current_password: f.current, new_password: f.next } })); setF({ current: "", next: "", confirm: "" }); setState({ busy: false, error: null, ok: "Password changed. Your other devices have been signed out." }); }
    catch (er) { setState({ busy: false, error: er, ok: "" }); }
  };
  const everywhere = async () => {
    if (!confirm("Sign out on every device, including this one?")) return;
    try { await api("/auth/logout-everywhere", { method: "POST" }); } catch { /* signed out locally regardless */ }
    signOut(); nav("/login");
  };
  return (
    <>
      <div className="page-hero"><div className="stack-sm" style={{ gap: 2 }}><h1>My account</h1><span className="muted">{user.organization.name}</span></div></div>
      <div className="two-col">
        <section className="wide panel panel-body stack">
          <div className="row" style={{ gap: 16 }}>
            <span className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials(user.full_name)}</span>
            <div className="stack-sm" style={{ gap: 2 }}><b style={{ fontSize: 20 }}>{user.full_name}</b><span className="muted">{user.email}</span><span className="date-chip" style={{ alignSelf: "flex-start" }}>{roleLabel(user.role)}</span></div>
          </div>
          <div>
            <h2 className="card-title" style={{ marginBottom: 8 }}>What your role allows</h2>
            <ul className="can-list">{(CAN[user.role] || []).map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="small muted" style={{ marginTop: 8 }}>Roles are set by your organization's administrator.</p>
          </div>
          <div className="spread"><div><h2 className="card-title">Appearance</h2><span className="small muted">Light or dark, remembered on this device.</span></div><ThemeToggle /></div>
        </section>
        <aside className="narrow stack">
          <form className="panel panel-body stack" onSubmit={change} noValidate>
            <h2 className="card-title">Change password</h2>
            {state.ok && <div className="notice notice-ok">{state.ok}</div>}
            <ErrorNotice error={state.error} />
            <Field label="Current password"><PasswordInput value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
            <Field label="New password"><PasswordInput autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /><PasswordRules value={f.next} /></Field>
            <Field label="Confirm new password"><PasswordInput autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={state.busy || !f.current || !f.next}>{state.busy ? "Saving..." : "Change password"}</button>
          </form>
          <section className="panel panel-body stack-sm">
            <h2 className="card-title">Devices</h2>
            <span className="small muted">Lost a phone or used a shared computer? Sign out everywhere at once.</span>
            <button className="btn btn-danger" onClick={everywhere}>Sign out on all devices</button>
          </section>
        </aside>
      </div>
    </>
  );
}
