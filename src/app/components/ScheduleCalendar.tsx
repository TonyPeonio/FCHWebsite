import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { type DateClickArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { CalEvent, CalendarProject } from "../../lib/types";
import { allDayDate, projectColor } from "../hooks";

interface Props {
  events: CalEvent[];
  projects: Record<string, CalendarProject>;
  editable?: boolean;
  /** Follow titles with project names (owner and staff view). */
  showProjectNames?: boolean;
  onEventClick?: (ev: CalEvent) => void;
  onDateClick?: (date: string, allDay: boolean) => void;
  onMove?: (ev: CalEvent, start: Date, end: Date | null, allDay: boolean) => void;
}

const isNarrow = () => window.matchMedia("(max-width: 700px)").matches;

export function ScheduleCalendar({ events, projects, editable, showProjectNames, onEventClick, onDateClick, onMove }: Props) {
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));

  const fcEvents: EventInput[] = events.map((ev) => {
    const color = projectColor(ev, projects);
    const names = ev.event_projects.map((t) => projects[t.project_id]?.name).filter(Boolean);
    return {
      id: ev.id,
      title: showProjectNames && names.length ? `${ev.title} – ${names.join(" + ")}` : ev.title,
      start: ev.all_day ? allDayDate(ev.starts_at) : ev.starts_at,
      end: ev.ends_at ? (ev.all_day ? allDayDate(ev.ends_at) : ev.ends_at) : undefined,
      allDay: ev.all_day,
      backgroundColor: color,
      borderColor: ev.client_visible ? color : "#333",
      classNames: ev.client_visible ? [] : ["fc-internal"],
    };
  });

  const moved = (arg: EventDropArg | EventResizeDoneArg) => {
    const ev = byId[arg.event.id];
    if (ev && onMove) onMove(ev, arg.event.start!, arg.event.end, arg.event.allDay);
  };

  return (
    <div className="calendar-wrap">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={isNarrow() ? "listUpcoming" : "dayGridMonth"}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: isNarrow() ? "listUpcoming,dayGridMonth" : "dayGridMonth,timeGridWeek,listUpcoming",
        }}
        buttonText={{ today: "Today", month: "Month", week: "Week" }}
        // Rolling list starting today, so "what's next" is never empty just because the month is ending.
        views={{ listUpcoming: { type: "list", duration: { days: 90 }, dateAlignment: "day", buttonText: "Upcoming" } }}
        noEventsContent="Nothing scheduled yet."
        height="auto"
        events={fcEvents}
        editable={editable}
        eventStartEditable={editable}
        eventDurationEditable={editable}
        selectable={false}
        dayMaxEvents={4}
        nowIndicator
        eventClick={(arg: EventClickArg) => {
          const ev = byId[arg.event.id];
          if (ev && onEventClick) onEventClick(ev);
        }}
        dateClick={(arg: DateClickArg) => onDateClick?.(arg.dateStr, arg.allDay)}
        eventDrop={moved}
        eventResize={moved}
      />
    </div>
  );
}
