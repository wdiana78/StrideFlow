import { Link } from "react-router-dom";
import { Empty, ErrorNotice, Loading } from "../components/ui";
import { useApi } from "../hooks";
import { money } from "../modules";
import { UsedBar } from "./Module";

export default function Finance() {
  const { data, error, loading, reload } = useApi("/finance/summary");
  if (loading && !data) return <Loading rows={8} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const tot = data.reduce((a, g) => ({ budget: a.budget + g.budget, spent: a.spent + g.spent }), { budget: 0, spent: 0 });
  return (
    <>
      <div className="spread" style={{ alignItems: "flex-end" }}>
        <div className="stack-sm" style={{ gap: 4 }}>
          <span className="small muted">Finance</span>
          <h1 className="page-title">Budget against actual</h1>
          <span className="muted">Approved and paid expenses against each grant's budget lines. Submitted expenses do not count until approved.</span>
        </div>
        <div className="row wrap"><Link className="btn" to="/app/m/budget_lines">Budget lines</Link><Link className="btn btn-primary" to="/app/m/expenses?new=1">Add expense</Link></div>
      </div>
      <div className="panel panel-body spread">
        <span><span className="muted">Total budget</span> <b style={{ fontSize: 20 }}>{money(tot.budget)}</b></span>
        <span><span className="muted">Spent</span> <b style={{ fontSize: 20 }}>{money(tot.spent)}</b></span>
        <span><span className="muted">Remaining</span> <b style={{ fontSize: 20 }}>{money(tot.budget - tot.spent)}</b></span>
        <span style={{ minWidth: 180 }}><UsedBar pct={tot.budget ? Math.round((tot.spent / tot.budget) * 1000) / 10 : 0} /></span>
      </div>
      {data.length === 0 ? <div className="panel"><Empty title="No budgets yet">Add budget lines to a grant to start tracking spending against it.</Empty></div> : data.map((g) => (
        <section key={g.grant.id || "none"} className="panel">
          <div className="panel-head">
            <div className="stack-sm" style={{ gap: 2 }}>
              <h2>{g.grant.id ? <Link to={`/app/m/grants/${g.grant.id}`} style={{ color: "var(--ink)" }}>{g.grant.title}</Link> : g.grant.title}</h2>
              {g.grant.id && <span className="small muted">{g.grant.funder_id_label} · grant {money(g.grant.amount)} · {g.grant.project_id_label}</span>}
            </div>
            <span style={{ minWidth: 200 }}><UsedBar pct={g.used_pct} /></span>
          </div>
          <div className="table-wrap"><table className="table" style={{ minWidth: 640 }}>
            <thead><tr><th>Budget line</th><th>Category</th><th style={{ textAlign: "right" }}>Budgeted</th><th style={{ textAlign: "right" }}>Spent</th><th style={{ textAlign: "right" }}>Remaining</th><th style={{ textAlign: "right" }}>Used</th></tr></thead>
            <tbody>
              {g.lines.map((l) => (
                <tr key={l.id}>
                  <td><Link className="row-link" to={`/app/m/budget_lines/${l.id}`}>{l.name}</Link></td>
                  <td className="muted" style={{ textTransform: "capitalize" }}>{l.category}</td>
                  <td style={{ textAlign: "right" }}>{money(l.amount)}</td><td style={{ textAlign: "right" }}>{money(l.spent)}</td>
                  <td style={{ textAlign: "right", color: l.remaining < 0 ? "var(--bad)" : undefined, fontWeight: l.remaining < 0 ? 600 : 400 }}>{money(l.remaining)}</td>
                  <td><UsedBar pct={l.used_pct} /></td>
                </tr>
              ))}
              <tr style={{ background: "var(--stone)" }}><td className="strong">Total</td><td /><td style={{ textAlign: "right" }} className="strong">{money(g.budget)}</td><td style={{ textAlign: "right" }} className="strong">{money(g.spent)}</td><td style={{ textAlign: "right" }} className="strong">{money(g.remaining)}</td><td /></tr>
            </tbody>
          </table></div>
        </section>
      ))}
    </>
  );
}
