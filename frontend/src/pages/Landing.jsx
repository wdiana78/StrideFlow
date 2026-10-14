import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";
import { useApi } from "../hooks";
import PLATFORM from "../platform.json";
import { AppIcon } from "./Apps";
import { INDUSTRY_EMOJI } from "./Auth";

const DEMO = { timiza: "zawadi@timiza.example", mwangaza: "wairimu@mwangaza.example", hatua: "wanjiru@hatua.example", pwani: "rehema@pwani.example" };
const go = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
const H = ({ eyebrow, children }) => (
  <div className="stack-sm" style={{ gap: 6, alignItems: "center", textAlign: "center" }}>
    <span className="chip-tone" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-dark)" }}>{eyebrow}</span>
    <h2 style={{ fontSize: "clamp(30px, 3.6vw, 46px)", lineHeight: 1.08, fontWeight: 800, letterSpacing: "-1px", maxWidth: 760 }}>{children}</h2>
  </div>
);

export default function Landing() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [ind, setInd] = useState("community");
  const { data: showcase } = useApi("/platform/showcase");
  const apps = Object.fromEntries(PLATFORM.apps.map((a) => [a.key, a]));
  const current = PLATFORM.industries.find((i) => i.key === ind);
  const explore = async (slug) => {
    if (!PREVIEW || !DEMO[slug]) { nav("/login"); return; }
    signIn(await api("/auth/login", { method: "POST", body: { email: DEMO[slug], password: "kept-demo-2026" } })); nav("/app");
  };
  return (
    <div style={{ background: "#FFF8F4", minHeight: "100%" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,248,244,.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--rule)" }}>
        <div className="container spread" style={{ padding: "14px 32px" }}>
          <Link to="/" className="brand" style={{ padding: 0, fontSize: 22 }}><Logo size={30} />Kept</Link>
          <nav className="row wrap" style={{ gap: 6 }} aria-label="Site">
            {[["apps", "Apps"], ["industries", "Industries"], ["customers", "Customers"]].map(([id, l]) => <a key={id} href={`#${id}`} onClick={go(id)} className="site-link" style={{ color: "var(--ink)" }}>{l}</a>)}
            {user ? <Link className="btn btn-primary" to="/app">Open workspace</Link> : <><Link className="btn btn-ghost" to="/login">Sign in</Link><Link className="btn btn-primary" to="/register">Start free</Link></>}
          </nav>
        </div>
      </header>

      <section style={{ background: "radial-gradient(800px 420px at 85% 10%, #FFE0CC 0%, transparent 60%), radial-gradient(700px 400px at 0% 100%, #FCD5E0 0%, transparent 60%)" }}>
        <div className="container" style={{ padding: "80px 32px 90px", display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center" }}>
          <div className="stack" style={{ flex: "1 1 480px", gap: 24 }}>
            <span className="chip-tone" style={{ background: "#fff", color: "var(--cobalt-dark)", alignSelf: "flex-start", boxShadow: "var(--shadow-soft)" }}>✨ Made in Nairobi for African organizations</span>
            <h1 style={{ fontSize: "clamp(44px, 5.8vw, 76px)", lineHeight: 1.0, fontWeight: 800, letterSpacing: "-2.2px" }}>
              One workspace.<br /><span style={{ background: "linear-gradient(90deg, #E85D84, #FF8A65, #FFB570)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Every part of your organization.</span>
            </h1>
            <p style={{ fontSize: 20, lineHeight: "31px", color: "var(--ink-2)", maxWidth: 540 }}>Pick your industry, install the apps you need, and get a branded website that updates itself.</p>
            <div className="row wrap">
              <Link className="btn btn-primary btn-lg" to="/register">Start free</Link>
              <a className="btn btn-lg" href="#customers" onClick={go("customers")}>See live examples</a>
            </div>
          </div>
          <div style={{ flex: "1 1 420px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: 24, borderRadius: 28, background: "rgba(255,255,255,.6)", border: "1px solid #fff", boxShadow: "var(--shadow-float)" }}>
            {PLATFORM.apps.slice(0, 12).map((a) => (
              <div key={a.key} className="stack-sm" style={{ alignItems: "center", gap: 6, textAlign: "center" }}>
                <AppIcon app={a} size={56} /><span className="small" style={{ fontWeight: 600, lineHeight: "15px" }}>{a.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="industries" className="container stack" style={{ padding: "80px 32px", gap: 28 }}>
        <H eyebrow="Industries">Built for how you work</H>
        <div className="row wrap" style={{ justifyContent: "center", gap: 10 }} role="tablist">
          {PLATFORM.industries.map((i) => (
            <button key={i.key} role="tab" aria-selected={ind === i.key} onClick={() => setInd(i.key)} className="btn"
              style={{ height: 48, borderRadius: 999, padding: "0 18px", fontSize: 15, background: ind === i.key ? "var(--ink)" : "#fff", color: ind === i.key ? "#fff" : "var(--ink)", borderColor: ind === i.key ? "var(--ink)" : "var(--rule)" }}>
              {INDUSTRY_EMOJI[i.key]} {i.name}
            </button>
          ))}
        </div>
        <div style={{ borderRadius: 28, padding: 28, background: "linear-gradient(135deg, #FCE4EA, #FFE6D6 60%, #FFF1E8)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {current.apps.map((k) => (
            <div key={k} className="row" style={{ gap: 12, background: "rgba(255,255,255,.85)", borderRadius: 16, padding: 12 }}>
              <AppIcon app={apps[k]} size={40} /><span className="stack-sm" style={{ gap: 0 }}><b style={{ fontSize: 14 }}>{apps[k].name}</b><span className="small muted">{apps[k].tagline}</span></span>
            </div>
          ))}
          <Link to="/register" className="btn btn-primary btn-lg" style={{ alignSelf: "center", justifySelf: "start" }}>Start with these apps</Link>
        </div>
      </section>

      <section id="apps" style={{ background: "#fff" }}>
        <div className="container stack" style={{ padding: "80px 32px", gap: 32 }}>
          <H eyebrow={`${PLATFORM.apps.length} apps`}>Install only what you need</H>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
            {PLATFORM.apps.map((a) => (
              <div key={a.key} className="row" style={{ gap: 14, padding: 18, borderRadius: 20, border: "1px solid var(--rule)", background: `linear-gradient(150deg, ${a.color}14, #fff 60%)` }}>
                <AppIcon app={a} /><span className="stack-sm" style={{ gap: 2 }}><b>{a.name}</b><span className="small muted">{a.tagline}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="customers" className="container stack" style={{ padding: "80px 32px", gap: 32 }}>
        <H eyebrow="Live examples">Four organizations, one platform</H>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {(showcase || []).map((s) => (
            <div key={s.slug} className="stack" style={{ borderRadius: 24, overflow: "hidden", background: "#fff", boxShadow: "var(--shadow-soft)", border: "1px solid var(--rule)", gap: 0 }}>
              <div style={{ background: `linear-gradient(135deg, ${s.primary} 0%, ${s.primary} 55%, ${s.accent} 160%)`, color: "#fff", padding: "26px 22px", minHeight: 150 }} className="stack-sm">
                <span className="chip-tone" style={{ background: "rgba(255,255,255,.25)", color: "#fff", alignSelf: "flex-start" }}>{s.industry}</span>
                <b style={{ fontSize: 22, lineHeight: "26px" }}>{s.organization}</b>
                <span style={{ opacity: .95, textTransform: "capitalize" }}>{s.tagline}</span>
              </div>
              <div className="row wrap" style={{ padding: 16 }}>
                <Link className="btn" to={`/site/${s.slug}`}>Website</Link>
                <button className="btn btn-primary" onClick={() => explore(s.slug)}>Open workspace</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "#fff" }}>
        <div className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          {[["🔐", "Locked-down sign-in", "Lockouts, strong passwords, instant sign-out everywhere"], ["🏠", "Your data stays yours", "Every organization is sealed off from the rest"], ["📱", "M-Pesa ready", "Donations and payments that post themselves"], ["📊", "Live numbers", "Your website shows results counted from real records"]].map(([e, t, d]) => (
            <div key={t} className="stack-sm" style={{ padding: 22, borderRadius: 20, background: "var(--ground)" }}><span style={{ fontSize: 28 }}>{e}</span><b style={{ fontSize: 17 }}>{t}</b><span className="muted">{d}</span></div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: "72px 32px" }}>
        <div className="spread" style={{ borderRadius: 32, padding: "44px 40px", background: "linear-gradient(120deg, #C93A63, #D9506F 50%, #E5734F)", color: "#fff" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-.8px", maxWidth: 560, color: "#fff" }}>Set up your workspace in five minutes.</h2>
          <Link className="btn btn-lg" to="/register" style={{ background: "#fff", color: "var(--cobalt-dark)", borderColor: "#fff", fontWeight: 800 }}>Start free</Link>
        </div>
      </section>
      <footer className="container spread small muted" style={{ padding: "24px 32px 40px" }}><span className="row" style={{ gap: 8 }}><Logo size={18} /> Kept · Nairobi 2026</span><span>Demo organizations use illustrative data</span></footer>
    </div>
  );
}
