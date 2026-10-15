import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, fileUrl, PREVIEW } from "../api";
import { downscale, flush, locate, newClientId, outbox, queue, send } from "../field";
import { useAuth } from "../auth";
import { Bars, Columns, Donut, PALETTE } from "../components/charts";
import { Empty, ErrorNotice, Field, Loading, Toast } from "../components/ui";
import { fmtDate, fmtNum } from "../format";
import { useApi } from "../hooks";

export const QTYPES = [["select", "Single choice"], ["multi", "Multiple choice"], ["number", "Number"], ["yesno", "Yes or no"], ["rating", "Rating 1 to 5"], ["text", "Short text"], ["textarea", "Long text"], ["date", "Date"], ["gps", "Location (GPS)"], ["photo", "Photo"]];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "q";
export const publicFormUrl = (id) => `${window.location.origin}${window.location.pathname}${PREVIEW ? "#" : ""}/f/${id}`.replace(/([^:])\/\//g, "$1/");

// ---------- list ----------
export function FormsList() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi("/forms");
  return (
    <>
      <div className="page-hero">
        <div className="stack-sm" style={{ gap: 2 }}><h1>Data collection</h1><span className="muted">Surveys, registers and checklists with instant charts.</span></div>
        {can.manage && <Link className="btn btn-accent" to="/app/forms/new">+ New form</Link>}
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : !data.length ? <div className="panel"><Empty title="No forms yet" action={can.manage && <Link className="btn btn-primary" to="/app/forms/new">Build your first form</Link>} /></div> : (
        <div className="tile-grid">
          {data.map((f, i) => (
            <div key={f.id} className="tile">
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <div className="stack-sm" style={{ gap: 2 }}><b style={{ fontSize: 17 }}>{f.title}</b><span className="small muted">{f.project_name || "No programme"} · {f.fields.length} questions</span></div>
                <span className="chip-tone" style={{ background: f.is_public ? "#E3F3EA" : "var(--stone)", color: f.is_public ? "var(--ok)" : "var(--slate)" }}>{f.is_public ? "Public link" : "Staff only"}</span>
              </div>
              <div className="row" style={{ gap: 6, alignItems: "baseline" }}><b style={{ fontSize: 34, color: PALETTE[i % PALETTE.length] }}>{fmtNum(f.responses)}</b><span className="muted">responses{f.last_response_at ? ` · last ${fmtDate(f.last_response_at)}` : ""}</span></div>
              <div className="row wrap">
                <Link className="btn btn-primary" to={`/app/forms/${f.id}`}>Analyse</Link>
                <Link className="btn" to={`/app/forms/${f.id}?tab=collect`}>Collect</Link>
                {can.manage && <Link className="btn btn-ghost" to={`/app/forms/${f.id}/edit`}>Edit</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- builder ----------
export function FormBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", project_id: "", is_public: false, status: "open", target: "", collect_gps: false, fields: [] });
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/options/projects").then(setProjects).catch(() => {});
    if (id) api(`/forms/${id}`).then((f) => setForm({ ...f, project_id: f.project_id || "", target: f.target ?? "", fields: f.fields.map((q) => ({ ...q, optionsText: (q.options || []).join("\n") })) })).catch(setError);
  }, [id]);
  const add = (type) => {
    const n = form.fields.length + 1;
    setForm({ ...form, fields: [...form.fields, { id: `q${n}_${Date.now() % 1000}`, label: "", type, required: false, optionsText: type === "select" || type === "multi" ? "Option A\nOption B" : "", min: null, max: null }] });
  };
  const upd = (i, patch) => setForm({ ...form, fields: form.fields.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const move = (i, d) => { const f = [...form.fields]; const j = i + d; if (j < 0 || j >= f.length) return; [f[i], f[j]] = [f[j], f[i]]; setForm({ ...form, fields: f }); };
  const save = async () => {
    setBusy(true); setError(null);
    const used = new Set(); const rename = {};
    const fields = form.fields.map((q) => {
      let qid = q.id && !id ? slug(q.label || q.id) : q.id || slug(q.label);
      while (used.has(qid)) qid += "_2";
      used.add(qid); rename[q.id] = qid;
      return { id: qid, label: q.label, type: q.type, required: !!q.required, options: (q.optionsText || "").split("\n").map((o) => o.trim()).filter(Boolean),
        min: q.min === "" || q.min == null ? null : Number(q.min), max: q.max === "" || q.max == null ? null : Number(q.max),
        show_if: q.show_if?.field ? { field: rename[q.show_if.field] || q.show_if.field, equals: q.show_if.equals } : null };
    });
    try {
      const body = { title: form.title, description: form.description, project_id: form.project_id || null, is_public: form.is_public, status: form.status,
        target: form.target ? Number(form.target) : null, collect_gps: !!form.collect_gps, fields };
      const f = id ? await api(`/forms/${id}`, { method: "PUT", body }) : await api("/forms", { method: "POST", body });
      nav(`/app/forms/${f.id}`);
    } catch (e) { setError(e); setBusy(false); }
  };
  return (
    <>
      <div className="spread"><h1 className="page-title">{id ? "Edit form" : "New form"}</h1>
        <div className="row"><Link className="btn" to={id ? `/app/forms/${id}` : "/app/forms"}>Cancel</Link><button className="btn btn-primary" disabled={busy || !form.title || !form.fields.length} onClick={save}>{busy ? "Saving…" : "Save form"}</button></div></div>
      <ErrorNotice error={error} />
      <div className="two-col">
        <div className="wide stack">
          <section className="panel panel-body stack">
            <Field label="Form title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Outreach exit survey" /></Field>
            <Field label="Description" hint="Optional"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="form-grid">
              <Field label="Programme"><select className="select" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
              <Field label="Status"><select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="open">Open: collecting</option><option value="draft">Draft</option><option value="closed">Closed</option></select></Field>
            </div>
            <div className="form-grid">
              <Field label="Target responses" hint="Optional. Shown on the live tracker"><input className="input" type="number" min="1" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="600" /></Field>
              <div className="stack-sm" style={{ justifyContent: "flex-end", gap: 10 }}>
                <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /><span>Public link, no sign-in needed</span></label>
                <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={!!form.collect_gps} onChange={(e) => setForm({ ...form, collect_gps: e.target.checked })} /><span>Record the collector's location with every response</span></label>
              </div>
            </div>
          </section>
          {form.fields.map((q, i) => (
            <section key={i} className="q-card">
              <div className="spread">
                <b>Question {i + 1}</b>
                <div className="row">
                  <button className="btn btn-icon btn-ghost" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                  <button className="btn btn-icon btn-ghost" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                  <button className="btn btn-icon btn-ghost-danger" aria-label="Remove question" onClick={() => setForm({ ...form, fields: form.fields.filter((_, k) => k !== i) })}>✕</button>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Question"><input className="input" value={q.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="How useful was the session?" /></Field>
                <Field label="Type"><select className="select" value={q.type} onChange={(e) => upd(i, { type: e.target.value })}>{QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              </div>
              {(q.type === "select" || q.type === "multi") && <Field label="Choices" hint="One per line"><textarea className="textarea" rows={3} value={q.optionsText} onChange={(e) => upd(i, { optionsText: e.target.value })} /></Field>}
              {q.type === "number" && <div className="form-grid"><Field label="Lowest" hint="Optional"><input className="input" type="number" value={q.min ?? ""} onChange={(e) => upd(i, { min: e.target.value })} /></Field><Field label="Highest" hint="Optional"><input className="input" type="number" value={q.max ?? ""} onChange={(e) => upd(i, { max: e.target.value })} /></Field></div>}
              <ShowIfEditor q={q} prior={form.fields.slice(0, i)} onChange={(show_if) => upd(i, { show_if })} />
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={!!q.required} onChange={(e) => upd(i, { required: e.target.checked })} />Required</label>
            </section>
          ))}
          <div className="panel panel-body stack-sm">
            <b>Add a question</b>
            <div className="row wrap">{QTYPES.map(([v, l]) => <button key={v} className="btn" onClick={() => add(v)}>{l}</button>)}</div>
          </div>
        </div>
        <aside className="narrow panel panel-body stack" style={{ position: "sticky", top: 16 }}>
          <span className="small muted">Preview</span>
          <b style={{ fontSize: 20 }}>{form.title || "Untitled form"}</b>
          <FormFields fields={form.fields.map((q) => ({ ...q, options: (q.optionsText || "").split("\n").filter((o) => o.trim()) }))} values={{}} onChange={() => {}} disabled />
        </aside>
      </div>
    </>
  );
}

function ShowIfEditor({ q, prior, onChange }) {
  const sources = prior.filter((p) => ["select", "multi", "yesno"].includes(p.type));
  if (!sources.length) return null;
  const src = sources.find((p) => p.id === q.show_if?.field);
  const values = src ? (src.type === "yesno" ? ["yes", "no"] : (src.optionsText || "").split("\n").map((o) => o.trim()).filter(Boolean)) : [];
  return (
    <div className="form-grid">
      <Field label="Show only if" hint="Optional skip logic">
        <select className="select" value={q.show_if?.field || ""} onChange={(e) => { const p2 = sources.find((x) => x.id === e.target.value); onChange(p2 ? { field: p2.id, equals: p2.type === "yesno" ? "yes" : (p2.optionsText || "").split("\n")[0]?.trim() || "" } : null); }}>
          <option value="">Always show</option>{sources.map((p) => <option key={p.id} value={p.id}>{p.label || "Untitled question"}</option>)}
        </select>
      </Field>
      {src && <Field label="is answered"><select className="select" value={q.show_if.equals} onChange={(e) => onChange({ ...q.show_if, equals: e.target.value })}>{values.map((v) => <option key={v} value={v}>{src.type === "yesno" ? (v === "yes" ? "Yes" : "No") : v}</option>)}</select></Field>}
    </div>
  );
}

// ---------- shared renderer ----------
export const visibleQ = (q, values) => {
  const c = q.show_if; if (!c) return true; const v = values[c.field];
  if (Array.isArray(v)) return v.includes(c.equals);
  if (v === true || v === false) return c.equals === (v ? "yes" : "no");
  return v !== undefined && v !== null && String(v) === c.equals;
};

function GpsInput({ value, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const capture = async () => { setBusy(true); setErr(""); try { onChange(await locate()); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <div className="stack-sm" style={{ gap: 6 }}>
      <div className="row wrap" style={{ gap: 10 }}>
        <button type="button" className="btn" disabled={disabled || busy} onClick={capture}>{busy ? "Finding location..." : value ? "Capture again" : "Capture location"}</button>
        {value && <span className="small">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}{value.accuracy ? ` (within ${Math.round(value.accuracy)} m)` : ""}</span>}
      </div>
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

function PhotoInput({ value, onChange, disabled, uploadPath }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    setBusy(true); setErr("");
    try { const small = await downscale(file); const form = new FormData(); form.append("file", small); onChange(await api(uploadPath, { method: "POST", form })); }
    catch (er) { setErr(er.message || "Could not upload the photo."); } finally { setBusy(false); }
  };
  return (
    <div className="stack-sm" style={{ gap: 6 }}>
      <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
        {value?.url && <img src={fileUrl(value.url)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--rule)" }} />}
        <label className="btn" aria-disabled={disabled || busy} style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
          {busy ? "Uploading..." : value ? "Replace photo" : "Take or choose a photo"}
          <input type="file" accept="image/*" capture="environment" hidden disabled={disabled || busy} onChange={pick} />
        </label>
        {value && !disabled && <button type="button" className="btn btn-ghost" onClick={() => onChange(null)}>Remove</button>}
      </div>
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

export function FormFields({ fields, values, onChange, errors = {}, disabled, uploadPath = "/uploads" }) {
  return fields.filter((q) => disabled || visibleQ(q, values)).map((q) => (
    <Field key={q.id} label={q.label || "Question"} hint={q.required ? undefined : "Optional"} error={errors[q.id]}>
      {q.type === "select" ? (
        <div className="row wrap" role="radiogroup" aria-label={q.label}>{q.options.map((o) => <button type="button" disabled={disabled} key={o} className="chip" aria-pressed={values[q.id] === o} onClick={() => onChange(q.id, o)}>{o}</button>)}</div>
      ) : q.type === "multi" ? (
        <div className="row wrap">{q.options.map((o) => { const on = (values[q.id] || []).includes(o); return <button type="button" disabled={disabled} key={o} className="chip" aria-pressed={on} onClick={() => onChange(q.id, on ? values[q.id].filter((x) => x !== o) : [...(values[q.id] || []), o])}>{o}</button>; })}</div>
      ) : q.type === "rating" ? (
        <div className="row" role="radiogroup" aria-label={q.label}>{[1, 2, 3, 4, 5].map((n) => <button type="button" disabled={disabled} key={n} className="chip" aria-label={`${n} of 5`} aria-pressed={values[q.id] === n} onClick={() => onChange(q.id, n)} style={{ minWidth: 44, justifyContent: "center" }}>{n}</button>)}</div>
      ) : q.type === "yesno" ? (
        <div className="row">{[["yes", "Yes"], ["no", "No"]].map(([v, l]) => <button type="button" disabled={disabled} key={v} className="chip" aria-pressed={values[q.id] === v} onClick={() => onChange(q.id, v)}>{l}</button>)}</div>
      ) : q.type === "gps" ? (
        <GpsInput value={values[q.id]} disabled={disabled} onChange={(v) => onChange(q.id, v)} />
      ) : q.type === "photo" ? (
        <PhotoInput value={values[q.id]} disabled={disabled} uploadPath={uploadPath} onChange={(v) => onChange(q.id, v)} />
      ) : q.type === "textarea" ? (
        <textarea className="textarea" rows={3} disabled={disabled} value={values[q.id] || ""} onChange={(e) => onChange(q.id, e.target.value)} />
      ) : (
        <input className="input" disabled={disabled} type={q.type === "number" ? "number" : q.type === "date" ? "date" : "text"} inputMode={q.type === "number" ? "numeric" : undefined} min={q.min ?? undefined} max={q.max ?? undefined} value={values[q.id] ?? ""} onChange={(e) => onChange(q.id, e.target.value)} />
      )}
    </Field>
  ));
}

// Offline-first collection, used by staff in the app and by field teams on the public link.
function useOutbox(formId, path) {
  const [pending, setPending] = useState(() => outbox(formId).length);
  const [syncing, setSyncing] = useState(false);
  const sync = async () => { if (!outbox(formId).length) return; setSyncing(true); await flush(formId, path); setPending(outbox(formId).length); setSyncing(false); };
  useEffect(() => { sync(); const on = () => sync(); window.addEventListener("online", on); const t = setInterval(sync, 20000); return () => { window.removeEventListener("online", on); clearInterval(t); }; }, [formId]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (entry) => {
    const r = await send(path, entry);
    if (r.ok || r.error) return r;
    queue(formId, entry); setPending(outbox(formId).length); return { ok: true, queued: true };
  };
  return { pending, syncing, sync, submit };
}

function CollectForm({ f, path, uploadPath, collectorDefault = "", askCollector, onSaved }) {
  const [values, setValues] = useState({});
  const [collector, setCollector] = useState(() => { try { return localStorage.getItem("kept_collector") || collectorDefault; } catch { return collectorDefault; } });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const box = useOutbox(f.id, path);
  const fieldErr = err?.data?.detail?.field ? { [err.data.detail.field]: err.message } : {};
  const submit = async () => {
    setBusy(true); setErr(null); setNote("");
    let location = null;
    if (f.collect_gps && !f.fields.some((q) => q.type === "gps" && values[q.id])) { try { location = await locate({ timeout: 8000 }); } catch { /* sent without a location */ } }
    if (askCollector) { try { localStorage.setItem("kept_collector", collector); } catch { /* ignore */ } }
    const data = Object.fromEntries(Object.entries(values).filter(([k]) => visibleQ(f.fields.find((q) => q.id === k) || {}, values)));
    const r = await box.submit({ data, client_id: newClientId(), collector: collector || undefined, location, captured_at: new Date().toISOString() });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setValues({}); setNote(r.queued ? "No connection. Saved on this device; it will send automatically." : "Response saved.");
    onSaved?.();
  };
  return (
    <div className="stack">
      {(box.pending > 0 || box.syncing) && (
        <div className="notice notice-warn spread"><span>{box.syncing ? "Sending saved responses..." : `${box.pending} response${box.pending > 1 ? "s" : ""} waiting to send from this device.`}</span><button type="button" className="btn" onClick={box.sync} disabled={box.syncing}>Send now</button></div>
      )}
      {note && <div className="notice notice-ok" role="status">{note}</div>}
      {err && !Object.keys(fieldErr).length && <ErrorNotice error={err} />}
      {askCollector && <Field label="Your name" hint="Remembered on this phone"><input className="input" value={collector} onChange={(e) => setCollector(e.target.value)} autoComplete="name" /></Field>}
      <FormFields fields={f.fields} values={values} errors={fieldErr} uploadPath={uploadPath} onChange={(k, v) => setValues({ ...values, [k]: v })} />
      {f.collect_gps && <span className="small muted">Your location is recorded with this response.</span>}
      <div className="row"><button className="btn btn-primary btn-lg" disabled={busy} onClick={submit}>{busy ? "Saving..." : "Submit"}</button><button className="btn btn-ghost" onClick={() => setValues({})}>Clear</button></div>
    </div>
  );
}

// ---------- detail: analytics, responses, collect, share ----------
export function FormDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") || "live");
  const [ver, setVer] = useState(0);
  const { data: f, error, loading } = useApi(`/forms/${id}`, null, [ver]);
  const { data: subs, reload } = useApi(`/forms/${id}/submissions`, null, [ver]);
  const [filter, setFilter] = useState({ q: "", v: "" });
  const [toast, setToast] = useState("");
  const rows = useMemo(() => (subs?.items || []).filter((s) => !filter.q || !filter.v || String(Array.isArray(s.data[filter.q]) ? s.data[filter.q].join("|") : s.data[filter.q]).split("|").includes(filter.v)), [subs, filter]);
  if (loading && !f) return <Loading rows={8} />;
  if (error) return <ErrorNotice error={error} />;
  const choiceQs = f.fields.filter((q) => q.type === "select");
  const csv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Submitted", "Collector", "Source", "Latitude", "Longitude", ...f.fields.map((q) => q.label)];
    const lines = [head.map(esc).join(","), ...rows.map((s) => [s.captured_at || s.created_at, s.collector, s.source, s.location?.lat, s.location?.lng, ...f.fields.map((q) => fmtAnswer(s.data[q.id]))].map(esc).join(","))];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = `${slug(f.title)}.csv`; a.click();
  };
  const del = async () => { if (!confirm(`Delete "${f.title}" and all ${f.responses} responses?`)) return; await api(`/forms/${id}`, { method: "DELETE" }); nav("/app/forms"); };
  return (
    <>
      <div className="page-hero">
        <div className="stack-sm" style={{ gap: 2 }}><span className="muted small">{f.project_name || "Data collection"}</span><h1>{f.title}</h1><span className="muted">{fmtNum(f.responses)} responses · {f.fields.length} questions · {f.is_public ? "public link on" : "staff only"}</span></div>
        <div className="row wrap">
          <button className="btn btn-primary" onClick={() => setTab("collect")}>Add response</button>
          <button className="btn" onClick={csv}>Export CSV</button>
          {can.manage && <Link className="btn" to={`/app/forms/${id}/edit`}>Edit</Link>}
          {can.admin && <button className="btn" onClick={del}>Delete</button>}
        </div>
      </div>
      <div className="tabs" role="tablist">
        {[["live", "Live tracker"], ["analytics", "Analytics"], ["responses", "Responses"], ["collect", "Collect"], ["import", "Import"], ["share", "Share"]].map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {(tab === "analytics" || tab === "responses") && choiceQs.length > 0 && (
        <div className="row wrap" style={{ gap: 10 }}>
          <span className="small strong">Filter responses</span>
          <select className="select" style={{ width: "auto" }} value={filter.q} onChange={(e) => setFilter({ q: e.target.value, v: "" })}><option value="">No filter</option>{choiceQs.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</select>
          {filter.q && <select className="select" style={{ width: "auto" }} value={filter.v} onChange={(e) => setFilter({ ...filter, v: e.target.value })}><option value="">Any</option>{f.fields.find((q) => q.id === filter.q).options.map((o) => <option key={o}>{o}</option>)}</select>}
          {filter.v && <span className="small muted">{rows.length} of {subs.total} responses</span>}
        </div>
      )}
      {tab === "analytics" && (rows.length === 0 ? <div className="panel"><Empty title="No responses yet" action={<button className="btn btn-primary" onClick={() => setTab("collect")}>Add the first response</button>} /></div> : (
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          {f.fields.map((q, i) => <QuestionChart key={q.id} q={q} rows={rows} color={PALETTE[i % PALETTE.length]} />)}
        </div>
      ))}
      {tab === "responses" && <Responses f={f} rows={rows} canDelete={can.manage} onDeleted={() => { reload(); setVer((v) => v + 1); setToast("Response deleted"); }} />}
      {tab === "live" && <Tracker f={f} onNew={() => reload()} />}
      {tab === "collect" && <Collect f={f} onSaved={() => { setVer((v) => v + 1); }} />}
      {tab === "import" && <ImportPanel f={f} canManage={can.manage} onDone={() => { setVer((v) => v + 1); setToast("Import finished"); }} />}
      {tab === "share" && (
        <section className="panel panel-body stack">
          {f.is_public ? (
            <>
              <b>Public link</b>
              <div className="row wrap"><input className="input" readOnly value={publicFormUrl(f.id)} style={{ flex: 1, minWidth: 260 }} onFocus={(e) => e.target.select()} />
                <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(publicFormUrl(f.id)); setToast("Link copied"); }}>Copy link</button>
                <Link className="btn" to={`/f/${f.id}`}>Open form</Link></div>
              <span className="small muted">Share on WhatsApp or print as a QR poster at events. Responses arrive here instantly; spam is rate-limited.</span>
            </>
          ) : <Empty title="This form is staff-only" action={can.manage && <Link className="btn btn-primary" to={`/app/forms/${f.id}/edit`}>Turn on the public link</Link>} />}
        </section>
      )}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}

function QuestionChart({ q, rows, color }) {
  const vals = rows.map((r) => r.data[q.id]).filter((v) => v !== undefined && v !== null && v !== "");
  const n = vals.length;
  let body;
  if (q.type === "select" || q.type === "multi") {
    const counts = {}; q.options.forEach((o) => { counts[o] = 0; });
    vals.forEach((v) => (Array.isArray(v) ? v : [v]).forEach((x) => { counts[x] = (counts[x] || 0) + 1; }));
    const data = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    body = q.type === "select" && data.length <= 4 ? <Donut data={data} size={140} /> : <Bars data={data} format={(v) => `${v} · ${n ? Math.round((v / n) * 100) : 0}%`} />;
  } else if (q.type === "rating") {
    const avg = vals.reduce((s, v) => s + Number(v), 0) / (n || 1);
    body = <><div className="row" style={{ gap: 10 }}><b style={{ fontSize: 30, color }}>{avg.toFixed(1)}</b><span style={{ color: "var(--accent)", fontSize: 20 }}>{"★".repeat(Math.round(avg))}<span style={{ color: "#D5DBD7" }}>{"★".repeat(5 - Math.round(avg))}</span></span><span className="muted small">average of {n}</span></div>
      <Columns data={[1, 2, 3, 4, 5].map((k) => ({ label: `${k}★`, value: vals.filter((v) => Number(v) === k).length }))} colors={["#E4E4E7", "#C4BEF6", "#7C6FE6", "#5B4CDB", "#18181B"]} format={fmtNum} height={150} /></>;
  } else if (q.type === "yesno") {
    const yes = vals.filter((v) => v === true).length;
    body = <Donut data={[{ label: "Yes", value: yes }, { label: "No", value: n - yes }]} colors={["#5B4CDB", "#E4E4E7"]} size={140} center={`${n ? Math.round((yes / n) * 100) : 0}%`} sub="said yes" />;
  } else if (q.type === "number") {
    const ns = vals.map(Number); const mn = Math.min(...ns), mx = Math.max(...ns), avg = ns.reduce((s, v) => s + v, 0) / (n || 1);
    const step = (mx - mn) / 5 || 1;
    const bins = Array.from({ length: 5 }, (_, k) => ({ label: `${Math.round(mn + k * step)}–${Math.round(mn + (k + 1) * step)}`, value: ns.filter((v) => v >= mn + k * step && (k === 4 ? v <= mx : v < mn + (k + 1) * step)).length }));
    body = <><div className="row wrap" style={{ gap: 18 }}>{[["Average", avg], ["Lowest", mn], ["Highest", mx], ["Total", ns.reduce((s, v) => s + v, 0)]].map(([l, v]) => <span key={l}><span className="small muted">{l}</span><br /><b style={{ fontSize: 20, color }}>{fmtNum(Math.round(v * 10) / 10)}</b></span>)}</div><Columns data={bins} format={fmtNum} height={140} colors={[color]} /></>;
  } else if (q.type === "gps") {
    body = <span>{n} responses have a location. See the map in Live tracker.</span>;
  } else if (q.type === "photo") {
    body = <div className="row wrap" style={{ gap: 8 }}>{vals.slice(0, 8).map((v, k) => <a key={k} href={fileUrl(v.url)} target="_blank" rel="noreferrer"><img src={fileUrl(v.url)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6 }} /></a>)}</div>;
  } else {
    body = <div className="stack-sm">{vals.slice(0, 6).map((v, k) => <div key={k} style={{ background: "var(--stone)", borderRadius: 8, padding: "8px 12px", fontSize: 14 }}>“{String(v)}”</div>)}{n > 6 && <span className="small muted">+{n - 6} more in Responses</span>}</div>;
  }
  return (
    <section className="panel panel-body stack-sm">
      <div className="spread" style={{ alignItems: "flex-start" }}><b style={{ fontSize: 15 }}>{q.label}</b><span className="small muted">{n} answers</span></div>
      {n ? body : <span className="small muted">No answers yet.</span>}
    </section>
  );
}

function Responses({ f, rows, canDelete, onDeleted }) {
  const [page, setPage] = useState(1);
  const show = rows.slice((page - 1) * 20, page * 20);
  const fmt = fmtAnswer;
  return (
    <section className="panel">
      <div className="table-wrap"><table className="table" style={{ minWidth: 200 + f.fields.length * 140 }}>
        <thead><tr><th>Date</th><th>Collector</th>{f.fields.map((q) => <th key={q.id}>{q.label.length > 28 ? q.label.slice(0, 27) + "…" : q.label}</th>)}<th /></tr></thead>
        <tbody>{show.map((s) => (
          <tr key={s.id}>
            <td style={{ whiteSpace: "nowrap" }}>{fmtDate(s.created_at)}</td><td className="muted">{s.collector || (s.source === "public" ? "Public link" : s.submitted_by)}</td>
            {f.fields.map((q) => <td key={q.id}>{q.type === "rating" && s.data[q.id] ? <span style={{ color: "var(--accent)" }}>{"★".repeat(s.data[q.id])}</span> : String(fmt(s.data[q.id]))}</td>)}
            <td>{canDelete && <button className="btn btn-icon btn-ghost-danger" aria-label="Delete response" onClick={async () => { if (confirm("Delete this response?")) { await api(`/forms/${f.id}/submissions/${s.id}`, { method: "DELETE" }); onDeleted(); } }}>✕</button>}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="pager"><span>{rows.length} responses</span><div className="row"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn" disabled={page * 20 >= rows.length} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </section>
  );
}

function Collect({ f, onSaved }) {
  const { user } = useAuth();
  if (f.status !== "open") return <div className="panel"><Empty title="This form is not collecting responses" /></div>;
  return <section className="panel panel-body" style={{ maxWidth: 720 }}><CollectForm f={f} path={`/forms/${f.id}/submissions`} uploadPath="/uploads" collectorDefault={user.full_name} onSaved={onSaved} /></section>;
}

export function PublicForm() {
  const { id } = useParams();
  const { data: f, error, loading } = useApi(`/public/forms/${id}`);
  if (loading && !f) return <div style={{ padding: 40 }}><Loading /></div>;
  if (error) return <div style={{ padding: 40 }}><Empty title="This form is not available" /></div>;
  return (
    <div style={{ minHeight: "100%", background: "var(--bg)", padding: "32px 16px 64px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }} className="stack">
        <div className="stack-sm" style={{ gap: 6 }}>
          <span className="small" style={{ color: f.brand.primary, fontWeight: 600 }}>{f.organization}</span>
          <h1 className="page-title">{f.title}</h1>
          {f.description && <p className="muted">{f.description}</p>}
        </div>
        <section className="panel panel-body"><CollectForm f={f} path={`/public/forms/${id}`} uploadPath={`/public/forms/${id}/photo`} askCollector /></section>
        <p className="small muted">Works without signal: responses are kept on this phone and sent when you are back online.</p>
      </div>
    </div>
  );
}

// ---------- live tracker ----------
export const fmtAnswer = (v) => (v === undefined || v === null ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "object" ? (v.url ? v.name || "photo" : v.lat !== undefined ? `${v.lat}, ${v.lng}` : "") : String(v));
const ago = (iso, now) => { const s2 = Math.max(0, Math.round((now - new Date(iso)) / 1000)); return s2 < 60 ? `${s2}s ago` : s2 < 3600 ? `${Math.round(s2 / 60)} min ago` : s2 < 86400 ? `${Math.round(s2 / 3600)} h ago` : fmtDate(iso); };

function Tracker({ f, onNew }) {
  const [by, setBy] = useState("");
  const [t, setT] = useState(null);
  const [err, setErr] = useState(null);
  const [fresh, setFresh] = useState(new Set());
  const [checked, setChecked] = useState(Date.now());
  const [sim, setSim] = useState(false);
  const last = useRef(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const data = await api(`/forms/${f.id}/tracker`, { params: by ? { by } : {} });
        if (stop) return;
        if (last.current && data.total > last.current) { const ids = new Set(data.latest.slice(0, data.total - last.current).map((r) => r.id)); setFresh(ids); onNew?.(); setTimeout(() => setFresh(new Set()), 6000); }
        last.current = data.total; setT(data); setErr(null); setChecked(Date.now());
      } catch (e) { if (!stop) setErr(e); }
    };
    tick(); const iv = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(iv); };
  }, [f.id, by]); // eslint-disable-line react-hooks/exhaustive-deps
  // Preview only: pretend a field team is out collecting, so the live view can be demonstrated.
  useEffect(() => {
    if (!sim) return undefined;
    const officers = ["Baraka Katana", "Neema Kazungu", "Juma Mwangome"];
    const iv = setInterval(() => {
      const data = {};
      for (const q of f.fields) {
        if (q.type === "select") data[q.id] = q.options[Math.floor(Math.random() * q.options.length)];
        else if (q.type === "number") data[q.id] = Math.max(q.min ?? 0, Math.floor(10 + Math.random() * 50));
        else if (q.type === "yesno") data[q.id] = Math.random() < 0.3 ? "yes" : "no";
        else if (q.type === "rating") data[q.id] = 3 + Math.floor(Math.random() * 3);
      }
      for (const q of f.fields) if (q.show_if && !visibleQ(q, data)) delete data[q.id];
      if (data.female !== undefined && data.reached !== undefined) data.female = Math.floor(data.reached * 0.55);
      const pts = t?.points || []; const base = pts[Math.floor(Math.random() * pts.length)] || { lat: -3.63, lng: 39.85 };
      api(`/forms/${f.id}/submissions`, { method: "POST", body: { data, client_id: newClientId(), collector: officers[Math.floor(Math.random() * 3)], location: { lat: base.lat + (Math.random() - 0.5) * 0.01, lng: base.lng + (Math.random() - 0.5) * 0.01, accuracy: 10 } } }).catch(() => {});
    }, 3500);
    return () => clearInterval(iv);
  }, [sim, t, f]);
  if (err && !t) return <ErrorNotice error={err} />;
  if (!t) return <Loading rows={6} />;
  const pct = t.target ? Math.min(100, Math.round((t.total / t.target) * 100)) : null;
  const leader = t.collectors[0];
  return (
    <div className="stack">
      <div className="spread">
        <span className="row small muted" style={{ gap: 8 }}><span className="live-dot" aria-hidden="true" />Live. Checked {ago(new Date(checked).toISOString(), Date.now())}, refreshes every 5 seconds.</span>
        {PREVIEW && <button className="btn" onClick={() => setSim(!sim)}>{sim ? "Stop field team simulation" : "Simulate a field team"}</button>}
      </div>
      <div className="tracker-kpis">
        <div><span>Today</span><b>{fmtNum(t.today)}</b></div>
        <div><span>Last 7 days</span><b>{fmtNum(t.week)}</b></div>
        <div><span>All responses</span><b>{fmtNum(t.total)}</b></div>
        <div><span>{t.target ? `Target ${fmtNum(t.target)}` : "With location"}</span><b>{t.target ? `${pct}%` : fmtNum(t.with_location)}</b>{t.target && <div className="tz-progress" style={{ marginTop: 8 }}><span style={{ width: `${pct}%`, background: "var(--cobalt)" }} /></div>}</div>
      </div>
      <div className="two-col">
        <section className="wide panel panel-body stack-sm">
          <div className="spread"><h2 className="card-title">Responses per day</h2><span className="small muted">{fmtDate(t.per_day[0].date)} to {fmtDate(t.per_day[t.per_day.length - 1].date)}</span></div>
          <Columns data={t.per_day.map((d) => ({ label: String(Number(d.date.slice(8, 10))), value: d.count }))} format={fmtNum} highlightLast />
        </section>
        <section className="narrow panel">
          <div className="panel-head"><h2>Collectors</h2>{leader && <span className="small muted">{leader.name.split(" ")[0]} leads</span>}</div>
          <table className="table"><thead><tr><th>Name</th><th style={{ textAlign: "right" }}>Today</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>{t.collectors.map((c) => <tr key={c.name}><td>{c.name}</td><td style={{ textAlign: "right" }}>{c.today}</td><td style={{ textAlign: "right" }}>{c.total}</td></tr>)}</tbody></table>
        </section>
      </div>
      <div className="two-col">
        <section className="wide panel panel-body stack-sm">
          <div className="spread"><h2 className="card-title">Where responses come from</h2><span className="small muted">{fmtNum(t.with_location)} with location</span></div>
          <PointsMap points={t.points} />
        </section>
        <section className="narrow panel panel-body stack-sm">
          <div className="spread"><h2 className="card-title">Breakdown</h2>
            {t.by_options.length > 0 && <select className="select" style={{ width: "auto", minHeight: 34 }} aria-label="Break down by" value={t.by || ""} onChange={(e) => setBy(e.target.value)}>{t.by_options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>}</div>
          {t.breakdown.length ? <Bars data={t.breakdown.map((b) => ({ label: b.label, value: b.count }))} color="var(--cobalt)" /> : <span className="small muted">Add a single-choice question to break responses down.</span>}
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Latest responses</h2><span className="small muted">Newest first</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>When</th><th>Collector</th>{f.fields.filter((q) => !["textarea", "photo", "gps"].includes(q.type)).slice(0, 4).map((q) => <th key={q.id}>{q.label}</th>)}<th>Location</th></tr></thead>
          <tbody>{t.latest.map((r) => (
            <tr key={r.id} className={fresh.has(r.id) ? "row-new" : undefined}>
              <td style={{ whiteSpace: "nowrap" }}>{ago(r.created_at, Date.now())}</td><td>{r.collector || "Public link"}</td>
              {f.fields.filter((q) => !["textarea", "photo", "gps"].includes(q.type)).slice(0, 4).map((q) => <td key={q.id}>{fmtAnswer(r.data[q.id])}</td>)}
              <td>{r.location ? <a href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`} target="_blank" rel="noreferrer">Map</a> : <span className="muted">None</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}

function PointsMap({ points }) {
  const [hover, setHover] = useState(null);
  if (!points.length) return <div className="empty" style={{ padding: 32 }}><span className="muted">No locations yet. Add a location question or turn on automatic location in the form settings.</span></div>;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const pad = 0.02;
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad, minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
  const W = 640, H = 380;
  const X = (lng) => ((lng - minLng) / (maxLng - minLng || 1)) * W, Y = (lat) => H - ((lat - minLat) / (maxLat - minLat || 1)) * H;
  const groups = {}; points.forEach((p) => { (groups[p.label] ||= []).push(p); });
  const labels = Object.keys(groups);
  const colors = ["#5B4CDB", "#18181B", "#3B82F6", "#A39BEF", "#71717A", "#0EA5E9", "#7C6FE6", "#52525B"];
  return (
    <div className="stack-sm">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "var(--surface-2)", borderRadius: 8 }} role="img" aria-label={`${points.length} response locations`}>
        {[0.25, 0.5, 0.75].map((k) => <g key={k} style={{ stroke: "var(--rule)" }}><line x1={0} x2={W} y1={H * k} y2={H * k} /><line y1={0} y2={H} x1={W * k} x2={W * k} /></g>)}
        {labels.map((l, i) => groups[l].map((p, k) => <circle key={`${l}${k}`} cx={X(p.lng)} cy={Y(p.lat)} r="5" fill={colors[i % colors.length]} fillOpacity=".75" stroke="var(--surface)" strokeWidth="1"
          onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} />))}
      </svg>
      <div className="row wrap" style={{ gap: 14 }}>{labels.map((l, i) => <span key={l} className="row small" style={{ gap: 6 }}><span className="dot" style={{ background: colors[i % colors.length] }} />{l || "Unlabelled"}</span>)}</div>
      <span className="small muted">{hover ? `${hover.collector}, ${hover.label || ""} at ${hover.lat.toFixed(4)}, ${hover.lng.toFixed(4)}` : "Hover a point for details. Each response links to Google Maps in the table below."}</span>
    </div>
  );
}

// ---------- import from Google Sheets or Excel (CSV) ----------
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
const norm = (s2) => s2.toLowerCase().replace(/[^a-z0-9]/g, "");

function ImportPanel({ f, canManage, onDone }) {
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState({});
  const [collectorCol, setCollectorCol] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(f.sheet_url || "");
  const [sheetMsg, setSheetMsg] = useState(null);
  if (!canManage) return <div className="panel"><Empty title="Only managers can import responses" /></div>;
  const load = async (file) => {
    setResult(null); setErr(null);
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const all = parseCsv(text); if (all.length < 2) { setErr(new Error("That file has no data rows.")); return; }
    const [head, ...body] = all;
    const m = {}; head.forEach((h, i) => { const q = f.fields.find((x) => [norm(x.id), norm(x.label)].includes(norm(h))); if (q) m[i] = q.id; });
    const c = head.findIndex((h) => ["collector", "enumerator", "collectedby", "nameofenumerator"].includes(norm(h)));
    setRows({ head, body }); setMap(m); setCollectorCol(c >= 0 ? String(c) : "");
  };
  const run = async () => {
    setBusy(true); setErr(null);
    const gpsQ = f.fields.find((q) => q.type === "gps");
    const payload = rows.body.map((r) => {
      const o = {}; Object.entries(map).forEach(([i, qid]) => { if (qid && r[i] !== undefined && r[i] !== "") o[qid] = r[i]; });
      if (collectorCol !== "" && r[collectorCol]) o._collector = r[collectorCol];
      if (gpsQ && !o[gpsQ.id]) delete o[gpsQ.id];
      return o;
    });
    try { setResult(await api(`/forms/${f.id}/import`, { method: "POST", body: { rows: payload } })); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const connect = async () => { setSheetMsg(null); try { await api(`/forms/${f.id}/sheet`, { method: "PUT", body: { url: sheet } }); setSheetMsg({ ok: "Sheet connected. Use Sync now to pull new rows." }); } catch (e) { setSheetMsg({ error: e }); } };
  const syncNow = async () => { setSheetMsg(null); try { const r = await api(`/forms/${f.id}/sheet-sync`, { method: "POST" }); setSheetMsg({ ok: `${r.created} new rows added, ${r.skipped_duplicates} already here${r.failed ? `, ${r.failed} could not be read` : ""}.` }); onDone(); } catch (e) { setSheetMsg({ error: e }); } };
  return (
    <div className="stack">
      <section className="panel panel-body stack">
        <div><h2 className="card-title">Import a spreadsheet</h2><p className="muted small" style={{ marginTop: 4 }}>In Google Sheets choose File, Download, Comma-separated values. In Excel choose Save as CSV. Columns are matched to questions by their names.</p></div>
        <label className="dropzone"><b>Choose a CSV file</b><span className="small">Up to 5,000 rows</span><input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} /></label>
        <ErrorNotice error={err} />
        {rows && !result && (
          <>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Column in your file</th><th>Goes to question</th><th>Example</th></tr></thead>
              <tbody>{rows.head.map((h, i) => (
                <tr key={i}><td>{h}</td>
                  <td><select className="select" style={{ minHeight: 34 }} value={String(collectorCol) === String(i) ? "_collector" : map[i] || ""} onChange={(e) => { const v = e.target.value; if (v === "_collector") { setCollectorCol(String(i)); const m2 = { ...map }; delete m2[i]; setMap(m2); } else { if (String(collectorCol) === String(i)) setCollectorCol(""); setMap({ ...map, [i]: v }); } }}>
                    <option value="">Skip this column</option><option value="_collector">Collector name</option>{f.fields.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                  </select></td>
                  <td className="muted">{rows.body[0]?.[i]}</td></tr>
              ))}</tbody>
            </table></div>
            <div className="row"><button className="btn btn-primary" disabled={busy || !Object.values(map).some(Boolean)} onClick={run}>{busy ? "Importing..." : `Import ${rows.body.length} rows`}</button><button className="btn btn-ghost" onClick={() => setRows(null)}>Cancel</button></div>
          </>
        )}
        {result && (
          <div className="stack-sm">
            <div className="notice notice-ok">{result.created} responses imported{result.skipped_duplicates ? `, ${result.skipped_duplicates} were already here` : ""}.</div>
            {result.failed > 0 && <div className="notice notice-warn"><b>{result.failed} rows were not imported.</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{result.errors.slice(0, 8).map((e) => <li key={e.row}>Row {e.row + 1}: {e.message}</li>)}</ul></div>}
            <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => { setRows(null); setResult(null); }}>Import another file</button>
          </div>
        )}
      </section>
      <section className="panel panel-body stack">
        <div><h2 className="card-title">Keep a Google Sheet in sync</h2><p className="muted small" style={{ marginTop: 4 }}>While the team moves over, connect the sheet they use today. Share it as "Anyone with the link can view". Each sync adds only rows that are new.</p></div>
        <Field label="Google Sheet link"><input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></Field>
        {sheetMsg?.ok && <div className="notice notice-ok">{sheetMsg.ok}</div>}
        <ErrorNotice error={sheetMsg?.error} />
        <div className="row wrap"><button className="btn" onClick={connect} disabled={!sheet}>Connect sheet</button><button className="btn btn-primary" onClick={syncNow} disabled={!f.sheet_url && !sheetMsg?.ok}>Sync now</button>
          {f.sheet_synced_at && <span className="small muted">Last synced {fmtDate(f.sheet_synced_at)}</span>}</div>
      </section>
    </div>
  );
}
