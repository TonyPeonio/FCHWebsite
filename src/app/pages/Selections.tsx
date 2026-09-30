import { Link } from "react-router-dom";
import { byId, fmtDate, useProjects, useSelections } from "../hooks";
import { Empty, StatusBadge } from "../components/ui";

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
            <Link to={`/selections/${s.id}`}>{s.title}</Link>
            {(projects.data?.length ?? 0) > 1 && <small className="muted"> · {projectMap[s.project_id]?.name}</small>}
          </span>
          <span>
            {s.due_date && s.status !== "approved" && <small>Due {fmtDate(s.due_date)} </small>}
            <StatusBadge status={s.status} />
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page">
      <h1>Selections</h1>
      <p className="muted">
        When we need you to choose something — tile, paint colors, fixtures — it shows up here. Pick an option, add
        notes, or upload photos of what you like.
      </p>
      <section className="card">
        <h2>Needs your input</h2>
        {open.length ? list(open) : <Empty>You're all caught up.</Empty>}
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
