import { Link, useSearchParams } from "react-router-dom";
import type { Selection } from "../../../lib/types";
import { Empty, ProjectDot, StatusBadge } from "../../components/ui";
import { byId, fmtDate, useProjects, useSelections } from "../../hooks";

const waitingOnClient = (s: Selection) => s.status === "requested" || s.status === "revision_requested";
const isOverdue = (s: Selection) => waitingOnClient(s) && !!s.due_date && s.due_date < new Date().toLocaleDateString("en-CA");

// ?show=review etc. (linked from the overview); no filter = everything not yet approved.
const FILTERS = {
  open: { label: "Not approved", test: (s: Selection) => s.status !== "approved" },
  review: { label: "Needs review", test: (s: Selection) => s.status === "submitted" },
  waiting: { label: "Waiting on client", test: waitingOnClient },
  overdue: { label: "Overdue", test: isOverdue },
  approved: { label: "Approved", test: (s: Selection) => s.status === "approved" },
  all: { label: "All", test: () => true },
};
type Filter = keyof typeof FILTERS;

/** Owner: every project's selections in one list. */
export function AllSelections() {
  const selections = useSelections();
  const projects = useProjects();
  const projectMap = byId(projects.data);
  const [params, setParams] = useSearchParams();
  const show = (params.get("show") as Filter | null) ?? "open";
  const filter = FILTERS[show] ?? FILTERS.open;

  const all = selections.data ?? [];
  // Soonest due first; ones without a due date last.
  const rows = all.filter(filter.test).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  return (
    <div className="page">
      <h1>Selections</h1>
      <p className="muted">Every project's selections. To request a new one, open the project's Selections tab.</p>
      <div className="chips filter">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} className={`chip ${show === f ? "on" : ""}`} onClick={() => setParams(f === "open" ? {} : { show: f })}>
            {FILTERS[f].label}
            {f !== "all" && f !== "open" && ` (${all.filter(FILTERS[f].test).length})`}
          </button>
        ))}
      </div>
      <section className="card">
        {rows.length ? (
          <ul className="rows">
            {rows.map((s) => (
              <li key={s.id}>
                <span>
                  <Link to={`/selections/${s.id}`}>{s.title}</Link>
                  <small className="muted">
                    {" "}
                    <ProjectDot color={projectMap[s.project_id]?.color ?? "#999"} />{" "}
                    <Link to={`/admin/projects/${s.project_id}`} className="muted">
                      {projectMap[s.project_id]?.name}
                    </Link>
                  </small>
                </span>
                <span>
                  {s.due_date && s.status !== "approved" && (
                    <small className={isOverdue(s) ? "overdue" : undefined}>Due {fmtDate(s.due_date)} </small>
                  )}
                  <StatusBadge status={s.status} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{selections.isLoading ? "Loading…" : "Nothing here."}</Empty>
        )}
      </section>
    </div>
  );
}
