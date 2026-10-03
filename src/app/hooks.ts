import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import type { CalEvent, CalendarProject } from "../lib/types";

export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: api.fetchProjects });
export const useCustomStatuses = () => useQuery({ queryKey: ["project-statuses"], queryFn: api.fetchCustomStatuses });
export const useCalendarProjects = () => useQuery({ queryKey: ["projects", "calendar"], queryFn: api.fetchCalendarProjects });
export const useEvents = () => useQuery({ queryKey: ["events"], queryFn: api.fetchEvents });
export const useSelections = (projectId?: string) =>
  useQuery({ queryKey: ["selections", projectId ?? "all"], queryFn: () => api.fetchSelections(projectId) });
export const useDocuments = (filter: { projectId?: string; selectionId?: string; library?: boolean } = {}) =>
  useQuery({ queryKey: ["documents", filter], queryFn: () => api.fetchDocuments(filter) });
export const usePeople = () => useQuery({ queryKey: ["people"], queryFn: api.fetchPeople });
export const useQuotes = () => useQuery({ queryKey: ["quotes"], queryFn: api.fetchQuotes });

/** Signed URLs for a list of storage paths, refreshed before they expire. */
export const useSignedUrls = (bucket: "project-files" | "quote-uploads", paths: string[]) =>
  useQuery({
    queryKey: ["signed", bucket, [...paths].sort()],
    queryFn: () => api.signedUrls(bucket, paths),
    enabled: paths.length > 0,
    staleTime: 45 * 60_000,
  });

export function byId<T extends { id: string }>(rows: T[] | undefined): Record<string, T> {
  return Object.fromEntries((rows ?? []).map((r) => [r.id, r]));
}

// ---------------------------------------------------------------- dates
// All-day events are stored as midnight UTC on that date, so read them back by their UTC date
// (otherwise Pacific time would shift them to the previous day).
export const allDayDate = (iso: string) => iso.slice(0, 10);
export const allDayIso = (date: string) => `${date}T00:00:00Z`;

export function fmtDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "";
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, opts);
}

export function fmtEventWhen(ev: CalEvent) {
  if (ev.all_day) {
    const start = fmtDate(allDayDate(ev.starts_at), { weekday: "short", month: "short", day: "numeric" });
    if (!ev.ends_at) return start;
    const lastDay = new Date(new Date(ev.ends_at).getTime() - 864e5).toISOString().slice(0, 10);
    return lastDay === allDayDate(ev.starts_at)
      ? start
      : `${start} – ${fmtDate(lastDay, { weekday: "short", month: "short", day: "numeric" })}`;
  }
  const s = new Date(ev.starts_at);
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

/** Upcoming events (including ones in progress today), soonest first. */
export function upcoming(events: CalEvent[] | undefined, limit = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
  return (events ?? [])
    .filter((e) => {
      if (!e.all_day) return new Date(e.ends_at ?? e.starts_at) >= today;
      // All-day end dates are exclusive, so the last day is the day before ends_at.
      const lastDay = e.ends_at ? new Date(new Date(e.ends_at).getTime() - 864e5).toISOString().slice(0, 10) : allDayDate(e.starts_at);
      return lastDay >= todayStr;
    })
    .slice(0, limit);
}

export function projectColor(ev: CalEvent, projects: Record<string, CalendarProject>) {
  const first = ev.event_projects[0];
  return first ? projects[first.project_id]?.color ?? "#778899" : "#999999";
}

export function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
