import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import { CATEGORY_LABEL, DOC_KIND_LABEL, type Doc, type DocumentKind, type Project } from "../../../lib/types";
import { DocList, Empty, ErrorNote, FilePicker, Modal, ProjectDot, StatusBadge, TypeToConfirm, UploadFailures } from "../../components/ui";
import { useAuth } from "../../auth";
import { byId, fmtDate, fmtEventWhen, upcoming, useDocuments, useEvents, usePeople, useProjects, useSelections } from "../../hooks";
import { draftFrom, EventEditor } from "./MasterCalendar";
import { ProjectForm, STATUS_OPTIONS } from "./Projects";

type Tab = "overview" | "selections" | "files" | "clients";

export function ProjectDetail() {
  const { id = "" } = useParams();
  const projects = useProjects();
  const project = byId(projects.data)[id];
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<false | "edit" | "complete">(false);
  const [deleting, setDeleting] = useState(false);
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const setCompleted = useMutation({
    mutationFn: (done: boolean) =>
      api.saveProject(
        done
          ? { id, status: "complete", completed_on: new Date().toLocaleDateString("en-CA") }
          : { id, status: "active", completed_on: null },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  if (!project) return <div className="page">{projects.isLoading ? "Loading…" : "Project not found."}</div>;

  return (
    <div className="page">
      <p>
        <Link to="/admin/projects">← Projects</Link>
      </p>
      <div className="title-row">
        <h1>
          <ProjectDot color={project.color} /> {project.name}
        </h1>
        {isOwner && (
          <div className="btn-row">
            <button
              className="btn"
              disabled={setCompleted.isPending}
              onClick={() => {
                if (project.status === "complete") setCompleted.mutate(false);
                // The website needs both to list the project, so ask for them first.
                else if (!project.category || !project.city?.trim()) setEditing("complete");
                else setCompleted.mutate(true);
              }}
            >
              {project.status === "complete" ? "Reopen" : "Mark completed"}
            </button>
            <button className="btn" onClick={() => setEditing("edit")}>
              Edit
            </button>
            <button className="btn danger" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </div>
        )}
      </div>
      <p className="muted">
        {project.category && <>{CATEGORY_LABEL[project.category]} · </>}
        {project.address && <>{project.address} · </>}
        {STATUS_OPTIONS.find((s) => s.value === project.status)?.label}
        {project.status === "complete"
          ? project.completed_on && <> {fmtDate(project.completed_on)}</>
          : project.target_completion && <> · Target {fmtDate(project.target_completion)}</>}
      </p>
      <ErrorNote error={setCompleted.error} />
      {isOwner && project.status === "complete" && (!project.category || !project.city?.trim()) && (
        <p className="notice warn">
          This project won't appear on the website until it has a build type and city.{" "}
          <button className="link-btn" onClick={() => setEditing("edit")}>
            Add them
          </button>
        </p>
      )}

      <div className="tabs" role="tablist">
        {(["overview", "selections", "files", "clients"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "files" ? "Photos & files" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview projectId={id} />}
      {tab === "selections" && <SelectionsTab projectId={id} />}
      {tab === "files" && <FilesTab project={project} />}
      {tab === "clients" && <ClientsTab projectId={id} />}

      {editing && <ProjectForm project={project} completing={editing === "complete"} onClose={() => setEditing(false)} />}
      {deleting && <DeleteProject project={project} onClose={() => setDeleting(false)} />}
    </div>
  );
}

/** Deleting also removes the project's photos and files, so the name must be typed to confirm. */
function DeleteProject({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      navigate("/admin/projects");
      qc.invalidateQueries();
    },
  });
  return (
    <TypeToConfirm
      title="Delete project"
      name={project.name}
      action="Delete project"
      pending={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    >
      <p>
        This permanently deletes <strong>{project.name}</strong>, including its photos and files, selections, and
        clients' access to it. Calendar events tagged to it stay on the calendar. This can't be undone.
      </p>
    </TypeToConfirm>
  );
}

function Overview({ projectId }: { projectId: string }) {
  const events = useEvents();
  const projects = useProjects();
  const [adding, setAdding] = useState(false);
  const { isOwner } = useAuth();
  const mine = (events.data ?? []).filter((e) => e.event_projects.some((t) => t.project_id === projectId));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Upcoming schedule</h2>
        <span>
          {isOwner && (
            <>
              <button className="btn small" onClick={() => setAdding(true)}>
                + Add event
              </button>{" "}
            </>
          )}
          <Link to="/admin/calendar">Master calendar →</Link>
        </span>
      </div>
      {upcoming(mine, 15).length === 0 ? (
        <Empty>No upcoming events for this project.</Empty>
      ) : (
        <ul className="rows">
          {upcoming(mine, 15).map((e) => (
            <li key={e.id}>
              <span>
                {e.title} {!e.client_visible && <small className="muted">(staff only)</small>}
              </span>
              <small>{fmtEventWhen(e)}</small>
            </li>
          ))}
        </ul>
      )}
      {adding && <EventEditor initial={draftFrom(null, undefined, true, projectId)} projects={projects.data ?? []} onClose={() => setAdding(false)} />}
    </section>
  );
}

function SelectionsTab({ projectId }: { projectId: string }) {
  const selections = useSelections(projectId);
  const [creating, setCreating] = useState(false);
  const { isOwner } = useAuth();
  return (
    <section className="card">
      <div className="card-head">
        <h2>Selections</h2>
        {isOwner && (
          <button className="btn small primary" onClick={() => setCreating(true)}>
            + Request a selection
          </button>
        )}
      </div>
      {selections.data?.length ? (
        <ul className="rows">
          {selections.data.map((s) => (
            <li key={s.id}>
              <Link to={`/selections/${s.id}`}>{s.title}</Link>
              <span>
                {s.due_date && s.status !== "approved" && <small>Due {fmtDate(s.due_date)} </small>}
                <StatusBadge status={s.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No selections yet. Ask the client to choose tile, paint, fixtures, etc.</Empty>
      )}
      {creating && <NewSelection projectId={projectId} onClose={() => setCreating(false)} />}
    </section>
  );
}

function NewSelection({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [options, setOptions] = useState<api.NewOption[]>([]);

  const create = useMutation({
    mutationFn: () => api.createSelection({ project_id: projectId, title: title.trim(), instructions: instructions.trim(), due_date: due || null }, options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["selections"] });
      onClose();
    },
  });

  const setOpt = (i: number, patch: Partial<api.NewOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <Modal title="Request a selection" onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label>
          What do they need to choose?
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Master bath floor tile" />
        </label>
        <label>
          Instructions
          <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Allowance, where to shop, sizes, anything they should know." />
        </label>
        <label>
          Due date (optional)
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>

        <fieldset>
          <legend>Options to choose from (optional)</legend>
          <small className="muted">Leave empty to let the client describe or upload their own choice.</small>
          {options.map((o, i) => (
            <div key={i} className="option-edit">
              <input placeholder="Option name" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
              <input placeholder="Details (price, finish…)" value={o.description} onChange={(e) => setOpt(i, { description: e.target.value })} />
              <label className="btn small">
                {o.image ? "✓ Photo" : "Photo"}
                <input type="file" accept="image/*" hidden onChange={(e) => setOpt(i, { image: e.target.files?.[0] ?? null })} />
              </label>
              <button type="button" className="icon-btn" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setOptions([...options, { label: "", description: "" }])}>
            + Add option
          </button>
        </fieldset>

        <button className="btn primary" disabled={create.isPending}>
          {create.isPending ? "Sending…" : "Send to client"}
        </button>
        <p className="muted small">Clients on this project get an email with a link.</p>
        <ErrorNote error={create.error} />
      </form>
    </Modal>
  );
}

const STAFF_KINDS: DocumentKind[] = ["photo", "plan", "permit", "contract", "other"];

function FilesTab({ project }: { project: Project }) {
  const projectId = project.id;
  const qc = useQueryClient();
  const docs = useDocuments({ projectId });
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<DocumentKind>("photo");
  const [caption, setCaption] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const [done, setDone] = useState(0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["documents"] });
  const { isOwner } = useAuth();

  const [failed, setFailed] = useState<api.UploadFailure[]>([]);
  const upload = useMutation({
    mutationFn: async () => {
      setDone(0);
      return api.uploadAll(
        files,
        (file) => api.uploadToProject(file, { projectId, folder: "docs", kind, caption, clientVisible }),
        () => setDone((n) => n + 1),
      );
    },
    onSuccess: (failures) => {
      setFailed(failures);
      setFiles(failures.map((f) => f.file));
      if (!failures.length) setCaption("");
      refresh();
    },
  });
  const website = useMutation({
    mutationFn: (d: Doc) => api.setShowOnWebsite(d.id, !d.show_on_website),
    onSuccess: refresh,
  });
  const completed = project.status === "complete";
  const remove = useMutation({ mutationFn: api.deleteDocument, onSuccess: refresh });
  const toggle = useMutation({
    mutationFn: (d: { id: string; client_visible: boolean }) => api.setDocumentVisibility(d.id, !d.client_visible),
    onSuccess: refresh,
  });

  return (
    <>
      {isOwner && (
      <section className="card">
        <h2>Upload</h2>
        <FilePicker
          files={files}
          onChange={(f) => {
            setFiles(f);
            setFailed([]);
          }}
        />
        {files.length > 0 && (
          <>
            <div className="grid-2 tight">
              <label>
                Type
                <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
                  {STAFF_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {DOC_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Caption (optional)
                <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Trusses are up!" />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} /> Visible to client
            </label>
            <button className="btn primary" disabled={upload.isPending} onClick={() => upload.mutate()}>
              {upload.isPending ? `Uploading ${Math.min(done + 1, files.length)} of ${files.length}…` : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
            </button>
          </>
        )}
        <UploadFailures failed={failed} />
        <ErrorNote error={upload.error ?? remove.error ?? toggle.error ?? website.error} />
      </section>
      )}
      {(docs.data?.length ?? 0) === 0 && <Empty>No photos or files yet.</Empty>}

      {(["photo", "plan", "permit", "contract", "selection", "other"] as DocumentKind[]).map((k) => {
        const group = (docs.data ?? []).filter((d) => d.kind === k);
        if (!group.length) return null;
        return (
          <section key={k} className="card">
            <h2>{DOC_KIND_LABEL[k]}</h2>
            {k === "photo" && isOwner && !completed && (
              <p className="muted small">Mark the project completed to choose photos for the website.</p>
            )}
            <DocList
              docs={group}
              onDelete={isOwner ? (d) => remove.mutate(d) : undefined}
              onToggleVisible={isOwner ? (d) => toggle.mutate(d) : undefined}
              onToggleWebsite={isOwner && completed ? (d) => website.mutate(d) : undefined}
            />
          </section>
        );
      })}
    </>
  );
}

function ClientsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const people = usePeople();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { isOwner } = useAuth();
  const members = (people.data ?? []).filter((u) => u.project_members.some((m) => m.project_id === projectId));

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, fullName: name, role: "client", projectId }),
    onSuccess: (r) => {
      setResult(r.invited ? `Invitation sent to ${email}.` : `${email} already had an account and now has access to this project.`);
      setEmail("");
      setName("");
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.removeMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });

  return (
    <section className="card">
      <h2>Who can see this project</h2>
      {members.length ? (
        <ul className="rows">
          {members.map((m) => (
            <li key={m.id}>
              <span>
                {m.full_name || m.email} <small className="muted">{m.email}</small>
              </span>
              {isOwner && (
                <button className="link-btn small danger" onClick={() => confirm(`Remove ${m.email} from this project?`) && remove.mutate(m.id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No clients yet.</Empty>
      )}

      {isOwner && (
      <form
        className="invite-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setResult(null);
          invite.mutate();
        }}
      >
        <h3>Invite a client</h3>
        <div className="grid-2 tight">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <button className="btn primary" disabled={invite.isPending}>
          {invite.isPending ? "Sending…" : "Send invitation"}
        </button>
        {result && <p className="notice ok">{result}</p>}
        <ErrorNote error={invite.error ?? remove.error} />
      </form>
      )}
    </section>
  );
}
