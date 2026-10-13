import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNotice, Field, Loading } from "../components/ui";
import { fmtDate, fmtNum, initials } from "../format";
import { useApi } from "../hooks";

// The organization's public portfolio. Content comes from the Website module; numbers come live from verified records.
const C = { teal: "#0E5E6F", tealDark: "#0A4552", sand: "#F7F3EA", sun: "#F2B33D", ink: "#1C2B2D" };
const go = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };

export default function PublicSite() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { data: s, error, loading, reload } = useApi(`/public/${slug}`);
  if (loading && !s) return <div style={{ padding: 40 }}><Loading rows={8} /></div>;
  if (error) return <div style={{ padding: 40 }}><ErrorNotice error={error} onRetry={reload} /></div>;
  const imp = s.impact;
  return (
    <div style={{ background: "#fff", color: C.ink, minHeight: "100%" }}>
      {user && (
        <div className="no-print" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-dark)", padding: "8px 24px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
          <span>You are viewing the public page. Everything here is edited in Website and updated from your records.</span>
          <span className="row"><Link to="/app/m/site_settings">Edit site</Link><Link to="/app">Back to the app</Link></span>
        </div>
      )}
      <header style={{ background: C.sand, borderBottom: "1px solid #e8e1cf" }}>
        <div className="container spread" style={{ padding: "18px 32px" }}>
          <a href="#top" onClick={go("top")} className="row" style={{ textDecoration: "none", color: C.ink, gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 }}>{initials(s.organization)}</span>
            <b style={{ fontSize: 18 }}>{s.organization}</b>
          </a>
          <nav className="row wrap" style={{ gap: 20, fontSize: 15 }} aria-label="Site">
            {[["about", "About"], ["programmes", "Programmes"], ["impact", "Impact"], ["team", "Team"], ["involved", "Get involved"]].map(([id, l]) =>
              <a key={id} href={`#${id}`} onClick={go(id)} style={{ color: C.ink, textDecoration: "none" }}>{l}</a>)}
            <a href="#involved" onClick={go("involved")} className="btn" style={{ background: C.teal, borderColor: C.teal, color: "#fff" }}>Volunteer with us</a>
          </nav>
        </div>
      </header>

      <section id="top" style={{ background: C.teal, color: "#fff" }}>
        <div className="container" style={{ padding: "88px 32px 96px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div className="stack" style={{ flex: "1 1 520px", gap: 22 }}>
            <span style={{ color: C.sun, fontWeight: 700, letterSpacing: "0.02em" }}>{s.location}</span>
            <h1 style={{ fontSize: "clamp(40px, 5.5vw, 68px)", lineHeight: 1.03, fontWeight: 800, letterSpacing: "-1.5px", textTransform: "capitalize" }}>{s.tagline}</h1>
            <p style={{ fontSize: 20, lineHeight: "31px", color: "#d6ebee", maxWidth: 620 }}>{s.intro}</p>
            <div className="row wrap">
              <a href="#programmes" onClick={go("programmes")} className="btn btn-lg" style={{ background: C.sun, borderColor: C.sun, color: C.ink }}>Our programmes</a>
              <a href="#involved" onClick={go("involved")} className="btn btn-lg" style={{ background: "transparent", borderColor: "#7fb3bd", color: "#fff" }}>Partner with us</a>
            </div>
          </div>
          {imp && (
            <div style={{ flex: "1 1 320px", background: C.tealDark, borderRadius: 12, padding: 28 }} className="stack">
              <span className="small" style={{ color: "#9cc8d0" }}>So far this year</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
                {[[imp.people_reached, "young people reached"], [imp.participants_registered, "participants registered"], [imp.activities_done, "activities delivered"], [imp.volunteer_hours, "volunteer hours"]].map(([n, l]) => (
                  <div key={l} className="stack-sm" style={{ gap: 2 }}><b style={{ fontSize: 36, lineHeight: "40px", color: C.sun }}>{fmtNum(n)}</b><span style={{ color: "#d6ebee", fontSize: 14 }}>{l}</span></div>
                ))}
              </div>
              <span className="small" style={{ color: "#9cc8d0" }}>Counted from {fmtNum(imp.evidence_items)} pieces of evidence: attendance sheets, photos and reports. Updated {fmtDate(imp.as_of, true)}.</span>
            </div>
          )}
        </div>
      </section>

      <section id="about" className="container" style={{ padding: "88px 32px", display: "flex", flexWrap: "wrap", gap: 48 }}>
        <h2 style={{ flex: "1 1 300px", fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>All communities deserve a chance to live in tranquility</h2>
        <div className="stack" style={{ flex: "1 1 460px" }}>
          <b style={{ color: C.teal }}>How we work</b>
          <p style={{ fontSize: 18, lineHeight: "30px", color: "#3c4a4c" }}>{s.about}</p>
        </div>
      </section>

      <section id="programmes" style={{ background: C.sand }}>
        <div className="container stack" style={{ padding: "88px 32px", gap: 32 }}>
          <div className="stack-sm"><b style={{ color: C.teal }}>What we focus on</b><h2 style={{ fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>Our programmes</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {s.programmes.map((p, i) => (
              <article key={p.id} className="stack" style={{ background: "#fff", borderRadius: 10, padding: 26, borderTop: `4px solid ${[C.teal, "#B5543C", "#6B5BA8", "#3F7D3A"][i % 4]}` }}>
                <h3 style={{ fontSize: 22, fontWeight: 700 }}>{p.title}</h3>
                <p style={{ color: "#3c4a4c", lineHeight: "25px" }}>{p.summary}</p>
                {p.focus && <span className="small" style={{ color: "#5b6b6d" }}>{p.focus}</span>}
                {p.results.length > 0 && (
                  <div className="stack-sm" style={{ borderTop: "1px solid #ece6d6", paddingTop: 14, marginTop: "auto" }}>
                    {p.results.map((r) => (
                      <div key={r.title} className="stack-sm" style={{ gap: 4 }}>
                        <span className="small" style={{ fontWeight: 600 }}>{r.title}</span>
                        <div style={{ height: 6, background: "#ece6d6", borderRadius: 3 }}><div style={{ height: 6, borderRadius: 3, background: C.teal, width: `${Math.min(100, (r.actual / r.target) * 100)}%` }} /></div>
                        <span className="small" style={{ color: "#5b6b6d" }}>{fmtNum(r.actual)} of {fmtNum(r.target)} {r.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {imp && (
        <section id="impact" className="container stack" style={{ padding: "88px 32px", gap: 28 }}>
          <div className="stack-sm"><b style={{ color: C.teal }}>Accountability</b><h2 style={{ fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>Results you can check</h2>
            <p style={{ fontSize: 18, lineHeight: "28px", color: "#3c4a4c", maxWidth: 760 }}>These figures are not typed into this page. They are counted from the attendance sheets, photos and reports our team records when the work happens, so they are always current.</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 0, borderTop: `3px solid ${C.ink}` }}>
            {[[imp.people_reached, "young people reached"], [imp.activities_done, "activities delivered"], [imp.events_held, "community events held"], [imp.volunteer_hours, "volunteer hours given"], [imp.participants_registered, "participants registered"], [imp.evidence_items, "pieces of evidence on file"]].map(([n, l]) => (
              <div key={l} className="stack-sm" style={{ padding: "20px 20px 20px 0", gap: 4 }}><b style={{ fontSize: 40, lineHeight: "44px", color: C.teal }}>{fmtNum(n)}</b><span style={{ color: "#3c4a4c" }}>{l}</span></div>
            ))}
          </div>
        </section>
      )}

      <section id="team" style={{ background: C.sand }}>
        <div className="container stack" style={{ padding: "88px 32px", gap: 28 }}>
          <div className="stack-sm"><b style={{ color: C.teal }}>Our team</b><h2 style={{ fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>Meet the team</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {s.team.map((t) => (
              <div key={t.name} className="row" style={{ background: "#fff", borderRadius: 10, padding: 20, gap: 16 }}>
                {t.photo?.url ? <img src={t.photo.url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} /> :
                  <span style={{ width: 64, height: 64, borderRadius: "50%", background: C.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, flex: "0 0 64px" }}>{initials(t.name)}</span>}
                <span className="stack-sm" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>{t.name}</b><span style={{ color: "#5b6b6d" }}>{t.role}</span></span>
              </div>
            ))}
          </div>
          <div className="stack-sm" style={{ paddingTop: 28 }}>
            <b style={{ color: C.teal }}>We are credible</b><h3 style={{ fontSize: 26, fontWeight: 800 }}>Our partners</h3>
            <div className="row wrap" style={{ gap: 12, marginTop: 8 }}>
              {s.partners.map((p) => <span key={p} style={{ background: "#fff", border: "1px solid #e8e1cf", borderRadius: 8, padding: "14px 18px", fontWeight: 600 }}>{p}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section id="involved" className="container" style={{ padding: "88px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
        <VolunteerForm slug={slug} />
        <InquiryForm slug={slug} />
      </section>

      <footer style={{ background: C.ink, color: "#c9d3d4" }}>
        <div className="container spread" style={{ padding: "32px", fontSize: 14 }}>
          <span className="stack-sm" style={{ gap: 4 }}><b style={{ color: "#fff" }}>{s.organization}</b><span>{s.location}{s.contact_email ? ` · ${s.contact_email}` : ""}</span></span>
          <span className="row wrap" style={{ gap: 16 }}>{Object.entries(s.social).filter(([, v]) => v).map(([k, v]) => <span key={k} style={{ textTransform: "capitalize" }}>{k}: {v}</span>)}</span>
          <span>Results powered by Kept</span>
        </div>
      </footer>
    </div>
  );
}

function VolunteerForm({ slug }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", ward: "", interest: "any", skills: "" });
  const [state, setState] = useState({ busy: false, error: null, ok: null });
  const submit = async (e) => {
    e.preventDefault(); setState({ busy: true, error: null, ok: null });
    try { const r = await api(`/public/${slug}/volunteer`, { method: "POST", body: { ...f, email: f.email || null } }); setState({ busy: false, error: null, ok: r.message }); setF({ name: "", phone: "", email: "", ward: "", interest: "any", skills: "" }); }
    catch (er) { setState({ busy: false, error: er, ok: null }); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="stack" style={{ background: C.sand, borderRadius: 12, padding: 28 }} noValidate>
      <div className="stack-sm"><b style={{ color: C.teal }}>Get involved</b><h2 style={{ fontSize: 28, fontWeight: 800 }}>Volunteer with us</h2><p style={{ color: "#3c4a4c" }}>Give a few hours a month in your ward. We train you first.</p></div>
      {state.ok && <div className="notice notice-ok" role="status">{state.ok}</div>}
      <ErrorNotice error={state.error} />
      <div className="form-grid">
        <Field label="Your name"><input className="input" value={f.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" /></Field>
        <Field label="Email" hint="Optional"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Ward"><input className="input" value={f.ward} onChange={set("ward")} /></Field>
      </div>
      <Field label="Programme you care about"><select className="select" value={f.interest} onChange={set("interest")}><option value="any">Any</option><option value="health">Health Advocacy</option><option value="gps">Gender, Peace and Security</option><option value="disability">Disability Inclusion</option><option value="climate">Climate Change</option></select></Field>
      <Field label="Skills" hint="Optional"><input className="input" value={f.skills} onChange={set("skills")} placeholder="Languages, photography, counselling…" /></Field>
      <button className="btn btn-lg" style={{ background: C.teal, borderColor: C.teal, color: "#fff", alignSelf: "flex-start" }} disabled={state.busy}>{state.busy ? "Sending…" : "Send application"}</button>
    </form>
  );
}

function InquiryForm({ slug }) {
  const [f, setF] = useState({ name: "", contact: "", kind: "partner", message: "" });
  const [state, setState] = useState({ busy: false, error: null, ok: null });
  const submit = async (e) => {
    e.preventDefault(); setState({ busy: true, error: null, ok: null });
    try { const r = await api(`/public/${slug}/inquiry`, { method: "POST", body: f }); setState({ busy: false, error: null, ok: r.message }); setF({ name: "", contact: "", kind: "partner", message: "" }); }
    catch (er) { setState({ busy: false, error: er, ok: null }); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="stack" style={{ border: "1px solid #e8e1cf", borderRadius: 12, padding: 28 }} noValidate>
      <div className="stack-sm"><b style={{ color: C.teal }}>Partners and donors</b><h2 style={{ fontSize: 28, fontWeight: 800 }}>Work with us</h2><p style={{ color: "#3c4a4c" }}>Fund a programme, sponsor an event or partner on a project. We reply within three working days.</p></div>
      {state.ok && <div className="notice notice-ok" role="status">{state.ok}</div>}
      <ErrorNotice error={state.error} />
      <div className="form-grid">
        <Field label="Name or organization"><input className="input" value={f.name} onChange={set("name")} /></Field>
        <Field label="Email or phone"><input className="input" value={f.contact} onChange={set("contact")} /></Field>
      </div>
      <Field label="About"><select className="select" value={f.kind} onChange={set("kind")}><option value="partner">Partnership</option><option value="donate">Donation or sponsorship</option><option value="media">Media</option><option value="other">Something else</option></select></Field>
      <Field label="Message"><textarea className="textarea" rows={4} value={f.message} onChange={set("message")} /></Field>
      <button className="btn btn-lg" style={{ background: C.ink, borderColor: C.ink, color: "#fff", alignSelf: "flex-start" }} disabled={state.busy}>{state.busy ? "Sending…" : "Send message"}</button>
    </form>
  );
}
