const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const PREVIEW = import.meta.env.VITE_DEMO === "1";
const TOKEN_KEY = "kept_token"; // preview build only; the real application uses an HttpOnly session cookie

const readCookie = (name) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) || "";
export const signedOutEvent = "strideflow:signed-out";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Absolute URL for an uploaded file path like /files/abc.jpg */
export const fileUrl = (path) => (!path ? null : path.startsWith("data:") ? path : `${BASE}${path}`);

export async function api(path, { method = "GET", body, form, params } = {}) {
  if (PREVIEW) {
    // Hosted preview: the same API, answered by an in-browser port of the backend (src/demo/engine.js).
    const { handle } = await import("./demo/engine");
    try {
      return await handle(method, path, { body, form, params, token: tokenStore.get() });
    } catch (e) {
      if (e.status === 401 && tokenStore.get()) { tokenStore.clear(); window.dispatchEvent(new Event(signedOutEvent)); }
      throw new ApiError(e.status || 500, e.message, e.data);
    }
  }
  const url = new URL(`${BASE}/api${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && url.searchParams.set(k, v));
  const headers = {};
  // Session cookie travels automatically; requests that change data echo the CSRF cookie in a header.
  if (!["GET", "HEAD"].includes(method)) { const csrf = readCookie("sf_csrf"); if (csrf) headers["X-CSRF-Token"] = decodeURIComponent(csrf); }
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, credentials: "include" });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event(signedOutEvent));
    const d = data?.detail;
    const message = typeof d === "string" ? d : d?.message || "Something went wrong. Try again.";
    throw new ApiError(res.status, message, data);
  }
  return data;
}
