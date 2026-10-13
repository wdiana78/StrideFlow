import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";
import { ErrorNotice, Field } from "../components/ui";

function fieldErrors(err) {
  const out = {};
  (err?.data?.errors || []).forEach((e) => { out[e.field] = e.message; });
  return out;
}

export function Login() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      signIn(await api("/auth/login", { method: "POST", body: form }));
      nav(loc.state?.from || "/app", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const demo = () => setForm({ email: "achieng@tumaini.example", password: "kept-demo-2026" });
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <Link to="/" className="brand" style={{ padding: 0 }}><Logo />Kept</Link>
        <div className="stack-sm"><h1 style={{ fontSize: 26, fontWeight: 700 }}>Sign in</h1><p className="muted">Pick up where your team left off.</p></div>
        <ErrorNotice error={error} />
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {PREVIEW ? (
          <div className="stack-sm" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 16 }}>
            <b style={{ fontSize: 14 }}>Try it as</b>
            {[["achieng@tumaini.example", "Achieng Otieno", "Manager: plans work, resolves flags, generates reports"],
              ["brian@tumaini.example", "Brian Mutua", "Member: only his own activities"],
              ["admin@tumaini.example", "Grace Nduta", "Admin: people, roles, audit log"],
              ["viewer@tumaini.example", "Board Observer", "Viewer: read only"],
              ["wairimu@mwangaza.example", "Wairimu Kamau", "Creative agency, the client-engagement template"]].map(([email, name, what]) => (
              <button key={email} type="button" className="btn" style={{ height: "auto", padding: "10px 14px", justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                onClick={async () => { try { signIn(await api("/auth/login", { method: "POST", body: { email, password: "kept-demo-2026" } })); nav("/app", { replace: true }); } catch (err) { setError(err); } }}>
                <span style={{ display: "flex", flexDirection: "column" }}><span>{name}</span><span className="small muted" style={{ fontWeight: 400 }}>{what}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="notice notice-warn small">Demo: <button type="button" className="btn btn-quiet" style={{ height: 28, padding: "0 6px" }} onClick={demo}>fill in the demo manager account</button></div>
        )}
        <p className="small muted">New here? <Link to="/register">Create your organization</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ organization_name: "", sector: "", currency: "KES", full_name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  const errs = fieldErrors(error);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      signIn(await api("/auth/register", { method: "POST", body: form }));
      nav("/app/projects?new=1", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card" style={{ maxWidth: 560 }} onSubmit={submit} noValidate>
        <Link to="/" className="brand" style={{ padding: 0 }}><Logo />Kept</Link>
        <div className="stack-sm"><h1 style={{ fontSize: 26, fontWeight: 700 }}>Create your organization</h1><p className="muted">You will be its administrator. You can invite your team next.</p></div>
        <ErrorNotice error={error} />
        <Field label="Organization name" error={errs.organization_name}><input className="input" value={form.organization_name} onChange={set("organization_name")} aria-invalid={!!errs.organization_name} /></Field>
        <div className="form-grid">
          <Field label="Sector" hint="Optional"><input className="input" placeholder="Community development" value={form.sector} onChange={set("sector")} /></Field>
          <Field label="Currency" error={errs.currency}><select className="select" value={form.currency} onChange={set("currency")}><option>KES</option><option>UGX</option><option>TZS</option><option>USD</option><option>EUR</option></select></Field>
        </div>
        <Field label="Your name" error={errs.full_name}><input className="input" autoComplete="name" value={form.full_name} onChange={set("full_name")} aria-invalid={!!errs.full_name} /></Field>
        <Field label="Work email" error={errs.email}><input className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errs.email} /></Field>
        <Field label="Password" hint="At least 8 characters" error={errs.password}><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-invalid={!!errs.password} /></Field>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Creating…" : "Create organization"}</button>
        <p className="small muted">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
