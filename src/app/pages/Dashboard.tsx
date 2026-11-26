import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { projectStatusLabel } from "../../lib/types";
import { byId, fmtDate, fmtEventWhen, isPast, relativeDay, upcoming, useCustomStatuses, useDocuments, useEvents, useProjects, useSelections } from "../hooks";
import { DocList, Empty, Icon, Loading, ProjectDot, StageSteps, StatusBadge } from "../components/ui";

export function Dashboard() {
  const { profile } = useAuth();
  const projects = useProjects();
  const statuses = useCustomStatuses();
  const events = useEvents();
  const selections = useSelections();
  const docs = useDocuments();
  const projectMap = byId(projects.data);
  const greeting = `Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`;

  const open = (selections.data ?? []).filter((s) => s.status === "requested" || s.status === "revision_requested");
  const photos = (docs.data ?? []).filter((d) => d.mime_type?.startsWith("image/") && d.kind === "photo").slice(0, 6);
  const next = upcoming(events.data);

  if (projects.isSuccess && projects.data.length === 0) {
    return (
      <div className="page">
        <h1>{greeting}</h1>
        <div className="card">
          <Empty icon="home">
            Your project hasn't been set up in the portal yet. We'll email you when it's ready. In the meantime you can reach us on the{" "}
            <a href={`${import.meta.env.BASE_URL}#contact`}>contact page</a>.
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{greeting}</h1>

      {projects.isLoading ? (
        <div className="card">
          <Loading rows={3} />
        </div>
      ) : (
        <div className="project-cards">
          {projects.data?.map((p) => (
            <section key={p.id} className="card project-card" style={{ borderTopColor: p.color }} aria-label={p.name}>
              <h2>{p.name}</h2>
              {p.address && <p className="muted">{p.address}</p>}
              <StageSteps stage={p.status} />
              <p>
                <strong>{projectStatusLabel(p, statuses.data)}</strong>
                {p.status === "complete"
                  ? p.completed_on && <> · Completed {fmtDate(p.completed_on)}</>
                  : p.target_completion && (
                      <>
                        {" "}
                        · Target completion {fmtDate(p.target_completion)}
                        {!isPast(p.target_completion) && <span className="muted"> ({relativeDay(p.target_completion)})</span>}
                      </>
                    )}
              </p>
            </section>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <section className="card attention">
          <h2>
            Waiting on you <span className="badge badge-submitted">{open.length}</span>
          </h2>
          <p className="muted small">We need your choice on {open.length === 1 ? "this" : "these"} to keep things moving. Tap one to respond.</p>
          <ul className="rows">
            {open.map((s) => (
              <li key={s.id}>
                <Link to={`/selections/${s.id}`}>
                  <strong>{s.title}</strong>
                </Link>
                <span>
                  {s.due_date && <small className={isPast(s.due_date) ? "overdue" : undefined}>Due {fmtDate(s.due_date)} </small>}
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
          {events.isLoading ? (
            <Loading />
          ) : next.length === 0 ? (
            <Empty icon="calendar">Nothing is scheduled yet. Inspections, deliveries, and milestones will show up here.</Empty>
          ) : (
            <ul className="rows">
              {next.map((e) => (
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
          {docs.isLoading ? <Loading /> : photos.length ? <DocList docs={photos} /> : <Empty icon="photo">Progress photos will show up here as your build moves along.</Empty>}
        </section>
      </div>

      <p className="muted small">
        <Icon name="upload" size={14} /> Have an inspiration photo or a document for us? <Link to="/files">Send it on the Photos & Files page</Link>.
      </p>
    </div>
  );
}
