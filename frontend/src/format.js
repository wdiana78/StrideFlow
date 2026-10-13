const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const parseDate = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const fmtDate = (iso, withYear = false) => {
  if (!iso) return "";
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
};
export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const fmtNum = (n) => (n == null ? "" : Number.isInteger(n) ? n.toLocaleString() : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }));
export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
// VITE_TODAY mirrors the backend KEPT_TODAY setting so due-date colouring matches the API.
export const isoToday = () => import.meta.env.VITE_TODAY || new Date().toISOString().slice(0, 10);
export const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", blocked: "Blocked", done: "Done" };
export const RULE_LABEL = { behind_pace: "Behind pace", overdue: "Overdue", missing_proof: "Missing proof", blocked: "Blocked", due_soon: "Due soon" };
export const RULE_WHY = {
  behind_pace: "Progress is 15 or more points below where it should be today. This closes itself when the gap recovers.",
  overdue: "Past its due date and not done. After 2 days it escalates to the project manager.",
  missing_proof: "Someone tried to complete this without the required proof. It does not count until the proof is attached.",
  blocked: "This waits on another activity that is past due. Nothing here can finish until that is done.",
  due_soon: "Due within 3 days and not started. The owner has been reminded.",
};
export const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
