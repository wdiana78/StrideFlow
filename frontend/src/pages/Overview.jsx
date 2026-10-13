import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Columns, Donut, PALETTE } from "../components/charts";
import { ErrorNotice, Loading, PaceLine, Status } from "../components/ui";
import { fmtDate, fmtNum } from "../format";
import { useApi } from "../hooks";
import { moneyShort } from "../modules";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const Ico = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

function Kpi({ label, value, sub, to, bg, icon }) {
  return (
    <Link to={to} className="kpi" style={{ background: bg }}>
      <span className="kpi-icon"><Ico d={icon} /></span>
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
  const f = d.finance, p = d.people, g = p.participants_by_gender || {};
  return (
    <>
      <div className="page-hero">
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="muted small">{fmtDate(d.today, true)}</span>
          <h1>Habari, {user.full_name.split(" ")[0]}</h1>
          <span className="muted">{user.organization.name}</span>
        </div>
        <div className="row wrap">
          <Link className="btn btn-accent" to="/app/attention">{d.open_flags} need attention</Link>
          <Link className="btn" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} to="/app/approvals">{d.approvals_waiting} to approve</Link>
        </div>
      </div>

      <div className="quick" aria-label="Quick actions">
        {can.manage && <Link className="btn btn-primary" to="/app/m/expenses?new=1">+ Expense</Link>}
        <Link className="btn" to="/app/m/participants?new=1">+ Participant</Link>
        {can.manage && <Link className="btn" to="/app/m/events?new=1">+ Event</Link>}
        {can.manage && <Link className="btn" to="/app/m/donations?new=1">+ Donation</Link>}
        {can.manage && <Link className="btn" to="/app/forms/new">+ New survey</Link>}
        <Link className="btn" to="/app/m/volunteer_hours?new=1">+ Volunteer hours</Link>
        <Link className="btn" to="/app/m/purchase_requests?new=1">+ Purchase request</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 12 }}>
        <Kpi label="On track" value={`${d.commitments.on_track}/${d.commitments.total}`} sub={`${d.commitments.at_risk} at risk`} to="/app/projects" bg="linear-gradient(135deg,#0E5E6F,#127A8F)" icon="M4 12l5 5L20 6" />
        <Kpi label="Funding secured" value={moneyShort(f.awarded)} sub={`${moneyShort(f.pipeline)} in pipeline`} to="/app/m/grants" bg="linear-gradient(135deg,#2F8F5B,#3FAE72)" icon="M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H7" />
        <Kpi label="Budget used" value={`${f.used_pct}%`} sub={`${moneyShort(f.spent)} of ${moneyShort(f.budget)}`} to="/app/finance" bg="linear-gradient(135deg,#2E6FAB,#3F8FD0)" icon="M4 20V10M10 20V4M16 20v-7" />
        <Kpi label="Participants" value={fmtNum(p.participants)} sub={`${g.female || 0} female · ${g.male || 0} male`} to="/app/analytics" bg="linear-gradient(135deg,#6B5BA8,#8676C6)" icon="M16 20v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8" />
        <Kpi label="Volunteers" value={p.volunteers_active} sub={`${fmtNum(p.hours_this_month)} hrs this month`} to="/app/m/volunteers" bg="linear-gradient(135deg,#C2477D,#D9649A)" icon="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" />
        <Kpi label="Cash received" value={moneyShort(f.received)} sub={`${moneyShort(f.received - f.spent)} unspent`} to="/app/m/income" bg="linear-gradient(135deg,#D17B0F,#EE9B2C)" icon="M3 7h18v10H3zM7 12h.01M17 12h.01M12 15a3 3 0 100-6 3 3 0 000 6" />
      </div>

      <div className="two-col">
        <section className="wide panel" aria-labelledby="prog-h">
          <div className="panel-head"><h2 id="prog-h">Programmes</h2><Link to="/app/analytics" className="btn btn-ghost">Analytics</Link></div>
          {d.programmes.map((pr, i) => (
            <div key={pr.id} style={{ padding: "14px 22px", borderTop: "1px solid var(--rule-soft)" }} className="stack-sm">
              <Link to={`/app/projects/${pr.id}`} className="row strong" style={{ color: "var(--ink)", textDecoration: "none", fontSize: 16, gap: 8 }}><span className="dot" style={{ background: PALETTE[i % PALETTE.length], width: 12, height: 12 }} />{pr.name}</Link>
              {pr.commitments.map((c) => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.2fr) minmax(120px, 1fr) 100px", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 14 }}>{c.title}<span className="small muted"> · {fmtNum(c.pace.actual)}/{fmtNum(c.pace.target)}</span></span>
                  <PaceLine pace={c.pace} />
                  <Status kind={c.pace.status} />
                </div>
              ))}
            </div>
          ))}
        </section>
        <aside className="narrow stack">
          <section className="panel panel-body stack-sm">
            <div className="spread"><h2 className="card-title">Spending by month</h2><Link to="/app/finance" className="small">Budget vs actual</Link></div>
            <Columns data={f.months.map((x) => ({ label: MONTHS[Number(x.month.slice(5, 7)) - 1], value: x.spent }))} highlightLast />
          </section>
          <section className="panel panel-body stack-sm">
            <h2 className="card-title">Participants by gender</h2>
            <Donut data={["female", "male", "other"].map((k) => ({ label: k, value: g[k] || 0 }))} size={140} colors={["#C2477D", "#2E86AB", "#F2B33D"]} />
          </section>
          <section className="panel panel-body stack-sm">
            <div className="spread"><h2 className="card-title">Coming up</h2><Link to="/app/calendar" className="small">Calendar</Link></div>
            {d.upcoming_events.map((e) => (
              <Link key={e.id} to={`/app/m/events/${e.id}`} className="row" style={{ textDecoration: "none", color: "inherit", gap: 12, fontSize: 14 }}>
                <span style={{ background: "var(--accent-tint)", color: "var(--accent-ink)", borderRadius: 8, padding: "4px 8px", fontWeight: 700, fontSize: 12, minWidth: 54, textAlign: "center" }}>{fmtDate(e.date)}</span>{e.title}
              </Link>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
