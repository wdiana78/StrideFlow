import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { useApi } from "../hooks";
import PLATFORM from "../platform.json";
import { AppIcon } from "./Apps";
import { INDUSTRY_EMOJI } from "./Auth";

const DEMO = { timiza: "zawadi@timiza.example", tumaini: "achieng@tumaini.example", hatua: "wanjiru@hatua.example", mwangaza: "wairimu@mwangaza.example", pwani: "rehema@pwani.example" };
const go = (id, after) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); after?.(); };
const NAVS = [["product", "Product"], ["how", "How it works"], ["industries", "Industries"], ["customers", "Customers"], ["faq", "FAQ"]];
const Title = ({ eyebrow, children, sub, center = true }) => (
  <div className="stack-sm" style={{ gap: 10, alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left" }}>
    <span className="eyebrow">{eyebrow}</span>
    <h2 style={{ fontSize: "clamp(30px, 3.6vw, 44px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-1.2px", maxWidth: 780 }}>{children}</h2>
    {sub && <p className="muted" style={{ fontSize: 18, lineHeight: "28px", maxWidth: 640 }}>{sub}</p>}
  </div>
);

function ProductMock() {
  const bars = [42, 64, 50, 78, 70, 92];
  return (
    <div aria-hidden="true" style={{ color: "var(--ink)", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--rule)", boxShadow: "0 30px 80px rgba(15,30,70,.35)", overflow: "hidden", minWidth: 0 }}>
      <div className="row" style={{ gap: 6, padding: "10px 14px", borderBottom: "1px solid var(--rule)", background: "var(--surface-2)" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c }} />)}
        <span className="small muted" style={{ marginLeft: 10 }}>kept.africa/app</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", minHeight: 300 }}>
        <div className="stack-sm" style={{ padding: 12, gap: 6, borderRight: "1px solid var(--rule)" }}>
          {["Home", "Attention", "Projects", "Finance", "Sales", "Website"].map((l, i) => <span key={l} style={{ fontSize: 11.5, fontWeight: 600, padding: "6px 8px", borderRadius: 6, background: i === 0 ? "var(--cobalt-tint)" : "transparent", color: i === 0 ? "var(--cobalt-dark)" : "var(--slate)" }}>{l}</span>)}
        </div>
        <div className="stack-sm" style={{ padding: 14, gap: 10 }}>
          <div style={{ borderRadius: 10, padding: "12px 14px", color: "#fff", background: "linear-gradient(120deg,#14142B,#6A4DF4)" }}><b style={{ fontSize: 14 }}>Habari, Zawadi</b><div style={{ fontSize: 11, opacity: .8 }}>9 items need you today</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[["Budget used", "45%", "#6A4DF4"], ["Raised", "KES 4.1M", "#F26A1B"], ["Reach", "1,026", "#F26A1B"]].map(([l, v, c]) => (
              <div key={l} style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 8 }}><span style={{ fontSize: 10, color: "var(--slate)" }}>{l}</span><b style={{ display: "block", fontSize: 15, color: c }}>{v}</b></div>
            ))}
          </div>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 10, display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
            {bars.map((h, i) => <span key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 4, background: i === bars.length - 1 ? "#FFC226" : "#6A4DF4", opacity: i === bars.length - 1 ? 1 : .35 + i * .1 }} />)}
          </div>
          {["Transport budget 108% used", "GBV referral MoU expired"].map((t, i) => <div key={t} className="row" style={{ gap: 8, fontSize: 11.5, padding: "6px 8px", borderRadius: 6, background: i ? "var(--maroon-tint)" : "var(--accent-tint)" }}><span className="dot" style={{ background: i ? "#F26A1B" : "#F26A1B" }} />{t}</div>)}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [ind, setInd] = useState("community");
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState(0);
  const { data: showcase } = useApi("/platform/showcase");
  const apps = Object.fromEntries(PLATFORM.apps.map((a) => [a.key, a]));
  const current = PLATFORM.industries.find((i) => i.key === ind);
  const featured = (showcase || []).filter((s) => ["timiza", "tumaini", "hatua"].includes(s.slug));
  const more = (showcase || []).filter((s) => !["timiza", "tumaini", "hatua"].includes(s.slug));
  const explore = async (slug) => {
    if (!PREVIEW || !DEMO[slug]) { nav("/login"); return; }
    signIn(await api("/auth/login", { method: "POST", body: { email: DEMO[slug], password: "kept-demo-2026" } })); nav("/app");
  };
  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      {/* ---------- header ---------- */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "color-mix(in srgb, var(--bg) 85%, transparent)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--rule)" }}>
        <div className="container spread" style={{ padding: "12px 32px", flexWrap: "nowrap" }}>
          <Link to="/" className="brand" style={{ padding: 0, fontSize: 22 }}><Logo size={32} />Kept</Link>
          <nav className="row mk-nav" style={{ gap: 2 }} aria-label="Main">
            {NAVS.map(([id, l]) => <a key={id} href={`#${id}`} onClick={go(id)} className="mk-link">{l}</a>)}
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <ThemeToggle />
            {user ? <Link className="btn btn-primary" to="/app">Open workspace</Link> : <><Link className="btn btn-ghost hide-sm" to="/login">Sign in</Link><Link className="btn btn-primary hide-xs" to="/register">Start free</Link></>}
            <button className="btn btn-icon mk-menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
          </div>
        </div>
        {menu && (
          <nav className="container stack-sm" style={{ padding: "8px 18px 18px" }} aria-label="Mobile">
            {NAVS.map(([id, l]) => <a key={id} href={`#${id}`} onClick={go(id, () => setMenu(false))} className="mk-link">{l}</a>)}
            {!user && <><Link className="mk-link" to="/login">Sign in</Link><Link className="btn btn-primary" to="/register" style={{ justifyContent: "center" }}>Start free</Link></>}
          </nav>
        )}
      </header>

      {/* ---------- hero ---------- */}
      <section style={{ position: "relative", overflow: "hidden", color: "#fff", background: "radial-gradient(700px 420px at 10% 0%, rgba(106,77,244,.35), transparent 60%), #14142B" }}>
        <svg aria-hidden="true" viewBox="0 0 700 600" preserveAspectRatio="xMaxYMax slice" style={{ position: "absolute", right: 0, bottom: 0, width: "min(62%, 760px)", height: "100%", opacity: .95 }}>
          <g fill="none" strokeWidth="26" strokeLinecap="round">
            <path d="M720 120 H520 a90 90 0 0 0 -90 90 V640" stroke="#8E5CFF" />
            <path d="M720 175 H540 a70 70 0 0 0 -70 70 V640" stroke="#C04CF5" />
            <path d="M720 230 H560 a50 50 0 0 0 -50 50 V640" stroke="#FFC226" />
            <path d="M720 285 H580 a30 30 0 0 0 -30 30 V640" stroke="#F26A1B" />
          </g>
        </svg>
        <div className="container" style={{ position: "relative", padding: "88px 32px 100px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", gap: 56, alignItems: "center" }}>
          <div className="stack" style={{ gap: 24 }}>
            <span className="eyebrow" style={{ background: "rgba(255,255,255,.08)", color: "#FFC226", alignSelf: "flex-start", border: "1px solid rgba(255,255,255,.15)" }}>★ Built in Nairobi for African organizations</span>
            <h1 style={{ fontSize: "clamp(40px, 5.6vw, 70px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-2px" }}>
              Run your organization <span style={{ background: "linear-gradient(90deg, #B9A8FF, #FFC226 60%, #F26A1B)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>and its website</span> from one place.
            </h1>
            <p style={{ fontSize: 19, lineHeight: "30px", color: "rgba(255,255,255,.8)", maxWidth: 540 }}>Pick your industry, install the apps you need, and publish a website whose numbers update themselves.</p>
            <div className="row wrap" style={{ gap: 12 }}>
              <Link className="btn btn-lg btn-accent" to="/register">Start free</Link>
              <a className="btn btn-lg" href="#customers" onClick={go("customers")} style={{ background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.25)" }}>See live examples →</a>
            </div>
            <div className="row wrap" style={{ gap: 22, color: "rgba(255,255,255,.7)", fontSize: 14 }}>
              <span>✓ M-Pesa donations</span><span>✓ Works on any phone</span><span>✓ Light and dark mode</span>
            </div>
          </div>
          <ProductMock />
        </div>
      </section>

      {/* ---------- logos ---------- */}
      <section style={{ borderBottom: "1px solid var(--rule)", background: "var(--surface)" }}>
        <div className="container row wrap" style={{ padding: "22px 32px", gap: 28, justifyContent: "center" }}>
          <span className="small muted">Running on Kept today</span>
          {(showcase || []).map((s) => <span key={s.slug} className="row" style={{ gap: 8, fontWeight: 700, color: "var(--ink-2)" }}><span style={{ width: 22, height: 22, borderRadius: 6, background: s.primary }} />{s.organization}</span>)}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="container stack" style={{ padding: "96px 32px", gap: 48, scrollMarginTop: 80, position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: -120, top: 40, width: 260, height: 260, borderRadius: "50%", border: "28px solid var(--cobalt-tint)", zIndex: 0 }} />
        <Title eyebrow="How it works" sub="Every organization gets two front doors on one platform.">One account. A public website and a private workspace.</Title>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {[["1", "The public types their address", "Someone searches “Timiza Youth Initiative” and lands on timiza.or.ke, their own domain, served by Kept with their own colours.", "#6A4DF4"],
            ["2", "Staff press “Staff login”", "Every tenant website has a staff login. Managers sign in with their work email and land on their Home.", "#F26A1B"],
            ["3", "Home is the launcher", "Like Odoo: the apps their organization installed, what needs attention today, and their numbers.", "#F26A1B"],
            ["4", "The website feeds itself", "Donations, volunteer sign-ups and survey answers land in the workspace; verified results flow back to the site.", "#4F8CFF"]].map(([n, t, d, c]) => (
            <div key={n} className="panel panel-body stack-sm" style={{ gap: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>{n}</span>
              <b style={{ fontSize: 18 }}>{t}</b><p className="muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "center" }}>
          {[["kept.africa", "Kept's own site: product, pricing, sign-up"], ["timiza.or.ke", "Timiza's public website (their brand)"], ["timiza.or.ke → Staff login", "Timiza's private workspace (Kept brand)"]].map(([u, d], i) => (
            <div key={u} className="row" style={{ gap: 12 }}>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5, fontWeight: 700, padding: "8px 12px", borderRadius: 8, background: ["var(--cobalt-tint)", "var(--accent-tint)", "var(--maroon-tint)"][i], color: "var(--ink)" }}>{u}</span>
              <span className="small muted">{d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- apps ---------- */}
      <section id="product" style={{ background: "var(--surface)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", scrollMarginTop: 70 }}>
        <div className="container stack" style={{ padding: "96px 32px", gap: 40 }}>
          <Title eyebrow={`${PLATFORM.apps.length} apps`} sub="Install only what you need. Remove an app any time; its data is kept.">Everything an organization runs on</Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {PLATFORM.apps.map((a) => (
              <div key={a.key} className="tile" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <AppIcon app={a} size={46} /><span className="stack-sm" style={{ gap: 2 }}><b>{a.name}</b><span className="small muted">{a.tagline}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- industries ---------- */}
      <section id="industries" className="container stack" style={{ padding: "96px 32px", gap: 32, scrollMarginTop: 70 }}>
        <Title eyebrow="Industries">Set up for how you work</Title>
        <div className="row wrap" style={{ justifyContent: "center", gap: 8 }} role="tablist">
          {PLATFORM.industries.map((i) => (
            <button key={i.key} role="tab" aria-selected={ind === i.key} onClick={() => setInd(i.key)} className="chip" aria-pressed={ind === i.key} style={{ height: 44, padding: "0 16px", fontSize: 14.5 }}>{INDUSTRY_EMOJI[i.key]} {i.name}</button>
          ))}
        </div>
        <div className="panel" style={{ padding: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 28, alignItems: "center" }}>
          <div className="stack">
            <span style={{ fontSize: 44 }}>{INDUSTRY_EMOJI[current.key]}</span>
            <h3 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.6px" }}>{current.name}</h3>
            <p className="muted">Kept installs {current.apps.length} apps for you on day one.</p>
            <Link to="/register" className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }}>Start with these apps</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {current.apps.map((k) => <div key={k} className="row" style={{ gap: 10, padding: 10, borderRadius: 10, background: "var(--surface-2)" }}><AppIcon app={apps[k]} size={32} /><span style={{ fontSize: 13, fontWeight: 600 }}>{apps[k].name}</span></div>)}
          </div>
        </div>
      </section>

      {/* ---------- customers ---------- */}
      <section id="customers" style={{ background: "var(--surface)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", scrollMarginTop: 70 }}>
        <div className="container stack" style={{ padding: "96px 32px", gap: 36 }}>
          <Title eyebrow="Case studies" sub="Two community organizations and one business, each with its own website and workspace.">Same platform, three very different organizations</Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
            {featured.map((s) => (
              <article key={s.slug} className="panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "28px 24px", color: "#fff", minHeight: 190, background: `radial-gradient(300px 160px at 100% 0%, ${s.accent}66, transparent 70%), linear-gradient(140deg, ${s.deep || s.primary}, ${s.primary})` }} className="stack-sm">
                  <span className="chip-tone" style={{ background: "rgba(255,255,255,.2)", color: "#fff", alignSelf: "flex-start" }}>{s.kind} · {s.industry}</span>
                  <b style={{ fontSize: 24, lineHeight: "28px", letterSpacing: "-.4px" }}>{s.organization}</b>
                  <span style={{ opacity: .92, textTransform: "capitalize" }}>{s.tagline}</span>
                </div>
                <div className="row wrap" style={{ padding: 16, marginTop: "auto" }}>
                  <Link className="btn" to={`/site/${s.slug}`}>Visit website</Link>
                  <button className="btn btn-primary" onClick={() => explore(s.slug)}>Open their workspace</button>
                </div>
              </article>
            ))}
          </div>
          {more.length > 0 && (
            <div className="row wrap" style={{ gap: 10, justifyContent: "center" }}>
              <span className="small muted">More examples:</span>
              {more.map((s) => <Link key={s.slug} to={`/site/${s.slug}`} className="chip"><span className="dot" style={{ background: s.primary }} />{s.organization} · {s.industry}</Link>)}
            </div>
          )}
        </div>
      </section>

      {/* ---------- trust ---------- */}
      <section className="container" style={{ padding: "80px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
        {[["Locked-down sign-in", "Lockouts, strong passwords, instant sign-out everywhere.", "#6A4DF4"], ["Your data stays yours", "Every organization is sealed off from the rest.", "#F26A1B"], ["Payments that post themselves", "M-Pesa and card donations land in your books.", "#F26A1B"], ["Numbers you can check", "Websites show results counted from real records.", "#4F8CFF"]].map(([t, d, c]) => (
          <div key={t} className="stack-sm" style={{ padding: 22, gap: 10 }}>
            <span style={{ width: 36, height: 4, borderRadius: 2, background: c }} /><b style={{ fontSize: 17 }}>{t}</b><span className="muted">{d}</span>
          </div>
        ))}
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="container stack" style={{ padding: "40px 32px 96px", gap: 28, maxWidth: 860, scrollMarginTop: 70 }}>
        <Title eyebrow="FAQ">Questions people ask</Title>
        {[["If someone searches for Timiza, what do they see?", "Timiza's own website on its own domain, in Timiza's colours. Kept stays in the background; the public never sees the word Kept except a small credit in the footer."],
          ["How does a manager get to the workspace?", "From the Staff login link on their organization's website, or at kept.africa/login. After signing in they land on Home: their installed apps, what needs attention today and their key numbers."],
          ["Do all organizations share one system?", "They share the platform, never the data. Every record belongs to one organization, every request is checked against it, and other organizations' records simply do not exist for you."],
          ["Can a business use it, not just NGOs?", "Yes. A shoe brand installs Sales, Inventory and Procurement; a guesthouse installs Bookings and Sales. The NGO apps never appear for them."],
          ["What happens if we remove an app?", "It disappears from the menu and the API, but the data is kept. Reinstall it and everything comes back."]].map(([q, a], i) => (
          <div key={q} className="panel">
            <button onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i} className="spread" style={{ width: "100%", padding: "18px 20px", border: 0, background: "none", cursor: "pointer", textAlign: "left", flexWrap: "nowrap" }}>
              <b style={{ fontSize: 16.5 }}>{q}</b><span style={{ fontSize: 22, color: "var(--cobalt)", transform: faq === i ? "rotate(45deg)" : "none", transition: "transform .15s" }}>+</span>
            </button>
            {faq === i && <p className="muted" style={{ padding: "0 20px 18px", fontSize: 15.5, lineHeight: "25px" }}>{a}</p>}
          </div>
        ))}
      </section>

      {/* ---------- CTA ---------- */}
      <section className="container" style={{ paddingBottom: 96 }}>
        <div style={{ borderRadius: 24, padding: "48px 40px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap",
          background: "radial-gradient(500px 240px at 100% 0%, rgba(255,194,38,.35), transparent 65%), linear-gradient(120deg, #14142B, #6A4DF4)" }}>
          <div className="stack-sm"><h2 style={{ fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 800, letterSpacing: "-.8px", color: "#fff" }}>Set up your workspace in five minutes.</h2><span style={{ opacity: .8 }}>Free while you set up. No card needed.</span></div>
          <Link className="btn btn-lg btn-accent" to="/register">Start free</Link>
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer style={{ background: "#0E0D22", color: "rgba(255,255,255,.72)" }}>
        <div className="container" style={{ padding: "64px 32px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 32 }}>
          <div className="stack-sm foot-brand" style={{ minWidth: 0, gap: 14 }}>
            <span className="row" style={{ gap: 10, color: "#fff", fontWeight: 800, fontSize: 20 }}><Logo size={30} />Kept</span>
            <span style={{ maxWidth: 340 }}>One workspace and one website for community organizations and growing businesses across Africa.</span>
            <form className="row" style={{ gap: 8, maxWidth: 380 }} onSubmit={(e) => { e.preventDefault(); e.currentTarget.reset(); alert("Thanks, you're on the list."); }}>
              <label className="sr-only" htmlFor="nl">Email</label>
              <input id="nl" className="input" type="email" required placeholder="Email for product news" style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.18)", color: "#fff" }} />
              <button className="btn btn-accent">Join</button>
            </form>
          </div>
          {[["Product", [["Apps", "#product"], ["How it works", "#how"], ["Industries", "#industries"], ["FAQ", "#faq"]]],
            ["Customers", (showcase || []).map((s) => [s.organization, `/site/${s.slug}`])],
            ["Company", [["Sign in", "/login"], ["Start free", "/register"], ["Security", "#faq"], ["Contact", "mailto:hello@kept.africa"]]]].map(([h, ls]) => (
            <div key={h} className="stack-sm" style={{ gap: 10 }}>
              <b style={{ color: "#fff", fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase" }}>{h}</b>
              {ls.map(([l, to]) => to.startsWith("/") ? <Link key={l} to={to} style={{ color: "rgba(255,255,255,.72)", textDecoration: "none" }}>{l}</Link>
                : <a key={l} href={to} onClick={to.startsWith("#") ? go(to.slice(1)) : undefined} style={{ color: "rgba(255,255,255,.72)", textDecoration: "none" }}>{l}</a>)}
            </div>
          ))}
        </div>
        <div className="container spread small" style={{ padding: "20px 32px 32px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <span>© 2026 Kept · Nairobi, Kenya</span><span>Demo organizations use illustrative data · Privacy · Terms</span>
        </div>
      </footer>
    </div>
  );
}
