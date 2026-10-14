import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { useApi } from "../hooks";
import PLATFORM from "../platform.json";
import { AppIcon } from "./Apps";

const DEMO = { timiza: "zawadi@timiza.example", tumaini: "achieng@tumaini.example", hatua: "wanjiru@hatua.example", mwangaza: "wairimu@mwangaza.example", pwani: "rehema@pwani.example" };
const go = (id, after) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); after?.(); };
const NAVS = [["how", "How it works"], ["product", "Apps"], ["industries", "Industries"], ["customers", "Customers"], ["faq", "Questions"]];
const Title = ({ eyebrow, children, sub, center = true }) => (
  <div className="stack-sm" style={{ gap: 10, alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left" }}>
    <span className="eyebrow">{eyebrow}</span>
    <h2 style={{ fontSize: "clamp(30px, 3.6vw, 44px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-1.2px", maxWidth: 780 }}>{children}</h2>
    {sub && <p className="muted" style={{ fontSize: 18, lineHeight: "28px", maxWidth: 640 }}>{sub}</p>}
  </div>
);

function ProductMock() {
  const bars = [38, 52, 46, 61, 58, 74];
  return (
    <div aria-hidden="true" className="mk-mock">
      <div className="mk-mock-bar"><span /><span /><span /></div>
      <div className="mk-mock-body">
        <div className="mk-mock-side">{["Home", "Alerts", "Projects", "Finance", "Sales", "Website"].map((l, i) => <span key={l} className={i === 0 ? "on" : ""}>{l}</span>)}</div>
        <div className="mk-mock-main">
          <div className="mk-mock-h"><b>Good to see you, Zawadi</b><span>Timiza Youth Initiative</span></div>
          <div className="mk-mock-kpis">{[["Budget used", "45.4%"], ["Funding secured", "KES 4.05M"], ["Young people reached", "1,026"]].map(([l, v]) => <div key={l}><span>{l}</span><b>{v}</b></div>)}</div>
          <div className="mk-mock-chart">{bars.map((h, i) => <span key={i} style={{ height: `${h}%`, opacity: i === bars.length - 1 ? 1 : 0.28 }} />)}</div>
          <div className="mk-mock-rows">{[["Over budget", "Transport, Health Advocacy at 108%"], ["Expiring", "GBV referral agreement ended 3 days ago"], ["Approval", "2 expenses waiting"]].map(([k, t]) => <div key={k}><b>{k}</b><span>{t}</span></div>)}</div>
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
    <div className="mk">
      <header className="mk-header">
        <div className="container mk-header-in">
          <Link to="/" className="mk-brand"><Logo size={26} />Kept</Link>
          <nav className="mk-nav" aria-label="Main">{NAVS.map(([id, l]) => <a key={id} href={`#${id}`} onClick={go(id)}>{l}</a>)}</nav>
          <div className="row" style={{ gap: 8 }}>
            <ThemeToggle />
            {user ? <Link className="btn btn-primary" to="/app">Open dashboard</Link> : <><Link className="btn btn-ghost hide-sm" to="/login">Sign in</Link><Link className="btn btn-primary hide-xs" to="/register">Get started</Link></>}
            <button className="btn btn-icon mk-menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
        {menu && <nav className="container mk-mobile" aria-label="Mobile">{NAVS.map(([id, l]) => <a key={id} href={`#${id}`} onClick={go(id, () => setMenu(false))}>{l}</a>)}{!user && <><Link to="/login">Sign in</Link><Link to="/register">Get started</Link></>}</nav>}
      </header>

      <section className="container mk-hero">
        <h1>Run your organization, and the website that tells its story, from one place.</h1>
        <p>Kept connects your programmes, money, people and stock to a public website that updates itself from the work.</p>
        <div className="row wrap" style={{ gap: 10, justifyContent: "center" }}>
          <Link className="btn btn-primary btn-lg" to="/register">Get started</Link>
          <a className="btn btn-lg" href="#customers" onClick={go("customers")}>See customer sites</a>
        </div>
      </section>
      <section className="container"><ProductMock /></section>

      <section className="container mk-logos">
        <span>Used by</span>
        {(showcase || []).map((s) => <Link key={s.slug} to={`/site/${s.slug}`}>{s.organization}</Link>)}
      </section>

      <section id="how" className="container mk-section">
        <div className="mk-head"><span className="eyebrow">How it works</span><h2>A public website and a private dashboard, on one account.</h2></div>
        <div className="mk-cols3">
          {[["The public visits your site", "People who search for your organization land on your own website and domain, in your brand."],
            ["Staff sign in", "The Staff login link on your site opens your dashboard: the apps you installed and what needs attention today."],
            ["The two stay in step", "Donations, volunteer sign-ups and survey answers arrive in the dashboard. Verified results flow back to the site."]].map(([t, d], i) => (
            <div key={t} className="mk-step"><span>{String(i + 1).padStart(2, "0")}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section id="product" className="mk-band">
        <div className="container mk-section">
          <div className="mk-head"><span className="eyebrow">Apps</span><h2>Install what you need. Remove what you don't.</h2><p>Data is kept when an app is removed, and returns when it is reinstalled.</p></div>
          <div className="mk-apps">
            {PLATFORM.apps.map((a) => <div key={a.key} className="mk-app"><AppIcon app={a} size={36} /><div><b>{a.name}</b><span>{a.tagline}</span></div></div>)}
          </div>
        </div>
      </section>

      <section id="industries" className="container mk-section">
        <div className="mk-head"><span className="eyebrow">Industries</span><h2>Set up for the work you do.</h2></div>
        <div className="mk-tabs" role="tablist">
          {PLATFORM.industries.map((i) => <button key={i.key} role="tab" aria-selected={ind === i.key} onClick={() => setInd(i.key)}>{i.name}</button>)}
        </div>
        <div className="mk-industry">
          <div><h3>{current.name}</h3><p>Starts with {current.apps.length} apps. Add or remove any of them later.</p><Link to="/register" className="btn btn-primary">Start with this setup</Link></div>
          <ul>{current.apps.map((k) => <li key={k}><AppIcon app={apps[k]} size={28} />{apps[k].name}</li>)}</ul>
        </div>
      </section>

      <section id="customers" className="mk-band">
        <div className="container mk-section">
          <div className="mk-head"><span className="eyebrow">Customers</span><h2>Two community organizations and a shoe brand.</h2><p>Each has its own website and its own dashboard on the same platform.</p></div>
          <div className="mk-cols3">
            {featured.map((s) => (
              <article key={s.slug} className="mk-case">
                <span className="mk-case-mark" style={{ background: s.primary }} />
                <span className="mk-case-kind">{s.industry}</span>
                <h3>{s.organization}</h3>
                <p>{s.tagline}</p>
                <div className="row wrap" style={{ gap: 8, marginTop: "auto" }}>
                  <Link className="btn" to={`/site/${s.slug}`}>Website</Link>
                  <button className="btn btn-ghost" onClick={() => explore(s.slug)}>Dashboard</button>
                </div>
              </article>
            ))}
          </div>
          {more.length > 0 && <p className="mk-more">Also on Kept: {more.map((s, i) => <span key={s.slug}>{i ? ", " : ""}<Link to={`/site/${s.slug}`}>{s.organization}</Link></span>)}.</p>}
        </div>
      </section>

      <section className="container mk-section">
        <div className="mk-cols4">
          {[["Sign-in protection", "Account lockout, strong passwords and sign-out on every device."], ["Isolated data", "Each organization's records are invisible to every other."], ["Payments that reconcile", "M-Pesa and card donations post to your books automatically."], ["Figures you can check", "Website numbers come from records with evidence attached."]].map(([t, d]) => (
            <div key={t} className="mk-fact"><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section id="faq" className="mk-band">
        <div className="container mk-section" style={{ maxWidth: 820 }}>
          <div className="mk-head"><span className="eyebrow">Questions</span><h2>Frequently asked</h2></div>
          <div className="mk-faq">
            {[["If someone searches for Timiza, what do they see?", "Timiza's own website, on Timiza's domain, in Timiza's design. Kept appears only as a small credit in the footer."],
              ["How does a manager reach the dashboard?", "Through Staff login on their organization's website. After signing in they land on Home: their apps, today's alerts and their figures."],
              ["Do organizations share data?", "They share the platform, never the records. Every request is checked against the organization that owns the data."],
              ["Is it only for NGOs?", "No. A shoe brand installs Sales, Inventory and Procurement. A guesthouse installs Bookings and Sales."],
              ["What happens when an app is removed?", "It leaves the menu and the API. The data stays, and returns if the app is installed again."]].map(([q, a], i) => (
              <div key={q} className="mk-faq-item">
                <button onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i}><span>{q}</span><span aria-hidden="true">{faq === i ? "−" : "+"}</span></button>
                {faq === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mk-cta">
        <h2>Set up your organization in an afternoon.</h2>
        <Link className="btn btn-primary btn-lg" to="/register">Get started</Link>
      </section>

      <footer className="mk-footer">
        <div className="container mk-footer-in">
          <div className="mk-footer-brand"><span className="mk-brand"><Logo size={22} />Kept</span><p>Operations and websites for community organizations and growing businesses.</p></div>
          {[["Product", [["Apps", "#product"], ["How it works", "#how"], ["Industries", "#industries"], ["Questions", "#faq"]]],
            ["Customers", (showcase || []).map((s) => [s.organization, `/site/${s.slug}`])],
            ["Company", [["Sign in", "/login"], ["Get started", "/register"], ["Contact", "mailto:hello@kept.africa"]]]].map(([h, ls]) => (
            <div key={h} className="mk-footer-col"><b>{h}</b>{ls.map(([l, to]) => to.startsWith("/") ? <Link key={l} to={to}>{l}</Link> : <a key={l} href={to} onClick={to.startsWith("#") ? go(to.slice(1)) : undefined}>{l}</a>)}</div>
          ))}
        </div>
        <div className="container mk-footer-legal"><span>© 2026 Kept, Nairobi</span><span>Demo organizations use illustrative figures</span></div>
      </footer>
    </div>
  );
}
