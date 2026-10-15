// Industry-specific website experiences, rendered inside PublicSite with the tenant's own brand.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ErrorNotice, Field } from "../components/ui";
import { fmtNum } from "../format";
import { useApi } from "../hooks";

const kes = (n) => `KES ${Math.round(n).toLocaleString()}`;

// ---------- small craft helpers ----------
export function useCountUp(target, ms = 1200) {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return undefined; }
    let raf, start;
    const el = ref.current;
    const run = () => { const step = (t) => { start ??= t; const p = Math.min((t - start) / ms, 1); setV(Math.round(target * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
    if (!el || !("IntersectionObserver" in window)) { run(); return () => cancelAnimationFrame(raf); }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, ms]);
  return [v, ref];
}
export function Count({ n, style }) { const [v, ref] = useCountUp(n); return <b ref={ref} style={style}>{fmtNum(v)}</b>; }

export function useReveal(deps) {
  useEffect(() => {
    const els = document.querySelectorAll(".site .reveal:not(.in)");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return undefined; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------- illustrations (original, drawn in code) ----------
export function CommunityArt() {
  return (
    <svg viewBox="0 0 520 440" style={{ width: "100%", height: "auto" }} aria-hidden="true">
      <circle cx="380" cy="110" r="70" fill="var(--s-accent)" />
      <circle cx="380" cy="110" r="96" fill="none" stroke="var(--s-accent)" strokeOpacity=".35" strokeWidth="10" />
      <path d="M0 330 C120 260 220 300 300 270 C390 238 450 270 520 250 V440 H0Z" fill="#fff" fillOpacity=".12" />
      <path d="M0 370 C140 330 260 360 360 330 C430 310 480 330 520 320 V440 H0Z" fill="#fff" fillOpacity=".2" />
      {[[110, 300, 1], [175, 285, .9], [240, 300, 1.05], [305, 290, .95], [370, 305, 1]].map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
          <circle cx="0" cy="-62" r="18" fill={["#FFE3C2", "#F6C9A0", "#E2A878", "#C98B5E", "#8F5E3B"][i]} />
          <path d="M-26 0 C-26 -34 26 -34 26 0 V44 H-26Z" fill={i % 2 ? "var(--s-accent)" : "#fff"} fillOpacity={i % 2 ? 1 : .9} />
        </g>
      ))}
      <path d="M80 250 v-70 M80 200 c-20 -10 -30 -30 -24 -46 M80 214 c20 -12 34 -26 30 -48" stroke="#fff" strokeOpacity=".7" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M455 260 v-90 M455 205 c-22 -12 -32 -34 -26 -52 M455 225 c22 -12 36 -30 32 -54" stroke="#fff" strokeOpacity=".7" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ShoeArt({ color = "#8A3B12", accent = "#C9F25C", kind = 0 }) {
  return (
    <svg viewBox="0 0 320 200" style={{ width: "100%", height: "auto" }} aria-hidden="true">
      <ellipse cx="160" cy="176" rx="130" ry="10" fill="#000" opacity=".12" />
      {kind % 2 === 0 ? (
        <g>
          <path d="M40 150 C40 120 70 104 104 98 L150 70 C170 60 196 66 206 84 L222 112 C250 116 286 126 290 150 Z" fill={color} />
          <path d="M150 70 L170 120 M178 66 L196 116 M120 90 L140 130" stroke={accent} strokeWidth="6" strokeLinecap="round" />
          <path d="M34 150 H296 C296 162 286 168 270 168 H52 C40 168 34 160 34 150Z" fill="#fff" />
          <path d="M34 160 H296" stroke={accent} strokeWidth="4" />
        </g>
      ) : (
        <g>
          <path d="M44 156 C60 130 120 124 170 128 C220 132 270 136 286 156 Z" fill={color} />
          <path d="M92 132 C120 104 196 104 224 134" stroke={accent} strokeWidth="14" fill="none" strokeLinecap="round" />
          {[110, 140, 170, 200].map((x) => <circle key={x} cx={x} cy={118} r="5" fill="#fff" />)}
          <path d="M40 156 H290 C290 166 282 170 270 170 H56 C46 170 40 164 40 156Z" fill="#2A1A12" />
        </g>
      )}
    </svg>
  );
}

export function CottageArt() {
  return (
    <svg viewBox="0 0 560 420" style={{ width: "100%", height: "auto" }} aria-hidden="true">
      <circle cx="440" cy="90" r="54" fill="var(--s-accent)" />
      <path d="M0 300 C100 280 180 300 280 290 C380 280 460 300 560 286 V420 H0Z" fill="#fff" fillOpacity=".18" />
      <path d="M0 340 C140 320 280 350 420 334 C480 328 520 334 560 330 V420 H0Z" fill="#fff" fillOpacity=".28" />
      <g transform="translate(150 190)">
        <path d="M-10 60 L90 -20 L190 60Z" fill="#E9C88B" />
        <path d="M-10 60 L90 -20 L190 60" stroke="#C9A462" strokeWidth="4" fill="none" />
        <rect x="10" y="60" width="160" height="80" fill="#fff" />
        <rect x="76" y="86" width="30" height="54" rx="4" fill="var(--s-primary)" />
        <rect x="26" y="78" width="34" height="28" rx="4" fill="var(--s-accent)" opacity=".8" />
        <rect x="122" y="78" width="34" height="28" rx="4" fill="var(--s-accent)" opacity=".8" />
      </g>
      <g stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".9">
        <path d="M430 330 C428 270 436 220 450 180" />
        <path d="M450 180 c-30 -10 -60 0 -78 20 M450 180 c24 -24 56 -26 80 -14 M450 180 c-8 -30 -32 -46 -56 -48 M450 180 c22 -18 48 -16 66 0" />
      </g>
    </svg>
  );
}

// ---------- Shop (retail) ----------
export function Shop({ s, compact }) {
  const { data: products, reload } = useApi(`/public/${s.slug}/products`);
  const [cart, setCart] = useState({});
  const [open, setOpen] = useState(false);
  const add = (p) => { setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + 1, p.in_stock) })); setOpen(true); };
  const list = products || [];
  const lines = list.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }));
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: 18 }}>
        {list.slice(0, compact ? 4 : 99).map((p, i) => (
          <article key={p.id} className="site-card reveal stack-sm" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
            <div style={{ background: "#F4F1EC", padding: "26px 20px 10px", position: "relative" }}>
              
              <GarmentArt name={p.name} color={s.palette[i % s.palette.length]} accent={i % 2 ? s.brand.primary : s.brand.accent} />
            </div>
            <div className="stack-sm" style={{ padding: 18, gap: 6 }}>
              <div className="spread" style={{ flexWrap: "nowrap" }}><b style={{ fontSize: 17 }}>{p.name}</b><b style={{ whiteSpace: "nowrap" }}>{kes(p.price)}</b></div>
              <span className="small" style={{ color: p.in_stock === 0 ? "#B42318" : p.low ? "#B54708" : "#6B5A55" }}>{p.in_stock === 0 ? "Sold out" : p.low ? `Only ${p.in_stock} left` : "In stock"}</span>
              <span className="small" style={{ color: "#6B5A55", lineHeight: "20px" }}>{p.description}</span>
              <button className="btn site-donate" style={{ justifyContent: "center", marginTop: 8 }} disabled={!p.in_stock || (cart[p.id] || 0) >= p.in_stock} onClick={() => add(p)}>{p.in_stock ? "Add to bag" : "Sold out"}</button>
            </div>
          </article>
        ))}
      </div>
      {lines.length > 0 && !open && <button className="btn site-donate site-bag" onClick={() => setOpen(true)}>Bag · {lines.reduce((a, l) => a + l.qty, 0)} · {kes(total)}</button>}
      {open && <Bag s={s} lines={lines} total={total} setCart={setCart} onClose={() => setOpen(false)} onDone={() => { setCart({}); reload(); }} />}
    </>
  );
}

