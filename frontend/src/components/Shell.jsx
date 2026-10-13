import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { initials } from "../format";

const I = {
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

function Links({ openFlags, admin }) {
  const cls = ({ isActive }) => "nav-link" + (isActive ? " active" : "");
  return (
    <>
      <NavLink to="/app" end className={cls}><Icon d={I.attention} />Attention{openFlags > 0 && <span className="nav-badge">{openFlags}</span>}</NavLink>
      <NavLink to="/app/projects" className={cls}><Icon d={I.projects} />Projects</NavLink>
      <NavLink to="/app/work" className={cls}><Icon d={I.work} />Work</NavLink>
      <NavLink to="/app/reports" className={cls}><Icon d={I.reports} />Reports</NavLink>
      {admin && <NavLink to="/app/settings" className={cls}><Icon d={I.settings} />Settings</NavLink>}
    </>
  );
}

export default function Shell() {
  const { user, signOut, can } = useAuth();
  const nav = useNavigate();
  const [openFlags, setOpenFlags] = useState(0);
  useEffect(() => {
    const load = () => api("/flags").then((d) => setOpenFlags(d.items.length)).catch(() => {});
    load();
    window.addEventListener("kept:changed", load);
    return () => window.removeEventListener("kept:changed", load);
  }, []);
  const out = () => { signOut(); nav("/"); };
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <Link className="brand" to="/app"><Logo />Kept</Link>
        <div className="org-name"><div className="small muted">Organization</div><div className="strong">{user.organization.name}</div></div>
        <nav className="stack-sm" style={{ gap: 4 }} aria-label="Sections"><Links openFlags={openFlags} admin={can.admin} /></nav>
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
      <nav className="topbar" aria-label="Sections">
        <Link className="brand" to="/app" style={{ padding: "0 8px" }} aria-label="Kept home"><Logo size={18} /></Link>
        <Links openFlags={openFlags} admin={can.admin} />
        <button className="btn btn-quiet" onClick={out}>Sign out</button>
      </nav>
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
