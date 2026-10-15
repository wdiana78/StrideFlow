import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { useApi } from "../hooks";
import { ErrorNotice, Field } from "../components/ui";
import PLATFORM from "../platform.json";
import { AppIcon } from "./Apps";

const DEMO = { timiza: "zawadi@timiza.example", tumaini: "achieng@tumaini.example", hatua: "wanjiru@hatua.example", mwangaza: "wairimu@mwangaza.example", pwani: "rehema@pwani.example" };

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

const NAVS = [["/product", "Product"], ["/solutions", "Solutions"], ["/customers", "Customers"], ["/pricing", "Pricing"], ["/contact", "Contact"]];
const PALETTE6 = [["Night", "#22184F"], ["Violet", "#7C5CFF"], ["Tangerine", "#FF6B35"], ["Marigold", "#FFB627"], ["Sky", "#3BA7FF"], ["Lilac", "#F3EFFF"]];
const SITES = { timiza: "timiza.or.ke", tumaini: "tumaini.kept.africa", hatua: "hatua.co.ke", mwangaza: "mwangaza.studio", pwani: "pwanihotels.co.ke" };

function MkLayout({ children }) {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
    if (loc.hash) { const t = setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60); return () => clearTimeout(t); }
    window.scrollTo(0, 0); return undefined;
  }, [loc.pathname, loc.hash]);
  return (
    <div className="mk">
      <header className="mk-header">
        <div className="container mk-header-in">
          <Link to="/" className="mk-brand"><Logo size={26} />Kept</Link>
          <nav className="mk-nav" aria-label="Main">{NAVS.map(([to, l]) => <NavLink key={to} to={to}>{l}</NavLink>)}</nav>
          <div className="row" style={{ gap: 8 }}>
            <ThemeToggle />
            {user ? <Link className="btn btn-primary" to="/app">Open dashboard</Link> : <><Link className="btn btn-ghost hide-sm" to="/login">Sign in</Link><Link className="btn btn-primary hide-xs" to="/contact">Book a demo</Link></>}
            <button className="btn btn-icon mk-menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
          </div>
        </div>
        {menu && <nav className="container mk-mobile" aria-label="Mobile">{NAVS.map(([to, l]) => <Link key={to} to={to} onClick={() => setMenu(false)}>{l}</Link>)}{!user && <Link to="/login">Sign in</Link>}</nav>}
      </header>
      <main>{children}</main>
      <section className="container"><div className="mk-cta"><h2>See Kept running on your own numbers.</h2><p>A 30-minute walkthrough, configured for your industry, with your questions answered by the people who build it.</p><Link className="btn btn-primary btn-lg" to="/contact">Book a demo</Link></div></section>
      <footer className="mk-footer">
        <div className="container mk-footer-in">
          <div className="mk-footer-brand"><span className="mk-brand"><Logo size={22} />Kept</span><p>Operations software and websites for organizations that deliver in the field: community organizations, retail chains, hotels and creative studios.</p>
            <div className="mk-palette" aria-label="Kept brand palette">{PALETTE6.map(([n, c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}</div></div>
          {[["Product", [["Overview", "/product"], ["Tazama field data", "/product#tazama"], ["Websites", "/product#websites"], ["Security", "/product#platform"]]],
            ["Solutions", [["Community organizations", "/solutions#community"], ["Retail chains", "/solutions#retail"], ["Hotels and tours", "/solutions#hospitality"], ["Creative studios", "/solutions#agency"]]],
            ["Company", [["Customers", "/customers"], ["Pricing", "/pricing"], ["Contact", "/contact"], ["Sign in", "/login"]]]].map(([h, ls]) => (
            <div key={h} className="mk-footer-col"><b>{h}</b>{ls.map(([l, to]) => <Link key={l} to={to}>{l}</Link>)}</div>
          ))}
        </div>
        <div className="container mk-footer-legal"><span>© 2026 Kept Technologies, Nairobi</span><span>Customer organizations shown with illustrative figures</span></div>
      </footer>
    </div>
  );
}
const Head = ({ eyebrow, title, sub, center }) => (
  <div className="mk-head" style={center ? { margin: "0 auto 44px", textAlign: "center" } : undefined}>
    <span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{sub && <p>{sub}</p>}
  </div>
);
const PageTop = ({ eyebrow, title, sub }) => (
  <div className="mk-hero-wrap mk-pagetop"><section className="container mk-hero" style={{ paddingBottom: 24 }}><span className="eyebrow">{eyebrow}</span><h1 style={{ marginTop: 12 }}>{title}</h1>{sub && <p>{sub}</p>}</section></div>
);

// ---------- Home ----------
export default function Landing() {
  const { data: showcase } = useApi("/platform/showcase");
  return (
    <MkLayout>
      <div className="mk-hero-wrap">
        <section className="container mk-hero">
          <h1>One system for the work, the money and the <em className="mk-hl">proof</em>.</h1>
          <p>Kept brings programmes, finance, stock, people and customers into one place, and turns the work your team records every day into the reports, dashboards and public website your stakeholders rely on.</p>
          <div className="row wrap" style={{ gap: 10, justifyContent: "center" }}><Link className="btn btn-primary btn-lg" to="/contact">Book a demo</Link><Link className="btn btn-lg" to="/product">Explore the product</Link></div>
        </section>
        <section className="container"><ProductMock /></section>
      </div>
      <section className="container mk-logos"><span>Trusted by</span>{(showcase || []).map((s) => <Link key={s.slug} to={`/site/${s.slug}`}>{s.organization}</Link>)}</section>

      <section className="container mk-section">
        <Head eyebrow="The problem" title="Growing organizations outgrow spreadsheets long before they can afford an enterprise system." sub="Figures live in a dozen files, approvals happen on WhatsApp, and nobody sees a missed target until a funder, a customer or an auditor does. Reporting takes days because the evidence has to be found before it can be counted." />
        <div className="mk-cols3">
          {[["Know where you stand, every day", "Targets, budgets, stock and bookings update as the work is recorded. Alerts flag what is slipping before the deadline, not after."],
            ["Spend with control", "Every expense, purchase and leave request follows an approval route with receipts attached. Budgets are compared with actual spend in real time."],
            ["Show proof, not promises", "Reports and website figures are built from records with evidence behind them, so the numbers you publish are the numbers you can defend."]].map(([t, d], i) => (
            <div key={t} className="mk-step"><span>{String(i + 1).padStart(2, "0")}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="mk-band">
        <div className="container mk-section mk-split">
          <div><Head eyebrow="Tazama" title="Field data that arrives while the team is still in the field." sub="Build a survey, register or checklist in minutes. Staff and volunteers collect on any phone, with or without signal, and every response appears on a live map and dashboard." />
            <Link className="btn btn-primary" to="/product#tazama">How Tazama works</Link></div>
          <ul className="mk-ticks">{["Works offline and syncs automatically when signal returns", "GPS location and photo evidence on every response", "Skip logic, validation and targets per form", "Imports your existing Google Sheet or Excel data", "Live tracker with a league table of collectors"].map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>

      <section className="container mk-section">
        <Head eyebrow="Built for your industry" title="Configured for the way you already operate." sub="Choose an industry and Kept installs the tools it needs. Nothing irrelevant, and every tool can be added or removed later." />
        <div className="mk-cols4">
          {[["community", "Community organizations", "Programmes, donors, M&E and field data in one place."], ["retail", "Retail chains", "Branch targets, stock transfers, deliveries and an online shop."],
            ["hospitality", "Hotels, dining and tours", "Rooms, tables and safaris, booked online and run from one desk."], ["agency", "Creative studios", "Productions, content calendars, gear bookings and invoicing."]].map(([k, t, d]) => (
            <Link key={k} to={`/solutions#${k}`} className="mk-fact" style={{ textDecoration: "none", color: "inherit" }}><h3>{t}</h3><p>{d}</p></Link>
          ))}
        </div>
      </section>
    </MkLayout>
  );
}

// ---------- Product ----------
const PILLARS = [
  ["Operate", "Plan the work and see it happen.", [["Projects and targets", "Commitments with deadlines, owners and the evidence each one needs. Pace is calculated daily, so a programme falling behind is visible in week two, not month six."],
    ["Tasks and approvals", "Work is assigned, dependencies are tracked, and anything waiting on a decision appears in one approvals inbox."], ["Events and calendar", "Every event gets its own attendance form, and a single calendar shows deadlines, leave and bookings together."]]],
  ["Control", "Keep money and stock accountable.", [["Budgets against actuals", "Spending is matched to budget lines as it is approved, with over-budget alerts and month-by-month burn."],
    ["Expenses and procurement", "Receipts are required before approval, nobody approves their own request, and purchase requests move from quote to delivery with a full history."], ["Inventory and transfers", "Stock levels, reorder points and transfers between branches, with every movement recorded against a person."]]],
  ["Sell and serve", "Run the customer side without a second system.", [["Sales and invoicing", "Customers, invoices and overdue alerts. A paid invoice posts to income automatically."],
    ["Bookings, tables and tours", "Rooms, venues and equipment with double-booking prevention, restaurant reservations by sitting, and tours with guide assignment."], ["Branches and deliveries", "Daily takings against target for each branch, and every delivery tracked from dispatch to doorstep."]]],
  ["Report and govern", "Answer any stakeholder in minutes.", [["Reports from the record", "Donor, board and management reports assembled from live data and frozen at the moment they are issued."],
    ["Alerts", "Ten rules watch deadlines, budgets, stock, documents and approvals, and escalate when nobody responds."], ["Audit trail and roles", "Every change is recorded with who, what and when. Administrators, managers, field staff and board members each see what their role requires."]]],
];
export function ProductPage() {
  return (
    <MkLayout>
      <PageTop eyebrow="Product" title="Everything an organization runs on, connected." sub="Kept replaces the spreadsheets, shared folders and message threads that hold your operations together, with one system where every record knows what it belongs to." />
      {PILLARS.map(([name, line, items], i) => (
        <section key={name} className={i % 2 ? "mk-band" : ""}>
          <div className="container mk-section">
            <Head eyebrow={name} title={line} />
            <div className="mk-cols3">{items.map(([t, d]) => <div key={t} className="mk-feature"><h3>{t}</h3><p>{d}</p></div>)}</div>
          </div>
        </section>
      ))}
      <section id="tazama" className="container mk-section mk-split" style={{ scrollMarginTop: 80 }}>
        <div><Head eyebrow="Tazama" title="Field data collection with live tracking." sub="Tazama, Swahili for observe, replaces paper forms and shared spreadsheets for teams who collect information away from the office." /></div>
        <ul className="mk-ticks">{["Ten question types, including GPS location and photo", "Skip logic so each person only sees questions that apply", "Offline collection on any phone, with automatic sync and no duplicates", "A live tracker: today, this week, progress to target, collectors and a map", "Import from CSV or keep a Google Sheet in sync during the switch", "Used for surveys and registers, rider check-ins and guest feedback"].map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section id="websites" className="mk-band" style={{ scrollMarginTop: 80 }}>
        <div className="container mk-section mk-split">
          <div><Head eyebrow="Websites" title="A public website that updates itself." sub="Every organization gets a website on its own domain, in its own brand, connected to its dashboard." /></div>
          <ul className="mk-ticks">{["Impact figures, stock levels and availability come straight from your records", "Donations by M-Pesa and card that post to your books", "Online shop, room booking, table reservations and tour requests", "Volunteer, contact and enquiry forms that land in the right inbox", "Staff sign in from the website to a dashboard in your brand"].map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>
      <section id="platform" className="container mk-section" style={{ scrollMarginTop: 80 }}>
        <Head eyebrow="Platform" title="Dependable by design." />
        <div className="mk-cols4">
          {[["Built for low bandwidth", "Pages load fast on 3G, and field collection works fully offline."], ["Your data stays separate", "Every organization's records are isolated, and every request is checked against the account making it."],
            ["Accountable by default", "Lockouts, strong passwords, instant sign-out on all devices, and a permanent audit trail."], ["Your data is yours", "Export any table to CSV at any time. Daily backups, and no lock-in."]].map(([t, d]) => (
            <div key={t} className="mk-fact"><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>
    </MkLayout>
  );
}

// ---------- Solutions ----------
const SOLUTIONS = [
  ["community", "Community organizations and NGOs", "Funders want evidence, boards want accountability, and field teams want less paperwork.", [
    "Programme targets with live pace and evidence attached", "Tazama field data with GPS and offline collection", "Grants pipeline, donations by M-Pesa, budgets against actuals", "Volunteer management and an anonymised participant registry", "Donor reports assembled from the record in minutes"], "timiza"],
  ["retail", "Retail chains", "Each branch runs its own till, stock walks between stores, and head office learns about a bad month at the end of it.", [
    "Daily takings for every branch, compared with monthly targets", "Stock levels, reorder alerts and branch-to-branch transfers", "Deliveries from dispatch to doorstep, with rider check-ins on Tazama", "An online shop with live stock and order tracking for customers", "Corporate and uniform invoicing with overdue alerts"], "hatua"],
  ["hospitality", "Hotels, dining and tours", "Rooms, restaurants and excursions are sold through different channels and reconciled by hand at night.", [
    "Room availability with double-booking prevention", "Online booking for rooms, tables and tours on your own website", "Restaurant reservations by sitting, with covers per service", "Tours with capacity limits and licensed guide assignment", "Tour operator and corporate invoicing"], "pwani"],
  ["agency", "Creative studios and agencies", "Productions, posts and gear bookings live in different apps, and invoices go out late.", [
    "Productions from brief to delivery, including client review rounds", "A content calendar per client, from draft to published", "Studio and equipment booking without clashes", "Client invoicing with deposits, balances and reminders", "A portfolio website with a brief form that lands in your pipeline"], "mwangaza"],
];
export function SolutionsPage() {
  return (
    <MkLayout>
      <PageTop eyebrow="Solutions" title="Built around the work, not the other way round." sub="Kept starts with the tools your industry needs and nothing it does not. Each configuration is used today by a real-world style case study." />
      {SOLUTIONS.map(([k, t, problem, points, slug], i) => (
        <section key={k} id={k} className={i % 2 ? "mk-band" : ""} style={{ scrollMarginTop: 70 }}>
          <div className="container mk-section mk-split">
            <div><Head eyebrow={t} title={problem} /><div className="row wrap" style={{ gap: 10 }}><Link className="btn btn-primary" to="/contact">Book a demo</Link><Link className="btn" to={`/site/${slug}`}>See a live example</Link></div></div>
            <ul className="mk-ticks">{points.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </section>
      ))}
    </MkLayout>
  );
}

// ---------- Customers ----------
const CASES = { timiza: ["Replaced a shared Google Sheet with Tazama for 110 outreach sessions a fortnight, mapped live, and produces donor reports from the record.", "Programmes, Tazama, Funding, Finance, Volunteers, Website"],
  tumaini: ["Tracks seed kits, training and savings groups across Machakos, with every input linked to a household.", "Programmes, Participants, Finance, Website"],
  hatua: ["Sees takings for five branches against target each morning and tracks every delivery from dispatch to doorstep.", "Branches, Deliveries, Inventory, Sales, Online shop"],
  mwangaza: ["Runs photo, video and film productions and client social calendars from one pipeline, and invoices on delivery.", "Studio, Content calendar, Bookings, Sales"],
  pwani: ["Sells rooms, restaurant tables and safaris on its own website and runs all three from one front desk.", "Rooms, Dining, Tours, Sales, Inventory"] };
export function CustomersPage() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const { data: showcase } = useApi("/platform/showcase");
  const explore = async (slug) => { if (!PREVIEW || !DEMO[slug]) { nav(`/site/${slug}/login`); return; } signIn(await api("/auth/login", { method: "POST", body: { email: DEMO[slug], password: "kept-demo-2026" } })); nav("/app"); };
  return (
    <MkLayout>
      <PageTop eyebrow="Customers" title="Five organizations. Five different ways of working." sub="Each runs its own website and its own dashboard on Kept. Visit the websites as the public sees them, or open the dashboards as their staff do." />
      <section className="container mk-section">
        <div className="mk-cases">
          {(showcase || []).map((s) => (
            <article key={s.slug} className="mk-case">
              <span className="mk-case-mark" style={{ background: s.primary }} />
              <span className="mk-case-kind">{s.industry}</span>
              <h3>{s.organization}</h3>
              <p>{CASES[s.slug]?.[0]}</p>
              <dl className="mk-case-meta"><dt>Uses</dt><dd>{CASES[s.slug]?.[1]}</dd><dt>Website</dt><dd><code>{SITES[s.slug] || `${s.slug}.kept.africa`}</code></dd></dl>
              <div className="row wrap" style={{ gap: 8, marginTop: "auto" }}>
                <Link className="btn" to={`/site/${s.slug}`}>Visit website</Link>
                {!user && <button className="btn btn-ghost" onClick={() => explore(s.slug)}>Open dashboard</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </MkLayout>
  );
}

// ---------- Pricing ----------
const PLANS = [["Starter", "4,900", "For small teams getting off spreadsheets.", ["Up to 10 staff accounts", "Five apps of your choice", "Website on a kept.africa address", "Tazama with 1,000 responses a month", "Email support"]],
  ["Growth", "14,900", "For organizations with several programmes, branches or properties.", ["Up to 50 staff accounts", "All apps", "Website on your own domain", "Unlimited Tazama responses", "M-Pesa donations and payments", "Onboarding and data import"], true],
  ["Organization", "Custom", "For groups, networks and multi-site operations.", ["Unlimited staff", "Multiple branches or properties", "Single sign-on and custom roles", "Service-level agreement", "Dedicated success manager"]]];
const FAQS = [["How long does it take to get started?", "Most organizations are live within two weeks. We configure your apps, import existing records and train your team in two sessions."],
  ["Can we bring our existing data?", "Yes. Spreadsheets, Google Sheets and CSV exports import directly, and a Google Sheet can stay in sync while your team switches over."],
  ["Does it work where the internet is unreliable?", "Field collection works fully offline and syncs when signal returns. The dashboard is built to load quickly on mobile data."],
  ["Can customers and donors pay us through it?", "Yes. M-Pesa and card payments are taken on your website and posted to your records automatically."],
  ["Who can see what?", "Every person has a role. Administrators manage the account, managers run operations, field staff see their own work, and board members get a read-only view."],
  ["Who owns the data?", "You do. Export any table at any time. Each organization's data is kept separate and backed up daily."],
  ["Is there a discount for non-profits?", "Registered community organizations and NGOs receive 40 percent off every plan."]];
export function PricingPage() {
  const [open, setOpen] = useState(0);
  return (
    <MkLayout>
      <PageTop eyebrow="Pricing" title="Simple monthly plans in Kenya shillings." sub="Every plan includes the website, the mobile-ready dashboard, updates and daily backups. Prices exclude VAT." />
      <section className="container mk-section" style={{ paddingTop: 24 }}>
        <div className="mk-plans">
          {PLANS.map(([n, price, line, items, hl]) => (
            <div key={n} className={"mk-plan" + (hl ? " hl" : "")}>
              {hl && <span className="mk-plan-tag">Most chosen</span>}
              <h3>{n}</h3><p>{line}</p>
              <div className="mk-price">{price === "Custom" ? <b>Custom</b> : <><span>KES</span><b>{price}</b><span>/month</span></>}</div>
              <ul className="mk-ticks">{items.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link className={"btn " + (hl ? "btn-primary" : "")} to="/contact" style={{ justifyContent: "center", marginTop: "auto" }}>{price === "Custom" ? "Talk to us" : "Book a demo"}</Link>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ textAlign: "center", marginTop: 18 }}>Indicative pricing for this demonstration.</p>
      </section>
      <section className="mk-band">
        <div className="container mk-section" style={{ maxWidth: 860 }}>
          <Head eyebrow="Questions" title="What buyers ask us" center />
          <div className="mk-faq">{FAQS.map(([q, a], i) => (
            <div key={q} className="mk-faq-item"><button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span>{q}</span><span aria-hidden="true">{open === i ? "−" : "+"}</span></button>{open === i && <p>{a}</p>}</div>
          ))}</div>
        </div>
      </section>
    </MkLayout>
  );
}

// ---------- Contact ----------
export function ContactPage() {
  const [f, setF] = useState({ name: "", organization: "", industry: "community", size: "1-10", contact: "", message: "" });
  const [st, setSt] = useState({ busy: false, error: null, ok: false });
  const send = async (e) => { e.preventDefault(); setSt({ busy: true, error: null, ok: false }); try { await api("/platform/demo-request", { method: "POST", body: { ...f, website: "" } }); setSt({ busy: false, error: null, ok: true }); } catch (er) { setSt({ busy: false, error: er, ok: false }); } };
  return (
    <MkLayout>
      <PageTop eyebrow="Contact" title="Book a demo" sub="Tell us how your organization works today. We will come back within one working day with a time and a demo configured for your industry." />
      <section className="container mk-section mk-split" style={{ paddingTop: 24 }}>
        <div className="stack">
          {[["Sales and demos", "hello@kept.africa"], ["Support for customers", "support@kept.africa"], ["Office", "Westlands, Nairobi. Monday to Friday, 8:30 to 17:30"]].map(([t, v]) => <div key={t} className="mk-fact"><h3>{t}</h3><p>{v}</p></div>)}
        </div>
        <form className="panel panel-body stack" onSubmit={send} noValidate>
          {st.ok ? <div className="stack-sm"><h3 className="card-title">Thank you. We have your request.</h3><p className="muted">Expect a reply within one working day.</p></div> : <>
            <ErrorNotice error={st.error} />
            <div className="form-grid">
              <Field label="Your name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
              <Field label="Organization"><input className="input" value={f.organization} onChange={(e) => setF({ ...f, organization: e.target.value })} autoComplete="organization" /></Field>
              <Field label="Industry"><select className="select" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}>{PLATFORM.industries.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}</select></Field>
              <Field label="Team size"><select className="select" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })}>{["1-10", "11-50", "51-200", "200+"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            </div>
            <Field label="Email or phone"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
            <Field label="What would you like Kept to fix?" hint="Optional"><textarea className="textarea" rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            <button className="btn btn-primary btn-lg" disabled={st.busy}>{st.busy ? "Sending..." : "Request a demo"}</button>
          </>}
        </form>
      </section>
    </MkLayout>
  );
}
