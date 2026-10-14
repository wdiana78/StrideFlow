// Small, dependency-free SVG charts. Every chart has a text alternative for screen readers.
import { fmtNum } from "../format";

export const PALETTE = ["#2F5BE8", "#F5B520", "#A3284F", "#5BB6F8", "#7C6CF2", "#F07B5A", "#1B3487", "#8FA3C8", "#E07AA0", "#3FA7D6"];
const short = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)}k` : fmtNum(Math.round(n * 10) / 10));

export function Bars({ data, format = fmtNum, color, colors, max }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="stack-sm" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")} style={{ gap: 8 }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 34%) 1fr auto", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.label}>{d.label}</span>
          <span style={{ height: 14, background: "var(--track)", borderRadius: 7, overflow: "hidden" }}>
            <span style={{ display: "block", height: 14, width: `${(d.value / top) * 100}%`, background: colors ? colors[i % colors.length] : color || PALETTE[i % PALETTE.length], borderRadius: 7, transition: "width .6s ease" }} />
          </span>
          <b style={{ fontVariantNumeric: "tabular-nums", minWidth: 42, textAlign: "right" }}>{format(d.value)}</b>
        </div>
      ))}
    </div>
  );
}

export function Columns({ data, format = short, colors = PALETTE, height = 170, highlightLast }) {
  const top = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(data.length, 1);
  return (
    <svg viewBox={`0 0 400 ${height}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      {data.map((d, i) => {
        const h = (d.value / top) * (height - 52);
        const x = (i * w * 400) / 100 + 8, bw = (w * 400) / 100 - 16;
        return (
          <g key={d.label + i}>
            <rect x={x} y={height - 26 - h} width={Math.max(bw, 4)} height={Math.max(h, d.value ? 2 : 0)} rx="5" fill={highlightLast ? (i === data.length - 1 ? colors[0] : "#B9C9F7") : colors[i % colors.length]} />
            {d.value > 0 && <text x={x + bw / 2} y={height - 32 - h} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: "var(--ink)" }}>{format(d.value)}</text>}
            <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="11.5" style={{ fill: "var(--slate)" }}>{d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ data, size = 170, format = fmtNum, center, sub, colors = PALETTE }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const r = 60, c = 2 * Math.PI * r;
  return (
    <div className="row wrap" style={{ gap: 18, alignItems: "center" }}>
      <svg width={size} height={size} viewBox="0 0 170 170" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
        <circle cx="85" cy="85" r={r} fill="none" stroke="var(--track)" strokeWidth="26" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.label} cx="85" cy="85" r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth="26" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 85 85)" />;
          acc += len;
          return el;
        })}
        <text x="85" y="82" textAnchor="middle" fontSize="24" fontWeight="700" style={{ fill: "var(--ink)" }}>{center ?? format(total)}</text>
        <text x="85" y="102" textAnchor="middle" fontSize="11" style={{ fill: "var(--slate)" }}>{sub ?? (center ? "" : "total")}</text>
      </svg>
      <div className="stack-sm" style={{ gap: 6 }}>
        {data.map((d, i) => (
          <span key={d.label} className="row" style={{ fontSize: 13, gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[i % colors.length], flex: "0 0 11px" }} />
            <span style={{ textTransform: "capitalize" }}>{d.label}</span><b>{format(d.value)}</b><span className="muted">{Math.round((d.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Lines({ series, height = 220, target, format = short }) {
  const xs = series.flatMap((s) => s.points.map((p) => +new Date(p.date)));
  const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1);
  const yTop = Math.max(1, target || 0, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const X = (d) => 44 + ((+new Date(d) - x0) / (x1 - x0)) * 340;
  const Y = (v) => height - 28 - (v / yTop) * (height - 48);
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ticks = [0, 0.5, 1].map((f) => yTop * f);
  return (
    <svg viewBox={`0 0 400 ${height}`} style={{ width: "100%", height: "auto" }} role="img"
      aria-label={series.map((s) => `${s.name}: ${format(s.points[s.points.length - 1]?.value || 0)}`).join(", ")}>
      {ticks.map((t) => <g key={t}><line x1="44" x2="388" y1={Y(t)} y2={Y(t)} style={{ stroke: "var(--rule)" }} /><text x="38" y={Y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--slate)" }}>{format(t)}</text></g>)}
      {target != null && <><line x1="44" x2="388" y1={Y(target)} y2={Y(target)} stroke="#A3284F" strokeDasharray="5 4" /><text x="386" y={Y(target) - 5} textAnchor="end" fontSize="11" fill="#A3284F">target {format(target)}</text></>}
      {series.map((s, i) => {
        const col = s.color || PALETTE[i % PALETTE.length];
        const d = s.points.map((p, k) => `${k ? "L" : "M"}${X(p.date).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(" ");
        const last = s.points[s.points.length - 1];
        return (
          <g key={s.name}>
            <path d={`${d} L${X(last.date).toFixed(1)} ${Y(0)} L${X(s.points[0].date).toFixed(1)} ${Y(0)} Z`} fill={col} opacity="0.08" />
            <path d={d} fill="none" stroke={col} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={X(last.date)} cy={Y(last.value)} r="4.5" fill={col} />
          </g>
        );
      })}
      {[x0, (x0 + x1) / 2, x1].map((t, k) => { const dt = new Date(t); return <text key={k} x={44 + k * 170} y={height - 8} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fontSize="11" style={{ fill: "var(--slate)" }}>{dt.getDate()} {M[dt.getMonth()]}</text>; })}
    </svg>
  );
}

export function Grouped({ data, keys, height = 190, format = short }) {
  const top = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k.key] || 0)));
  const gw = 380 / Math.max(data.length, 1);
  return (
    <div className="stack-sm">
      <svg viewBox={`0 0 400 ${height}`} style={{ width: "100%", height: "auto" }} role="img"
        aria-label={data.map((d) => `${d.label}: ${keys.map((k) => `${k.label} ${format(d[k.key] || 0)}`).join(", ")}`).join("; ")}>
        {data.map((d, i) => keys.map((k, j) => {
          const bw = (gw - 14) / keys.length, h = ((d[k.key] || 0) / top) * (height - 44);
          return <rect key={k.key + i} x={14 + i * gw + j * bw} y={height - 24 - h} width={Math.max(bw - 3, 3)} height={h} rx="3" fill={k.color} />;
        }))}
        {data.map((d, i) => <text key={d.label} x={14 + i * gw + (gw - 14) / 2} y={height - 6} textAnchor="middle" fontSize="10.5" style={{ fill: "var(--slate)" }}>{d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label}</text>)}
      </svg>
      <div className="row wrap" style={{ gap: 14 }}>{keys.map((k) => <span key={k.key} className="row small" style={{ gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: k.color }} />{k.label}</span>)}</div>
    </div>
  );
}

export function Meter({ value, max, color = "var(--cobalt)", height = 10 }) {
  return (
    <div style={{ height, background: "var(--track)", borderRadius: height / 2, overflow: "hidden" }} role="img" aria-label={`${fmtNum(value)} of ${fmtNum(max)}`}>
      <div style={{ height, width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, background: color, borderRadius: height / 2, transition: "width .8s ease" }} />
    </div>
  );
}
