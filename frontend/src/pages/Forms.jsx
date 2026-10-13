import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Bars, Columns, Donut, PALETTE } from "../components/charts";
import { Empty, ErrorNotice, Field, Loading, Toast } from "../components/ui";
import { fmtDate, fmtNum } from "../format";
import { useApi } from "../hooks";

export const QTYPES = [["select", "Single choice"], ["multi", "Multiple choice"], ["rating", "Rating 1 to 5"], ["yesno", "Yes / No"], ["number", "Number"], ["text", "Short text"], ["textarea", "Long text"], ["date", "Date"]];
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
            <div key={f.id} className="tile" style={{ borderTop: `5px solid ${PALETTE[i % PALETTE.length]}` }}>
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
  const [form, setForm] = useState({ title: "", description: "", project_id: "", is_public: false, status: "open", fields: [] });
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/options/projects").then(setProjects).catch(() => {});
    if (id) api(`/forms/${id}`).then((f) => setForm({ ...f, project_id: f.project_id || "", fields: f.fields.map((q) => ({ ...q, optionsText: (q.options || []).join("\n") })) })).catch(setError);
  }, [id]);
  const add = (type) => {
    const n = form.fields.length + 1;
    setForm({ ...form, fields: [...form.fields, { id: `q${n}_${Date.now() % 1000}`, label: "", type, required: false, optionsText: type === "select" || type === "multi" ? "Option A\nOption B" : "", min: null, max: null }] });
  };
  const upd = (i, patch) => setForm({ ...form, fields: form.fields.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const move = (i, d) => { const f = [...form.fields]; const j = i + d; if (j < 0 || j >= f.length) return; [f[i], f[j]] = [f[j], f[i]]; setForm({ ...form, fields: f }); };
  const save = async () => {
    setBusy(true); setError(null);
    const used = new Set();
    const fields = form.fields.map((q) => {
      let qid = q.id && !id ? slug(q.label || q.id) : q.id || slug(q.label);
      while (used.has(qid)) qid += "_2";
      used.add(qid);
      return { id: qid, label: q.label, type: q.type, required: !!q.required, options: (q.optionsText || "").split("\n").map((o) => o.trim()).filter(Boolean),
        min: q.min === "" || q.min == null ? null : Number(q.min), max: q.max === "" || q.max == null ? null : Number(q.max) };
    });
    try {
      const body = { title: form.title, description: form.description, project_id: form.project_id || null, is_public: form.is_public, status: form.status, fields };
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
            <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} style={{ width: 18, height: 18 }} /><span><b>Public link</b> <span className="muted">anyone with the link can respond, no sign-in</span></span></label>
          </section>
          {form.fields.map((q, i) => (
            <section key={i} className="q-card" style={{ borderLeft: `5px solid ${PALETTE[i % PALETTE.length]}` }}>
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
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={!!q.required} onChange={(e) => upd(i, { required: e.target.checked })} />Required</label>
            </section>
          ))}
          <div className="panel panel-body stack-sm">
            <b>Add a question</b>
            <div className="row wrap">{QTYPES.map(([v, l], k) => <button key={v} className="btn" style={{ borderColor: PALETTE[k % PALETTE.length], color: PALETTE[k % PALETTE.length] }} onClick={() => add(v)}>+ {l}</button>)}</div>
          </div>
        </div>
        <aside className="narrow panel panel-body stack" style={{ position: "sticky", top: 16 }}>
          <span className="chip-tone" style={{ background: "var(--accent-tint)", color: "var(--accent-ink)", alignSelf: "flex-start" }}>Live preview</span>
          <b style={{ fontSize: 20 }}>{form.title || "Untitled form"}</b>
          <FormFields fields={form.fields.map((q) => ({ ...q, options: (q.optionsText || "").split("\n").filter((o) => o.trim()) }))} values={{}} onChange={() => {}} disabled />
        </aside>
      </div>
    </>
  );
}

// ---------- shared renderer ----------
export function FormFields({ fields, values, onChange, errors = {}, disabled }) {
  return fields.map((q) => (
    <Field key={q.id} label={q.label || "Question"} hint={q.required ? undefined : "Optional"} error={errors[q.id]}>
      {q.type === "select" ? (
        <div className="row wrap" role="radiogroup" aria-label={q.label}>{q.options.map((o) => <button type="button" disabled={disabled} key={o} className="chip" aria-pressed={values[q.id] === o} onClick={() => onChange(q.id, o)}>{o}</button>)}</div>
      ) : q.type === "multi" ? (
        <div className="row wrap">{q.options.map((o) => { const on = (values[q.id] || []).includes(o); return <button type="button" disabled={disabled} key={o} className="chip" aria-pressed={on} onClick={() => onChange(q.id, on ? values[q.id].filter((x) => x !== o) : [...(values[q.id] || []), o])}>{on ? "✓ " : ""}{o}</button>; })}</div>
      ) : q.type === "rating" ? (
        <div className="row" role="radiogroup" aria-label={q.label}>{[1, 2, 3, 4, 5].map((n) => <button type="button" disabled={disabled} key={n} aria-label={`${n} of 5`} aria-pressed={values[q.id] === n} onClick={() => onChange(q.id, n)} style={{ fontSize: 28, background: "none", border: 0, cursor: "pointer", color: values[q.id] >= n ? "var(--accent)" : "#CBD3CE", padding: 2 }}>★</button>)}</div>
      ) : q.type === "yesno" ? (
        <div className="row">{[["yes", "Yes"], ["no", "No"]].map(([v, l]) => <button type="button" disabled={disabled} key={v} className="chip" aria-pressed={values[q.id] === v} onClick={() => onChange(q.id, v)}>{l}</button>)}</div>
      ) : q.type === "textarea" ? (
        <textarea className="textarea" rows={3} disabled={disabled} value={values[q.id] || ""} onChange={(e) => onChange(q.id, e.target.value)} />
      ) : (
        <input className="input" disabled={disabled} type={q.type === "number" ? "number" : q.type === "date" ? "date" : "text"} min={q.min ?? undefined} max={q.max ?? undefined} value={values[q.id] ?? ""} onChange={(e) => onChange(q.id, e.target.value)} />
      )}
    </Field>
  ));
}

// ---------- detail: analytics, responses, collect, share ----------
export function FormDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") || "analytics");
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
    const head = ["Submitted", "Source", ...f.fields.map((q) => q.label)];
    const lines = [head.map(esc).join(","), ...rows.map((s) => [s.created_at, s.source, ...f.fields.map((q) => { const v = s.data[q.id]; return Array.isArray(v) ? v.join("; ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v; })].map(esc).join(","))];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = `${slug(f.title)}.csv`; a.click();
  };
  const del = async () => { if (!confirm(`Delete "${f.title}" and all ${f.responses} responses?`)) return; await api(`/forms/${id}`, { method: "DELETE" }); nav("/app/forms"); };
  return (
    <>
      <div className="page-hero">
        <div className="stack-sm" style={{ gap: 2 }}><span className="muted small">{f.project_name || "Data collection"}</span><h1>{f.title}</h1><span className="muted">{fmtNum(f.responses)} responses · {f.fields.length} questions · {f.is_public ? "public link on" : "staff only"}</span></div>
        <div className="row wrap">
          <button className="btn btn-accent" onClick={() => setTab("collect")}>+ Add response</button>
          <button className="btn" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} onClick={csv}>Export CSV</button>
          {can.manage && <Link className="btn" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} to={`/app/forms/${id}/edit`}>Edit</Link>}
          {can.admin && <button className="btn" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} onClick={del}>Delete</button>}
        </div>
      </div>
      <div className="tabs" role="tablist">
        {[["analytics", "Analytics"], ["responses", "Responses"], ["collect", "Collect"], ["share", "Share"]].map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {(tab === "analytics" || tab === "responses") && choiceQs.length > 0 && (
        <div className="row wrap" style={{ gap: 10 }}>
          <span className="small strong">Filter responses</span>
          <select className="select" style={{ width: "auto" }} value={filter.q} onChange={(e) => setFilter({ q: e.target.value, v: "" })}><option value="">No filter</option>{choiceQs.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</select>
          {filter.q && <select className="select" style={{ width: "auto" }} value={filter.v} onChange={(e) => setFilter({ ...filter, v: e.target.value })}><option value="">Any</option>{f.fields.find((q) => q.id === filter.q).options.map((o) => <option key={o}>{o}</option>)}</select>}
          {filter.v && <span className="chip-tone" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-dark)" }}>{rows.length} of {subs.total} responses</span>}
        </div>
      )}
      {tab === "analytics" && (rows.length === 0 ? <div className="panel"><Empty title="No responses yet" action={<button className="btn btn-primary" onClick={() => setTab("collect")}>Add the first response</button>} /></div> : (
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          {f.fields.map((q, i) => <QuestionChart key={q.id} q={q} rows={rows} color={PALETTE[i % PALETTE.length]} />)}
        </div>
      ))}
      {tab === "responses" && <Responses f={f} rows={rows} canDelete={can.manage} onDeleted={() => { reload(); setVer((v) => v + 1); setToast("Response deleted"); }} />}
      {tab === "collect" && <Collect f={f} onSaved={() => { setVer((v) => v + 1); setToast("Response saved"); }} />}
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
      <Columns data={[1, 2, 3, 4, 5].map((k) => ({ label: `${k}★`, value: vals.filter((v) => Number(v) === k).length }))} colors={["#E4572E", "#EE8A3C", "#F2B33D", "#7CB66A", "#3F9E6B"]} format={fmtNum} height={150} /></>;
  } else if (q.type === "yesno") {
    const yes = vals.filter((v) => v === true).length;
    body = <Donut data={[{ label: "Yes", value: yes }, { label: "No", value: n - yes }]} colors={["#3F9E6B", "#E4572E"]} size={140} center={`${n ? Math.round((yes / n) * 100) : 0}%`} sub="said yes" />;
  } else if (q.type === "number") {
    const ns = vals.map(Number); const mn = Math.min(...ns), mx = Math.max(...ns), avg = ns.reduce((s, v) => s + v, 0) / (n || 1);
    const step = (mx - mn) / 5 || 1;
    const bins = Array.from({ length: 5 }, (_, k) => ({ label: `${Math.round(mn + k * step)}–${Math.round(mn + (k + 1) * step)}`, value: ns.filter((v) => v >= mn + k * step && (k === 4 ? v <= mx : v < mn + (k + 1) * step)).length }));
    body = <><div className="row wrap" style={{ gap: 18 }}>{[["Average", avg], ["Lowest", mn], ["Highest", mx], ["Total", ns.reduce((s, v) => s + v, 0)]].map(([l, v]) => <span key={l}><span className="small muted">{l}</span><br /><b style={{ fontSize: 20, color }}>{fmtNum(Math.round(v * 10) / 10)}</b></span>)}</div><Columns data={bins} format={fmtNum} height={140} colors={[color]} /></>;
  } else {
    body = <div className="stack-sm">{vals.slice(0, 6).map((v, k) => <div key={k} style={{ background: "var(--stone)", borderRadius: 8, padding: "8px 12px", fontSize: 14 }}>“{String(v)}”</div>)}{n > 6 && <span className="small muted">+{n - 6} more in Responses</span>}</div>;
  }
  return (
    <section className="panel panel-body stack-sm" style={{ borderTop: `4px solid ${color}` }}>
      <div className="spread" style={{ alignItems: "flex-start" }}><b style={{ fontSize: 15 }}>{q.label}</b><span className="small muted">{n} answers</span></div>
      {n ? body : <span className="small muted">No answers yet.</span>}
    </section>
  );
}

function Responses({ f, rows, canDelete, onDeleted }) {
  const [page, setPage] = useState(1);
  const show = rows.slice((page - 1) * 20, page * 20);
  const fmt = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v ?? "");
  return (
    <section className="panel">
      <div className="table-wrap"><table className="table" style={{ minWidth: 200 + f.fields.length * 140 }}>
        <thead><tr><th>Date</th><th>By</th>{f.fields.map((q) => <th key={q.id}>{q.label.length > 28 ? q.label.slice(0, 27) + "…" : q.label}</th>)}<th /></tr></thead>
        <tbody>{show.map((s) => (
          <tr key={s.id}>
            <td style={{ whiteSpace: "nowrap" }}>{fmtDate(s.created_at)}</td><td className="muted">{s.source === "public" ? "Public link" : s.submitted_by}</td>
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
  const [values, setValues] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldErr = err?.data?.detail?.field ? { [err.data.detail.field]: err.message } : {};
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await api(`/forms/${f.id}/submissions`, { method: "POST", body: values }); setValues({}); onSaved(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  if (f.status !== "open") return <div className="panel"><Empty title="This form is not collecting responses" /></div>;
  return (
    <section className="panel panel-body stack" style={{ maxWidth: 720 }}>
      {err && !Object.keys(fieldErr).length && <ErrorNotice error={err} />}
      <FormFields fields={f.fields} values={values} errors={fieldErr} onChange={(k, v) => setValues({ ...values, [k]: v })} />
      <div className="row"><button className="btn btn-primary btn-lg" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save response"}</button><button className="btn btn-ghost" onClick={() => setValues({})}>Clear</button></div>
    </section>
  );
}

// ---------- public form ----------
export function PublicForm() {
  const { id } = useParams();
  const { data: f, error, loading } = useApi(`/public/forms/${id}`);
  const [values, setValues] = useState({});
  const [state, setState] = useState({ busy: false, err: null, done: false });
  if (loading && !f) return <div style={{ padding: 40 }}><Loading /></div>;
  if (error) return <div style={{ padding: 40 }}><Empty title="This form is not available" /></div>;
  const fieldErr = state.err?.data?.detail?.field ? { [state.err.data.detail.field]: state.err.message } : {};
  const submit = async () => {
    setState({ busy: true, err: null, done: false });
    try { await api(`/public/forms/${id}`, { method: "POST", body: { ...values, website: "" } }); setState({ busy: false, err: null, done: true }); }
    catch (e) { setState({ busy: false, err: e, done: false }); }
  };
  return (
    <div style={{ minHeight: "100%", background: `linear-gradient(160deg, ${f.brand.primary} 0 260px, #F5F6F3 260px)`, padding: "40px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }} className="stack">
        <div className="stack-sm" style={{ color: "#fff" }}><span style={{ color: f.brand.accent, fontWeight: 700 }}>{f.organization}</span><h1 style={{ fontSize: 30, fontWeight: 800 }}>{f.title}</h1>{f.description && <span style={{ opacity: .85 }}>{f.description}</span>}</div>
        <section className="panel panel-body stack" style={{ boxShadow: "var(--shadow-float)" }}>
          {state.done ? (
            <div className="empty"><div style={{ fontSize: 48 }}>✓</div><h3>Thank you</h3><p className="muted">Your answers were received.</p><button className="btn" onClick={() => { setValues({}); setState({ busy: false, err: null, done: false }); }}>Submit another</button></div>
          ) : (
            <>
              {state.err && !Object.keys(fieldErr).length && <ErrorNotice error={state.err} />}
              <FormFields fields={f.fields} values={values} errors={fieldErr} onChange={(k, v) => setValues({ ...values, [k]: v })} />
              <button className="btn btn-lg" style={{ background: f.brand.primary, borderColor: f.brand.primary, color: "#fff", alignSelf: "flex-start" }} disabled={state.busy} onClick={submit}>{state.busy ? "Sending…" : "Submit"}</button>
              <span className="small muted">No names are needed. Answers are used only to improve our programmes.</span>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
