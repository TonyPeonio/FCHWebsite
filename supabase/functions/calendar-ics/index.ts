// Read-only calendar feed for Google/Apple/Outlook: GET /calendar-ics?token=<feed_token>
// Staff get every event; clients get only client-visible events on their projects.
import { adminClient, corsHeaders, HttpError, serve } from "../_shared/util.ts";

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > 75) {
      out.push(current);
      current = " " + ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n");
}

const utcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10).replace(/-/g, "");

serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new HttpError(404, "Not found");

  const db = adminClient();
  const { data: profile } = await db.from("profiles").select("id, role").eq("feed_token", token).maybeSingle();
  if (!profile) throw new HttpError(404, "Not found");
  const isStaff = profile.role === "owner" || profile.role === "staff";

  const from = new Date(Date.now() - 60 * 864e5).toISOString();
  const to = new Date(Date.now() + 365 * 864e5).toISOString();

  let query = db
    .from("events")
    .select("id, title, notes, starts_at, ends_at, all_day, client_visible, updated_at, event_projects(project_id, projects(name))")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");

  let memberProjects: string[] = [];
  if (!isStaff) {
    const { data: m } = await db.from("project_members").select("project_id").eq("user_id", profile.id);
    memberProjects = (m ?? []).map((r) => r.project_id);
    query = query.eq("client_visible", true);
  }

  const { data: events, error } = await query;
  if (error) throw error;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//First Choice Homes//Project Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${isStaff ? "First Choice Homes — All Projects" : "First Choice Homes — My Project"}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const ev of events ?? []) {
    // deno-lint-ignore no-explicit-any
    const tags = (ev.event_projects ?? []) as any[];
    const visibleTags = isStaff ? tags : tags.filter((t) => memberProjects.includes(t.project_id));
    if (!isStaff && visibleTags.length === 0) continue;

    const projectNames = visibleTags.map((t) => t.projects?.name).filter(Boolean);
    const summary = isStaff && projectNames.length ? `${ev.title} – ${projectNames.join(" + ")}` : ev.title;

    lines.push("BEGIN:VEVENT", `UID:${ev.id}@firstchoicehomesllc.org`, `DTSTAMP:${utcStamp(ev.updated_at)}`);
    if (ev.all_day) {
      const start = dateOnly(ev.starts_at);
      const endIso = ev.ends_at ?? new Date(new Date(ev.starts_at).getTime() + 864e5).toISOString();
      lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${dateOnly(endIso)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(ev.starts_at)}`);
      if (ev.ends_at) lines.push(`DTEND:${utcStamp(ev.ends_at)}`);
    }
    lines.push(`SUMMARY:${escapeText(summary)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeText(ev.notes)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="schedule.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
});