function Bag({ s, lines, total, setCart, onClose, onDone }) {
  const [f, setF] = useState({ name: "", contact: "", message: "" });
  const [state, setState] = useState({ busy: false, error: null, ok: null });
  const place = async () => {
    setState({ busy: true, error: null, ok: null });
    try { const r = await api(`/public/${s.slug}/order`, { method: "POST", body: { ...f, website: "", items: lines.map((l) => ({ id: l.id, qty: l.qty })) } }); setState({ busy: false, error: null, ok: r }); onDone(); }
    catch (e) { setState({ busy: false, error: e, ok: null }); }
  };
  return (
    <div className="site-drawer-wrap" onClick={onClose}>
      <aside className="site-drawer" style={{ width: "min(420px, 94vw)", gap: 12 }} onClick={(e) => e.stopPropagation()} aria-label="Your bag">
        <div className="spread"><h2 style={{ fontSize: 22, fontWeight: 800 }}>Your bag</h2><button className="btn btn-icon" aria-label="Close" onClick={onClose}>✕</button></div>
        {state.ok ? (
          <div className="stack" style={{ textAlign: "center", alignItems: "center", paddingTop: 30 }}>
            
            <b style={{ fontSize: 20 }}>Order {state.ok.reference}</b><span style={{ color: "#6B5A55" }}>{state.ok.message}</span><Link className="btn" to={`${s.base}/track?ref=${state.ok.reference}`}>Track this order</Link>
            <button className="btn" onClick={onClose}>Keep shopping</button>
          </div>
        ) : lines.length === 0 ? <p style={{ color: "#6B5A55" }}>Your bag is empty.</p> : (
          <>
            {lines.map((l) => (
              <div key={l.id} className="spread" style={{ borderBottom: "1px solid #F0E3DC", padding: "8px 0", flexWrap: "nowrap" }}>
                <span className="stack-sm" style={{ gap: 0 }}><b>{l.name}</b><span className="small" style={{ color: "#6B5A55" }}>{kes(l.price)} each</span></span>
                <span className="row">
                  <button className="btn btn-icon" aria-label={`One less ${l.name}`} onClick={() => setCart((c) => ({ ...c, [l.id]: Math.max(0, (c[l.id] || 0) - 1) }))}>−</button>
                  <b style={{ minWidth: 18, textAlign: "center" }}>{l.qty}</b>
                  <button className="btn btn-icon" aria-label={`One more ${l.name}`} disabled={l.qty >= l.in_stock} onClick={() => setCart((c) => ({ ...c, [l.id]: Math.min(l.in_stock, (c[l.id] || 0) + 1) }))}>+</button>
                </span>
              </div>
            ))}
            <div className="spread"><b>Total</b><b style={{ fontSize: 20, color: "var(--s-primary)" }}>{kes(total)}</b></div>
            <ErrorNotice error={state.error} />
            <Field label="Your name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Phone (M-Pesa) or email"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
            <Field label="Delivery address"><input className="input" value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Estate, street and building" /></Field>
            <Field label="Sizes and notes" hint="Optional"><input className="input" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Jacket size M, shirt size L" /></Field>
            <button className="btn btn-lg site-donate" style={{ justifyContent: "center" }} disabled={state.busy} onClick={place}>{state.busy ? "Placing…" : `Place order · ${kes(total)}`}</button>
            <span className="small" style={{ color: "#6B5A55" }}>Pay by M-Pesa on confirmation. Stock is checked live. Track your order with the reference we send you.</span>
          </>
        )}
      </aside>
    </div>
  );
}

