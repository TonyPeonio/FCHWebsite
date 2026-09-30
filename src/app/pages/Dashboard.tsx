import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { byId, fmtDate, fmtEventWhen, upcoming, useDocuments, useEvents, useProjects, useSelections } from "../hooks";
import { DocList, Empty, ProjectDot, StatusBadge } from "../components/ui";

const STATUS_LABEL = { planning: "Planning", active: "Under construction", on_hold: "On hold", complete: "Complete" };

export function Dashboard() {
  const { profile } = useAuth();
  const projects = useProjects();
  const events = useEvents();
  const selections = useSelections();
  const docs = useDocuments();
  const projectMap = byId(projects.data);

  const open = (selections.data ?? []).filter((s) => s.status === "requested" || s.status === "revision_requested");
  const photos = (docs.data ?? []).filter((d) => d.mime_type?.startsWith("image/") && d.kind === "photo").slice(0, 6);

  if (projects.isSuccess && projects.data.length === 0) {
    return (
      <div className="page">
        <h1>Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <Empty>Your project hasn't been set up in the portal yet. We'll let you know when it's ready!</Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>

      <div className="project-cards">
        {projects.data?.map((p) => (
          <div key={p.id} className="card project-card" style={{ borderTopColor: p.color }}>
            <h2>{p.name}</h2>
            {p.address && <p className="muted">{p.address}</p>}
            <p>
              <strong>{STATUS_LABEL[p.status]}</strong>
              {p.target_completion && <> · Target completion {fmtDate(p.target_completion)}</>}
            </p>
          </div>
        ))}
      </div>

      {open.length > 0 && (
        <section className="card attention">
          <h2>Waiting on you</h2>
          <ul className="rows">
            {open.map((s) => (
              <li key={s.id}>
                <Link to={`/selections/${s.id}`}>{s.title}</Link>
                <span>
                  {s.due_date && <small>Due {fmtDate(s.due_date)} </small>}
                  <StatusBadge status={s.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Coming up</h2>
            <Link to="/schedule">Full schedule →</Link>
          </div>
          {upcoming(events.data).length === 0 ? (
            <Empty>Nothing scheduled yet.</Empty>
          ) : (
            <ul className="rows">
              {upcoming(events.data).map((e) => (
                <li key={e.id}>
                  <span>
                    <ProjectDot color={projectMap[e.event_projects[0]?.project_id]?.color ?? "#999"} /> {e.title}
                  </span>
                  <small>{fmtEventWhen(e)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Latest photos</h2>
            <Link to="/files">All photos & files →</Link>
          </div>
          {photos.length ? <DocList docs={photos} /> : <Empty>Progress photos will show up here.</Empty>}
        </section>
      </div>
    </div>
  );
}
