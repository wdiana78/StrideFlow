const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const PREVIEW = import.meta.env.VITE_DEMO === "1";
const TOKEN_KEY = "kept_token";

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
      if (e.status === 401 && tokenStore.get()) { tokenStore.clear(); window.dispatchEvent(new Event("kept:signed-out")); }
      throw new ApiError(e.status || 500, e.message, e.data);
    }
  }
  const url = new URL(`${BASE}/api${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && url.searchParams.set(k, v));
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event("kept:signed-out"));
    }
    const d = data?.detail;
    const message = typeof d === "string" ? d : d?.message || "Something went wrong. Try again.";
    throw new ApiError(res.status, message, data);
  }
  return data;
}
