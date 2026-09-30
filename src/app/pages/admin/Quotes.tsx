import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import type { Quote, QuoteStatus } from "../../../lib/types";
import { Empty, ErrorNote } from "../../components/ui";
import { useAuth } from "../../auth";
import { fmtDate, useQuotes, useSignedUrls } from "../../hooks";

const STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Became a project" },
  { value: "declined", label: "Declined" },
];

function QuoteCard({ q }: { q: Quote }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(q.staff_notes ?? "");
  const files = useSignedUrls("quote-uploads", q.file_paths);
  const update = useMutation({
    mutationFn: (fields: Parameters<typeof api.updateQuote>[1]) => api.updateQuote(q.id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  const { isOwner } = useAuth();

  return (
    <article className={`card quote ${q.status}`}>
      <div className="card-head">
        <h2>{q.name || q.email}</h2>
        <select value={q.status} disabled={!isOwner} onChange={(e) => update.mutate({ status: e.target.value as QuoteStatus })}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">Received {fmtDate(q.submitted_at ?? q.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
      <p>
        <a href={`mailto:${q.email}?subject=${encodeURIComponent("Your quote request — First Choice Homes")}`}>{q.email}</a>
        {q.phone && (
          <>
            {" · "}
            <a href={`tel:${q.phone}`}>{q.phone}</a>
          </>
        )}
        {q.address && <> · {q.address}</>}
      </p>
      {q.message && <p className="pre quote-msg">{q.message}</p>}
      {q.file_paths.length > 0 && (
        <ul className="doc-list">
          {q.file_paths.map((p) => (
            <li key={p}>
              <a href={files.data?.[p]} target="_blank" rel="noopener">
                📄 {p.split("/").pop()!.replace(/^\d+-/, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
      <label>
        Internal notes
        <textarea rows={2} value={notes} readOnly={!isOwner} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (q.staff_notes ?? "") && update.mutate({ staff_notes: notes })} />
      </label>
      <ErrorNote error={update.error} />
    </article>
  );
}

export function Quotes() {
  const quotes = useQuotes();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const rows = (quotes.data ?? []).filter((q) => filter === "all" || q.status === "new" || q.status === "contacted");

  return (
    <div className="page">
      <div className="title-row">
        <h1>Quote requests</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")}>
          <option value="open">New & contacted</option>
          <option value="all">All</option>
        </select>
      </div>
      <p className="muted small">Every request from the website's "Get a Free Quote" form. They're also emailed to the office.</p>
      {rows.length ? rows.map((q) => <QuoteCard key={q.id} q={q} />) : <Empty>No quote requests.</Empty>}
    </div>
  );
}
