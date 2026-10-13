import { useEffect, useRef } from "react";

const SHAPES = {
  circle: "M6 1.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z",
  tri: "M6 1.5 L10.8 10 L1.2 10 Z",
  sq: "M2 2 H10 V10 H2 Z",
  check: "M2 6.5 L5 9.2 L10 3",
};

const LOOK = {
  on_track: ["On track", "#1D7348", "circle", true],
  done: ["Done", "#1D7348", "check", false],
  at_risk: ["At risk", "#A85A06", "tri", true],
  overdue: ["Overdue", "#B3261E", "sq", true],
  blocked: ["Blocked", "#56625E", "sq", false],
  not_started: ["Not started", "#56625E", "circle", false],
  in_progress: ["In progress", "#2C3D9B", "circle", true],
  behind_pace: ["Behind pace", "#A85A06", "tri", true],
  missing_proof: ["Missing proof", "#A85A06", "tri", false],
  due_soon: ["Due soon", "#2C3D9B", "circle", false],
  needs_proof: ["Needs proof", "#A85A06", "tri", false],
};

export function Shape({ kind, size = 11 }) {
  const [, color, shape, filled] = LOOK[kind] || LOOK.not_started;
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d={SHAPES[shape]} fill={filled ? color : "none"} stroke={color} strokeWidth={shape === "check" ? 1.8 : 1.5} />
    </svg>
  );
}

export function Status({ kind, label }) {
  const [text, color] = LOOK[kind] || LOOK.not_started;
  return (
    <span className="status" style={{ color }}>
      <Shape kind={kind} />
      {label || text}
    </span>
  );
}

export function PaceLine({ pace }) {
  const a = Math.min(pace.actual_pct, 100);
  const e = Math.min(pace.expected_pct, 100);
  const behind = e > a;
  const fill = pace.status === "on_track" || pace.status === "done" ? "var(--cobalt)" : "var(--ink-2)";
  return (
    <div className="pace" role="img" aria-label={`${pace.actual} of ${pace.target} done; ${pace.expected} expected by today`}>
      <div className="track" />
      {behind && <div className="gap" style={{ left: `${a}%`, width: `${e - a}%` }} />}
      <div className="fill" style={{ width: `${a}%`, background: fill }} />
      <div className="tick" style={{ left: `calc(${e}% - 1px)` }} />
    </div>
  );
}

export function Loading({ rows = 4 }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 18, width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="notice notice-error spread" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: 440 }}>{children}</p>}
      {action}
    </div>
  );
}

export function Dialog({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector("input, select, textarea, button")?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    ref.current?.addEventListener("keydown", onKey);
    return () => prev?.focus?.();
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span>{label} {hint && <span className="hint">{hint}</span>}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}
