// Field collection helpers: offline queue, location capture and photo downscaling.
// Responses are kept on the device until the server confirms them; each carries a client id so retries never duplicate.
import { api } from "./api";

const KEY = (formId) => `kept_outbox_${formId}`;
const read = (formId) => { try { return JSON.parse(localStorage.getItem(KEY(formId)) || "[]"); } catch { return []; } };
const write = (formId, items) => { try { localStorage.setItem(KEY(formId), JSON.stringify(items)); } catch { /* storage full or blocked */ } };

export const newClientId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
export const outbox = (formId) => read(formId);

export function queue(formId, entry) { write(formId, [...read(formId), entry]); }

// Network failures (no signal) are worth retrying; validation errors are not and are returned to the caller.
const isOffline = (e) => !navigator.onLine || e?.status === undefined || e?.status === 0 || e?.status >= 500 || e?.status === 429;

export async function send(path, entry) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, offline: true }; // no signal: don't wait for a timeout
  try { await api(path, { method: "POST", body: entry }); return { ok: true }; }
  catch (e) { return isOffline(e) ? { ok: false, offline: true } : { ok: false, error: e }; }
}

export async function flush(formId, path) {
  const items = read(formId); let sent = 0; const keep = [];
  if (!items.length || navigator.onLine === false) return { sent: 0, left: items.length };
  for (const it of items) {
    const r = await send(path, it);
    if (r.ok) sent++; else if (r.offline) keep.push(it); // a rejected response is dropped from the queue; it was shown as an error when saved
  }
  write(formId, keep);
  return { sent, left: keep.length };
}

export function locate({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This device cannot share its location.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, accuracy: Math.round(p.coords.accuracy * 10) / 10 }),
      (err) => reject(new Error(err.code === 1 ? "Location permission was refused. Allow it in the browser settings." : "Could not get a location. Move outdoors and try again.")),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}

export async function downscale(file, max = 1280, quality = 0.8) {
  if (!/^image\//.test(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
  return blob ? new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}
