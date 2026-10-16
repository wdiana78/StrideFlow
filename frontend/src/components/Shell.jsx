import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, fileUrl, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { initials } from "../format";
import { GROUP_COLOR, MODS, NAV } from "../modules";
import ThemeToggle from "./ThemeToggle";

const I = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  attention: "M4 13h4l2 3h4l2-3h4M4 13l2.5-7h11L20 13v6H4z",
  check: "M5 12l4 4 10-10M4 20h16",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  projects: "M3 6h7l2 2h9v11H3z",
  work: "M4 4h16v16H4zM8 12l3 3 5-6",
  reports: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  forms: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3",
  apps: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  settings: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4",
};
const Icon = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
export const Logo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="currentColor" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const SITE_HOME = (slug) => `/site/${slug}`;

function Links({ openFlags, approvals, admin, onNavigate, installed, siteSlug }) {
  const loc = useLocation();
  const has = (a) => installed.includes(a);
  const cls = ({ isActive }) => "nav-link" + (isActive ? " active" : "");
  const L = (props) => <NavLink {...props} className={cls} onClick={onNavigate} />;
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter(([k]) => (k === "@finance" ? has("finance") : k === "@site" ? has("website") && siteSlug : has(MODS[k]?.app))) })).filter((g) => g.items.length);
  const groupOpen = (g) => g.items.some(([k]) => loc.pathname.startsWith(k === "@finance" ? "/app/finance" : `/app/m/${k}`));
  const [open, setOpen] = useState({});
  return (
    <>
      <L to="/app" end><Icon d={I.overview} />Home</L>
      <L to="/app/attention"><Icon d={I.attention} />Alerts{openFlags > 0 && <span className="nav-badge">{openFlags}</span>}</L>
      <L to="/app/approvals"><Icon d={I.check} />Approvals{approvals > 0 && <span className="nav-badge">{approvals}</span>}</L>
      <L to="/app/calendar"><Icon d={I.calendar} />Calendar</L>
      {(has("projects") || has("forms")) && <div className="nav-section">Work</div>}
      {has("projects") && <><L to="/app/projects"><Icon d={I.projects} />Projects</L><L to="/app/work"><Icon d={I.work} />Tasks</L><L to="/app/analytics"><Icon d={I.analytics} />Insights</L></>}
      {has("forms") && <L to="/app/forms"><Icon d={I.forms} />Tazama<span className="nav-tag">Field</span></L>}
      {has("projects") && <L to="/app/reports"><Icon d={I.reports} />Reports</L>}
      {groups.length > 0 && <div className="nav-section">Operations</div>}
      {groups.map((g) => {
        const isOpen = open[g.label] !== false || groupOpen(g);
        return (
          <div key={g.label}>
            <button className="nav-group" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [g.label]: !isOpen })}>
              <span>{g.label}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            </button>
            {isOpen && g.items.map(([k, label]) => k === "@site" ? (
              <Link key={k} to={SITE_HOME(siteSlug)} className="nav-link nav-sub" onClick={onNavigate}>{label} ↗</Link>
            ) : (
              <L key={k} to={k === "@finance" ? "/app/finance" : `/app/m/${k}`} end={k !== "@finance"}><span className="nav-sub-label">{label}</span></L>
            ))}
          </div>
        );
      })}
      <div className="nav-section">Workspace</div>
      <L to="/app/apps"><Icon d={I.apps} />Apps</L>
      <L to="/app/account"><Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />My account</L>
      {admin && <L to="/app/settings"><Icon d={I.settings} />Settings</L>}
    </>
  );
}

