import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, fileUrl } from "../api";
import { useAuth } from "../auth";
import { notifyChanged } from "../components/Shell";
import { Dialog, Empty, ErrorNotice, Field, Loading, Toast } from "../components/ui";
import { fmtDateTime } from "../format";
import { useApi } from "../hooks";
import { display, GROUP_COLOR, MODS, statusLabel, STATUS_TONE, TONE_COLOR } from "../modules";
import { Columns, PALETTE } from "../components/charts";

const optionCache = {};
export function useOptions(ref) {
  const [opts, setOpts] = useState(optionCache[ref] || []);
  useEffect(() => {
    if (!ref) return;
    api(`/options/${ref}`).then((o) => { optionCache[ref] = o; setOpts(o); }).catch(() => {});
  }, [ref]);
  return opts;
}
export const clearOptions = () => Object.keys(optionCache).forEach((k) => delete optionCache[k]);

export function StatusPill({ m, value }) {
  const tone = STATUS_TONE[value] || "neutral";
  return <span className="status" style={{ color: TONE_COLOR[tone] }}><svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={tone === "neutral" ? "none" : TONE_COLOR[tone]} stroke={TONE_COLOR[tone]} strokeWidth="1.5" /></svg>{statusLabel(m, value)}</span>;
}

function csv(m, rows) {
  const cols = [...m.fields.filter((f) => f.type !== "file"), ...(m.computed || [])];
  const head = [...cols.map((f) => f.label), ...(m.status ? ["Status"] : [])];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(","), ...rows.map((r) => [...cols.map((f) => (f.type === "ref" ? r[`${f.key}_label`] : f.type === "select" ? display(f, r) : r[f.key])), ...(m.status ? [statusLabel(m, r[m.status.field])] : [])].map(esc).join(","))];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = `${m.key}.csv`;
  a.click();
}

