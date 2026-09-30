import { useState } from "react";
import type { CalEvent } from "../../lib/types";
import { ScheduleCalendar } from "../components/ScheduleCalendar";
import { Modal, ProjectDot } from "../components/ui";
import { byId, fmtEventWhen, useEvents, useProjects } from "../hooks";
import { CalendarFeed } from "./Account";

export function Schedule() {
  const events = useEvents();
  const projects = useProjects();
  const projectMap = byId(projects.data);
  const [open, setOpen] = useState<CalEvent | null>(null);
  const multiple = (projects.data?.length ?? 0) > 1;

  return (
    <div className="page">
      <h1>Project schedule</h1>
      {multiple && (
        <p className="legend">
          {projects.data?.map((p) => (
            <span key={p.id}>
              <ProjectDot color={p.color} /> {p.name}
            </span>
          ))}
        </p>
      )}
      <ScheduleCalendar events={events.data ?? []} projects={projectMap} onEventClick={setOpen} />
      <p className="muted small">Dates can shift with weather, inspections, and material deliveries. We'll keep this updated.</p>
      <CalendarFeed compact />

      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)}>
          <p>
            <strong>{fmtEventWhen(open)}</strong>
          </p>
          {open.category && <p className="muted">{open.category}</p>}
          {open.notes && <p className="pre">{open.notes}</p>}
        </Modal>
      )}
    </div>
  );
}
