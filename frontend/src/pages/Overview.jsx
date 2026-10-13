import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { ErrorNotice, Loading, PaceLine, Status } from "../components/ui";
import { fmtDate, fmtNum } from "../format";
import { useApi } from "../hooks";
import { money, moneyShort } from "../modules";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Kpi({ label, value, sub, to, tone }) {
  const body = (
    <div className="stack-sm" style={{ gap: 4, padding: "16px 18px", height: "100%" }}>
      <span className="small muted">{label}</span>
      <b style={{ fontSize: 26, lineHeight: "32px", letterSpacing: "-0.3px", color: tone }}>{value}</b>
      {sub && <span className="small" style={{ color: "var(--ink-2)" }}>{sub}</span>}
    </div>
  );
  return to ? <Link to={to} className="panel" style={{ textDecoration: "none", color: "inherit" }}>{body}</Link> : <div className="panel">{body}</div>;
}

export default function Overview() {
  const { user } = useAuth();
  const { data: d, error, loading, reload } = useApi("/dashboard");
  if (loading && !d) return <Loading rows={10} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const f = d.finance, p = d.people;
  const maxMonth = Math.max(1, ...f.months.map((x) => x.spent));
  const g = p.participants_by_gender || {};
  return (
    <>
      <div className="spread" style={{ alignItems: "flex-end" }}>
        <div className="stack-sm" style={{ gap: 4 }}>
          <span className="small muted">{fmtDate(d.today, true)}</span>
          <h1 className="page-title">{user.organization.name}</h1>
        </div>
        <div className="row wrap">
          <Link className="btn" to="/app/attention">{d.open_flags} need attention</Link>
          <Link className="btn btn-primary" to="/app/approvals">{d.approvals_waiting} waiting for your approval</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12 }}>
        <Kpi label="Commitments on track" value={`${d.commitments.on_track} of ${d.commitments.total}`} sub={`${d.commitments.at_risk} at risk · ${d.commitments.overdue} overdue`} to="/app/projects" tone={d.commitments.at_risk + d.commitments.overdue ? "var(--risk)" : "var(--ok)"} />
        <Kpi label="Funding secured" value={moneyShort(f.awarded)} sub={`${moneyShort(f.pipeline)} in the pipeline`} to="/app/m/grants" />
        <Kpi label="Budget used" value={`${f.used_pct}%`} sub={`${moneyShort(f.spent)} of ${moneyShort(f.budget)}`} to="/app/finance" tone={f.used_pct > 90 ? "var(--risk)" : undefined} />
        <Kpi label="Cash received" value={moneyShort(f.received)} sub={`${moneyShort(f.received - f.spent)} after spending`} to="/app/m/income" />
        <Kpi label="Participants registered" value={fmtNum(p.participants)} sub={`${g.female || 0} female · ${g.male || 0} male · ${g.other || 0} other`} to="/app/m/participants" />
        <Kpi label="Active volunteers" value={p.volunteers_active} sub={`${fmtNum(p.hours_this_month)} hours this month · ${p.volunteer_applicants} applicants`} to="/app/m/volunteers" />
      </div>

      <div className="two-col">
        <section className="wide panel" aria-labelledby="prog-h">
          <div className="panel-head"><h2 id="prog-h">Programmes</h2><Link to="/app/projects" className="small">All programmes</Link></div>
          {d.programmes.map((pr) => (
            <div key={pr.id} style={{ padding: "16px 22px", borderTop: "1px solid var(--rule-soft)" }} className="stack-sm">
              <Link to={`/app/projects/${pr.id}`} className="row-link strong" style={{ color: "var(--ink)", textDecoration: "none", fontSize: 16 }}>{pr.name}</Link>
              {pr.commitments.map((c) => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1.2fr) minmax(140px, 1fr) 110px", gap: 16, alignItems: "center" }}>
                  <span style={{ fontSize: 14 }}>{c.title}<span className="small muted"> · {fmtNum(c.pace.actual)} of {fmtNum(c.pace.target)}</span></span>
                  <PaceLine pace={c.pace} />
                  <Status kind={c.pace.status} />
                </div>
              ))}
            </div>
          ))}
        </section>
        <aside className="narrow stack">
          <section className="panel panel-body stack-sm" aria-labelledby="spend-h">
            <div className="spread"><h2 id="spend-h" style={{ fontSize: 17, fontWeight: 600 }}>Spending by month</h2><Link to="/app/finance" className="small">Budget against actual</Link></div>
            <svg viewBox="0 0 320 150" style={{ width: "100%", height: "auto" }} role="img" aria-label={`Approved spending per month: ${f.months.map((x) => `${MONTHS[Number(x.month.slice(5, 7)) - 1]} ${money(x.spent)}`).join(", ")}`}>
              {f.months.map((x, i) => {
                const h = (x.spent / maxMonth) * 100;
                return (
                  <g key={x.month}>
                    <rect x={10 + i * 52} y={115 - h} width="34" height={h} rx="3" fill={i === f.months.length - 1 ? "#2C3D9B" : "#9AA7E3"} />
                    <text x={27 + i * 52} y="132" textAnchor="middle" fontSize="11" fill="#56625E">{MONTHS[Number(x.month.slice(5, 7)) - 1]}</text>
                    {x.spent > 0 && <text x={27 + i * 52} y={110 - h} textAnchor="middle" fontSize="10" fill="#3B4643">{Math.round(x.spent / 1000)}k</text>}
                  </g>
                );
              })}
            </svg>
          </section>
          <section className="panel panel-body stack-sm" aria-labelledby="ev-h">
            <div className="spread"><h2 id="ev-h" style={{ fontSize: 17, fontWeight: 600 }}>Coming up</h2><Link to="/app/calendar" className="small">Calendar</Link></div>
            {d.upcoming_events.length === 0 ? <span className="small muted">Nothing planned.</span> : d.upcoming_events.map((e) => (
              <Link key={e.id} to={`/app/m/events/${e.id}`} className="history-item" style={{ gridTemplateColumns: "56px 1fr", textDecoration: "none", color: "inherit", fontSize: 14 }}>
                <span className="strong" style={{ color: "var(--cobalt)" }}>{fmtDate(e.date)}</span><span>{e.title}<span className="small muted"> · {e.venue}</span></span>
              </Link>
            ))}
          </section>
          <section className="panel panel-body stack-sm" aria-labelledby="rep-h">
            <h2 id="rep-h" style={{ fontSize: 17, fontWeight: 600 }}>Funder reports due</h2>
            {d.reports_due.length === 0 ? <span className="small muted">None scheduled.</span> : d.reports_due.map((g2) => (
              <Link key={g2.id} to={`/app/m/grants/${g2.id}`} className="history-item" style={{ gridTemplateColumns: "56px 1fr", textDecoration: "none", color: "inherit", fontSize: 14 }}>
                <span className="strong" style={{ color: g2.next_report_due <= d.today ? "var(--bad)" : "var(--ink)" }}>{fmtDate(g2.next_report_due)}</span><span>{g2.title}<span className="small muted"> · {g2.funder_id_label}</span></span>
              </Link>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
