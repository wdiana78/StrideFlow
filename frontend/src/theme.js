// White-label theming: an organization's brand colours (Website > Site settings) restyle the whole workspace.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const VALID = /^#[0-9a-fA-F]{6}$/;

export function applyBrand(primary, accent) {
  const p = VALID.test(primary || "") ? primary : "#2C3D9B";
  const a = VALID.test(accent || "") ? accent : "#F2B33D";
  const r = document.documentElement.style;
  r.setProperty("--cobalt", p);
  r.setProperty("--cobalt-dark", mix(p, "#000000", 0.28));
  r.setProperty("--cobalt-tint", mix(p, "#FFFFFF", 0.9));
  r.setProperty("--cobalt-soft", mix(p, "#FFFFFF", 0.55));
  r.setProperty("--brand-deep", mix(p, "#000000", 0.45));
  r.setProperty("--accent", a);
  r.setProperty("--accent-tint", mix(a, "#FFFFFF", 0.82));
  r.setProperty("--accent-ink", mix(a, "#000000", 0.55));
}
export const resetBrand = () => applyBrand("#2C3D9B", "#F2B33D");