// ---------- Rooms (hospitality) ----------
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export function StaySearch({ s, today }) {
  const nav = useNavigate();
  const [q, setQ] = useState({ start: addDays(today, 1), end: addDays(today, 3), guests: 2 });
  return (
    <form className="stay-search" onSubmit={(e) => { e.preventDefault(); nav(`${s.base}/rooms?start=${q.start}&end=${q.end}&guests=${q.guests}`); }}>
      <label className="field"><span>Check in</span><input className="input" type="date" min={today} value={q.start} onChange={(e) => setQ({ ...q, start: e.target.value, end: q.end <= e.target.value ? addDays(e.target.value, 1) : q.end })} /></label>
      <label className="field"><span>Check out</span><input className="input" type="date" min={addDays(q.start, 1)} value={q.end} onChange={(e) => setQ({ ...q, end: e.target.value })} /></label>
      <label className="field"><span>Guests</span><select className="select" value={q.guests} onChange={(e) => setQ({ ...q, guests: e.target.value })}>{[1, 2, 3, 4, 5, 6, 10, 40, 80].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <button className="btn btn-lg site-donate" style={{ alignSelf: "flex-end", justifyContent: "center" }}>Check availability</button>
    </form>
  );
}

export function Rooms({ s, today, bare }) {
  const [sp] = useSearchParams();
  const start = sp.get("start") || addDays(today, 1), end = sp.get("end") || addDays(today, 3), guests = Number(sp.get("guests") || 1);
  const { data: rooms, reload } = useApi(`/public/${s.slug}/rooms`, { start, end });
  const [pick, setPick] = useState(null);
  const nights = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
  const list = useMemo(() => (rooms || []).filter((r) => r.capacity >= guests || r.kind === "venue"), [rooms, guests]);
  return (
    <section className={bare ? "stack" : "container stack"} style={{ padding: bare ? 0 : "40px 32px 80px", gap: 22 }}>
      {!bare && <StaySearch s={s} today={today} />}
      <span style={{ color: "#6B5A55" }}>{nights} night{nights > 1 ? "s" : ""} · {start} to {end} · {guests} guest{guests > 1 ? "s" : ""}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
        {list.map((r, i) => (
          <article key={r.id} className="site-card reveal" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ height: 150, position: "relative", background: "var(--s-deep)" }}>
              <svg viewBox="0 0 100 60" style={{ position: "absolute", right: 16, bottom: 10, width: 90, opacity: .85 }} aria-hidden="true"><path d="M10 40 L50 12 L90 40Z" fill="#fff" fillOpacity=".85" /><rect x="22" y="40" width="56" height="18" fill="#fff" fillOpacity=".7" /></svg>
            </div>
            <div className="stack-sm" style={{ padding: 20, gap: 8, flex: 1 }}>
              <span className="small" style={{ color: r.available ? "#067647" : "#6B5A55", fontWeight: 600 }}>{r.available ? "Available for your dates" : "Booked for your dates"}</span>
              <div className="spread" style={{ flexWrap: "nowrap" }}><b style={{ fontSize: 19 }}>{r.name}</b><span><b style={{ color: "var(--s-primary)" }}>{kes(r.rate)}</b><span className="small" style={{ color: "#6B5A55" }}> / {r.kind === "venue" ? "day" : "night"}</span></span></div>
              <span style={{ color: "#57434D", lineHeight: "23px" }}>{r.description}</span>
              {r.amenities && <span className="small" style={{ color: "#6B5A55" }}>{r.amenities}</span>}
              <button className="btn site-donate" style={{ justifyContent: "center", marginTop: "auto" }} disabled={!r.available} onClick={() => setPick(r)}>{r.available ? `Request ${nights} night${nights > 1 ? "s" : ""} · ${kes(r.rate * nights)}` : "Not free on these dates"}</button>
            </div>
          </article>
        ))}
      </div>
      {pick && <BookDialog s={s} room={pick} start={start} end={end} onClose={() => { setPick(null); reload(); }} />}
    </section>
  );
}

