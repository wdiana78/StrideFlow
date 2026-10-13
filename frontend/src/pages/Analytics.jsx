import { useMemo, useState } from "react";
import { Bars, Columns, Donut, Grouped, Lines, PALETTE } from "../components/charts";
import { ErrorNotice, Loading, Status } from "../components/ui";
import { fmtNum } from "../format";
import { useApi } from "../hooks";
import { moneyShort } from "../modules";

const AGE_ORDER = ["10-14", "15-19", "20-24", "25-35", "36+"];

export default function Analytics() {
  const { data: a, error, loading, reload } = useApi("/analytics");
  const [prog, setProg] = useState("all");
  const programmes = useMemo(() => [...new Set((a?.series || []).map((s) => s.programme))], [a]);
  if (loading && !a) return <Loading rows={10} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const series = a.series.filter((s) => prog === "all" || s.programme === prog);
  const P = a.participants;
  return (
    <>
      <div className="page-hero">
        <div className="stack-sm" style={{ gap: 2 }}><h1>M&amp;E analytics</h1><span className="muted">Live from activities, evidence, the participant registry and finance.</span></div>
        <div className="row wrap">
          <select className="select" style={{ width: "auto", background: "#fff", color: "var(--ink)" }} aria-label="Programme" value={prog} onChange={(e) => setProg(e.target.value)}>
            <option value="all">All programmes</option>{programmes.map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="btn btn-accent" onClick={() => window.print()}>Export PDF</button>
        </div>
      </div>

      <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {series.map((s, i) => (
          <section key={s.title} className="panel panel-body stack-sm">
            <div className="spread" style={{ alignItems: "flex-start" }}>
              <div className="stack-sm" style={{ gap: 2 }}><span className="small muted">{s.programme}</span><b className="card-title" style={{ fontSize: 15 }}>{s.title}</b></div>
              <Status kind={s.pace.status} />
            </div>
            <div className="row" style={{ gap: 18 }}>
              <span><b style={{ fontSize: 26, color: PALETTE[i % PALETTE.length] }}>{fmtNum(s.pace.actual)}</b><span className="muted"> / {fmtNum(s.target)} {s.unit}</span></span>
              <span className="small muted">{Math.round(s.pace.actual_pct)}% done · {Math.round(s.pace.expected_pct)}% expected</span>
            </div>
            <Lines series={[{ name: s.title, points: s.points, color: PALETTE[i % PALETTE.length] }]} target={s.target} height={170} />
          </section>
        ))}
      </div>

      <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section className="panel panel-body stack-sm"><h2 className="card-title">Gender</h2>
          <Donut data={["female", "male", "other"].map((k) => ({ label: k, value: P.gender.find((g) => g.label === k)?.count || 0 }))} colors={["#C2477D", "#2E86AB", "#F2B33D"]} /></section>
        <section className="panel panel-body stack-sm"><h2 className="card-title">Age bands</h2>
          <Columns data={[...P.age_band].sort((x, y) => AGE_ORDER.indexOf(x.label) - AGE_ORDER.indexOf(y.label)).map((g) => ({ label: g.label, value: g.count }))} format={fmtNum} /></section>
        <section className="panel panel-body stack-sm"><h2 className="card-title">Disability inclusion</h2>
          <Donut data={[["Yes", "With a disability"], ["No", "Without"]].map(([k, l]) => ({ label: l, value: P.disability.find((g) => g.label === k)?.count || 0 }))} colors={["#6B5BA8", "#D7DDE0"]} /></section>
      </div>

      <div className="two-col">
        <section className="wide panel panel-body stack-sm"><h2 className="card-title">Participants by programme and gender</h2>
          <Grouped data={P.by_programme} keys={[{ key: "female", label: "Female", color: "#C2477D" }, { key: "male", label: "Male", color: "#2E86AB" }, { key: "other", label: "Other", color: "#F2B33D" }]} format={fmtNum} /></section>
        <section className="narrow panel panel-body stack-sm"><h2 className="card-title">Reach by ward</h2><Bars data={P.ward.map((w) => ({ label: w.label, value: w.count }))} /></section>
      </div>

      <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="panel panel-body stack-sm"><h2 className="card-title">Event turnout: expected vs actual</h2>
          <Grouped data={a.events.map((e) => ({ label: e.title.split(",")[0], expected: e.expected, attended: e.attended }))} keys={[{ key: "expected", label: "Expected", color: "#B9D3D8" }, { key: "attended", label: "Attended", color: "#0E5E6F" }]} format={fmtNum} /></section>
        <section className="panel panel-body stack-sm"><h2 className="card-title">Spending by category</h2>
          <Donut data={a.spending_by_category.map((x) => ({ label: x.label, value: x.value }))} format={moneyShort} center={moneyShort(a.spending_by_category.reduce((s, x) => s + x.value, 0))} /></section>
        <section className="panel panel-body stack-sm"><h2 className="card-title">Volunteer hours by programme</h2>
          <Bars data={a.volunteer_hours.map((x) => ({ label: x.label, value: x.value }))} colors={["#3F9E6B", "#E4572E", "#6B5BA8", "#2E86AB"]} /></section>
      </div>
    </>
  );
}