export default function Shell() {
  const { user, signOut, can } = useAuth();
  const nav = useNavigate();
  const [openFlags, setOpenFlags] = useState(0);
  const [approvals, setApprovals] = useState(0);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [siteSlug, setSiteSlug] = useState(null);
  const [orgColor, setOrgColor] = useState("#6D3FC9");
  const [orgLogo, setOrgLogo] = useState(null);
  const installed = user.organization.installed_apps || [];
  useEffect(() => {
    if (installed.includes("website")) {
      // The workspace always wears StrideFlow's brand; the organization's own colour only marks its logo.
      // Each organization's dashboard wears its own brand: logo, primary colour and accent. StrideFlow stays in the footer.
      api("/m/site_settings", { params: { page_size: 1 } }).then((d) => {
        const st = d.items[0]; setSiteSlug(st?.slug || null);
        const root = document.documentElement.style;
        if (st?.brand_primary) { setOrgColor(st.brand_primary); root.setProperty("--brand", st.brand_primary); }
        if (st?.brand_accent) root.setProperty("--brand-2", st.brand_accent);
        // Text on the accent and primary colours flips to dark when those colours are light (lime, yellow).
        const light = (hex) => { const h = (hex || "").replace("#", ""); if (h.length !== 6) return false; const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6; };
        root.setProperty("--on-brand-2", light(st?.brand_accent) ? "#1A1A1A" : "#FFFFFF");
        root.setProperty("--on-brand", light(st?.brand_primary) ? "#1A1A1A" : "#FFFFFF");
        if (st?.logo?.url) setOrgLogo(fileUrl(st.logo.url));
      }).catch(() => {});
    }
    const load = () => {
      api("/flags", { params: user.role === "member" ? { mine: true } : {} }).then((d) => setOpenFlags(d.items.length)).catch(() => {});
      api("/approvals").then((d) => setApprovals(d.length)).catch(() => {});
    };
    load();
    window.addEventListener("kept:changed", load);
    const key = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("kept:changed", load); window.removeEventListener("keydown", key); document.documentElement.style.removeProperty("--brand"); document.documentElement.style.removeProperty("--brand-2"); document.documentElement.style.removeProperty("--on-brand-2"); document.documentElement.style.removeProperty("--on-brand"); };
  }, [installed.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const out = () => signOut({ then: () => nav(siteSlug ? `/site/${siteSlug}` : "/") });
  const linkProps = { openFlags, approvals, admin: can.admin, installed, siteSlug };
  return (
    <div className="shell">
      <aside className={"sidebar" + (menu ? " open" : "")} aria-label="Main">
        <Link to="/app" className="org-brand" aria-label={`${user.organization.name} dashboard`}>
          {orgLogo ? <img src={orgLogo} alt={user.organization.name} /> : <span className="org-chip" style={{ margin: 0, padding: 0, background: "none", border: 0 }}><span className="logo" style={{ background: orgColor }}>{initials(user.organization.name)}</span><span className="org-brand-name">{user.organization.name}</span></span>}
          <span className="org-brand-sub">Staff dashboard</span>
        </Link>
        {siteSlug && <Link to={`/site/${siteSlug}`} className="nav-link" style={{ fontSize: 13.5 }}><Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />View public website ↗</Link>}
        <nav className="stack-sm side-scroll" style={{ gap: 2 }} aria-label="Sections"><Links {...linkProps} onNavigate={() => setMenu(false)} /></nav>
        <div className="user-box">
          <span className="avatar">{initials(user.full_name)}</span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span className="strong" style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.full_name}</span>
            <span className="small muted" style={{ textTransform: "capitalize" }}>{user.role}</span>
          </span>
          <button className="btn btn-quiet" onClick={out} aria-label="Sign out" title="Sign out"><Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></button>
        </div>
        <span className="row small muted" style={{ gap: 6, padding: "6px 8px 0" }}><Logo size={14} />Powered by StrideFlow</span>
      </aside>
      <nav className="topbar" aria-label="Quick links">
        <button className="btn btn-quiet" onClick={() => setMenu(true)} aria-label="Open menu"><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
        <Link className="brand" to="/app" style={{ padding: "0 8px", fontSize: 15 }} aria-label="Dashboard home"><span className="org-chip" style={{ margin: 0, padding: 0, background: "none", border: 0 }}><span className="logo" style={{ background: orgColor, width: 28, height: 28, flex: "0 0 28px", fontSize: 11 }}>{initials(user.organization.name)}</span></span></Link>
        <NavLink to="/app" end className="nav-link">Home</NavLink>
        <NavLink to="/app/attention" className="nav-link">Alerts {openFlags > 0 && <span className="nav-badge">{openFlags}</span>}</NavLink>
        <span style={{ flex: 1 }} />
        <button className="btn btn-quiet" onClick={() => setSearch(true)} aria-label="Search"><Icon d={I.search} /></button>
        <ThemeToggle />
      </nav>
      {menu && <div className="overlay" style={{ zIndex: 29, padding: 0 }} onClick={() => setMenu(false)} />}
      <main className="main" id="main">
        <div className="appbar no-print">
          <button className="searchbar" onClick={() => setSearch(true)}><Icon d={I.search} />Search everything<kbd>Ctrl K</kbd></button>
          <span style={{ flex: 1 }} />
          {PREVIEW && <PreviewBar />}
          <span className="hide-md"><ThemeToggle /></span>
          <Notifications count={openFlags} />
          <AccountMenu siteSlug={siteSlug} onSignOut={out} />
        </div>
        <Outlet />
      </main>
      {search && <SearchDialog onClose={() => setSearch(false)} />}
    </div>
  );
}

