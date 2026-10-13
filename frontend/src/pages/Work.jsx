import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorNotice, Loading, Status } from "../components/ui";
import { fmtDate, isoToday } from "../format";
import { useApi } from "../hooks";

export default function Work() {
  const [owner, setOwner] = useState("me");
  const [state, setState] = useState("open");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi("/activities", { owner: owner === "me" ? "me" : undefined, state, page, page_size: 15 });
  const t = isoToday();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  return (
    <>
      <div className="spread">
        <h1 className="page-title">Work</h1>
        <div className="row wrap">
          <div className="seg" role="group" aria-label="Whose work">
            <button aria-pressed={owner === "me"} onClick={() => { setOwner("me"); setPage(1); }}>Mine</button>
            <button aria-pressed={owner === "all"} onClick={() => { setOwner("all"); setPage(1); }}>Everyone</button>
          </div>
          <select className="select" style={{ width: "auto" }} aria-label="Status" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
            <option value="open">Not done</option><option value="overdue">Overdue</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="all">All</option>
          </select>
        </div>
      </div>
      <div className="panel">
        <ErrorNotice error={error} onRetry={reload} />
        {loading && !data ? <div className="panel-body"><Loading /></div> : data.items.length === 0 ? (
          <Empty title={owner === "me" ? "Nothing assigned to you" : "Nothing here"}>{owner === "me" ? "When a manager gives you an activity it shows up here, ordered by due date." : "No activities match this filter."}</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 720 }}>
                <thead><tr><th>Activity</th><th>Project</th><th>Owner</th><th>Due</th><th>Status</th><th style={{ textAlign: "right" }}>Proof</th></tr></thead>
                <tbody>{data.items.map((a) => {
                  const late = a.status !== "done" && a.due_on < t;
                  return (
                    <tr key={a.id}>
                      <td><Link className="row-link" to={`/app/activities/${a.id}`}>{a.title}</Link><div className="small muted">{a.commitment_title}</div></td>
                      <td>{a.project_name}</td><td>{a.owner?.full_name || "Unassigned"}</td>
                      <td style={{ color: late ? "var(--bad)" : undefined }}>{fmtDate(a.due_on)}</td>
                      <td><Status kind={a.status === "done" ? "done" : late && a.status !== "blocked" ? "overdue" : a.status} /></td>
                      <td style={{ textAlign: "right", color: a.proof_have < a.proof_need ? "var(--risk)" : "var(--slate)" }}>{a.proof_need ? `${a.proof_have} of ${a.proof_need}` : "None needed"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <div className="pager"><span>{data.total} total</span><div className="row"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
          </>
        )}
      </div>
    </>
  );
}