function BookDialog({ s, room, start, end, onClose }) {
  const [f, setF] = useState({ name: "", contact: "", notes: "" });
  const [state, setState] = useState({ busy: false, error: null, ok: null });
  const send = async () => {
    setState({ busy: true, error: null, ok: null });
    try { setState({ busy: false, error: null, ok: await api(`/public/${s.slug}/booking-request`, { method: "POST", body: { ...f, resource_id: room.id, starts_on: start, ends_on: end, website: "" } }) }); }
    catch (e) { setState({ busy: false, error: e, ok: null }); }
  };
  return (
    <div className="site-drawer-wrap" onClick={onClose}>
      <aside className="site-drawer" style={{ width: "min(440px, 94vw)", gap: 12 }} onClick={(e) => e.stopPropagation()} aria-label="Booking request">
        <div className="spread"><h2 style={{ fontSize: 22, fontWeight: 800 }}>{room.name}</h2><button className="btn btn-icon" aria-label="Close" onClick={onClose}>✕</button></div>
        <span style={{ color: "#6B5A55" }}>{start} to {end}</span>
        {state.ok ? (
          <div className="stack" style={{ alignItems: "center", textAlign: "center", paddingTop: 24 }}><b style={{ fontSize: 19 }}>Request received</b><span style={{ color: "#57434D" }}>{state.ok.message}</span><button className="btn" onClick={onClose}>Done</button></div>
        ) : (
          <>
            <ErrorNotice error={state.error} />
            <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Phone or email"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
            <Field label="Anything we should know?" hint="Optional"><textarea className="textarea" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            <button className="btn btn-lg site-donate" style={{ justifyContent: "center" }} disabled={state.busy} onClick={send}>{state.busy ? "Sending…" : "Hold these dates"}</button>
            <span className="small" style={{ color: "#6B5A55" }}>We hold the room and confirm by phone. Nothing is charged now.</span>
          </>
        )}
      </aside>
    </div>
  );
}

