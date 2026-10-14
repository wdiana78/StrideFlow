// Kept's signature motif: a kitenge-inspired lattice of four-petal jacaranda flowers, mango seeds and coral dots.
const FLOWER = (cx, cy, r, fill, o = 1) => (
  <g key={`${cx}-${cy}`} opacity={o} transform={`translate(${cx} ${cy})`}>
    {[0, 90, 180, 270].map((a) => <ellipse key={a} cx="0" cy={-r * 0.62} rx={r * 0.34} ry={r * 0.62} fill={fill} transform={`rotate(${a})`} />)}
    <circle r={r * 0.22} fill="#FFB020" />
  </g>
);

export function Motif({ style, dense = false, tone = "dark" }) {
  const cells = [];
  const cols = 7, rows = 6, gap = 110;
  const fills = tone === "dark" ? ["#9A73E0", "#6D3FC9", "#C3A9EE", "#D4458A"] : ["#C3A9EE", "#E8DFF4", "#DCCDF5", "#F6C5D8"];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * gap + (r % 2 ? gap / 2 : 0), y = r * gap * 0.86;
    const k = (r * 3 + c * 5) % 9;
    if (k < (dense ? 6 : 4)) cells.push(FLOWER(x, y, 30 + (k % 3) * 6, fills[(r + c) % fills.length], 0.55 + (k % 4) * 0.12));
    else if (k < 7) cells.push(<rect key={`d${r}${c}`} x={x - 9} y={y - 9} width="18" height="18" rx="4" transform={`rotate(45 ${x} ${y})`} fill="#FFB020" opacity=".8" />);
    else cells.push(<circle key={`c${r}${c}`} cx={x} cy={y} r="7" fill="#FF6B57" opacity=".85" />);
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 760 560" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", pointerEvents: "none", ...style }}>
      {cells}
    </svg>
  );
}
