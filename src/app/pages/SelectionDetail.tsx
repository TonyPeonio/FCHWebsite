import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../../lib/api";
import { useAuth } from "../auth";
import { byId, fmtDate, useDocuments, useProjects, useSignedUrls } from "../hooks";
import { DocList, ErrorNote, FilePicker, StatusBadge } from "../components/ui";

export function SelectionDetail() {
  const { id = "" } = useParams();
  const { isStaff, isOwner, session } = useAuth();
  const qc = useQueryClient();
  const sel = useQuery({ queryKey: ["selection", id], queryFn: () => api.fetchSelection(id) });
  const docs = useDocuments({ selectionId: id });
  const projects = useProjects();
  const project = byId(projects.data)[sel.data?.project_id ?? ""];
  const optionImages = useSignedUrls(
    "project-files",
    (sel.data?.selection_options ?? []).map((o) => o.image_path ?? "").filter(Boolean),
  );

  const [optionId, setOptionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [staffNote, setStaffNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["selection", id] });
    qc.invalidateQueries({ queryKey: ["selections"] });
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const submit = useMutation({
    mutationFn: () => api.submitSelection(sel.data!, note, optionId, files),
    onSuccess: () => {
      setFiles([]);
      invalidate();
    },
  });
  const decide = useMutation({
    mutationFn: (approve: boolean) => api.decideSelection(id, approve, staffNote),
    onSuccess: invalidate,
  });
  const removeDoc = useMutation({ mutationFn: api.deleteDocument, onSuccess: invalidate });

  if (sel.isLoading) return <div className="page">Loading…</div>;
  if (!sel.data) return <div className="page"><ErrorNote error={sel.error ?? "Selection not found"} /></div>;
  const s = sel.data;
  const canRespond = !isStaff && (s.status === "requested" || s.status === "revision_requested");
  const chosen = s.selection_options.find((o) => o.id === s.chosen_option_id);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (s.selection_options.length && !optionId && !note.trim() && !files.length) return;
    submit.mutate();
  }

  return (
    <div className="page narrow">
      <p>
        <Link to={isStaff ? `/admin/projects/${s.project_id}` : "/selections"}>← {isStaff ? project?.name ?? "Project" : "All selections"}</Link>
      </p>
      <div className="title-row">
        <h1>{s.title}</h1>
        <StatusBadge status={s.status} />
      </div>
      {s.due_date && s.status !== "approved" && <p className="muted">Please respond by {fmtDate(s.due_date)}</p>}
      {s.instructions && <p className="pre">{s.instructions}</p>}

      {s.status === "revision_requested" && s.staff_note && (
        <p className="notice warn">
          <strong>Note from First Choice Homes:</strong> {s.staff_note}
        </p>
      )}
      {s.status === "approved" && (
        <p className="notice ok">
          Approved{s.decided_at && ` on ${fmtDate(s.decided_at)}`}.{s.staff_note && ` ${s.staff_note}`}
        </p>
      )}

      <form onSubmit={onSubmit}>
        {s.selection_options.length > 0 && (
          <div className="options">
            {s.selection_options.map((o) => {
              const selected = canRespond ? optionId === o.id : s.chosen_option_id === o.id;
              return (
                <label key={o.id} className={`option ${selected ? "selected" : ""} ${canRespond ? "" : "readonly"}`}>
                  {canRespond && (
                    <input type="radio" name="option" checked={optionId === o.id} onChange={() => setOptionId(o.id)} />
                  )}
                  {o.image_path && optionImages.data?.[o.image_path] && <img src={optionImages.data[o.image_path]} alt={o.label} />}
                  <strong>{o.label}</strong>
                  {o.description && <small>{o.description}</small>}
                  {!canRespond && selected && <span className="chosen">✓ Chosen</span>}
                </label>
              );
            })}
          </div>
        )}

        {canRespond ? (
          <div className="card">
            <label>
              Notes {s.selection_options.length ? "(optional)" : ""}
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell us what you chose, a product name/code, or anything we should know."
              />
            </label>
            <FilePicker files={files} onChange={setFiles} label="Upload photos or files" />
            <button className="btn primary" disabled={submit.isPending}>
              {submit.isPending ? "Sending…" : "Submit my selection"}
            </button>
            <ErrorNote error={submit.error} />
          </div>
        ) : (
          (s.client_note || chosen) && (
            <div className="card">
              <h2>Client response</h2>
              {chosen && <p>Chose: <strong>{chosen.label}</strong></p>}
              {s.client_note && <p className="pre">{s.client_note}</p>}
              {s.submitted_at && <small className="muted">Submitted {fmtDate(s.submitted_at)}</small>}
            </div>
          )
        )}
      </form>

      {(docs.data?.length ?? 0) > 0 && (
        <section className="card">
          <h2>Uploaded files</h2>
          <DocList
            docs={docs.data!}
            onDelete={(d) => removeDoc.mutate(d)}
            canDelete={(d) => isOwner || (canRespond && d.uploaded_by === session?.user.id)}
          />
        </section>
      )}

      {isOwner && s.status === "submitted" && (
        <section className="card">
          <h2>Review</h2>
          <label>
            Note to client (optional)
            <textarea rows={3} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} placeholder="e.g. Great choice — ordering this week." />
          </label>
          <div className="btn-row">
            <button className="btn primary" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
              Approve
            </button>
            <button className="btn" disabled={decide.isPending} onClick={() => decide.mutate(false)}>
              Request changes
            </button>
          </div>
          <ErrorNote error={decide.error} />
        </section>
      )}
    </div>
  );
}
