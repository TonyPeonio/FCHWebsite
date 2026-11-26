import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../../lib/api";
import { useAuth } from "../auth";
import { byId, fmtDate, isPast, relativeDay, useDocuments, useProjects, useSignedUrls } from "../hooks";
import { DocList, Empty, ErrorNote, FilePicker, Icon, Loading, StatusBadge, UploadBar, UploadFailures, useToast } from "../components/ui";

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
  const [progress, setProgress] = useState<api.UploadProgress | null>(null);
  const [needChoice, setNeedChoice] = useState(false);
  const toast = useToast();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["selection", id] });
    qc.invalidateQueries({ queryKey: ["selections"] });
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const submit = useMutation({
    mutationFn: () => api.submitSelection(sel.data!, note, optionId, files, setProgress),
    onSuccess: () => {
      setFiles([]);
      toast("Sent! We'll review your selection and let you know.");
      invalidate();
    },
    onError: (err) => {
      // Files that did upload are saved already; keep only the ones that still need sending.
      if (err instanceof api.UploadsFailed) setFiles(err.failed.map((f) => f.file));
      invalidate();
    },
    onSettled: () => setProgress(null),
  });
  const decide = useMutation({
    mutationFn: (approve: boolean) => api.decideSelection(id, approve, staffNote),
    onSuccess: (_, approve) => {
      toast(approve ? "Approved. The client has been emailed." : "Sent back to the client with your note.");
      invalidate();
    },
  });
  const removeDoc = useMutation({ mutationFn: api.deleteDocument, onSuccess: invalidate });

  const back = (
    <Link to={isStaff ? `/admin/projects/${sel.data?.project_id ?? ""}?tab=selections` : "/selections"} className="back-link">
      <Icon name="left" size={16} /> {isStaff ? project?.name ?? "Project" : "All selections"}
    </Link>
  );
  if (sel.isLoading) {
    return (
      <div className="page narrow">
        <Loading rows={5} />
      </div>
    );
  }
  if (!sel.data) {
    return (
      <div className="page narrow">
        <Link to={isStaff ? "/admin/selections" : "/selections"} className="back-link">
          <Icon name="left" size={16} /> All selections
        </Link>
        <Empty icon="list">This selection doesn't exist any more, or isn't yours to see.</Empty>
      </div>
    );
  }
  const s = sel.data;
  const canRespond = !isStaff && (s.status === "requested" || s.status === "revision_requested");
  const chosen = s.selection_options.find((o) => o.id === s.chosen_option_id);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // With options to pick from, a response needs a pick, a note, or a file; otherwise a note or a file.
    if (!optionId && !note.trim() && !files.length) return setNeedChoice(true);
    setNeedChoice(false);
    submit.mutate();
  }

  return (
    <div className="page narrow">
      {back}
      <div className="title-row">
        <h1>{s.title}</h1>
        <StatusBadge status={s.status} />
      </div>
      {s.due_date && s.status !== "approved" && (
        <p className={isPast(s.due_date) && s.status !== "submitted" ? "overdue" : "muted"}>
          {isStaff ? "Due" : "Please respond by"} {fmtDate(s.due_date)} ({relativeDay(s.due_date)})
        </p>
      )}
      {s.instructions && <p className="pre">{s.instructions}</p>}

      {s.status === "revision_requested" && s.staff_note && (
        <p className="notice warn">
          <strong>Note from First Choice Homes:</strong> {s.staff_note}
        </p>
      )}
      {s.status === "submitted" && !isStaff && (
        <p className="notice info">Thanks! We have your selection and will review it soon. You'll get an email when we do.</p>
      )}
      {s.status === "approved" && (
        <p className="notice ok">
          Approved{s.decided_at && ` on ${fmtDate(s.decided_at)}`}.{s.staff_note && ` ${s.staff_note}`}
        </p>
      )}

      <form onSubmit={onSubmit}>
        {s.selection_options.length > 0 && (
          <div className="options" role={canRespond ? "radiogroup" : undefined} aria-label={canRespond ? "Options to choose from" : undefined}>
            {s.selection_options.map((o) => {
              const selected = canRespond ? optionId === o.id : s.chosen_option_id === o.id;
              return (
                <label key={o.id} className={`option ${selected ? "selected" : ""} ${canRespond ? "" : "readonly"}`}>
                  {canRespond && (
                    <input type="radio" name="option" checked={optionId === o.id} onChange={() => (setOptionId(o.id), setNeedChoice(false))} />
                  )}
                  {o.image_path && optionImages.data?.[o.image_path] && <img src={optionImages.data[o.image_path]} alt={o.label} />}
                  <strong>{o.label}</strong>
                  {o.description && <small>{o.description}</small>}
                  {!canRespond && selected && (
                    <span className="chosen">
                      <Icon name="check" size={14} /> Chosen
                    </span>
                  )}
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
            <FilePicker wholePage files={files} onChange={(f) => (setFiles(f), setNeedChoice(false))} label="Add photos or files" disabled={submit.isPending} />
            {needChoice && (
              <p className="notice warn" role="alert">
                {s.selection_options.length ? "Pick one of the options above, or tell us what you'd like in the notes." : "Add a note or a photo so we know what you'd like."}
              </p>
            )}
            {submit.isPending && files.length > 0 ? (
              <UploadBar progress={progress} />
            ) : (
              <button className="btn primary" disabled={submit.isPending}>
                {submit.isPending ? "Sending…" : "Submit my selection"}
              </button>
            )}
            {submit.error instanceof api.UploadsFailed ? <UploadFailures failed={submit.error.failed} /> : <ErrorNote error={submit.error} />}
          </div>
        ) : (
          (s.client_note || chosen) && (
            <div className="card">
              <h2>{isStaff ? "Client response" : "Your response"}</h2>
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
            <textarea rows={3} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} placeholder="e.g. Great choice, ordering this week." />
          </label>
          <div className="btn-row">
            <button className="btn primary" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
              <Icon name="check" size={16} /> Approve
            </button>
            <button
              className="btn"
              disabled={decide.isPending}
              onClick={() => {
                if (staffNote.trim() || confirm("Send it back without a note? The client won't know what to change.")) decide.mutate(false);
              }}
            >
              Ask for changes
            </button>
          </div>
          <p className="muted small">Either way the client gets an email. Asking for changes lets them choose again.</p>
          <ErrorNote error={decide.error} />
        </section>
      )}
    </div>
  );
}
