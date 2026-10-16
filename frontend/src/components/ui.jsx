import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";

const SHAPES = {
  circle: "M6 1.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z",
  tri: "M6 1.5 L10.8 10 L1.2 10 Z",
  sq: "M2 2 H10 V10 H2 Z",
  check: "M2 6.5 L5 9.2 L10 3",
};

const LOOK = {
  on_track: ["On track", "var(--ok)", "circle", true],
  done: ["Done", "var(--ok)", "check", false],
  at_risk: ["At risk", "var(--risk)", "tri", true],
  overdue: ["Overdue", "var(--bad)", "sq", true],
  blocked: ["Blocked", "var(--slate)", "sq", false],
  not_started: ["Not started", "var(--slate)", "circle", false],
  in_progress: ["In progress", "var(--cobalt)", "circle", true],
  behind_pace: ["Behind pace", "var(--risk)", "tri", true],
  missing_proof: ["Missing proof", "var(--risk)", "tri", false],
  due_soon: ["Due soon", "var(--cobalt)", "circle", false],
  needs_proof: ["Needs proof", "var(--risk)", "tri", false],
  over_budget: ["Budget", "var(--bad)", "tri", true],
  invoice_overdue: ["Overdue invoice", "var(--bad)", "sq", true],
  approval_waiting: ["Approval waiting", "var(--cobalt)", "circle", false],
  expiring: ["Expiring document", "var(--bad)", "sq", false],
  low_stock: ["Low stock", "var(--risk)", "sq", true],
  report_due: ["Funder deadline", "var(--risk)", "circle", true],
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
  // The label points at the first control by id, so its accessible name is exactly the label (not the text of
  // sibling buttons, rules or errors). The error is announced as the control's description.
  const auto = useId();
  const items = Children.toArray(children);
  const first = items.findIndex((c) => isValidElement(c));
  const id = first >= 0 ? items[first].props.id || `f${auto}` : undefined;
  const errId = error ? `${id}-err` : undefined;
  if (first >= 0) items[first] = cloneElement(items[first], { id, "aria-describedby": errId, "aria-invalid": error ? true : undefined });
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label} {hint && <span className="hint">{hint}</span>}</label>
      {items}
      {error && <span className="field-error" id={errId} role="alert">{error}</span>}
    </div>
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

/** Password field with a show/hide control. The toggle is a real button: keyboard operable, announced, and it never submits the form. */
export function PasswordInput({ value, onChange, autoComplete = "current-password", id, invalid, "aria-invalid": ariaInvalid, ...rest }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="pw-wrap">
      <input {...rest} id={id} className="input" type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={onChange}
        aria-invalid={invalid || ariaInvalid || undefined} spellCheck={false} autoCapitalize="off" />
      <button type="button" className="pw-toggle" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}

export const PASSWORD_RULES = [
  ["At least 10 characters", (p) => p.length >= 10],
  ["Letters and numbers", (p) => /[a-z]/i.test(p) && /\d/.test(p)],
];

/** Live checklist of the password policy, plus the rules the server also enforces, stated up front. */
export function PasswordRules({ value }) {
  return (
    <ul className="pw-rules" aria-live="polite">
      {PASSWORD_RULES.map(([label, test]) => <li key={label} className={test(value) ? "ok" : ""}>{label}</li>)}
      <li className="note">Not a common password, and not your name or email</li>
    </ul>
  );
}
