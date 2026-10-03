import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { projectStatusLabel } from "../../../lib/types";
import { SpaceUsed } from "../../components/SpaceUsed";
import { Empty, ProjectDot, StatusBadge } from "../../components/ui";
import {
  byId,
  fmtDate,
  fmtEventWhen,
  projectColor,
  upcoming,
  useCustomStatuses,
  useEvents,
  useProjects,
  useQuotes,
  useSelections,
} from "../../hooks";

export function AdminHome() {
  const { profile } = useAuth();
  const events = useEvents();
  const projects = useProjects();
  const quotes = useQuotes();
  const selections = useSelections();
  const statuses = useCustomStatuses();
  const projectMap = byId(projects.data);

  const newQuotes = (quotes.data ?? []).filter((q) => q.status === "new");
  const toReview = (selections.data ?? []).filter((s) => s.status === "submitted");
  const waiting = (selections.data ?? []).filter((s) => s.status === "requested" || s.status === "revision_requested");
  const planning = (projects.data ?? []).filter((p) => p.status === "planning");
  const overdue = waiting.filter((s) => s.due_date && s.due_date < new Date().toLocaleDateString("en-CA"));

  return (
    <div className="page">
      <h1>Good {new Date().getHours() < 12 ? "morning" : "afternoon"}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>

      <div className="stats">
        <Link to="/admin/quotes" className="stat">
          <strong>{newQuotes.length}</strong> new {newQuotes.length === 1 ? "inquiry" : "inquiries"}
        </Link>
        <div className="stat">
          <strong>{toReview.length}</strong> selection{toReview.length === 1 ? "" : "s"} to review
        </div>
        <div className="stat">
          <strong>{waiting.length}</strong> waiting on clients{overdue.length > 0 && <em> · {overdue.length} overdue</em>}
        </div>
        <Link to="/admin/projects?stage=planning" className="stat">
          <strong>{planning.length}</strong> in planning
        </Link>
        <Link to="/admin/projects?stage=active" className="stat">
          <strong>{(projects.data ?? []).filter((p) => p.status === "active").length}</strong> under construction
        </Link>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Next up</h2>
            <Link to="/admin/calendar">Calendar →</Link>
          </div>
          {upcoming(events.data, 10).length ? (
            <ul className="rows">
              {upcoming(events.data, 10).map((e) => (
                <li key={e.id}>
                  <span>
                    <ProjectDot color={projectColor(e, projectMap)} /> {e.title}
                    <small className="muted"> {e.event_projects.map((t) => projectMap[t.project_id]?.name).join(", ")}</small>
                  </span>
                  <small>{fmtEventWhen(e)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing scheduled.</Empty>
          )}
        </section>

        <section className="card">
          <h2>Selections needing attention</h2>
          {[...toReview, ...overdue].length ? (
            <ul className="rows">
              {[...toReview, ...overdue].map((s) => (
                <li key={s.id}>
                  <span>
                    <Link to={`/selections/${s.id}`}>{s.title}</Link>
                    <small className="muted"> {projectMap[s.project_id]?.name}</small>
                  </span>
                  <span>
                    {s.status !== "submitted" && s.due_date && <small>Due {fmtDate(s.due_date)} </small>}
                    <StatusBadge status={s.status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>All caught up.</Empty>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>In planning</h2>
            <Link to="/admin/projects?stage=planning">Projects →</Link>
          </div>
          {planning.length ? (
            <ul className="rows">
              {planning.map((p) => (
                <li key={p.id}>
                  <span>
                    <ProjectDot color={p.color} /> <Link to={`/admin/projects/${p.id}`}>{p.name}</Link>
                  </span>
                  <span className="badge">{projectStatusLabel(p, statuses.data)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No projects in planning.</Empty>
          )}
        </section>

        <SpaceUsed />
      </div>
    </div>
  );
}
