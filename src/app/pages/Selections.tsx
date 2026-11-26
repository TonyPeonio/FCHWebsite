import { Link } from "react-router-dom";
import { byId, fmtDate, isPast, useProjects, useSelections } from "../hooks";
import { Empty, Loading, StatusBadge } from "../components/ui";

export function Selections() {
  const selections = useSelections();
  const projects = useProjects();
  const projectMap = byId(projects.data);
  const rows = selections.data ?? [];
  const open = rows.filter((s) => s.status === "requested" || s.status === "revision_requested");
  const done = rows.filter((s) => !open.includes(s));

  const list = (items: typeof rows) => (
    <ul className="rows">
      {items.map((s) => (
        <li key={s.id}>
          <span>
            <Link to={`/selections/${s.id}`}>
              <strong>{s.title}</strong>
            </Link>
            {(projects.data?.length ?? 0) > 1 && <small className="muted"> · {projectMap[s.project_id]?.name}</small>}
          </span>
          <span>
            {s.due_date && s.status !== "approved" && (
              <small className={isPast(s.due_date) && s.status !== "submitted" ? "overdue" : undefined}>Due {fmtDate(s.due_date)} </small>
            )}
            <StatusBadge status={s.status} />
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page">
      <h1>Selections</h1>
      <p className="lead">
        When we need you to choose something, like tile, paint colors, or fixtures, it shows up here. Open it to pick an option, add notes, or upload photos of
        what you like.
      </p>
      <section className="card">
        <h2>Needs your choice</h2>
        {selections.isLoading ? <Loading /> : open.length ? list(open) : <Empty icon="check">You're all caught up. We'll email you when there's something new to choose.</Empty>}
      </section>
      {done.length > 0 && (
        <section className="card">
          <h2>Submitted & approved</h2>
          {list(done)}
        </section>
      )}
    </div>
  );
}
