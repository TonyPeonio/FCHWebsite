import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import { EVENT_CATEGORIES, type CalEvent, type Project } from "../../../lib/types";
import { ScheduleCalendar } from "../../components/ScheduleCalendar";
import { ErrorNote, Modal, ProjectDot } from "../../components/ui";
import { allDayDate, allDayIso, byId, useEvents, useProjects } from "../../hooks";

// <input type="datetime-local"> works in local time without a timezone suffix.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const addDays = (date: string, n: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

interface Draft {
  id?: string;
  title: string;
  notes: string;
  category: string;
  allDay: boolean;
  startDate: string; // all-day: YYYY-MM-DD
  endDate: string; // all-day: last day, inclusive
  start: string; // timed: datetime-local
  end: string;
  clientVisible: boolean;
  projectIds: string[];
}

function draftFrom(ev: CalEvent | null, date?: string, allDay = true, projectId?: string): Draft {
  if (ev) {
    const startDate = allDayDate(ev.starts_at);
    return {
      id: ev.id,
      title: ev.title,
      notes: ev.notes ?? "",
      category: ev.category ?? "",
      allDay: ev.all_day,
      startDate,
      endDate: ev.all_day && ev.ends_at ? addDays(allDayDate(ev.ends_at), -1) : startDate,
      start: toLocalInput(ev.starts_at),
      end: ev.ends_at ? toLocalInput(ev.ends_at) : "",
      clientVisible: ev.client_visible,
      projectIds: ev.event_projects.map((t) => t.project_id),
    };
  }
  const d = (date ?? new Date().toLocaleDateString("en-CA")).slice(0, 10);
  const timed = !allDay && date ? date.slice(0, 16) : `${d}T08:00`;
  return {
    title: "",
    notes: "",
    category: "",
    allDay,
    startDate: d,
    endDate: d,
    start: timed,
    end: "",
    clientVisible: true,
    projectIds: projectId ? [projectId] : [],
  };
}

export function EventEditor({ initial, projects, onClose }: { initial: Draft; projects: Project[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const done = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () => {
      if (d.allDay && d.endDate < d.startDate) throw new Error("End date is before the start date.");
      if (!d.allDay && d.end && d.end < d.start) throw new Error("End time is before the start time.");
      return api.saveEvent(
        {
          id: d.id,
          title: d.title.trim(),
          notes: d.notes.trim() || null,
          category: d.category || null,
          all_day: d.allDay,
          starts_at: d.allDay ? allDayIso(d.startDate) : new Date(d.start).toISOString(),
          ends_at: d.allDay
            ? d.endDate > d.startDate ? allDayIso(addDays(d.endDate, 1)) : null
            : d.end ? new Date(d.end).toISOString() : null,
          client_visible: d.clientVisible,
        },
        d.projectIds,
      );
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api.deleteEvent(d.id!), onSuccess: done });

  function toggleProject(id: string) {
    set("projectIds", d.projectIds.includes(id) ? d.projectIds.filter((p) => p !== id) : [...d.projectIds, id]);
  }

  return (
    <Modal title={d.id ? "Edit event" : "New event"} onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Title
          <input required value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Framing inspection" />
        </label>

        <fieldset>
          <legend>Projects (tags)</legend>
          <div className="chips">
            {projects.map((p) => (
              <label key={p.id} className={`chip ${d.projectIds.includes(p.id) ? "on" : ""}`}>
                <input type="checkbox" checked={d.projectIds.includes(p.id)} onChange={() => toggleProject(p.id)} />
                <ProjectDot color={p.color} /> {p.name}
              </label>
            ))}
          </div>
          <small className="muted">
            Clients on a tagged project see this event. Leave all unchecked for a company-only event.
          </small>
        </fieldset>

        <label className="check">
          <input type="checkbox" checked={d.allDay} onChange={(e) => set("allDay", e.target.checked)} /> All day
        </label>
        {d.allDay ? (
          <div className="grid-2 tight">
            <label>
              Start date
              <input type="date" required value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value, endDate: d.endDate < e.target.value ? e.target.value : d.endDate })} />
            </label>
            <label>
              End date
              <input type="date" required value={d.endDate} min={d.startDate} onChange={(e) => set("endDate", e.target.value)} />
            </label>
          </div>
        ) : (
          <div className="grid-2 tight">
            <label>
              Starts
              <input type="datetime-local" required value={d.start} onChange={(e) => set("start", e.target.value)} />
            </label>
            <label>
              Ends (optional)
              <input type="datetime-local" value={d.end} min={d.start} onChange={(e) => set("end", e.target.value)} />
            </label>
          </div>
        )}

        <label>
          Category
          <select value={d.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">—</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          Notes {d.clientVisible && d.projectIds.length > 0 && <small className="muted">(clients can read these)</small>}
          <textarea rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>

        <label className="check">
          <input type="checkbox" checked={d.clientVisible} onChange={(e) => set("clientVisible", e.target.checked)} /> Visible to clients
        </label>
        {!d.clientVisible && <p className="muted small">Staff-only: shown with a dark outline and hidden from every client.</p>}

        <div className="btn-row">
          <button className="btn primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
          {d.id && (
            <button type="button" className="btn danger" disabled={remove.isPending} onClick={() => confirm("Delete this event?") && remove.mutate()}>
              Delete
            </button>
          )}
        </div>
        <ErrorNote error={save.error ?? remove.error} />
      </form>
    </Modal>
  );
}

export function MasterCalendar() {
  const qc = useQueryClient();
  const events = useEvents();
  const projects = useProjects();
  const projectMap = byId(projects.data);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showInternal, setShowInternal] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);

  const move = useMutation({
    mutationFn: ({ ev, start, end, allDay }: { ev: CalEvent; start: Date; end: Date | null; allDay: boolean }) =>
      api.moveEvent(
        ev.id,
        allDay ? allDayIso(start.toLocaleDateString("en-CA")) : start.toISOString(),
        end ? (allDay ? allDayIso(end.toLocaleDateString("en-CA")) : end.toISOString()) : null,
        allDay,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const visible = (events.data ?? []).filter((e) => {
    if (!showInternal && !e.client_visible) return false;
    if (e.event_projects.length === 0) return !hidden.has("none");
    return e.event_projects.some((t) => !hidden.has(t.project_id));
  });

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="page wide">
      <div className="title-row">
        <h1>Master calendar</h1>
        <button className="btn primary" onClick={() => setEditing(draftFrom(null))}>
          + New event
        </button>
      </div>
      <div className="chips filter">
        {projects.data?.map((p) => (
          <button key={p.id} className={`chip ${hidden.has(p.id) ? "" : "on"}`} onClick={() => toggle(p.id)}>
            <ProjectDot color={p.color} /> {p.name}
          </button>
        ))}
        <button className={`chip ${hidden.has("none") ? "" : "on"}`} onClick={() => toggle("none")}>
          <ProjectDot color="#999" /> Untagged
        </button>
        <label className="check inline">
          <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} /> Show staff-only
        </label>
      </div>
      <p className="muted small">Click a day to add an event, click an event to edit it, or drag it to reschedule.</p>

      <ScheduleCalendar
        events={visible}
        projects={projectMap}
        editable
        showProjectNames
        onEventClick={(ev) => setEditing(draftFrom(ev))}
        onDateClick={(date, allDay) => setEditing(draftFrom(null, date, allDay))}
        onMove={(ev, start, end, allDay) => move.mutate({ ev, start, end, allDay })}
      />
      <ErrorNote error={move.error} />

      {editing && <EventEditor initial={editing} projects={projects.data ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

export { draftFrom };
