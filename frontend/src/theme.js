// Light and dark mode. The choice is remembered per browser; first visit follows the device setting.
const KEY = "kept_theme";
export function currentTheme() {
  try { const t = localStorage.getItem(KEY); if (t === "light" || t === "dark") return t; } catch { /* storage blocked */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  window.dispatchEvent(new Event("kept:theme"));
}
export const initTheme = () => document.documentElement.setAttribute("data-theme", currentTheme());