export default function ModulePage() {
  const { key, id } = useParams();
  const m = MODS[key];
  const nav = useNavigate();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  const [page, setPage] = useState(1);
  const [viewPref, setView] = useState("table");
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  useEffect(() => { setQ(""); setQuery(""); setFilters({}); setStatus(""); setPage(1); setView(m?.status?.board ? "board" : "table"); setSort({ key: "created_at", dir: "desc" }); }, [key]); // eslint-disable-line
  useEffect(() => { const t = setTimeout(() => { setQuery(q); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  const view = viewPref === "board" && m?.status?.board ? "board" : "table"; // a board only exists for modules with a workflow
  const params = { q: query, status, sort: sort.key, dir: sort.dir, page: view === "board" ? 1 : page, page_size: view === "board" ? 200 : 15, ...filters };
  const { data, error, loading, reload } = useApi(m ? `/m/${key}` : null, params, [key]);
  useEffect(() => { if (sp.get("new") === "1") { setEditing("new"); setSp({}, { replace: true }); } }, [sp, setSp]);
  if (!m) return <Empty title="Unknown section" />;
  const can = (what) => m[what].includes(user.role);
  const cols = [...m.fields.filter((f) => f.list), ...(m.computed || []).filter((f) => f.list)];
  const filterFields = m.fields.filter((f) => f.filter);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const done = (msg) => { setToast(msg); reload(); notifyChanged(); clearOptions(); };
  const sortBy = (k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <>
      <div className="spread" style={{ alignItems: "flex-end" }}>
        <div className="stack-sm" style={{ gap: 6 }}>
          <span className="chip-tone" style={{ background: `${GROUP_COLOR[m.group]}22`, color: GROUP_COLOR[m.group], alignSelf: "flex-start" }}><span className="dot" style={{ background: GROUP_COLOR[m.group] }} />{m.group}</span>
          <h1 className="page-title">{m.label}</h1>
        </div>
        <div className="row wrap">
          {m.status?.board && (
            <div className="seg" role="group" aria-label="View">
              <button aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
              <button aria-pressed={view === "board"} onClick={() => setView("board")}>Board</button>
            </div>
          )}
          <button className="btn" onClick={() => data && csv(m, data.items)} disabled={!data?.items?.length}>Export CSV</button>
          {can("create") && <button className="btn btn-primary" onClick={() => setEditing("new")}>Add {m.singular.toLowerCase()}</button>}
        </div>
      </div>

      <Insight m={m} version={data?.total} />
      <div className="panel">
        <div className="panel-head" style={{ alignItems: "flex-end" }}>
          <input className="input" style={{ maxWidth: 280 }} placeholder={`Search ${m.label.toLowerCase()}`} aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row wrap">
            {m.status && view === "table" && (
              <select className="select" style={{ width: "auto" }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>{m.status.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            {filterFields.map((f) => <FilterSelect key={f.key} f={f} value={filters[f.key] || ""} onChange={(v) => { setFilters({ ...filters, [f.key]: v }); setPage(1); }} />)}
          </div>
        </div>
        <ErrorNotice error={error} onRetry={reload} />
        {loading && !data ? <div className="panel-body"><Loading rows={6} /></div> : !data?.items.length ? (
          <Empty title={query || status || Object.values(filters).some(Boolean) ? "Nothing matches" : `No ${m.label.toLowerCase()} yet`}
            action={can("create") && !query && <button className="btn btn-primary" onClick={() => setEditing("new")}>Add the first {m.singular.toLowerCase()}</button>}>
            {query ? "Try another search or clear the filters." : m.description}
          </Empty>
        ) : view === "board" ? (
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(240px, 1fr)", gap: 12, padding: 16, overflowX: "auto" }}>
            {m.status.options.map(([v, l]) => {
              const items = data.items.filter((r) => r[m.status.field] === v);
              const drop = async (e) => {
                e.preventDefault(); e.currentTarget.style.outline = "none";
                const rid = e.dataTransfer.getData("text/plain"); const rec = data.items.find((x) => x.id === rid);
                if (!rec || rec[m.status.field] === v) return;
                const tr = m.status.transitions.find((x) => x.to === v && x.from.includes(rec[m.status.field]));
                if (!tr) { setToast(`Can't move from ${statusLabel(m, rec[m.status.field])} to ${l}`); return; }
                const note = tr.note ? prompt(`Note for "${tr.label}"`) : null;
                if (tr.note && !note) return;
                try { await api(`/m/${key}/${rid}/transition`, { method: "POST", body: { to: v, note } }); done(`${rec._title}: ${l}`); } catch (er) { setToast(er.message); }
              };
              return (
                <div key={v} className="stack-sm" onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.outline = "2px dashed var(--cobalt-soft)"; }} onDragLeave={(e) => { e.currentTarget.style.outline = "none"; }} onDrop={drop}
                  style={{ background: "linear-gradient(180deg, var(--stone), #fff)", borderRadius: 16, padding: 10, minHeight: 160, gap: 8, border: "1px solid var(--rule-soft)" }}>
                  <div className="spread small" style={{ fontWeight: 600, padding: "2px 4px" }}><StatusPill m={m} value={v} /><span className="muted">{items.length}</span></div>
                  {items.map((r) => (
                    <button key={r.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)} onClick={() => nav(`/app/m/${key}/${r.id}`)} className="stack-sm" title="Drag to change status"
                      style={{ textAlign: "left", background: "#fff", border: "1px solid var(--rule)", borderRadius: 12, padding: 12, gap: 4, cursor: "grab", boxShadow: "var(--shadow-soft)" }}>
                      <b style={{ fontSize: 14 }}>{r._title}</b>
                      {cols.filter((f) => f.key !== m.title_field).slice(0, 3).map((f) => display(f, r) && <span key={f.key} className="small muted">{f.label}: {display(f, r)}</span>)}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 720 }}>
                <thead><tr>
                  {cols.map((f) => (
                    <th key={f.key} aria-sort={sort.key === f.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {f.type === "ref" || m.computed?.some((c) => c.key === f.key) ? f.label : <button className="btn-quiet" style={{ border: 0, background: "none", font: "inherit", fontWeight: 600, cursor: "pointer", padding: 0, color: "inherit" }} onClick={() => sortBy(f.key)}>{f.label}{sort.key === f.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}</button>}
                    </th>
                  ))}
                  {m.status && <th>Status</th>}
                  <th style={{ textAlign: "right" }}><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>{data.items.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/app/m/${key}/${r.id}`)}>
                    {cols.map((f, i) => (
                      <td key={f.key} style={{ textAlign: ["money", "number", "percent"].includes(f.type) ? "right" : undefined, color: f.key === "remaining" && r.remaining < 0 ? "var(--bad)" : f.key === "stock" && r.stock <= (r.reorder_level ?? -1) ? "var(--risk)" : undefined, fontWeight: f.key === "stock" && r.stock <= (r.reorder_level ?? -1) ? 600 : undefined }}>
                        {i === 0 ? <Link className="row-link" to={`/app/m/${key}/${r.id}`} onClick={(e) => e.stopPropagation()}>{display(f, r) || r._title}</Link> : f.key === "used_pct" ? <UsedBar pct={r.used_pct} /> : display(f, r)}
                      </td>
                    ))}
                    {m.status && <td><StatusPill m={m} value={r[m.status.field]} /></td>}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      {can("edit") && <button className="btn btn-icon btn-ghost" title="Edit" aria-label={`Edit ${r._title}`} onClick={() => setEditing(r)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg></button>}
                      {can("delete") && <button className="btn btn-icon btn-ghost-danger" title="Delete" aria-label={`Delete ${r._title}`} onClick={async () => { if (!confirm(`Delete ${r._title}?`)) return; try { await api(`/m/${key}/${r.id}`, { method: "DELETE" }); done("Deleted"); } catch (e) { setToast(e.message); } }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="pager">
              <span>{data.total.toLocaleString()} record{data.total === 1 ? "" : "s"}</span>
              <div className="row"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
            </div>
          </>
        )}
      </div>
      {id && <RecordPanel key={id} m={m} id={id} onClose={() => nav(`/app/m/${key}`)} onEdit={(r) => setEditing(r)} onChanged={done} />}
      {editing && <RecordForm m={m} record={editing === "new" ? null : editing} onClose={() => setEditing(null)}
        onSaved={(r, isNew) => { setEditing(null); done(isNew ? `${m.singular} added` : "Saved"); if (isNew) nav(`/app/m/${key}/${r.id}`); }} />}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}

export function UsedBar({ pct }) {
  const over = pct > 100, warn = pct >= 90;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end", width: "100%" }}>
      <span style={{ width: 70, height: 6, background: "var(--track)", borderRadius: 3, overflow: "hidden" }}>
        <span style={{ display: "block", height: 6, width: `${Math.min(pct, 100)}%`, background: over ? "var(--bad)" : warn ? "var(--risk)" : "var(--cobalt)" }} />
      </span>
      <span style={{ color: over ? "var(--bad)" : warn ? "var(--risk)" : undefined, fontWeight: over || warn ? 600 : 400, minWidth: 48 }}>{pct}%</span>
    </span>
  );
}

function FilterSelect({ f, value, onChange }) {
  const opts = useOptions(f.type === "ref" ? f.ref : null);
  const [text, setText] = useState(value);
  useEffect(() => { const t = setTimeout(() => text !== value && onChange(text), 300); return () => clearTimeout(t); }, [text]); // eslint-disable-line
  if (!["ref", "bool", "select"].includes(f.type)) {
    return <input className="input" style={{ width: 150 }} placeholder={f.label} aria-label={`Filter by ${f.label.toLowerCase()}`} value={text} onChange={(e) => setText(e.target.value)} />;
  }
  const choices = f.type === "ref" ? opts.map((o) => [o.id, o.label]) : f.type === "bool" ? [["true", "Yes"], ["false", "No"]] : f.options;
  return (
    <select className="select" style={{ width: "auto", maxWidth: 220 }} aria-label={f.label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{f.label}: all</option>{choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function RecordPanel({ m, id, onClose, onEdit, onChanged }) {
  const { user } = useAuth();
  const { data: r, error, loading, reload } = useApi(`/m/${m.key}/${id}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState("");
  const st = m.status;
  const steps = useMemo(() => (r && st ? st.transitions.filter((x) => x.from.includes(r[st.field]) && x.roles.includes(user.role)) : []), [r, st, user.role]);
  const go = async (tr, withNote) => {
    if (tr.note && withNote === undefined) { setNoteFor(tr); setNote(""); return; }
    setBusy(true); setErr(null);
    try { await api(`/m/${m.key}/${id}/transition`, { method: "POST", body: { to: tr.to, note: withNote || null } }); setNoteFor(null); reload(); onChanged(`${statusLabel(m, tr.to)}`); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm(`Delete this ${m.singular.toLowerCase()}? This cannot be undone.`)) return;
    try { await api(`/m/${m.key}/${id}`, { method: "DELETE" }); onChanged("Deleted"); onClose(); } catch (e) { setErr(e); }
  };
  const all = [...m.fields, ...(m.computed || [])];
  return (
    <Dialog title={r ? r._title : m.singular} onClose={onClose}
      footer={r && <>
        {m.delete.includes(user.role) && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={del}>Delete</button>}
        {m.edit.includes(user.role) && <button className="btn" onClick={() => onEdit(r)}>Edit</button>}
        {steps.map((tr) => <button key={tr.to} className={"btn" + (["approved", "awarded", "paid", "active", "held", "done", "received", "converted"].includes(tr.to) ? " btn-primary" : "")} disabled={busy} onClick={() => go(tr)}>{tr.label}</button>)}
      </>}>
      <div className="dialog-body">
        <ErrorNotice error={error || err} onRetry={error ? reload : undefined} />
        {loading && !r ? <Loading /> : r && (
          <>
            <div className="row wrap" style={{ gap: 16 }}>
              {st && <StatusPill m={m} value={r[st.field]} />}
              <span className="small muted">Added by {r.created_by_label || "the website"} · {fmtDateTime(r.created_at)}</span>
            </div>
            {st && steps.some((x) => x.not_creator) && r.created_by_id === user.id && <div className="notice notice-warn small">You submitted this, so someone else has to approve it.</div>}
            {noteFor && (
              <div className="stack-sm notice" style={{ background: "var(--stone)" }}>
                <Field label={`Note for "${noteFor.label}"`} hint="Required"><textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
                <div className="row"><button className="btn btn-primary" disabled={!note.trim() || busy} onClick={() => go(noteFor, note)}>{noteFor.label}</button><button className="btn btn-quiet" onClick={() => setNoteFor(null)}>Cancel</button></div>
              </div>
            )}
            {m.key === "events" && <EventFormBox ev={r} onChanged={reload} />}
            <dl className="facts" style={{ gridTemplateColumns: "160px 1fr" }}>
              {all.map((f) => {
                const v = display(f, r);
                if (!v && f.type !== "bool") return null;
                return [
                  <dt key={f.key + "t"}>{f.label}</dt>,
                  <dd key={f.key + "d"} style={{ whiteSpace: f.type === "textarea" ? "pre-wrap" : undefined }}>
                    {f.type === "file" && r[f.key]?.url ? <a href={fileUrl(r[f.key].url)} target="_blank" rel="noreferrer">{v}</a> : f.key === "used_pct" ? <UsedBar pct={r.used_pct} /> : v}
                  </dd>,
                ];
              })}
            </dl>
            {r._history?.length > 0 && (
              <div className="stack-sm" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 14 }}>
                <b>History</b>
                {r._history.map((h) => <div key={h.id} className="history-item" style={{ gridTemplateColumns: "110px 1fr" }}><span className="muted">{fmtDateTime(h.at)}</span><span>{h.summary}</span></div>)}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

export function RecordForm({ m, record, onClose, onSaved, preset = {} }) {
  const isNew = !record;
  const init = () => {
    const v = {};
    for (const f of m.fields) v[f.key] = record ? record[f.key] ?? (f.type === "bool" ? false : "") : preset[f.key] ?? (f.type === "bool" ? false : "");
    return v;
  };
  const [vals, setVals] = useState(init);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldErr = Object.fromEntries((error?.data?.errors || []).filter((e) => e.field).map((e) => [e.field, e.message]));
  const submit = async () => {
    setBusy(true); setError(null);
    const body = {};
    for (const f of m.fields) {
      const v = vals[f.key];
      if (!isNew && JSON.stringify(v ?? "") === JSON.stringify(record[f.key] ?? "")) continue;
      body[f.key] = v === "" ? null : f.type === "number" || f.type === "money" ? (v === null ? null : Number(v)) : v;
    }
    try {
      const r = isNew ? await api(`/m/${m.key}`, { method: "POST", body }) : await api(`/m/${m.key}/${record.id}`, { method: "PATCH", body });
      onSaved(r, isNew);
    } catch (e) { setError(e); setBusy(false); }
  };
  return (
    <Dialog title={isNew ? `Add ${m.singular.toLowerCase()}` : `Edit ${m.singular.toLowerCase()}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Saving…" : isNew ? `Add ${m.singular.toLowerCase()}` : "Save changes"}</button></>}>
      <div className="dialog-body">
        <ErrorNotice error={error && !Object.keys(fieldErr).length ? error : null} />
        {m.key === "participants" && <div className="notice small" style={{ background: "var(--stone)" }}>Do not record names. Use the participant's code and only the details needed for disaggregated reporting.</div>}
        <div className="form-grid">
          {m.fields.map((f) => (
            <div key={f.key} style={{ gridColumn: f.type === "textarea" || f.type === "file" ? "1 / -1" : undefined }}>
              <Field label={f.label} hint={f.required ? undefined : "Optional"} error={fieldErr[f.key]}>
                <Input f={f} value={vals[f.key]} onChange={(v) => setVals({ ...vals, [f.key]: v })} invalid={!!fieldErr[f.key]} />
              </Field>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

function Input({ f, value, onChange, invalid }) {
  const opts = useOptions(f.type === "ref" ? f.ref : null);
  const [up, setUp] = useState(false);
  const [upErr, setUpErr] = useState(null);
  const common = { "aria-invalid": invalid || undefined };
  switch (f.type) {
    case "textarea": return <textarea className="textarea" rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "number": case "money": return <input className="input" type="number" inputMode="decimal" min={f.min ?? (f.type === "money" ? 0 : undefined)} max={f.max} step="any" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "date": return <input className="input" type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "email": return <input className="input" type="email" value={value || ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "bool": return <label className="row" style={{ fontWeight: 400, minHeight: 40 }}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />Yes</label>;
    case "select": return <select className="select" value={value || ""} onChange={(e) => onChange(e.target.value)} {...common}><option value="">Choose…</option>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
    case "ref": return <select className="select" value={value || ""} onChange={(e) => onChange(e.target.value)} {...common}><option value="">{f.required ? "Choose…" : "None"}</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
    case "file": return (
      <div className="stack-sm">
        {value?.name && <div className="file-chip"><span className="strong" style={{ flex: 1 }}>{value.name}</span><button type="button" className="btn btn-quiet" onClick={() => onChange("")}>Remove</button></div>}
        <label className="dropzone" style={{ minHeight: 64 }}>
          <b>{up ? "Uploading…" : value?.name ? "Replace file" : "Choose a file or take a photo"}</b>
          <span className="small">Photo, PDF, Word, Excel. Up to 10 MB.</span>
          <input type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={async (e) => {
            const file = e.target.files[0]; if (!file) return; setUp(true); setUpErr(null);
            const form = new FormData(); form.append("file", file);
            try { onChange(await api("/uploads", { method: "POST", form })); } catch (er) { setUpErr(er.message); } finally { setUp(false); e.target.value = ""; }
          }} />
        </label>
        {upErr && <span className="field-error">{upErr}</span>}
      </div>
    );
    default: return <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
}

function Insight({ m, version }) {
  const by = m.status ? m.status.field : (m.fields.find((f) => f.filter && (f.type === "select" || f.type === "ref")) || {}).key;
  const sumField = (m.fields.find((f) => f.type === "money" && f.list) || {}).key;
  const { data } = useApi(by ? `/m/${m.key}/stats` : null, { by, sum: sumField }, [version]);
  if (!by || !data?.length) return null;
  const tones = m.status ? data.map((d) => TONE_COLOR[STATUS_TONE[d.key] || "neutral"]) : PALETTE;
  return (
    <div className="panel" style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {data.slice(0, 6).map((d, i) => (
        <div key={String(d.key)} className="stack-sm" style={{ gap: 2, borderLeft: `4px solid ${m.status ? tones[i] : PALETTE[i % PALETTE.length]}`, paddingLeft: 12 }}>
          <span className="small muted">{d.label}</span>
          <b style={{ fontSize: 22 }}>{d.count}</b>
          {sumField && <span className="small" style={{ color: "var(--ink-2)" }}>KES {Math.round(d.sum).toLocaleString()}</span>}
        </div>
      ))}
    </div>
  );
}

function EventFormBox({ ev, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const f = ev._form;
  if (!f) return (
    <div className="notice" style={{ background: "var(--accent-tint)", color: "var(--accent-ink)" }}>
      <div className="spread"><span>No attendance form yet.</span><button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await api(`/events/${ev.id}/form`, { method: "POST" }); setBusy(false); onChanged(); }}>Create attendance form</button></div>
    </div>
  );
  const link = `${window.location.origin}${window.location.pathname}${window.location.hash ? "#" : ""}/f/${f.id}`.replace(/([^:])\/\//g, "$1/");
  return (
    <div style={{ borderRadius: 16, padding: 16, background: "linear-gradient(135deg, var(--cobalt-tint), var(--accent-tint))" }} className="stack-sm">
      <div className="spread"><b>Attendance and feedback form</b><span className="chip-tone" style={{ background: "#fff", color: "var(--cobalt-dark)" }}>{f.responses} responses</span></div>
      <span className="small" style={{ color: "var(--ink-2)" }}>Share the link or QR at the door. Marking the event as held fills attendance from these responses.</span>
      <div className="row wrap">
        <Link className="btn btn-primary" to={`/app/forms/${f.id}`}>See results</Link>
        <Link className="btn" to={`/app/forms/${f.id}?tab=collect`}>Add response</Link>
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy public link"}</button>
      </div>
    </div>
  );
}