function useOutside(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open, setOpen]);
  return ref;
}

function Notifications({ count }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useOutside(open, setOpen);
  const toggle = async () => { const o = !open; setOpen(o); if (o) api("/flags", { params: { mine: true } }).then((d) => setItems(d.items)).catch(() => setItems([])); };
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn btn-icon icon-badge" aria-label={`Notifications, ${count} open alerts`} aria-expanded={open} onClick={toggle}>
        <Icon d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4" />{count > 0 && <span>{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="menu" role="dialog" aria-label="Notifications" style={{ width: 360 }}>
          <div className="menu-head"><b>Assigned to you</b><Link to="/app/attention" onClick={() => setOpen(false)}>All alerts</Link></div>
          {items === null ? <div className="menu-empty">Loading...</div> : items.length === 0 ? <div className="menu-empty">Nothing needs you right now.</div> : items.slice(0, 6).map((f) => (
            <Link key={f.id} to="/app/attention" className="menu-item" onClick={() => setOpen(false)}><b>{f.title}</b><span>{f.detail}</span></Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountMenu({ siteSlug, onSignOut }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, setOpen);
  const role = { admin: "Administrator", manager: "Manager", member: "Field team", viewer: "Read only" }[user.role] || user.role;
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="account-btn" aria-expanded={open} aria-label="Account" onClick={() => setOpen(!open)}>
        <span className="avatar">{initials(user.full_name)}</span><span className="hide-sm account-name"><b>{user.full_name.split(" ")[0]}</b><span>{role}</span></span>
      </button>
      {open && (
        <div className="menu" role="menu" style={{ width: 260 }}>
          <div className="menu-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><b>{user.full_name}</b><span className="small muted">{user.email}</span></div>
          <Link role="menuitem" to="/app/account" className="menu-item" onClick={() => setOpen(false)}>My account</Link>
          {siteSlug && <Link role="menuitem" to={`/site/${siteSlug}`} className="menu-item" onClick={() => setOpen(false)}>View public website</Link>}
          {user.role === "admin" && <Link role="menuitem" to="/app/settings" className="menu-item" onClick={() => setOpen(false)}>Team and settings</Link>}
          <button role="menuitem" className="menu-item" onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function SearchDialog({ onClose }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [sel, setSel] = useState(0);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return undefined; }
    const t = setTimeout(() => api("/search", { params: { q } }).then((r) => { setRes(r); setSel(0); }).catch(() => setRes([])), 180);
    return () => clearTimeout(t);
  }, [q]);
  const go = (r) => { onClose(); nav(r.link); };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Search" style={{ maxWidth: 620 }}>
        <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--rule-soft)", gap: 10 }}>
          <Icon d={I.search} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers, invoices, grants, events, people…" aria-label="Search everything"
            style={{ border: 0, outline: "none", flex: 1, fontSize: 17, background: "none" }}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowDown") setSel(Math.min(sel + 1, res.length - 1)); if (e.key === "ArrowUp") setSel(Math.max(sel - 1, 0)); if (e.key === "Enter" && res[sel]) go(res[sel]); }} />
          <kbd className="small muted">Esc</kbd>
        </div>
        <div role="listbox" style={{ maxHeight: 420, overflowY: "auto", padding: 8 }}>
          {q.trim().length >= 2 && res.length === 0 && <div className="empty" style={{ padding: 24 }}><span className="muted">No matches for “{q}”</span></div>}
          {res.map((r, i) => (
            <button key={r.link} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(r)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: 0, borderRadius: 10, background: i === sel ? "var(--cobalt-tint)" : "transparent", cursor: "pointer", textAlign: "left" }}>
              <span className="small muted" style={{ minWidth: 96 }}>{r.kind}</span>
              <span style={{ flex: 1 }}>{r.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewBar() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const reset = async () => {
    if (!confirm("Reset the demo to its starting data?")) return;
    const { resetPreview } = await import("../demo/engine");
    resetPreview(); signOut(); nav("/login");
  };
  return (
    <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
      <span className="small muted hide-sm">Demo · 13 Oct 2026</span>
      <button className="btn" onClick={() => { signOut(); nav("/login"); }}>Switch account</button>
      <button className="btn btn-quiet" onClick={reset}>Reset</button>
    </div>
  );
}

export const notifyChanged = () => window.dispatchEvent(new Event("kept:changed"));
