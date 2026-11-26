import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import type { Quote, QuoteStatus } from "../../../lib/types";
import { Empty, ErrorNote, Icon, Loading, useToast } from "../../components/ui";
import { useAuth } from "../../auth";
import { byId, fmtDate, useProjects, useQuotes, useSignedUrls } from "../../hooks";
import { ProjectForm } from "./Projects";

const STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Became a project" },
  { value: "declined", label: "Declined" },
];

const FILTERS = {
  open: { label: "New & contacted", test: (q: Quote) => q.status === "new" || q.status === "contacted" },
  new: { label: "New", test: (q: Quote) => q.status === "new" },
  converted: { label: "Became a project", test: (q: Quote) => q.status === "converted" },
  declined: { label: "Declined", test: (q: Quote) => q.status === "declined" },
  all: { label: "All", test: () => true },
};
type Filter = keyof typeof FILTERS;

function QuoteCard({ q }: { q: Quote }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [notes, setNotes] = useState(q.staff_notes ?? "");
  const [creating, setCreating] = useState(false);
  const files = useSignedUrls("quote-uploads", q.file_paths);
  const projects = useProjects();
  const project = q.project_id ? byId(projects.data)[q.project_id] : undefined;
  const update = useMutation({
    mutationFn: (fields: Parameters<typeof api.updateQuote>[1]) => api.updateQuote(q.id, fields),
    onSuccess: (_, fields) => {
      if (fields.staff_notes !== undefined) toast("Notes saved.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const { isOwner } = useAuth();
  const who = q.name || q.email;

  return (
    <article className={`card quote ${q.status}`} aria-label={`Inquiry from ${who}`}>
      <div className="card-head">
        <h2>
          {who} {q.status === "new" && <span className="badge badge-submitted">New</span>}
        </h2>
        <label className="inline">
          <span className="sr-only">Status of the inquiry from {who}</span>
          <select value={q.status} disabled={!isOwner || update.isPending} onChange={(e) => update.mutate({ status: e.target.value as QuoteStatus })}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">Received {fmtDate(q.submitted_at ?? q.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
      <p className="contact-line">
        <a href={`mailto:${q.email}?subject=${encodeURIComponent("Your inquiry — First Choice Homes")}`}>{q.email}</a>
        {q.phone && <a href={`tel:${q.phone}`}>{q.phone}</a>}
        {q.address && <span>{q.address}</span>}
      </p>
      {q.message && <p className="pre quote-msg">{q.message}</p>}
      {q.file_paths.length > 0 && (
        <ul className="doc-list" aria-label="Attached files">
          {q.file_paths.map((p) => (
            <li key={p}>
              <a href={files.data?.[p]} target="_blank" rel="noopener" className="doc-link">
                <Icon name="file" /> {p.split("/").pop()!.replace(/^\d+-/, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
      <label>
        Notes for yourself <small className="muted">(the customer never sees these; saved when you click away)</small>
        <textarea rows={2} value={notes} readOnly={!isOwner} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (q.staff_notes ?? "") && update.mutate({ staff_notes: notes })} />
      </label>
      {isOwner &&
        (project ? (
          <p className="muted small">
            Became the project <Link to={`/admin/projects/${project.id}`}>{project.name}</Link>.
          </p>
        ) : (
          q.status !== "declined" && (
            <button className="btn small" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} /> Start a project from this inquiry
            </button>
          )
        ))}
      <ErrorNote error={update.error} />
      {creating && (
        <ProjectForm
          defaults={{ name: q.name ? `${q.name.trim().split(/\s+/).pop()} Residence` : "", address: q.address ?? "" }}
          onClose={(saved) => {
            setCreating(false);
            if (!saved) return;
            // Link the inquiry to its new project, then go there to invite the client.
            update.mutate(
              { status: "converted", project_id: saved.id },
              // The invitation form there starts filled in with who sent the inquiry.
              { onSettled: () => navigate(`/admin/projects/${saved.id}?tab=clients`, { state: { inviteName: q.name ?? "", inviteEmail: q.email } }) },
            );
          }}
        />
      )}
    </article>
  );
}

export function Quotes() {
  const quotes = useQuotes();
  const [filter, setFilter] = useState<Filter>("open");
  const all = quotes.data ?? [];
  const rows = all.filter(FILTERS[filter].test);

  return (
    <div className="page">
      <h1>Website inquiries</h1>
      <p className="lead">Every inquiry sent through the website's contact form, newest first. They're also emailed to the office.</p>
      <div className="chips filter" role="group" aria-label="Show inquiries">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {FILTERS[f].label} <span className="chip-count">{all.filter(FILTERS[f].test).length}</span>
          </button>
        ))}
      </div>
      {quotes.isLoading ? (
        <Loading rows={4} />
      ) : rows.length ? (
        rows.map((q) => <QuoteCard key={q.id} q={q} />)
      ) : (
        <div className="card">
          <Empty icon="inbox">
            {all.length === 0 ? "No inquiries yet. When someone fills out the form on the website, it shows up here." : "No inquiries in this list right now."}
          </Empty>
        </div>
      )}
      <ErrorNote error={quotes.error} />
    </div>
  );
}
