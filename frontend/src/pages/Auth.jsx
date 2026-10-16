import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";
import { ErrorNotice, Field, PasswordInput, PasswordRules } from "../components/ui";
import PLATFORM from "../platform.json";

/** Field-level messages from either shape the API returns: {detail: {message, field}} or {errors: [{field, message}]}. */
function fieldErrors(err) {
  const out = {};
  (err?.data?.errors || []).forEach((e) => { if (e.field) out[e.field.split(".").pop()] = e.message; });
  const d = err?.data?.detail;
  if (d && typeof d === "object" && d.field) out[d.field] = d.message;
  return out;
}
// Shown in the banner only when no field can carry the message.
const generalError = (err) => (err && !Object.keys(fieldErrors(err)).length ? err : null);

function AuthCard({ title, sub, children, onSubmit }) {
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <Link to="/" className="brand" style={{ padding: 0 }} aria-label="StrideFlow home"><Logo />StrideFlow</Link>
        <div className="stack-sm" style={{ gap: 6 }}><h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.01em" }}>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
        {children}
      </form>
    </div>
  );
}

// ---------- sign in ----------
const PREVIEW_ACCOUNTS = [["zawadi@timiza.example", "Timiza Youth Initiative", "Community organization · manager"], ["wairimu@mwangaza.example", "Mwangaza Creative Studio", "Creative studio · admin"],
  ["wanjiru@hatua.example", "Hatua Apparel", "Retail chain · owner"], ["rehema@pwani.example", "Pwani Hotels & Safaris", "Hotels and tours · general manager"],
  ["baraka@timiza.example", "Timiza, field officer", "Member: only their own work"]];

export function Login() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  const go = async (body) => {
    setBusy(true); setError(null);
    try { signIn(await api("/auth/login", { method: "POST", body })); nav(loc.state?.from || "/app", { replace: true }); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <AuthCard title="Sign in to StrideFlow" onSubmit={(e) => { e.preventDefault(); go(form); }}>
      {loc.state?.notice && <div className="notice notice-ok" role="status">{loc.state.notice}</div>}
      <ErrorNotice error={error} />
      <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Password"><PasswordInput required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
      <div className="spread"><span /><Link to="/forgot-password" className="small">Forgot password?</Link></div>
      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      {PREVIEW && (
        <div className="stack-sm" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 16 }}>
          <b style={{ fontSize: 14 }}>Demonstration accounts</b>
          <span className="small muted">Illustrative organizations with sample data.</span>
          {PREVIEW_ACCOUNTS.map(([email, name, what]) => (
            <button key={email} type="button" className="btn" style={{ height: "auto", padding: "10px 14px", justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
              onClick={() => go({ email, password: "kept-demo-2026" })}>
              <span style={{ display: "flex", flexDirection: "column" }}><span>{name}</span><span className="small muted" style={{ fontWeight: 400 }}>{what}</span></span>
            </button>
          ))}
        </div>
      )}
      <p className="small muted">New to StrideFlow? <Link to="/register">Create a workspace</Link></p>
    </AuthCard>
  );
}

