import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NAV } from "../modules";
import { useEffect, useState } from "react";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { initials } from "../format";

const I = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  check: "M5 12l4 4 10-10M4 20h16",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  attention: "M4 13h4l2 3h4l2-3h4M4 13l2.5-7h11L20 13v6H4z",
  projects: "M3 6h7l2 2h9v11H3z",
  work: "M4 4h16v16H4zM8 12l3 3 5-6",
  reports: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
  settings: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
};
const Icon = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const Logo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true"><path d="M3 11.5 L8.5 17 L19 5" fill="none" stroke="#2C3D9B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function Links({ openFlags, approvals, admin, onNavigate }) {
  const loc = useLocation();
  const cls = ({ isActive }) => "nav-link" + (isActive ? " active" : "");
  const L = (props) => <NavLink {...props} className={cls} onClick={onNavigate} />;
  const groupOpen = (g) => g.items.some(([k]) => loc.pathname.startsWith(k === "@finance" ? "/app/finance" : `/app/m/${k}`));
  const [open, setOpen] = useState(() => Object.fromEntries(NAV.map((g) => [g.label, true])));
  return (
    <>
      <L to="/app" end><Icon d={I.overview} />Overview</L>
      <L to="/app/attention"><Icon d={I.attention} />Attention{openFlags > 0 && <span className="nav-badge">{openFlags}</span>}</L>
      <L to="/app/approvals"><Icon d={I.check} />Approvals{approvals > 0 && <span className="nav-badge" style={{ background: "var(--risk)" }}>{approvals}</span>}</L>
      <L to="/app/calendar"><Icon d={I.calendar} />Calendar</L>
      <div className="nav-section">Programmes and M&amp;E</div>
      <L to="/app/projects"><Icon d={I.projects} />Programmes</L>
      <L to="/app/work"><Icon d={I.work} />Work</L>
      <L to="/app/reports"><Icon d={I.reports} />Reports</L>
      <div className="nav-section">Operations</div>
      {NAV.map((g) => {
        const isOpen = open[g.label] !== false || groupOpen(g);
        return (
          <div key={g.label}>
            <button className="nav-group" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [g.label]: !isOpen })}>
              <span>{g.label}</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            </button>
            {isOpen && g.items.map(([k, label]) => k === "@site" ? (
              <Link key={k} to="/site/timiza" className="nav-link nav-sub" onClick={onNavigate}>{label} ↗</Link>
            ) : (
              <L key={k} to={k === "@finance" ? "/app/finance" : `/app/m/${k}`} end={k !== "@finance"}><span className="nav-sub-label">{label}</span></L>
            ))}
          </div>
        );
      })}
      {admin && <><div className="nav-section">Admin</div><L to="/app/settings"><Icon d={I.settings} />Settings</L></>}
    </>
  );
}

export default function Shell() {
  const { user, signOut, can } = useAuth();
  const nav = useNavigate();
  const [openFlags, setOpenFlags] = useState(0);
  const [approvals, setApprovals] = useState(0);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const load = () => {
      api("/flags").then((d) => setOpenFlags(d.items.length)).catch(() => {});
      api("/approvals").then((d) => setApprovals(d.length)).catch(() => {});
    };
    load();
    window.addEventListener("kept:changed", load);
    return () => window.removeEventListener("kept:changed", load);
  }, []);
  const out = () => { signOut(); nav("/"); };
  return (
    <div className="shell">
      <aside className={"sidebar" + (menu ? " open" : "")} aria-label="Main">
        <Link className="brand" to="/app"><Logo />Kept</Link>
        <div className="org-name"><div className="small muted">Organization</div><div className="strong">{user.organization.name}</div></div>
        <nav className="stack-sm side-scroll" style={{ gap: 2 }} aria-label="Sections"><Links openFlags={openFlags} approvals={approvals} admin={can.admin} onNavigate={() => setMenu(false)} /></nav>
        <div className="user-box">
          <span className="avatar">{initials(user.full_name)}</span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span className="strong" style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.full_name}</span>
            <span className="small muted" style={{ textTransform: "capitalize" }}>{user.role}</span>
          </span>
          <button className="btn btn-quiet" onClick={out} aria-label="Sign out" title="Sign out">
            <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
          </button>
        </div>
      </aside>
      <nav className="topbar" aria-label="Quick links">
        <button className="btn btn-quiet" onClick={() => setMenu(true)} aria-label="Open menu"><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
        <Link className="brand" to="/app" style={{ padding: "0 8px" }} aria-label="Kept home"><Logo size={18} /></Link>
        <NavLink to="/app" end className="nav-link">Overview</NavLink>
        <NavLink to="/app/attention" className="nav-link">Attention {openFlags > 0 && <span className="nav-badge">{openFlags}</span>}</NavLink>
        <NavLink to="/app/approvals" className="nav-link">Approvals</NavLink>
      </nav>
      {menu && <div className="overlay" style={{ zIndex: 29, padding: 0 }} onClick={() => setMenu(false)} />}
      <main className="main" id="main">{PREVIEW && <PreviewBar />}<Outlet /></main>
    </div>
  );
}

export const notifyChanged = () => window.dispatchEvent(new Event("kept:changed"));

function PreviewBar() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const reset = async () => {
    if (!confirm("Reset the preview to its starting data? Your changes in this browser will be lost.")) return;
    const { resetPreview } = await import("../demo/engine");
    resetPreview();
    signOut();
    nav("/login");
  };
  const switchUser = () => { signOut(); nav("/login"); };
  return (
    <div className="notice no-print" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-dark)", border: "1px solid #c3caeb", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 240 }}><b>Live preview.</b> Everything works; your changes are saved in this browser. "Today" is fixed at 13 Oct 2026 so the scenario stays the same.</span>
      <button className="btn" onClick={switchUser}>Switch account</button>
      <button className="btn btn-quiet" onClick={reset}>Reset data</button>
    </div>
  );
}
