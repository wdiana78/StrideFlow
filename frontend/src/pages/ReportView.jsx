import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, ErrorNotice, Loading, Status, Toast } from "../components/ui";
import { fmtDate, fmtDateTime, fmtNum, parseDate, RULE_LABEL } from "../format";
import { useApi } from "../hooks";

function Chart({ s, asOf }) {
  const start = parseDate(s.start), due = parseDate(s.due_on), end = parseDate(asOf);
  const days = (a, b) => Math.round((b - a) / 86400000);
  const span = Math.max(days(start, end), 1);
  const X = (d) => 48 + (days(start, parseDate(d)) / span) * 680;
  const Y = (v) => 200 - (v / s.target) * 170;
  const actual = s.points.map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)} ${Y(Math.min(p.value, s.target)).toFixed(1)}`).join(" ");
  const totalSpan = Math.max(days(start, due), 1);
  const expectedEnd = Math.min(s.target, (s.target * span) / totalSpan);
  const last = s.points[s.points.length - 1];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(s.target * f * 10) / 10);
  return (
    <svg viewBox="0 0 760 240" style={{ width: "100%", height: "auto" }} role="img"
      aria-label={`${s.title}: ${fmtNum(last.value)} by ${fmtDate(asOf)} against ${fmtNum(Math.round(expectedEnd * 10) / 10)} expected.`}>
      {ticks.map((t) => <g key={t}><line x1="48" x2="740" y1={Y(t)} y2={Y(t)} style={{ stroke: t ? "var(--rule-soft)" : "var(--rule)" }} /><text x="40" y={Y(t) + 4} textAnchor="end" fontSize="12" style={{ fill: "var(--slate)" }}>{t}</text></g>)}
      <text x="48" y="226" fontSize="12" style={{ fill: "var(--slate)" }}>{fmtDate(s.start)}</text>
      <text x="728" y="226" fontSize="12" style={{ fill: "var(--slate)" }} textAnchor="end">{fmtDate(asOf)}</text>
      <path d={`M48 200 L728 ${Y(expectedEnd).toFixed(1)}`} fill="none" stroke="#B3A9C4" strokeWidth="2" strokeDasharray="6 5" />
      <path d={actual} fill="none" stroke="#6D3FC9" strokeWidth="3" strokeLinejoin="round" />
      <circle cx={X(last.date)} cy={Y(Math.min(last.value, s.target))} r="4.5" fill="#6D3FC9" />
    </svg>
  );
}

function brief(r, s) {
  const lines = [
    `You are helping me write the narrative for a progress report to ${s.stakeholder || "our funder"}.`,
    `Use ONLY the verified figures below. Do not invent numbers. Flag anything that looks inconsistent.`,
    "",
    `Organization: ${s.organization}`, `Project: ${s.project.name}`, `Period: ${s.period.start} to ${s.period.end}`, "",
    "Planned against actual:",
    ...s.rows.map((x) => `- ${x.title}: ${fmtNum(x.actual)} of ${fmtNum(x.target)} ${x.unit} (expected ${fmtNum(x.expected)} by ${s.period.as_of}); status ${x.status_label}; due ${x.due_on}`),
    "", "Issues and how they were handled:",
    ...(s.issues.length ? s.issues.map((i) => `- ${RULE_LABEL[i.rule]}: ${i.title}. ${i.detail}${i.resolution ? ` Resolution: ${i.resolution}` : " Still open."}`) : ["- None recorded"]),
    "", `Evidence on file: ${s.evidence.total} items (${s.evidence.by_label.map((b) => `${b.count} ${b.label.toLowerCase()}`).join(", ")}).`,
    "", "Write: a 150-word summary, a paragraph on challenges and corrective actions, and three priorities for the next period.",
  ];
  return lines.join("\n");
}

export default function ReportView() {
  const { id } = useParams();
  const { data: r, error, loading, reload } = useApi(`/reports/${id}`);
  const [toast, setToast] = useState("");
  if (loading && !r) return <Loading rows={10} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const s = r.snapshot;
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(brief(r, s)); setToast("Brief copied. Paste it into ChatGPT or another assistant."); window.open("https://chatgpt.com/", "_blank", "noopener"); }
    catch { setToast("Your browser blocked copying. Use Save as PDF instead."); }
  };
  return (
    <>
      <div className="spread no-print">
        <div className="crumbs"><Link to="/app/reports">Reports</Link> / <Link to={`/app/projects/${s.project.id}`}>{s.project.name}</Link></div>
        <div className="row wrap">
          <button className="btn" onClick={copyBrief} title="Copies verified figures as a prompt, then opens ChatGPT">Copy AI brief</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Save as PDF</button>
        </div>
      </div>
      <article className="report">
        <header className="spread" style={{ alignItems: "flex-start", borderBottom: "1px solid var(--rule)", paddingBottom: 24 }}>
          <div className="stack-sm">
            <span className="muted" style={{ fontSize: 14 }}>Progress report{s.stakeholder ? ` for ${s.stakeholder}` : ""}</span>
            <h1 style={{ fontSize: 30, lineHeight: "36px", fontWeight: 700, letterSpacing: "-0.3px" }}>{s.project.name}</h1>
            <span style={{ color: "var(--ink-2)" }}>{s.organization} · {fmtDate(s.period.start, true)} to {fmtDate(s.period.end, true)}</span>
          </div>
          <div className="small muted" style={{ textAlign: "right" }}>Generated by {s.generated_by}<br />{fmtDateTime(r.created_at)}<br />Snapshot, will not change</div>
        </header>
        <section className="stack-sm"><h2>Summary</h2><p style={{ fontSize: 16, lineHeight: "26px", maxWidth: 760 }}>{s.summary}</p></section>
        <section className="stack-sm">
          <h2>Planned against actual</h2>
          <div className="table-wrap"><table style={{ minWidth: 620 }}>
            <thead><tr><th>Commitment</th><th className="num">Target</th><th className="num">Expected by {fmtDate(s.period.as_of)}</th><th className="num">Actual</th><th className="num">Variance</th><th>Status</th></tr></thead>
            <tbody>{s.rows.map((x) => (
              <tr key={x.commitment_id}>
                <td className="strong">{x.title}</td><td className="num">{fmtNum(x.target)} {x.unit}</td><td className="num">{fmtNum(x.expected)}</td><td className="num">{fmtNum(x.actual)}</td>
                <td className="num" style={{ color: x.variance < 0 ? "var(--risk)" : "var(--ok)" }}>{x.variance > 0 ? "+" : ""}{fmtNum(x.variance)}</td>
                <td><Status kind={x.status} label={x.status_label} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
        {s.series.map((ser) => (
          <section key={ser.commitment_id} className="stack-sm">
            <div className="spread"><h2>{ser.title}, over time</h2>
              <div className="row small" style={{ gap: 16 }}><span className="row"><span style={{ width: 18, height: 3, background: "var(--cobalt)" }} />Actual</span><span className="row"><span style={{ width: 18, borderTop: "2px dashed #B3A9C4" }} />Expected pace to {fmtNum(ser.target)} by {fmtDate(ser.due_on)}</span></div>
            </div>
            <Chart s={ser} asOf={s.period.as_of} />
          </section>
        ))}
        <section className="stack-sm">
          <h2>Issues and how they were handled</h2>
          {s.issues.length === 0 ? <p className="muted">No issues were flagged in this period.</p> : s.issues.map((i, k) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 16, padding: "12px 0", borderTop: "1px solid var(--rule-soft)" }}>
              <span className="muted" style={{ fontSize: 14 }}>{fmtDate(i.opened)}</span>
              <span><b>{RULE_LABEL[i.rule]}: {i.title}.</b> {i.detail} {i.resolution ? <span style={{ color: "var(--ink-2)" }}>Resolution: {i.resolution}</span> : <span style={{ color: "var(--risk)" }}>Still open.</span>}</span>
            </div>
          ))}
        </section>
        <section className="stack-sm">
          <h2>Evidence index</h2>
          {s.evidence.total === 0 ? <Empty title="No evidence in this period" /> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {s.evidence.by_label.map((b) => <div key={b.label} style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14 }}><b style={{ fontSize: 22 }}>{b.count}</b><div className="small" style={{ color: "var(--ink-2)" }}>{b.label}</div></div>)}
              </div>
              <details><summary style={{ cursor: "pointer", fontWeight: 600, marginTop: 8 }}>All {s.evidence.total} items</summary>
                <table style={{ marginTop: 8 }}><tbody>{s.evidence.items.map((e) => (
                  <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.activity}</td><td>{e.label}</td><td>{e.value != null ? fmtNum(e.value) : e.file_name || (e.text || "").slice(0, 60)}</td></tr>
                ))}</tbody></table>
              </details>
            </>
          )}
        </section>
      </article>
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