// ---------- Studio (agency) ----------
export function Work({ s }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20 }}>
      {s.stories.map((x, i) => (
        <article key={x.id} className="reveal" style={{ borderRadius: 22, overflow: "hidden", background: i === 0 ? "var(--s-accent)" : "#141414", color: i === 0 ? "#111" : "#fff", padding: 28, minHeight: 300, display: "flex", flexDirection: "column", gap: 12, gridRow: i === 0 ? "span 2" : undefined }}>
          <span className="small" style={{ opacity: .7, letterSpacing: ".08em", textTransform: "uppercase" }}>Case study 0{i + 1}</span>
          <h3 style={{ fontSize: i === 0 ? 34 : 24, lineHeight: 1.08, fontWeight: 700 }}>{x.title}</h3>
          <p style={{ opacity: .8, lineHeight: "24px" }}>{x.summary}</p>
          <div style={{ marginTop: "auto" }}><b style={{ fontSize: i === 0 ? 64 : 44, lineHeight: 1, letterSpacing: "-2px" }}>{x.stat_value}</b><div style={{ opacity: .75 }}>{x.stat_label}</div></div>
          {x.quote && <blockquote style={{ margin: 0, fontWeight: 600 }}>“{x.quote}” <span style={{ opacity: .6, fontWeight: 400 }}>{x.quote_by}</span></blockquote>}
        </article>
      ))}
    </div>
  );
}

export function BriefForm({ s }) {
  const [f, setF] = useState({ name: "", contact: "", budget: "Under KES 200k", message: "" });
  const [state, setState] = useState({ busy: false, error: null, ok: null });
  const send = async (e) => {
    e.preventDefault(); setState({ busy: true, error: null, ok: null });
    try { const r = await api(`/public/${s.slug}/inquiry`, { method: "POST", body: { name: f.name, contact: f.contact, kind: "project", message: `Budget: ${f.budget}\n${f.message}`, website: "" } }); setState({ busy: false, error: null, ok: r.message }); setF({ name: "", contact: "", budget: f.budget, message: "" }); }
    catch (er) { setState({ busy: false, error: er, ok: null }); }
  };
  return (
    <form onSubmit={send} className="stack" style={{ background: "#141414", color: "#fff", borderRadius: 24, padding: 32 }} noValidate>
      <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1px" }}>Start a project</h2>
      {state.ok && <div className="notice notice-ok">{state.ok}</div>}
      <ErrorNotice error={state.error} />
      <div className="form-grid">
        <Field label="Name and company"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email or phone"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
      </div>
      <div className="row wrap" role="radiogroup" aria-label="Budget">{["Under KES 200k", "KES 200k to 500k", "KES 500k to 1M", "Over KES 1M"].map((b) => <button type="button" key={b} className="site-pill" aria-pressed={f.budget === b} onClick={() => setF({ ...f, budget: b })} style={f.budget === b ? { background: "var(--s-accent)", color: "#111", borderColor: "var(--s-accent)" } : { background: "transparent", color: "#fff", borderColor: "#444" }}>{b}</button>)}</div>
      <Field label="What do you need?"><textarea className="textarea" rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="A new identity for our coffee brand, launching in March" /></Field>
      <button className="btn btn-lg" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "#111", fontWeight: 800, alignSelf: "flex-start" }} disabled={state.busy}>{state.busy ? "Sending…" : "Send brief"}</button>
    </form>
  );
}

