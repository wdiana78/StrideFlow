import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, PREVIEW } from "../api";
import PLATFORM from "../platform.json";
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
        <div className="stack-sm"><Link to="/" className="small">← Back</Link><h1 style={{ fontSize: 26, fontWeight: 800 }}>Sign in to your workspace</h1></div>
        <ErrorNotice error={error} />
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {PREVIEW ? (
          <div className="stack-sm" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 16 }}>
            <b style={{ fontSize: 14 }}>Try it as</b>
            {[["zawadi@timiza.example", "🤝 Timiza Youth Initiative", "Community organization · manager"],
              ["wairimu@mwangaza.example", "🎨 Mwangaza Creative Studio", "Agency · admin"],
              ["wanjiru@hatua.example", "👟 Hatua Shoes", "Retail brand · admin"],
              ["rehema@pwani.example", "🏝️ Pwani Coast Stays", "Hospitality · admin"],
              ["admin@timiza.example", "🔑 Timiza admin", "Install apps, people, audit log"],
              ["baraka@timiza.example", "🙋 Timiza field officer", "Member: only their own work"]].map(([email, name, what]) => (
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
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ industry: "community", organization_name: "", site_slug: "", palette: "blossom", currency: "KES", full_name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  const errs = fieldErrors(error);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ind = PLATFORM.industries.find((i) => i.key === form.industry);
  const apps = Object.fromEntries(PLATFORM.apps.map((a) => [a.key, a]));
  const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { signIn(await api("/auth/register", { method: "POST", body: { ...form, site_slug: form.site_slug || null } })); nav("/app", { replace: true }); }
    catch (err) { setError(err); if (err.data?.detail?.field === "site_slug") setStep(2); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card" style={{ maxWidth: 880, borderRadius: 24, boxShadow: "var(--shadow-float)" }} onSubmit={submit} noValidate>
        <div className="spread"><Link to="/" className="brand" style={{ padding: 0 }}><Logo size={28} />Kept</Link>
          <div className="row" style={{ gap: 6 }}>{[1, 2, 3].map((n) => <span key={n} style={{ width: n === step ? 28 : 10, height: 10, borderRadius: 5, background: n <= step ? "var(--cobalt)" : "var(--rule)", transition: "width .2s" }} />)}</div></div>
        <ErrorNotice error={error && !Object.keys(errs).length ? error : null} />
        {step === 1 && (
          <>
            <div className="stack-sm"><h1 style={{ fontSize: 30, fontWeight: 800 }}>What kind of organization are you?</h1><p className="muted">We install the right apps. You can add or remove apps any time.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {PLATFORM.industries.map((i, k) => (
                <button type="button" key={i.key} aria-pressed={form.industry === i.key} onClick={() => setForm({ ...form, industry: i.key })}
                  className="stack-sm" style={{ textAlign: "left", padding: 16, borderRadius: 16, cursor: "pointer", border: form.industry === i.key ? "2px solid var(--cobalt)" : "1px solid var(--rule)", background: form.industry === i.key ? "linear-gradient(150deg, var(--cobalt-tint), #fff)" : "#fff" }}>
                  <b style={{ fontSize: 16 }}>{INDUSTRY_EMOJI[i.key]} {i.name}</b>
                  <span className="row wrap" style={{ gap: 4 }}>{i.apps.slice(0, 5).map((a) => <span key={a} className="dot" title={apps[a].name} style={{ background: apps[a].color, width: 10, height: 10 }} />)}<span className="small muted">{i.apps.length} apps</span></span>
                </button>
              ))}
            </div>
            <div className="stack-sm"><b className="small">Installs for {ind.name.toLowerCase()}</b>
              <div className="row wrap" style={{ gap: 8 }}>{ind.apps.map((a) => <span key={a} className="chip-tone" style={{ background: `${apps[a].color}22`, color: "var(--ink)" }}><span className="dot" style={{ background: apps[a].color }} />{apps[a].name}</span>)}</div></div>
            <button type="button" className="btn btn-primary btn-lg" style={{ alignSelf: "flex-end" }} onClick={() => setStep(2)}>Continue</button>
          </>
        )}
        {step === 2 && (
          <>
            <div className="stack-sm"><h1 style={{ fontSize: 30, fontWeight: 800 }}>Your organization and website</h1></div>
            <Field label="Organization name" error={errs.organization_name}><input className="input" value={form.organization_name} autoFocus onChange={(e) => setForm({ ...form, organization_name: e.target.value, site_slug: form.site_slug || slugify(e.target.value) })} /></Field>
            <Field label="Website address" hint="Optional" error={errs.site_slug}>
              <div className="row" style={{ gap: 0 }}><span className="input" style={{ width: "auto", display: "flex", alignItems: "center", background: "var(--stone)", borderRadius: "10px 0 0 10px", color: "var(--slate)" }}>kept.africa/site/</span>
                <input className="input" style={{ borderRadius: "0 10px 10px 0", borderLeft: 0 }} value={form.site_slug} onChange={(e) => setForm({ ...form, site_slug: slugify(e.target.value) })} /></div>
            </Field>
            <div className="stack-sm"><b className="small">Brand palette</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                {Object.entries(PLATFORM.palettes).map(([k, p]) => (
                  <button type="button" key={k} aria-pressed={form.palette === k} onClick={() => setForm({ ...form, palette: k })} className="stack-sm"
                    style={{ padding: 12, borderRadius: 14, cursor: "pointer", border: form.palette === k ? "2px solid var(--cobalt)" : "1px solid var(--rule)", background: "#fff", textAlign: "left" }}>
                    <span className="row" style={{ gap: 0 }}>{p.colors.map((c) => <span key={c} style={{ flex: 1, height: 28, background: c }} />)}</span><b className="small">{p.name}</b>
                  </button>
                ))}
              </div></div>
            <div className="row" style={{ justifyContent: "space-between" }}><button type="button" className="btn" onClick={() => setStep(1)}>Back</button><button type="button" className="btn btn-primary btn-lg" disabled={form.organization_name.trim().length < 2} onClick={() => setStep(3)}>Continue</button></div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="stack-sm"><h1 style={{ fontSize: 30, fontWeight: 800 }}>Your admin account</h1><p className="muted">You can invite your team next.</p></div>
            <div className="form-grid">
              <Field label="Your name" error={errs.full_name}><input className="input" autoComplete="name" value={form.full_name} onChange={set("full_name")} autoFocus /></Field>
              <Field label="Work email" error={errs.email}><input className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
            </div>
            <Field label="Password" hint="10+ characters, letters and numbers" error={errs.password}><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
            <div className="row" style={{ justifyContent: "space-between" }}><button type="button" className="btn" onClick={() => setStep(2)}>Back</button><button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Setting up…" : "Create workspace"}</button></div>
          </>
        )}
        <p className="small muted">Already on Kept? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}

export const INDUSTRY_EMOJI = { community: "🤝", agency: "🎨", retail: "👟", hospitality: "🏝️", education: "🎓", health: "🩺" };
