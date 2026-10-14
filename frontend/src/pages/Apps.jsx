import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { notifyChanged } from "../components/Shell";
import { ErrorNotice, Loading, Toast } from "../components/ui";
import { useApi } from "../hooks";
import PLATFORM from "../platform.json";

export const APP_ICONS = {
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z", clipboard: "M8 4h8v3H8zM6 6h12v15H6zM9 12h6M9 16h4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5", heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z",
  wallet: "M3 7h18v12H3zM16 13h2M3 7l12-4v4", receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6", cart: "M3 4h2l2.5 11h10L20 7H6.5M9 20h.01M17 20h.01",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10", key: "M15 3a6 6 0 00-5.6 8.2L3 17.6V21h3.4l1-1v-2h2v-2h2l1.4-1.4A6 6 0 1015 3zM16 8h.01",
  users: "M16 20v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8M20 20v-2a3 3 0 00-2-2.8M4 20v-2a3 3 0 012-2.8", id: "M3 5h18v14H3zM7 10a2 2 0 104 0 2 2 0 00-4 0M6 16c1-2 5-2 6 0M14 9h4M14 13h4",
  file: "M6 3h9l4 4v14H6zM14 3v5h5", gavel: "M14 4l6 6M11 7l6 6M12.5 5.5l-6 6M4 20h10M8 14l-4 4", globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
};
export function AppIcon({ app, size = 52 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(145deg, ${app.color}, color-mix(in srgb, ${app.color} 70%, #0F1E46))`, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 14px color-mix(in srgb, ${app.color} 35%, transparent)`, flex: `0 0 ${size}px` }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={APP_ICONS[app.icon] || APP_ICONS.box} /></svg>
    </span>
  );
}

export default function Apps() {
  const { can, refresh } = useAuth();
  const { data, error, loading, reload } = useApi("/apps");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  if (loading && !data) return <Loading rows={8} />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const industry = PLATFORM.industries.find((i) => i.key === data.industry);
  const toggle = async (a) => {
    if (a.installed && !confirm(`Remove ${a.name}? Its data is kept and comes back if you reinstall.`)) return;
    setBusy(a.key); setErr(null);
    try { await api(`/apps/${a.key}/${a.installed ? "uninstall" : "install"}`, { method: "POST" }); await refresh(); reload(); notifyChanged(); setToast(`${a.name} ${a.installed ? "removed" : "installed"}`); }
    catch (e) { setErr(e); } finally { setBusy(null); }
  };
  const apps = data.apps.filter((a) => filter === "all" || (filter === "installed" ? a.installed : !a.installed));
  return (
    <>
      <div className="page-hero">
        <div className="stack-sm" style={{ gap: 2 }}><h1>Apps</h1><span className="muted">{industry?.name} · {data.installed.length} of {data.apps.length} installed</span></div>
        <div className="seg" role="group" aria-label="Show">
          {[["all", "All"], ["installed", "Installed"], ["available", "Available"]].map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </div>
      <ErrorNotice error={err} />
      <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {apps.map((a) => (
          <div key={a.key} className="tile" style={{ gap: 12, background: "var(--surface)" }}>
            <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
              <AppIcon app={a} />
              <div className="stack-sm" style={{ gap: 2, flex: 1 }}>
                <b style={{ fontSize: 16 }}>{a.name}</b>
                <span className="small muted">{a.tagline}</span>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6 }}>{a.modules.map((m) => <span key={m.key} className="chip-tone" style={{ background: "var(--stone)", color: "var(--ink-2)", fontWeight: 500 }}>{m.label}</span>)}</div>
            <div className="row" style={{ marginTop: "auto" }}>
              {a.installed ? <span className="chip-tone" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>✓ Installed</span> : <span className="chip-tone" style={{ background: "var(--stone)", color: "var(--slate)" }}>Not installed</span>}
              {a.installed && a.modules[0] && <Link className="btn btn-ghost" style={{ marginLeft: "auto" }} to={`/app/m/${a.modules[0].key}`}>Open</Link>}
              {can.admin && <button className={"btn " + (a.installed ? "btn-ghost-danger" : "btn-primary")} style={{ marginLeft: a.installed && a.modules[0] ? 0 : "auto" }} disabled={busy === a.key} onClick={() => toggle(a)}>{busy === a.key ? "…" : a.installed ? "Remove" : "Install"}</button>}
            </div>
          </div>
        ))}
      </div>
      {!can.admin && <p className="small muted">Only admins can install or remove apps.</p>}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
