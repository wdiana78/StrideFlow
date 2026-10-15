import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Columns, Donut, PALETTE } from "../components/charts";
import { ErrorNotice, Loading, PaceLine, Shape, Status } from "../components/ui";
import { fmtDate, fmtNum, RULE_LABEL } from "../format";
import { useApi } from "../hooks";
import { moneyShort } from "../modules";
import PLATFORM from "../platform.json";
import { AppIcon } from "./Apps";

export const APP_HOME = { projects: "/app/projects", forms: "/app/forms", events: "/app/m/events", funding: "/app/m/grants", finance: "/app/finance", sales: "/app/m/invoices",
  procurement: "/app/m/purchase_requests", inventory: "/app/m/items", bookings: "/app/m/bookings", people: "/app/m/volunteers", participants: "/app/m/participants",
  documents: "/app/m/documents", governance: "/app/m/meetings", website: "/app/m/site_settings" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TONES = ["var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)", "var(--p1)", "color-mix(in srgb, var(--p2) 60%, var(--p3))"];
const Ico = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

function Kpi({ label, value, sub, to, i, icon }) {
  const fg = TONES[i % TONES.length];
  return (
    <Link to={to} className="kpi" style={{ "--kpi-c": fg }}>
      <span className="kpi-icon" style={{ background: fg, color: fg === "var(--p4)" ? "#2B1E00" : "#fff" }}><Ico d={icon} /></span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub">{sub}</span>
    </Link>
  );
}

export default function Overview() {
  const { user, can } = useAuth();
  const { data: d, error, loading, reload } = useApi("/dashboard");
  if (loading && !d) return <Loading rows={10} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const has = (a) => d.installed.includes(a);
  const f = d.finance, p = d.people, g = p.participants_by_gender || {};
  const kpis = [
    has("projects") && { label: "On track", value: `${d.commitments.on_track}/${d.commitments.total}`, sub: `${d.commitments.at_risk} at risk`, to: "/app/projects", icon: "M4 12l5 5L20 6" },
    has("sales") && { label: "Unpaid invoices", value: moneyShort(d.sales.outstanding), sub: `${d.sales.overdue} overdue · ${d.sales.drafts} drafts`, to: "/app/m/invoices", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
    has("bookings") && { label: "Active bookings", value: d.bookings.active, sub: `${d.bookings.in_house} checked in · ${moneyShort(d.bookings.value)}`, to: "/app/m/bookings", icon: "M4 6h16v14H4zM4 10h16" },
    has("inventory") && { label: "Low stock", value: d.inventory.low_stock, sub: `of ${d.inventory.items} items · ${fmtNum(d.inventory.units)} units`, to: "/app/m/items", icon: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4" },
    has("funding") && { label: "Funding secured", value: moneyShort(f.awarded), sub: `${moneyShort(f.pipeline)} in pipeline`, to: "/app/m/grants", icon: "M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H7" },
    has("finance") && { label: "Budget used", value: `${f.used_pct}%`, sub: `${moneyShort(f.spent)} of ${moneyShort(f.budget)}`, to: "/app/finance", icon: "M4 20V10M10 20V4M16 20v-7" },
    has("participants") && { label: "Participants", value: fmtNum(p.participants), sub: `${g.female || 0} female · ${g.male || 0} male`, to: "/app/analytics", icon: "M16 20v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8" },
    has("people") && p.volunteers_active > 0 && { label: "Volunteers", value: p.volunteers_active, sub: `${fmtNum(p.hours_this_month)} hrs this month`, to: "/app/m/volunteers", icon: "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" },
    has("funding") && { label: "Cash received", value: moneyShort(f.received), sub: `${moneyShort(f.received - f.spent)} unspent`, to: "/app/m/income", icon: "M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6" },
    has("sales") && !has("funding") && { label: "Paid invoices", value: moneyShort(d.sales.paid), sub: "collected so far", to: "/app/m/invoices", icon: "M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6" },
  ].filter(Boolean).slice(0, 6);
  const quick = [
    has("sales") && ["+ Invoice", "/app/m/invoices?new=1"], has("bookings") && ["+ Booking", "/app/m/bookings?new=1"], has("finance") && can.manage && ["+ Expense", "/app/m/expenses?new=1"],
    has("events") && can.manage && ["+ Event", "/app/m/events?new=1"], has("inventory") && ["+ Stock movement", "/app/m/stock_moves?new=1"], has("participants") && ["+ Participant", "/app/m/participants?new=1"],
    has("funding") && can.manage && ["+ Donation", "/app/m/donations?new=1"], has("forms") && can.manage && ["+ Survey", "/app/forms/new"], has("sales") && ["+ Customer", "/app/m/customers?new=1"],
  ].filter(Boolean);
  return (
    <>
      <div className="hero-navy">
        <div className="stack-sm" style={{ gap: 4 }}>
          <span className="muted small">{fmtDate(d.today, true)}</span>
          <h1>Good to see you, {user.full_name.split(" ")[0]}</h1>
          <span className="muted">{user.organization.name}</span>
        </div>
        <div className="row wrap">
          <Link className="btn btn-primary" to="/app/attention">{d.open_flags} alerts</Link>
          <Link className="btn" to="/app/approvals">{d.approvals_waiting} to approve</Link>
        </div>
      </div>

      <section className="stack-sm" aria-labelledby="apps-h">
        <div className="spread"><h2 id="apps-h" className="card-title">Apps</h2><Link to="/app/apps" className="small">Manage apps</Link></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10 }}>
          {PLATFORM.apps.filter((a) => d.installed.includes(a.key)).map((a) => (
            <Link key={a.key} to={a.key === "people" && d.industry !== "community" ? "/app/m/leave_requests" : APP_HOME[a.key]} className="tile" style={{ alignItems: "center", textAlign: "center", padding: "14px 8px", gap: 8 }}>
              <AppIcon app={a} size={44} /><span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: "16px" }}>{a.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="quick" aria-label="Quick actions">
        {quick.map(([l, to], i) => <Link key={l} className={"btn" + (i === 0 ? " btn-primary" : "")} to={to}>{l}</Link>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {kpis.map((k, i) => <Kpi key={k.label} {...k} i={i} />)}
      </div>
      <div className="two-col">
        <section className="wide panel" aria-labelledby="prog-h">
          {has("projects") && d.programmes.length > 0 ? (
            <>
              <div className="panel-head"><h2 id="prog-h">Projects</h2><Link to="/app/analytics" className="btn btn-ghost">Analytics</Link></div>
              {d.programmes.map((pr, i) => (
                <div key={pr.id} style={{ padding: "14px 22px", borderTop: "1px solid var(--rule-soft)" }} className="stack-sm">
                  <Link to={`/app/projects/${pr.id}`} className="row strong" style={{ color: "var(--ink)", textDecoration: "none", fontSize: 16, gap: 8 }}>{pr.name}</Link>
                  {pr.commitments.map((c) => (
                    <div key={c.id} className="prog-row">
                      <span style={{ fontSize: 14 }}>{c.title}<span className="small muted"> · {fmtNum(c.pace.actual)}/{fmtNum(c.pace.target)}</span></span>
                      <PaceLine pace={c.pace} /><Status kind={c.pace.status} />
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="panel-head"><h2 id="prog-h">Needs attention</h2><Link to="/app/attention" className="btn btn-ghost">All</Link></div>
              {d.top_flags.length === 0 ? <div className="empty"><h3>All clear</h3></div> : d.top_flags.map((fl, i) => (
                <Link key={i} to="/app/attention" className="row" style={{ padding: "14px 22px", borderTop: "1px solid var(--rule-soft)", gap: 12, textDecoration: "none", color: "var(--ink)" }}>
                  <Shape kind={fl.rule === "invoice_overdue" ? "overdue" : fl.rule} /><b style={{ minWidth: 150 }}>{RULE_LABEL[fl.rule] || fl.rule}</b><span>{fl.title}<span className="small muted"> · {fl.detail}</span></span>
                </Link>
              ))}
            </>
          )}
        </section>
        <aside className="narrow stack">
          {has("finance") && f.months.some((x) => x.spent > 0) && (
            <section className="panel panel-body stack-sm">
              <div className="spread"><h2 className="card-title">Spending by month</h2>{has("finance") && <Link to="/app/finance" className="small">Budget vs actual</Link>}</div>
              <Columns data={f.months.map((x) => ({ label: MONTHS[Number(x.month.slice(5, 7)) - 1], value: x.spent }))} highlightLast />
            </section>
          )}
          {has("participants") && p.participants > 0 && (
            <section className="panel panel-body stack-sm">
              <h2 className="card-title">Participants by gender</h2>
              <Donut data={["female", "male", "other"].map((k) => ({ label: k, value: g[k] || 0 }))} size={140} colors={["#3B82F6", "#5B4CDB", "#A39BEF"]} />
            </section>
          )}
          {has("events") && (
            <section className="panel panel-body stack-sm">
              <div className="spread"><h2 className="card-title">Coming up</h2><Link to="/app/calendar" className="small">Calendar</Link></div>
              {d.upcoming_events.length === 0 ? <span className="small muted">Nothing planned.</span> : d.upcoming_events.map((e) => (
                <Link key={e.id} to={`/app/m/events/${e.id}`} className="row" style={{ textDecoration: "none", color: "inherit", gap: 12, fontSize: 14 }}>
                  <span style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-dark)", borderRadius: 8, padding: "4px 8px", fontWeight: 700, fontSize: 12, minWidth: 56, textAlign: "center" }}>{fmtDate(e.date)}</span>{e.title}
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
