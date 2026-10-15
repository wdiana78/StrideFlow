import SPEC from "./modules.json";
import { fmtDate } from "./format";

export { SPEC };
export const MODS = Object.fromEntries(SPEC.modules.map((m) => [m.key, m]));
export const money = (n) => (n == null ? "" : `KES ${Math.round(Number(n)).toLocaleString()}`);
export const moneyShort = (n) => {
  const v = Number(n || 0);
  return v >= 1e6 ? `KES ${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}M` : v >= 1e3 ? `KES ${Math.round(v / 1e3)}k` : `KES ${v}`;
};
export const statusLabel = (m, v) => (m.status ? Object.fromEntries(m.status.options)[v] || v : v);
export const STATUS_TONE = {
  submitted: "risk", pending: "risk", prospect: "neutral", drafting: "neutral", new: "risk", applicant: "risk", planned: "info", open: "info",
  approved: "ok", awarded: "ok", reporting: "ok", active: "ok", held: "ok", done: "ok", received: "ok", paid: "ok", converted: "ok", good: "ok", contacted: "info", ordered: "info",
  rejected: "bad", declined: "bad", cancelled: "neutral", closed: "neutral", inactive: "neutral", dropped: "neutral", lost: "bad", disposed: "neutral", repair: "risk",
};
export const TONE_COLOR = { ok: "var(--ok)", risk: "var(--risk)", bad: "var(--bad)", info: "var(--cobalt)", neutral: "var(--slate)" };

export function display(f, rec) {
  const v = rec[f.key];
  if (v === null || v === undefined || v === "") return "";
  switch (f.type) {
    case "money": return money(v);
    case "number": return Number(v).toLocaleString();
    case "percent": return `${v}%`;
    case "date": return fmtDate(v, true);
    case "bool": return v ? "Yes" : "No";
    case "select": return Object.fromEntries(f.options)[v] || v;
    case "ref": return rec[`${f.key}_label`] || "";
    case "file": return v.name || "File";
    default: return String(v);
  }
}

export const GROUP_COLOR = { Funding: "#FF6B57", Finance: "#3B2F6B", Sales: "#2E86DE", Procurement: "#FF6B57", Inventory: "#9A73E0", Bookings: "#D4458A", People: "#9A73E0", Participants: "#2E86DE", Operations: "#FF6B57", Governance: "#D4458A", Website: "#FFB020" };
export const NAV = [
  { label: "Funding", items: [["grants", "Grants"], ["donations", "Donations"], ["income", "Income"]] },
  { label: "Finance", items: [["@finance", "Budget against actual"], ["budget_lines", "Budget lines"], ["expenses", "Expenses"]] },
  { label: "Branches", items: [["branches", "Branches"], ["branch_sales", "Daily sales"], ["transfers", "Stock transfers"]] },
  { label: "Deliveries", items: [["deliveries", "Deliveries"]] },
  { label: "Studio", items: [["productions", "Productions"]] },
  { label: "Social media", items: [["posts", "Content calendar"]] },
  { label: "Sales", items: [["customers", "Customers"], ["invoices", "Invoices"]] },
  { label: "Bookings", items: [["bookings", "Bookings"], ["resources", "Rooms and resources"]] },
  { label: "Dining", items: [["reservations", "Table reservations"]] },
  { label: "Tours", items: [["tour_bookings", "Tour bookings"], ["tours", "Tours"], ["guides", "Guides"]] },
  { label: "Procurement", items: [["purchase_requests", "Purchase requests"], ["vendors", "Vendors"]] },
  { label: "Inventory", items: [["items", "Stock"], ["stock_moves", "Stock movements"], ["assets", "Assets"]] },
  { label: "People", items: [["volunteers", "Volunteers"], ["volunteer_hours", "Volunteer hours"], ["leave_requests", "Leave"]] },
  { label: "Participants", items: [["participants", "Participant registry"]] },
  { label: "Operations", items: [["events", "Events"], ["documents", "Documents"], ["inquiries", "Inquiries"]] },
  { label: "Governance", items: [["meetings", "Meetings"], ["decisions", "Decisions and actions"]] },
  { label: "Website", items: [["site_settings", "Site settings and brand"], ["site_programmes", "Programme pages"], ["site_services", "Services"], ["site_stories", "Stories"], ["site_team", "Team"], ["@site", "View public site"]] },
];