export { Link };

// ---------- apparel illustrations (original) ----------
export function GarmentArt({ name = "", color = "#8A3B12", accent = "#C9F25C" }) {
  const n = name.toLowerCase();
  const kind = n.includes("jacket") ? "jacket" : n.includes("shirt") ? "shirt" : n.includes("trouser") ? "trousers" : n.includes("dress") ? "dress" : n.includes("kids") ? "kids"
    : n.includes("sneaker") ? "sneaker" : n.includes("belt") ? "belt" : n.includes("tote") || n.includes("bag") ? "tote" : "shirt";
  if (kind === "sneaker") return <ShoeArt color={color} accent={accent} kind={0} />;
  const P = {
    jacket: <g><path d="M110 40l-40 20-30 70 26 10 14-34v94h120V96l14 34 26-10-30-70-40-20-30 22z" fill={color} /><path d="M160 62v134" stroke={accent} strokeWidth="4" /><path d="M110 40l50 22 50-22" fill="none" stroke="#000" strokeOpacity=".2" strokeWidth="6" /><rect x="96" y="118" width="26" height="20" rx="3" fill="#000" opacity=".15" /><rect x="198" y="118" width="26" height="20" rx="3" fill="#000" opacity=".15" /></g>,
    shirt: <g><path d="M112 44l-44 18-28 56 24 12 16-28v104h120V102l16 28 24-12-28-56-44-18c-6 14-22 22-48 22s-42-8-48-22z" fill={color} /><g fill={accent}>{[0, 1, 2, 3].map((i) => <circle key={i} cx="160" cy={86 + i * 26} r="4" />)}</g><path d="M80 120h200M90 160h180" stroke={accent} strokeOpacity=".5" strokeWidth="8" strokeDasharray="14 10" /></g>,
    trousers: <g><path d="M104 36h112l14 168h-48l-22-118-22 118h-48z" fill={color} /><path d="M104 52h112" stroke={accent} strokeWidth="6" /></g>,
    dress: <g><path d="M136 34h48l8 40c26 30 52 76 62 130H66c10-54 36-100 62-130z" fill={color} /><path d="M128 74c20 12 44 12 64 0" fill="none" stroke={accent} strokeWidth="6" /><path d="M96 150c40 16 88 16 128 0" fill="none" stroke={accent} strokeOpacity=".6" strokeWidth="5" /></g>,
    kids: <g><path d="M124 56l-34 14-20 40 20 10 12-20v64h116v-64l12 20 20-10-20-40-34-14c-6 10-18 16-36 16s-30-6-36-16z" fill={color} /><circle cx="160" cy="124" r="16" fill={accent} /><path d="M118 168h84v32h-30l-12-18-12 18h-30z" fill="#000" opacity=".2" /></g>,
    belt: <g><rect x="40" y="104" width="240" height="30" rx="8" fill={color} /><rect x="196" y="96" width="44" height="46" rx="6" fill="none" stroke={accent} strokeWidth="7" />{[70, 100, 130].map((x) => <circle key={x} cx={x} cy="119" r="4" fill="#000" opacity=".3" />)}</g>,
    tote: <g><path d="M90 84h140l12 120H78z" fill={color} /><path d="M122 84c0-40 76-40 76 0" fill="none" stroke={accent} strokeWidth="8" /><path d="M84 130h152M82 160h156" stroke={accent} strokeOpacity=".55" strokeWidth="8" /></g>,
  };
  return <svg viewBox="0 0 320 220" style={{ width: "100%", height: "auto" }} aria-hidden="true"><ellipse cx="160" cy="210" rx="110" ry="8" fill="#000" opacity=".1" />{P[kind]}</svg>;
}