// ---------- sign up ----------
export function Register() {
  const { user, signIn } = useAuth();
  const [form, setForm] = useState({ full_name: "", organization_name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  if (created) return <Navigate to="/app/welcome" replace />;
  if (user) return <Navigate to="/app" replace />;
  const errs = fieldErrors(error);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const res = await api("/auth/register", { method: "POST", body: form }); setCreated(true); signIn(res); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <AuthCard title="Create your workspace" sub="Start with an empty workspace and set it up your way. No payment details needed." onSubmit={submit}>
      <ErrorNotice error={generalError(error)} />
      <Field label="Your name" error={errs.full_name}><input className="input" autoComplete="name" value={form.full_name} onChange={set("full_name")} /></Field>
      <Field label="Organization or business name" error={errs.organization_name}><input className="input" autoComplete="organization" value={form.organization_name} onChange={set("organization_name")} /></Field>
      <Field label="Work email" error={errs.email}><input className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
      <Field label="Password" error={errs.password}>
        <PasswordInput autoComplete="new-password" value={form.password} onChange={set("password")} invalid={!!errs.password} />
        <PasswordRules value={form.password} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Creating your workspace..." : "Create workspace"}</button>
      <p className="small muted">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthCard>
  );
}

// ---------- password reset ----------
export function ForgotPassword() {
  const [emailAddr, setEmailAddr] = useState("");
  const [state, setState] = useState({ busy: false, error: null, sent: "" });
  const submit = async (e) => {
    e.preventDefault(); setState({ busy: true, error: null, sent: "" });
    try { const r = await api("/auth/password-reset", { method: "POST", body: { email: emailAddr } }); setState({ busy: false, error: null, sent: r.message }); }
    catch (err) { setState({ busy: false, error: err, sent: "" }); }
  };
  return (
    <AuthCard title="Reset your password" sub="Enter the email you sign in with. We will send a link to choose a new password." onSubmit={submit}>
      {state.sent ? <div className="notice notice-ok" role="status">{state.sent}</div> : <>
        <ErrorNotice error={state.error} />
        <Field label="Email"><input className="input" type="email" autoComplete="email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} /></Field>
        <button className="btn btn-primary btn-lg" disabled={state.busy || !emailAddr}>{state.busy ? "Sending..." : "Send reset link"}</button>
      </>}
      {PREVIEW && state.sent && <span className="small muted">In this offline preview no email is sent. Reset links work on the hosted application.</span>}
      <p className="small muted"><Link to="/login">Back to sign in</Link></p>
    </AuthCard>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [state, setState] = useState({ busy: false, error: null });
  const errs = fieldErrors(state.error);
  const submit = async (e) => {
    e.preventDefault(); setState({ busy: true, error: null });
    try { const r = await api("/auth/password-reset/confirm", { method: "POST", body: { token: sp.get("token") || "", new_password: pw } }); nav("/login", { replace: true, state: { notice: r.message } }); }
    catch (err) { setState({ busy: false, error: err }); }
  };
  return (
    <AuthCard title="Choose a new password" sub="You will be signed out everywhere else." onSubmit={submit}>
      <ErrorNotice error={generalError(state.error)} />
      <Field label="New password" error={errs.password || errs.new_password}><PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><PasswordRules value={pw} /></Field>
      <button className="btn btn-primary btn-lg" disabled={state.busy || !pw}>{state.busy ? "Saving..." : "Save new password"}</button>
      <p className="small muted"><Link to="/forgot-password">Request a new link</Link></p>
    </AuthCard>
  );
}

// ---------- invitations ----------
export function AcceptInvitation() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState({ full_name: "", password: "" });
  const [state, setState] = useState({ busy: false, error: null });
  useEffect(() => { api(`/auth/invitations/${encodeURIComponent(token)}`).then((d) => { setInfo(d); setForm((f) => ({ ...f, full_name: d.full_name || "" })); }).catch(setLoadErr); }, [token]);
  const errs = fieldErrors(state.error);
  const submit = async (e) => {
    e.preventDefault(); setState({ busy: true, error: null });
    try { signIn(await api(`/auth/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: form })); nav("/app", { replace: true }); }
    catch (err) { setState({ busy: false, error: err }); }
  };
  if (loadErr) return <AuthCard title="This invitation is not valid"><ErrorNotice error={loadErr} /><Link className="btn" to="/login">Go to sign in</Link></AuthCard>;
  if (!info) return <AuthCard title="Checking your invitation..." />;
  return (
    <AuthCard title={`Join ${info.organization}`} sub={`You are invited as ${info.role === "admin" ? "an administrator" : `a ${info.role === "viewer" ? "read-only member" : info.role}`}. Your sign-in email will be ${info.email}.`} onSubmit={submit}>
      <ErrorNotice error={generalError(state.error)} />
      <Field label="Your name" error={errs.full_name}><input className="input" autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
      <Field label="Choose a password" error={errs.password}><PasswordInput autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><PasswordRules value={form.password} /></Field>
      <button className="btn btn-primary btn-lg" disabled={state.busy}>{state.busy ? "Joining..." : "Accept and join"}</button>
    </AuthCard>
  );
}

// ---------- first run: choose capabilities ----------
const GROUPS = [
  ["Plan and deliver work", ["projects", "forms", "events", "documents", "governance"]],
  ["Money and requests", ["finance", "procurement", "sales", "funding"]],
  ["Stock, locations and delivery", ["inventory", "branches", "deliveries"]],
  ["Bookings and services", ["bookings", "dining", "tours", "studio", "social"]],
  ["People", ["people", "participants"]],
];

export function Welcome() {
  const { user, refresh, can } = useAuth();
  const nav = useNavigate();
  const apps = PLATFORM.apps.filter((a) => !a.demo_only);
  const [chosen, setChosen] = useState(() => new Set(user?.organization?.installed_apps || []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!user) return <Navigate to="/login" replace />;
  if (!can.admin) return <Navigate to="/app" replace />;
  const toggle = (k) => { const n = new Set(chosen); n.has(k) ? n.delete(k) : n.add(k); setChosen(n); };
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const had = new Set(user.organization.installed_apps || []);
      for (const k of chosen) if (!had.has(k)) await api(`/apps/${k}/install`, { method: "POST" });
      for (const k of had) if (!chosen.has(k)) await api(`/apps/${k}/uninstall`, { method: "POST" });
      await refresh(); nav("/app", { replace: true });
    } catch (err) { setError(err); setBusy(false); }
  };
  const byKey = Object.fromEntries(apps.map((a) => [a.key, a]));
  return (
    <div className="welcome">
      <div className="welcome-head">
        <span className="eyebrow">Welcome, {user.full_name.split(" ")[0]}</span>
        <h1>What do you want to manage first?</h1>
        <p className="muted">Choose the capabilities {user.organization.name} needs now. You can add or remove them at any time from Capabilities; switching one off keeps its data.</p>
      </div>
      <ErrorNotice error={error} />
      {GROUPS.map(([label, keys]) => (
        <section key={label} className="welcome-group" aria-label={label}>
          <h2>{label}</h2>
          <div className="welcome-grid">
            {keys.filter((k) => byKey[k]).map((k) => (
              <label key={k} className={"welcome-opt" + (chosen.has(k) ? " on" : "")}>
                <input type="checkbox" checked={chosen.has(k)} onChange={() => toggle(k)} />
                <span><b>{byKey[k].name}</b><span>{byKey[k].tagline}</span></span>
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="welcome-actions">
        <span className="muted small">{chosen.size} selected</span>
        <button className="btn btn-primary btn-lg" disabled={busy || chosen.size === 0} onClick={save}>{busy ? "Setting up..." : "Continue to my workspace"}</button>
      </div>
    </div>
  );
}
