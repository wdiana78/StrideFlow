import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Bars, Columns, Donut } from "../components/charts";
import { ErrorNotice, Loading, PaceLine, Shape, Status } from "../components/ui";
import { fmtDate, fmtNum, isoToday, RULE_LABEL } from "../format";
import { useApi } from "../hooks";
import { moneyShort } from "../modules";
import PLATFORM from "../platform.json";
import { AppIcon } from "./Apps";

export const APP_HOME = { projects: "/app/projects", forms: "/app/forms", events: "/app/m/events", funding: "/app/m/grants", finance: "/app/finance", sales: "/app/m/invoices",
  procurement: "/app/m/purchase_requests", inventory: "/app/m/items", bookings: "/app/m/bookings", people: "/app/m/volunteers", participants: "/app/m/participants",
  documents: "/app/m/documents", governance: "/app/m/meetings", website: "/app/m/site_settings", branches: "/app/m/branch_sales", deliveries: "/app/m/deliveries",
  studio: "/app/m/productions", social: "/app/m/posts", dining: "/app/m/reservations", tours: "/app/m/tour_bookings" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TONES = ["var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)", "var(--p1)", "color-mix(in srgb, var(--p2) 60%, var(--p3))"];
const ICON = {
  check: "M4 12l5 5L20 6", money: "M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H7", chart: "M4 20V10M10 20V4M16 20v-7", people: "M16 20v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8",
  heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z", cash: "M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6", receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4", bed: "M3 18v-7h18v7M3 14h18M7 11V8h4v3", truck: "M2 6h12v10H2zM14 9h4l3 3v4h-7", camera: "M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5", store: "M3 9h18v11H3zM3 9l2-5h14l2 5", fork: "M5 3v8a2 2 0 004 0V3M7 11v10M17 3c-2 2-2 6 0 8v10", compass: "M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z",
};
const Ico = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

function Kpi({ label, value, sub, to, i, icon }) {
  const fg = TONES[i % TONES.length];
  return (
    <Link to={to} className="kpi" style={{ "--kpi-c": fg }}>
      <span className="kpi-icon" style={{ background: fg, color: fg === "var(--p4)" ? "#2B1E00" : "#fff" }}><Ico d={icon} /></span>
      <span className="kpi-label">{label}</span><span className="kpi-value">{value}</span><span className="kpi-sub">{sub}</span>
    </Link>
  );
}
const KpiRow = ({ items }) => <div className="kpi-row">{items.filter(Boolean).slice(0, 6).map((k, i) => <Kpi key={k.label} {...k} i={i} />)}</div>;
const Panel = ({ title, link, children, wide }) => (
  <section className={`panel ${wide ? "wide" : "narrow"}`}>
    <div className="panel-head"><h2>{title}</h2>{link && <Link to={link[0]} className="small">{link[1]}</Link>}</div>
    <div className="panel-body stack-sm">{children}</div>
  </section>
);
const Pipeline = ({ stages, counts }) => (
  <div className="pipeline">{stages.map(([k, l], i) => <div key={k} style={{ "--kpi-c": TONES[i % TONES.length] }}><b>{fmtNum(counts?.[k] || 0)}</b><span>{l}</span></div>)}</div>
);

function Banner({ title, subtitle, actions }) {
  const { user } = useAuth();
  return (
    <div className="hero-navy">
      <div className="stack-sm" style={{ gap: 4 }}>
        <span className="muted small">{fmtDate(isoToday(), true)} · {roleLabel(user.role)}</span>
        <h1>{title}</h1><span className="muted">{subtitle}</span>
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}
export const roleLabel = (r) => ({ admin: "Administrator", manager: "Manager", member: "Field team", viewer: "Board and partners (read only)" }[r] || r);

// One next action per enabled capability, so a new workspace never opens on a page of zeros.
const FIRST_STEPS = [
  ["projects", "Create your first project", "Set a goal, a deadline and the people responsible. Tasks and progress hang off it.", "/app/projects?new=1"],
  ["forms", "Build a Tazama form", "Collect data in the field, with GPS and photos, even without signal.", "/app/forms/new"],
  ["finance", "Set up a budget line", "Expenses are approved against budget lines, so start with one.", "/app/m/budget_lines?new=1"],
  ["inventory", "Add your first stock item", "Record what you hold and where. Movements and low-stock alerts follow.", "/app/m/items?new=1"],
  ["procurement", "Add a supplier", "Purchase requests are raised against suppliers.", "/app/m/vendors?new=1"],
  ["sales", "Add a customer", "Invoices and overdue reminders start from customer records.", "/app/m/customers?new=1"],
  ["bookings", "Add a bookable resource", "Rooms, vehicles or equipment, with availability checks.", "/app/m/resources?new=1"],
  ["branches", "Add your locations", "Branches, warehouses or sites that stock, sales and deliveries belong to.", "/app/m/branches?new=1"],
  ["deliveries", "Record a delivery", "Follow it from dispatch to doorstep.", "/app/m/deliveries?new=1"],
  ["documents", "Upload a contract or certificate", "Add an expiry date and StrideFlow reminds you before it lapses.", "/app/m/documents?new=1"],
  ["events", "Plan an event", "Each event gets its own attendance form.", "/app/m/events?new=1"],
  ["people", "Add people to your register", "Staff, volunteers, contractors or members.", "/app/m/volunteers?new=1"],
];

function GettingStarted({ has, admin }) {
  const steps = FIRST_STEPS.filter(([k]) => has(k)).slice(0, 5);
  return (
    <section className="panel" aria-labelledby="gs-h">
      <div className="panel-head"><h2 id="gs-h">Get started</h2>{admin && <Link to="/app/welcome" className="small">Change capabilities</Link>}</div>
      <ol className="gs-list">
        {steps.map(([k, title, text, to]) => (
          <li key={k}><div><b>{title}</b><span>{text}</span></div><Link className="btn" to={to}>Start</Link></li>
        ))}
        {admin && <li><div><b>Invite your team</b><span>Send email invitations with the right role for each person.</span></div><Link className="btn" to="/app/settings">Invite</Link></li>}
      </ol>
    </section>
  );
}

function AppLauncher({ installed, industry }) {
  return (
    <section className="stack-sm" aria-labelledby="apps-h">
      <div className="spread"><h2 id="apps-h" className="card-title">Apps</h2><Link to="/app/apps" className="small">Manage apps</Link></div>
      <div className="launcher">
        {PLATFORM.apps.filter((a) => installed.includes(a.key)).map((a) => (
          <Link key={a.key} to={a.key === "people" && industry !== "community" ? "/app/m/leave_requests" : APP_HOME[a.key]} className="tile launcher-tile">
            <AppIcon app={a} size={44} /><span>{industry === "agency" && a.key === "bookings" ? "Studio and gear bookings" : a.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Overview() {
  const { user } = useAuth();
  if (user.role === "member") return <FieldHome />;
  if (user.role === "viewer") return <BoardHome />;
  return <ManagerHome />;
}

// ---------- managers and administrators ----------
function ManagerHome() {
  const { user, can } = useAuth();
  const { data: d, error, loading, reload } = useApi("/dashboard");
  if (loading && !d) return <Loading rows={10} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const has = (a) => d.installed.includes(a);
  if (d.is_empty) {
    return (
      <>
        <Banner title={`Welcome to StrideFlow, ${user.full_name.split(" ")[0]}`} subtitle={`${user.organization.name} is ready. Here is a sensible first step for each capability you chose.`} />
        <GettingStarted has={has} admin={can.admin} />
        <AppLauncher installed={d.installed} industry={d.industry} />
      </>
    );
  }
  const ind = d.industry, o = d.ops || {}, f = d.finance, p = d.people, g = p.participants_by_gender || {};
  const quick = [
    has("branches") && ["Record takings", "/app/m/branch_sales?new=1"], has("deliveries") && ["New delivery", "/app/m/deliveries?new=1"], has("studio") && ["New production", "/app/m/productions?new=1"],
    has("social") && ["Plan a post", "/app/m/posts?new=1"], ind === "hospitality" && has("bookings") && ["New booking", "/app/m/bookings?new=1"], has("dining") && ["Reserve a table", "/app/m/reservations?new=1"],
    has("tours") && ["Book a tour", "/app/m/tour_bookings?new=1"], has("sales") && ["New invoice", "/app/m/invoices?new=1"], has("finance") && can.manage && ["Record expense", "/app/m/expenses?new=1"],
    has("participants") && ["Register participant", "/app/m/participants?new=1"], has("forms") && ind === "community" && ["New Tazama form", "/app/forms/new"], has("funding") && can.manage && ["Record donation", "/app/m/donations?new=1"],
    has("events") && ind === "community" && can.manage && ["New event", "/app/m/events?new=1"],
  ].filter(Boolean).slice(0, 6);
  const br = o.branches;
  const kpis = ind === "retail" ? [
    br && { label: "Takings today", value: moneyShort(br.today), sub: `${moneyShort(br.month)} this month`, to: "/app/m/branch_sales", icon: ICON.cash },
    br && { label: "Month to target", value: `${Math.round((br.month / Math.max(1, br.rows.reduce((a, r) => a + r.target, 0))) * 100)}%`, sub: `day ${br.days_elapsed} of the month`, to: "/app/m/branches", icon: ICON.chart },
    o.deliveries && { label: "Out for delivery", value: fmtNum(o.deliveries.out || 0), sub: `${o.deliveries.assigned || 0} assigned · ${o.deliveries.new || 0} new`, to: "/app/m/deliveries", icon: ICON.truck },
    { label: "Low stock", value: d.inventory.low_stock, sub: `of ${d.inventory.items} lines`, to: "/app/m/items", icon: ICON.box },
    { label: "Unpaid invoices", value: moneyShort(d.sales.outstanding), sub: `${d.sales.overdue} overdue`, to: "/app/m/invoices", icon: ICON.receipt },
    { label: "Transfers open", value: o.transfers_open || 0, sub: "between branches", to: "/app/m/transfers", icon: ICON.store },
  ] : ind === "hospitality" ? [
    o.rooms && { label: "Occupancy tonight", value: `${Math.round((o.rooms.occupied / Math.max(1, o.rooms.total)) * 100)}%`, sub: `${o.rooms.occupied} of ${o.rooms.total} rooms`, to: "/app/m/bookings", icon: ICON.bed },
    o.rooms && { label: "Arrivals today", value: o.rooms.arrivals, sub: `${o.rooms.departures} departures`, to: "/app/m/bookings", icon: ICON.calendar },
    o.dining && { label: "Covers today", value: fmtNum(o.dining.reduce((a, r) => a + r.covers, 0)), sub: `${o.dining.reduce((a, r) => a + r.tables, 0)} tables booked`, to: "/app/m/reservations", icon: ICON.fork },
    o.tours && { label: "Tours this week", value: o.tours.week, sub: `${o.tours.enquiries} enquiries to confirm`, to: "/app/m/tour_bookings", icon: ICON.compass },
    { label: "Unpaid invoices", value: moneyShort(d.sales.outstanding), sub: `${d.sales.overdue} overdue`, to: "/app/m/invoices", icon: ICON.receipt },
    { label: "Stays booked ahead", value: moneyShort(d.bookings.value), sub: `${d.bookings.active} active bookings`, to: "/app/m/bookings", icon: ICON.cash },
  ] : ind === "agency" ? [
    o.productions && { label: "In production", value: (o.productions.booked || 0) + (o.productions.shooting || 0) + (o.productions.editing || 0), sub: `${o.productions.review || 0} awaiting client review`, to: "/app/m/productions", icon: ICON.camera },
    o.shoots && { label: "Next shoot", value: o.shoots[0] ? fmtDate(o.shoots[0].date) : "None", sub: o.shoots[0]?.title || "Nothing booked", to: "/app/m/productions", icon: ICON.calendar },
    { label: "Posts this week", value: o.posts_week ?? 0, sub: `${o.posts_review || 0} waiting for client approval`, to: "/app/m/posts", icon: ICON.chart },
    { label: "Unpaid invoices", value: moneyShort(d.sales.outstanding), sub: `${d.sales.overdue} overdue · ${d.sales.drafts} drafts`, to: "/app/m/invoices", icon: ICON.receipt },
    { label: "Collected", value: moneyShort(d.sales.paid), sub: "paid invoices", to: "/app/m/invoices", icon: ICON.cash },
  ] : [
    has("projects") && { label: "Commitments on track", value: `${d.commitments.on_track}/${d.commitments.total}`, sub: `${d.commitments.at_risk} at risk`, to: "/app/projects", icon: ICON.check },
    has("funding") && { label: "Funding secured", value: moneyShort(f.awarded), sub: `${moneyShort(f.pipeline)} in pipeline`, to: "/app/m/grants", icon: ICON.money },
    has("finance") && { label: "Budget used", value: `${f.used_pct}%`, sub: `${moneyShort(f.spent)} of ${moneyShort(f.budget)}`, to: "/app/finance", icon: ICON.chart },
    has("participants") && { label: "Participants", value: fmtNum(p.participants), sub: `${g.female || 0} female · ${g.male || 0} male`, to: "/app/analytics", icon: ICON.people },
    has("people") && { label: "Active volunteers", value: p.volunteers_active, sub: `${fmtNum(p.hours_this_month)} hours this month`, to: "/app/m/volunteers", icon: ICON.heart },
    has("funding") && { label: "Cash received", value: moneyShort(f.received), sub: `${moneyShort(f.received - f.spent)} unspent`, to: "/app/m/income", icon: ICON.cash },
  ];
  return (
    <>
      <Banner title={`Good to see you, ${user.full_name.split(" ")[0]}`} subtitle={user.organization.name}
        actions={<><Link className="btn btn-primary" to="/app/attention">{d.open_flags} alerts</Link><Link className="btn" to="/app/approvals">{d.approvals_waiting} to approve</Link></>} />
      <AppLauncher installed={d.installed} industry={ind} />
      <div className="quick" aria-label="Quick actions">{quick.map(([l, to], i) => <Link key={l} className={"btn" + (i === 0 ? " btn-primary" : "")} to={to}>{l}</Link>)}</div>
      <KpiRow items={kpis} />

      {ind === "retail" && br && (
        <div className="two-col">
          <Panel wide title="Branch performance this month" link={["/app/m/branch_sales", "Daily sales"]}>
            {br.rows.map((r, i) => {
              const pace = (r.target * br.days_elapsed) / 30; const pct = Math.round((r.month / Math.max(1, r.target)) * 100); const ahead = r.month >= pace;
              return (
                <div key={r.name} className="branch-row">
                  <div className="spread"><b>{r.name}</b><span className="small"><b>{moneyShort(r.month)}</b> <span className="muted">of {moneyShort(r.target)} · {pct}%</span> <span style={{ color: ahead ? "var(--ok)" : "var(--risk)", fontWeight: 600 }}>{ahead ? "ahead of pace" : "behind pace"}</span></span></div>
                  <div className="meter"><span style={{ width: `${Math.min(100, pct)}%`, background: TONES[i % TONES.length] }} /><i style={{ left: `${Math.min(100, (br.days_elapsed / 30) * 100)}%` }} /></div>
                </div>
              );
            })}
            <span className="small muted">The marker shows where each branch should be by today.</span>
          </Panel>
          <Panel title="Deliveries" link={["/app/m/deliveries", "All deliveries"]}>
            <Pipeline stages={[["new", "New"], ["assigned", "Assigned"], ["out", "On the road"], ["delivered", "Delivered"], ["failed", "Failed"]]} counts={o.deliveries} />
            <Link to="/app/forms" className="btn">Open rider tracking in Tazama</Link>
          </Panel>
        </div>
      )}

      {ind === "hospitality" && (
        <div className="two-col">
          <Panel wide title="Restaurants today" link={["/app/m/reservations", "Reservations"]}>
            {o.dining?.length ? <Bars data={o.dining.map((r) => ({ label: `${r.label} (${r.tables} tables)`, value: r.covers }))} format={(v) => `${v} covers`} /> : <span className="muted small">No tables booked for today.</span>}
          </Panel>
          <Panel title="Rooms tonight" link={["/app/m/bookings", "Bookings"]}>
            {o.rooms && <Donut data={[{ label: "Occupied", value: o.rooms.occupied }, { label: "Available", value: Math.max(0, o.rooms.total - o.rooms.occupied) }]} size={140} center={`${Math.round((o.rooms.occupied / Math.max(1, o.rooms.total)) * 100)}%`} sub="occupied" colors={["var(--p2)", "var(--p6)"]} />}
            {o.tours?.unassigned > 0 && <div className="notice notice-warn">{o.tours.unassigned} confirmed tours have no guide yet.</div>}
          </Panel>
        </div>
      )}

      {ind === "agency" && (
        <div className="two-col">
          <Panel wide title="Production pipeline" link={["/app/m/productions", "All productions"]}>
            <Pipeline stages={[["brief", "Brief"], ["booked", "Booked"], ["shooting", "Shooting"], ["editing", "In edit"], ["review", "Client review"], ["delivered", "Delivered"]]} counts={o.productions} />
          </Panel>
          <Panel title="Upcoming shoots" link={["/app/m/productions", "Calendar"]}>
            {o.shoots?.length ? o.shoots.map((x) => <div key={x.title} className="row" style={{ gap: 12 }}><span className="date-chip">{fmtDate(x.date)}</span><span>{x.title}</span></div>) : <span className="muted small">No shoots booked.</span>}
          </Panel>
        </div>
      )}

      {!["retail", "hospitality", "agency"].includes(ind) && (
        <div className="two-col">
          <section className="wide panel" aria-labelledby="prog-h">
            {has("projects") && d.programmes.length > 0 ? (
              <>
                <div className="panel-head"><h2 id="prog-h">Programmes</h2><Link to="/app/analytics" className="small">Insights</Link></div>
                {d.programmes.map((pr) => (
                  <div key={pr.id} style={{ padding: "14px 22px", borderTop: "1px solid var(--rule-soft)" }} className="stack-sm">
                    <Link to={`/app/projects/${pr.id}`} className="strong" style={{ color: "var(--ink)", textDecoration: "none", fontSize: 16 }}>{pr.name}</Link>
                    {pr.commitments.map((c) => (
                      <div key={c.id} className="prog-row"><span style={{ fontSize: 14 }}>{c.title}<span className="small muted"> · {fmtNum(c.pace.actual)}/{fmtNum(c.pace.target)}</span></span><PaceLine pace={c.pace} /><Status kind={c.pace.status} /></div>
                    ))}
                  </div>
                ))}
              </>
            ) : <Alerts flags={d.top_flags} />}
          </section>
          <aside className="narrow stack">
            {has("finance") && f.months.some((x) => x.spent > 0) && <Panel title="Spending by month" link={["/app/finance", "Budget vs actual"]}><Columns data={f.months.map((x) => ({ label: MONTHS[Number(x.month.slice(5, 7)) - 1], value: x.spent }))} highlightLast /></Panel>}
            {has("participants") && p.participants > 0 && <Panel title="Participants by gender"><Donut data={["female", "male", "other"].map((k) => ({ label: k, value: g[k] || 0 }))} size={140} /></Panel>}
          </aside>
        </div>
      )}

      {["retail", "hospitality", "agency"].includes(ind) && (
        <div className="two-col">
          <section className="wide panel"><Alerts flags={d.top_flags} /></section>
          <aside className="narrow stack">
            {d.upcoming_events.length > 0 && <Panel title="Coming up" link={["/app/calendar", "Calendar"]}>{d.upcoming_events.map((e) => <div key={e.id} className="row" style={{ gap: 12 }}><span className="date-chip">{fmtDate(e.date)}</span>{e.title}</div>)}</Panel>}
            {user.role === "admin" && <AdminCard />}
          </aside>
        </div>
      )}
      {!["retail", "hospitality", "agency"].includes(ind) && user.role === "admin" && <AdminCard />}
    </>
  );
}

function Alerts({ flags }) {
  return (
    <>
      <div className="panel-head"><h2>Needs attention</h2><Link to="/app/attention" className="small">All alerts</Link></div>
      {flags.length === 0 ? <div className="empty"><h3>All clear</h3></div> : flags.map((fl, i) => (
        <Link key={i} to="/app/attention" className="row" style={{ padding: "13px 22px", borderTop: "1px solid var(--rule-soft)", gap: 12, textDecoration: "none", color: "var(--ink)" }}>
          <Shape kind={fl.rule === "invoice_overdue" ? "overdue" : fl.rule} /><b style={{ minWidth: 140 }}>{RULE_LABEL[fl.rule] || fl.rule}</b><span>{fl.title}<span className="small muted"> · {fl.detail}</span></span>
        </Link>
      ))}
    </>
  );
}

function AdminCard() {
  const { data: users } = useApi("/users");
  return (
    <Panel title="Administration">
      <div className="admin-links">
        <Link to="/app/settings"><b>{users ? (users.items || users).length : "…"}</b><span>Team members and roles</span></Link>
        <Link to="/app/apps"><b>Apps</b><span>Install or remove</span></Link>
        <Link to="/app/settings?tab=audit"><b>Audit log</b><span>Every change, by whom</span></Link>
        <Link to="/app/m/site_settings"><b>Website</b><span>Content and brand</span></Link>
      </div>
    </Panel>
  );
}

// ---------- field team ----------
function FieldHome() {
  const { user } = useAuth();
  const { data: tasks } = useApi("/activities", { owner: "me", state: "open", page_size: 8 });
  const { data: flags } = useApi("/flags", { mine: true });
  const { data: forms } = useApi("/forms");
  const open = (forms || []).filter((f) => f.status === "open");
  const list = tasks?.items || [];
  return (
    <>
      <Banner title={`Your day, ${user.full_name.split(" ")[0]}`} subtitle={`${list.length} open tasks · ${(flags?.items || []).length} alerts for you`}
        actions={open[0] && <Link className="btn btn-primary" to={`/app/forms/${open[0].id}?tab=collect`}>Collect: {open[0].title}</Link>} />
      <div className="two-col">
        <Panel wide title="My tasks" link={["/app/work", "All my work"]}>
          {list.length === 0 ? <span className="muted">Nothing assigned to you right now.</span> : list.map((a) => (
            <Link key={a.id} to={`/app/activities/${a.id}`} className="task-row"><span><b>{a.title}</b><span className="small muted">{a.project_name || a.commitment_title || ""}</span></span><span className="date-chip">{a.due_on ? fmtDate(a.due_on) : "No date"}</span></Link>
          ))}
        </Panel>
        <Panel title="Tazama forms" link={["/app/forms", "All forms"]}>
          {open.length === 0 ? <span className="muted small">No forms open for collection.</span> : open.slice(0, 6).map((f2) => (
            <Link key={f2.id} to={`/app/forms/${f2.id}?tab=collect`} className="task-row"><span><b>{f2.title}</b><span className="small muted">{fmtNum(f2.responses)} responses</span></span><span className="btn btn-primary" style={{ height: 32 }}>Collect</span></Link>
          ))}
        </Panel>
      </div>
      {(flags?.items || []).length > 0 && <section className="panel"><Alerts flags={flags.items.slice(0, 6).map((x) => ({ rule: x.rule, title: x.title, detail: x.detail }))} /></section>}
    </>
  );
}

// ---------- board and partners (read only) ----------
function BoardHome() {
  const { user } = useAuth();
  const { data: d } = useApi("/dashboard");
  const { data: reports } = useApi("/reports");
  if (!d) return <Loading rows={8} />;
  const f = d.finance;
  return (
    <>
      <Banner title="Board overview" subtitle={`${user.organization.name}. Read-only view of results, money and reports.`} actions={<Link className="btn btn-primary" to="/app/reports">Reports</Link>} />
      <KpiRow items={[
        { label: "Commitments on track", value: `${d.commitments.on_track}/${d.commitments.total}`, sub: `${d.commitments.at_risk} at risk`, to: "/app/projects", icon: ICON.check },
        { label: "Funding secured", value: moneyShort(f.awarded), sub: `${moneyShort(f.pipeline)} in pipeline`, to: "/app/m/grants", icon: ICON.money },
        { label: "Budget used", value: `${f.used_pct}%`, sub: `${moneyShort(f.spent)} of ${moneyShort(f.budget)}`, to: "/app/finance", icon: ICON.chart },
        { label: "Participants", value: fmtNum(d.people.participants), sub: "registered this year", to: "/app/analytics", icon: ICON.people },
      ]} />
      <div className="two-col">
        <section className="wide panel">
          <div className="panel-head"><h2>Programme progress</h2><Link to="/app/analytics" className="small">Insights</Link></div>
          {d.programmes.map((pr) => (
            <div key={pr.id} style={{ padding: "14px 22px", borderTop: "1px solid var(--rule-soft)" }} className="stack-sm">
              <b>{pr.name}</b>
              {pr.commitments.map((c) => <div key={c.id} className="prog-row"><span style={{ fontSize: 14 }}>{c.title}</span><PaceLine pace={c.pace} /><Status kind={c.pace.status} /></div>)}
            </div>
          ))}
        </section>
        <Panel title="Latest reports" link={["/app/reports", "All reports"]}>
          {(reports?.items || reports || []).length === 0 && <span className="muted small">No reports issued yet. Reports appear here as soon as a manager issues one.</span>}
          {(reports?.items || reports || []).slice(0, 5).map((r) => <Link key={r.id} to={`/app/reports/${r.id}`} className="task-row"><span><b>{r.title}</b><span className="small muted">{r.project_name || ""}</span></span><span className="date-chip">{fmtDate(r.created_at || r.period_end)}</span></Link>)}
        </Panel>
      </div>
    </>
  );
}