// ---------- retail: stores and order tracking ----------
export function Stores({ s }) {
  const { data } = useApi(`/public/${s.slug}/stores`);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 18 }}>
      {(data || []).map((b) => (
        <article key={b.name} className="site-card stack-sm reveal" style={{ gap: 8 }}>
          <span className="small" style={{ color: "var(--s-primary)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{b.city}</span>
          <b style={{ fontSize: 20 }}>{b.name}</b>
          <span style={{ color: "#57434D" }}>{b.address}</span>
          <span className="small" style={{ color: "#6B5A55" }}>{b.hours}</span>
          <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
            {b.phone && <a className="btn" href={`tel:${b.phone.replace(/\s/g, "")}`}>Call {b.phone}</a>}
            <a className="btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address}`)}`} target="_blank" rel="noreferrer">Directions</a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TrackOrder({ s }) {
  const [sp] = useSearchParams();
  const [f, setF] = useState({ ref: sp.get("ref") || "", phone: "" });
  const [st, setSt] = useState({ busy: false, error: null, r: null });
  const go = async (e) => { e.preventDefault(); setSt({ busy: true, error: null, r: null }); try { setSt({ busy: false, error: null, r: await api(`/public/${s.slug}/track`, { params: f }) }); } catch (er) { setSt({ busy: false, error: er, r: null }); } };
  const steps = ["Order received", "Rider assigned", "On the way", "Delivered"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 28, alignItems: "start" }}>
      <form onSubmit={go} className="site-card stack" noValidate>
        <b style={{ fontSize: 20 }}>Where is my order?</b>
        <Field label="Order reference"><input className="input" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder="e.g. ORD-3F9A21" /></Field>
        <Field label="Phone number used for the order"><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <ErrorNotice error={st.error} />
        <button className="btn site-donate" style={{ justifyContent: "center" }} disabled={st.busy || !f.ref || !f.phone}>{st.busy ? "Checking..." : "Track order"}</button>
      </form>
      {st.r && (
        <div className="site-card stack">
          <span className="small" style={{ color: "#6B5A55" }}>Order {st.r.reference} · {st.r.area}</span>
          {st.r.status === "failed" ? <b style={{ fontSize: 20, color: "#B42318" }}>We could not deliver. We will call you to rearrange.</b> : (
            <ol className="track-steps">{steps.map((t, i) => <li key={t} className={i <= st.r.step ? "done" : ""}><span>{i + 1}</span>{t}{i === 2 && st.r.rider && i <= st.r.step ? ` with ${st.r.rider}` : ""}</li>)}</ol>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- hospitality: dining and experiences ----------
const RESTAURANTS = [["grill", "Ocean Grill", "Seafood from the morning catch, grilled over coconut husk."], ["terrace", "Spice Terrace", "Swahili and Indian Ocean cooking under the makuti roof."], ["beach", "Beach Bar", "Sundowners, light plates and live music on Fridays."]];
export function Dining({ s, today }) {
  const [f, setF] = useState({ restaurant: "grill", date: today, time: "19:30", covers: 2, name: "", phone: "", notes: "" });
  const [st, setSt] = useState({ busy: false, error: null, ok: "" });
  const send = async (e) => { e.preventDefault(); setSt({ busy: true, error: null, ok: "" }); try { const r = await api(`/public/${s.slug}/table`, { method: "POST", body: { ...f, covers: Number(f.covers), website: "" } }); setSt({ busy: false, error: null, ok: r.message }); } catch (er) { setSt({ busy: false, error: er, ok: "" }); } };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 28, alignItems: "start" }}>
      <div className="stack">{RESTAURANTS.map(([k, n, d]) => <div key={k} className="site-card stack-sm reveal" style={{ gap: 6 }}><b style={{ fontSize: 22, fontFamily: "var(--s-display)" }}>{n}</b><span style={{ color: "#57434D" }}>{d}</span><span className="small" style={{ color: "#6B5A55" }}>Lunch 12:30 to 15:00 · Dinner 19:00 to 22:30</span></div>)}</div>
      <form onSubmit={send} className="site-card stack" noValidate>
        <b style={{ fontSize: 22 }}>Reserve a table</b>
        {st.ok && <div className="notice notice-ok">{st.ok}</div>}
        <ErrorNotice error={st.error} />
        <div className="form-grid">
          <Field label="Restaurant"><select className="select" value={f.restaurant} onChange={(e) => setF({ ...f, restaurant: e.target.value })}>{RESTAURANTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Field>
          <Field label="Guests"><select className="select" value={f.covers} onChange={(e) => setF({ ...f, covers: e.target.value })}>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Date"><input className="input" type="date" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time"><select className="select" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>{["12:30", "13:00", "13:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
        </div>
        <Field label="Requests" hint="Optional"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Anniversary, high chair, sea view" /></Field>
        <button className="btn site-donate" style={{ justifyContent: "center" }} disabled={st.busy}>{st.busy ? "Booking..." : "Book table"}</button>
      </form>
    </div>
  );
}

export function Experiences({ s, today }) {
  const { data: tours } = useApi(`/public/${s.slug}/tours`);
  const [pick, setPick] = useState(null);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
        {(tours || []).map((t) => (
          <article key={t.id} className="site-card stack-sm reveal" style={{ gap: 8 }}>
            <span className="small" style={{ color: "var(--s-accent)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{t.duration}</span>
            <b style={{ fontSize: 21, fontFamily: "var(--s-display)" }}>{t.name}</b>
            <span style={{ color: "#57434D", lineHeight: "23px" }}>{t.description}</span>
            <div className="spread" style={{ marginTop: "auto" }}><span><b>{kes(t.price)}</b><span className="small" style={{ color: "#6B5A55" }}> per person</span></span><button className="btn site-donate" onClick={() => setPick(t)}>Book</button></div>
          </article>
        ))}
      </div>
      {pick && <TourDialog s={s} tour={pick} today={today} onClose={() => setPick(null)} />}
    </>
  );
}

function TourDialog({ s, tour, today, onClose }) {
  const [f, setF] = useState({ date: today, pax: 2, name: "", contact: "" });
  const [st, setSt] = useState({ busy: false, error: null, ok: null });
  const send = async () => { setSt({ busy: true, error: null, ok: null }); try { setSt({ busy: false, error: null, ok: await api(`/public/${s.slug}/tour-booking`, { method: "POST", body: { ...f, pax: Number(f.pax), tour_id: tour.id, website: "" } }) }); } catch (er) { setSt({ busy: false, error: er, ok: null }); } };
  return (
    <div className="site-drawer-wrap" onClick={onClose}>
      <aside className="site-drawer" style={{ width: "min(440px, 94vw)", gap: 12 }} onClick={(e) => e.stopPropagation()} aria-label={`Book ${tour.name}`}>
        <div className="spread"><h2 style={{ fontSize: 22, fontWeight: 800 }}>{tour.name}</h2><button className="btn btn-icon" aria-label="Close" onClick={onClose}>✕</button></div>
        {st.ok ? <div className="stack" style={{ paddingTop: 16 }}><b style={{ fontSize: 19 }}>Request received</b><span style={{ color: "#57434D" }}>{st.ok.message}</span><button className="btn" onClick={onClose}>Done</button></div> : (
          <>
            <ErrorNotice error={st.error} />
            <div className="form-grid">
              <Field label="Date"><input className="input" type="date" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
              <Field label="People"><select className="select" value={f.pax} onChange={(e) => setF({ ...f, pax: e.target.value })}>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n}>{n}</option>)}</select></Field>
            </div>
            <Field label="Lead guest"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Phone or email"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
            <div className="spread"><span>Total</span><b style={{ fontSize: 20 }}>{kes(tour.price * Number(f.pax))}</b></div>
            <button className="btn btn-lg site-donate" style={{ justifyContent: "center" }} disabled={st.busy} onClick={send}>{st.busy ? "Sending..." : "Request booking"}</button>
            <span className="small" style={{ color: "#6B5A55" }}>A licensed guide is assigned and confirms by phone. Pay on confirmation.</span>
          </>
        )}
      </aside>
    </div>
  );
}
