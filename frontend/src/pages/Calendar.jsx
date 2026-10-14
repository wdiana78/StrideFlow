import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorNotice, Loading } from "../components/ui";
import { isoToday } from "../format";
import { useApi } from "../hooks";

const KIND = { event: ["Event", "#6A4DF4"], activity: ["Activity due", "#13865B"], report: ["Deadline", "#F26A1B"], leave: ["Leave", "#D99A0B"] };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Calendar() {
  const t = isoToday();
  const [cursor, setCursor] = useState(() => new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, 1));
  const [kinds, setKinds] = useState(Object.keys(KIND));
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const { data, error, loading, reload } = useApi("/calendar", { start: iso(days[0]), end: iso(days[41]) });
  const byDay = useMemo(() => { const m = {}; (data || []).filter((i) => kinds.includes(i.kind)).forEach((i) => { (m[i.date] ||= []).push(i); }); return m; }, [data, kinds]);
  const move = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  return (
    <>
      <div className="spread">
        <h1 className="page-title">{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</h1>
        <div className="row wrap">
          <button className="btn" onClick={() => move(-1)} aria-label="Previous month">‹</button>
          <button className="btn" onClick={() => setCursor(new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, 1))}>Today</button>
          <button className="btn" onClick={() => move(1)} aria-label="Next month">›</button>
          <Link className="btn btn-primary" to="/app/m/events?new=1">Add event</Link>
        </div>
      </div>
      <div className="row wrap" role="group" aria-label="Show">
        {Object.entries(KIND).map(([k, [l, c]]) => (
          <button key={k} className="chip" aria-pressed={kinds.includes(k)} onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
          </button>
        ))}
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : (
        <div className="panel" style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", minWidth: 840 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="small strong" style={{ padding: "8px 10px", background: "var(--stone)", color: "var(--ink-2)" }}>{d}</div>)}
            {days.map((d) => {
              const k = iso(d), items = byDay[k] || [], other = d.getMonth() !== cursor.getMonth(), isToday = k === t;
              return (
                <div key={k} style={{ minHeight: 112, borderTop: "1px solid var(--rule-soft)", borderLeft: "1px solid var(--rule-soft)", padding: 6, background: other ? "var(--surface-2)" : "var(--surface)" }}>
                  <div className="small" style={{ fontWeight: isToday ? 700 : 500, color: other ? "var(--slate)" : isToday ? "#fff" : "var(--ink-2)", background: isToday ? "var(--cobalt)" : "none", borderRadius: 4, display: "inline-block", padding: "0 6px", marginBottom: 4 }}>{d.getDate()}</div>
                  <div className="stack-sm" style={{ gap: 3 }}>
                    {items.slice(0, 4).map((i, n) => (
                      <Link key={n} to={i.link} title={`${KIND[i.kind][0]}: ${i.title} ${i.detail ? `(${i.detail})` : ""}`} style={{ display: "block", fontSize: 12, lineHeight: "16px", padding: "2px 6px", borderRadius: 4, background: `${KIND[i.kind][1]}14`, borderLeft: `3px solid ${KIND[i.kind][1]}`, color: "var(--ink)", textDecoration: i.status === "done" || i.status === "held" ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.title}</Link>
                    ))}
                    {items.length > 4 && <span className="small muted">+{items.length - 4} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
