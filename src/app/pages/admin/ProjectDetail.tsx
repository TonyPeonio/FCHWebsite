import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import { CATEGORY_LABEL, DOC_KIND_LABEL, projectStatusLabel, type Doc, type DocumentKind, type Project } from "../../../lib/types";
import { DocList, Empty, ErrorNote, FilePicker, Icon, Loading, Modal, plural, ProjectDot, StatusBadge, Tabs, TypeToConfirm, UploadBar, UploadFailures, useToast } from "../../components/ui";
import { useAuth } from "../../auth";
import { byId, fmtDate, fmtEventWhen, isPast, upcoming, useCustomStatuses, useDocuments, useEvents, usePeople, useProjects, useSelections } from "../../hooks";
import { draftFrom, EventEditor } from "./MasterCalendar";
import { ProjectForm } from "./Projects";

type Tab = "overview" | "selections" | "files" | "clients";
const TABS: Tab[] = ["overview", "selections", "files", "clients"];

export function ProjectDetail() {
  const { id = "" } = useParams();
  const projects = useProjects();
  const statuses = useCustomStatuses();
  const project = byId(projects.data)[id];
  // The open tab is part of the address (?tab=files), so Back and reloading keep your place.
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "overview";
  const setTab = (t: Tab) => setParams(t === "overview" ? {} : { tab: t }, { replace: true });
  const selections = useSelections(id);
  const docs = useDocuments({ projectId: id });
  const people = usePeople();
  const toast = useToast();
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
    onSuccess: (_, done) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast(done ? "Marked completed. Choose photos for the website on the Photos & files tab." : "Project reopened.");
      if (done) setTab("files");
    },
  });

  if (!project) {
    return (
      <div className="page">
        <Link to="/admin/projects" className="back-link">
          <Icon name="left" size={16} /> Projects
        </Link>
        {projects.isLoading ? <Loading rows={4} /> : <Empty icon="home">This project doesn't exist any more.</Empty>}
      </div>
    );
  }
  const toReview = (selections.data ?? []).filter((s) => s.status === "submitted").length;
  const onWebsite = (docs.data ?? []).filter((d) => d.show_on_website).length;
  const members = (people.data ?? []).filter((u) => u.project_members.some((m) => m.project_id === id)).length;

  return (
    <div className="page">
      <Link to="/admin/projects" className="back-link">
        <Icon name="left" size={16} /> Projects
      </Link>
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
        {projectStatusLabel(project, statuses.data)}
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

      {isOwner && project.status === "complete" && project.category && project.city?.trim() && (
        <p className={`notice ${onWebsite ? "ok" : "info"}`}>
          {onWebsite
            ? `${plural(onWebsite, "photo")} from this project ${onWebsite === 1 ? "is" : "are"} on the website's Our Work section.`
            : "This project is complete. Choose which photos appear on the website's Our Work section."}{" "}
          {tab !== "files" && (
            <button className="link-btn" onClick={() => setTab("files")}>
              {onWebsite ? "Change photos" : "Choose photos"}
            </button>
          )}
        </p>
      )}

      <Tabs
        label="Project sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Schedule" },
          { id: "selections", label: "Selections", count: toReview },
          { id: "files", label: "Photos & files", count: docs.data?.length },
          { id: "clients", label: "Clients", count: members },
        ]}
      />

      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <Overview projectId={id} />}
        {tab === "selections" && <SelectionsTab projectId={id} />}
        {tab === "files" && <FilesTab project={project} />}
        {tab === "clients" && <ClientsTab projectId={id} />}
      </div>

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
  const [editing, setEditing] = useState<ReturnType<typeof draftFrom> | null>(null);
  const { isOwner } = useAuth();
  const mine = (events.data ?? []).filter((e) => e.event_projects.some((t) => t.project_id === projectId));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Upcoming schedule</h2>
        <span>
          {isOwner && (
            <>
              <button className="btn small" onClick={() => setEditing(draftFrom(null, undefined, true, projectId))}>
                <Icon name="plus" size={14} /> Add event
              </button>{" "}
            </>
          )}
          <Link to="/admin/calendar">Master calendar →</Link>
        </span>
      </div>
      {events.isLoading ? (
        <Loading />
      ) : upcoming(mine, 15).length === 0 ? (
        <Empty icon="calendar">Nothing is scheduled for this project yet. Add an event and the clients on it will see it too.</Empty>
      ) : (
        <ul className="rows">
          {upcoming(mine, 15).map((e) => (
            <li key={e.id}>
              <span>
                {isOwner ? (
                  <button className="link-btn" onClick={() => setEditing(draftFrom(e))}>
                    {e.title}
                  </button>
                ) : (
                  e.title
                )}{" "}
                {!e.client_visible && <small className="muted">(staff only)</small>}
              </span>
              <small>{fmtEventWhen(e)}</small>
            </li>
          ))}
        </ul>
      )}
      {editing && <EventEditor initial={editing} projects={projects.data ?? []} onClose={() => setEditing(null)} />}
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
            <Icon name="plus" size={14} /> Request a selection
          </button>
        )}
      </div>
      {selections.data?.length ? (
        <ul className="rows">
          {selections.data.map((s) => (
            <li key={s.id}>
              <Link to={`/selections/${s.id}`}>{s.title}</Link>
              <span>
                {s.due_date && s.status !== "approved" && (
                  <small className={isPast(s.due_date) && s.status !== "submitted" ? "overdue" : undefined}>Due {fmtDate(s.due_date)} </small>
                )}
                <StatusBadge status={s.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : selections.isLoading ? (
        <Loading />
      ) : (
        <Empty icon="list">No selections yet. Request one to ask the client to choose tile, paint, fixtures, and so on; they get an email with a link.</Empty>
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
  const toast = useToast();

  const create = useMutation({
    mutationFn: () => api.createSelection({ project_id: projectId, title: title.trim(), instructions: instructions.trim(), due_date: due || null }, options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["selections"] });
      toast("Selection sent to the client.");
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
              <input aria-label={`Option ${i + 1} name`} placeholder="Option name" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
              <input aria-label={`Option ${i + 1} details`} placeholder="Details (price, finish…)" value={o.description} onChange={(e) => setOpt(i, { description: e.target.value })} />
              <label className="btn small" title={o.image?.name}>
                {o.image ? (
                  <>
                    <Icon name="check" size={14} /> Photo added
                  </>
                ) : (
                  <>
                    <Icon name="photo" size={14} /> Add photo
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" aria-label={`Photo for option ${i + 1}`} onChange={(e) => setOpt(i, { image: e.target.files?.[0] ?? null })} />
              </label>
              <button type="button" className="icon-btn" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                <Icon name="close" size={16} />
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
const isPhotoFile = (f: File) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);

function FilesTab({ project }: { project: Project }) {
  const projectId = project.id;
  const qc = useQueryClient();
  const toast = useToast();
  const docs = useDocuments({ projectId });
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<DocumentKind>("photo");
  const [caption, setCaption] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const [onWebsite, setOnWebsite] = useState(false);
  const [progress, setProgress] = useState<api.UploadProgress | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["documents"] });
  const { isOwner } = useAuth();
  const completed = project.status === "complete";
  const photos = files.filter(isPhotoFile).length;
  // "Photos" only fits pictures; anything else chosen alongside them is filed under Other.
  const kindFor = (file: File): DocumentKind => (kind === "photo" && !isPhotoFile(file) ? "other" : kind);

  const [failed, setFailed] = useState<api.UploadFailure[]>([]);
  const upload = useMutation({
    mutationFn: () =>
      api.uploadAll(
        files,
        (file, onProgress) =>
          api.uploadToProject(file, {
            projectId,
            folder: "docs",
            kind: kindFor(file),
            caption,
            clientVisible,
            showOnWebsite: completed && onWebsite && kindFor(file) === "photo",
            onProgress,
          }),
        setProgress,
      ),
    onSuccess: (failures) => {
      const sent = files.length - failures.length;
      setFailed(failures);
      setFiles(failures.map((f) => f.file));
      if (!failures.length) setCaption("");
      if (sent) toast(`${plural(sent, "file")} uploaded.`);
      refresh();
    },
    onSettled: () => setProgress(null),
  });
  const website = useMutation({
    mutationFn: (d: Doc) => api.setShowOnWebsite(d.id, !d.show_on_website),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: api.deleteDocument, onSuccess: refresh });
  const toggle = useMutation({
    mutationFn: (d: { id: string; client_visible: boolean }) => api.setDocumentVisibility(d.id, !d.client_visible),
    onSuccess: refresh,
  });
  const captionEdit = useMutation({
    mutationFn: ({ d, text }: { d: Doc; text: string }) => api.updateDocument(d.id, { caption: text || null }),
    onSuccess: refresh,
  });
  const bulkUpdate = useMutation({
    mutationFn: ({ list, fields }: { list: Doc[]; fields: { client_visible?: boolean; show_on_website?: boolean } }) =>
      api.updateDocuments(list.map((d) => d.id), fields),
    onSuccess: (_, { list }) => {
      toast(`${plural(list.length, "photo")} updated.`);
      refresh();
    },
  });
  const bulkRemove = useMutation({
    mutationFn: (list: Doc[]) => api.deleteDocuments(list),
    onSuccess: (_, list) => {
      toast(`${plural(list.length, "photo")} deleted.`);
      refresh();
    },
  });

  return (
    <>
      {isOwner && (
        <section className="card">
          <h2>Add photos and files</h2>
          <FilePicker
            wholePage
            label="Choose photos or files"
            files={files}
            disabled={upload.isPending}
            onChange={(f) => {
              setFiles(f);
              setFailed([]);
            }}
          />
          {files.length > 0 && (
            <>
              <div className="upload-options">
                <label>
                  File under
                  <select value={kind} disabled={upload.isPending} onChange={(e) => setKind(e.target.value as DocumentKind)}>
                    {STAFF_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {DOC_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  {kind === "photo" && photos < files.length && <span className="hint">Files that aren't pictures will go under Other.</span>}
                </label>
                <label>
                  Caption (optional)
                  <input value={caption} maxLength={200} disabled={upload.isPending} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Trusses are up!" />
                  {files.length > 1 && <span className="hint">Used for all {files.length} files.</span>}
                </label>
              </div>
              <label className="check">
                <input type="checkbox" checked={clientVisible} disabled={upload.isPending} onChange={(e) => setClientVisible(e.target.checked)} /> Let the client see{" "}
                {files.length > 1 ? "these" : "this"}
              </label>
              {completed && kind === "photo" && photos > 0 && (
                <label className="check">
                  <input type="checkbox" checked={onWebsite} disabled={upload.isPending} onChange={(e) => setOnWebsite(e.target.checked)} /> Also show{" "}
                  {photos > 1 ? "these photos" : "this photo"} on the website
                </label>
              )}
              {upload.isPending ? (
                <UploadBar progress={progress} />
              ) : (
                <button className="btn primary" onClick={() => upload.mutate()}>
                  <Icon name="upload" size={16} /> Upload {plural(files.length, "file")}
                </button>
              )}
            </>
          )}
          <UploadFailures failed={failed} />
          <ErrorNote error={upload.error ?? remove.error ?? toggle.error ?? website.error ?? captionEdit.error ?? bulkUpdate.error ?? bulkRemove.error} />
        </section>
      )}
      {docs.isLoading && <Loading rows={4} />}
      {docs.data?.length === 0 && (
        <Empty icon="photo">No photos or files yet. Add progress photos, plans, permits, and contracts here; you choose which ones the client sees.</Empty>
      )}

      {(["photo", "plan", "permit", "contract", "selection", "other"] as DocumentKind[]).map((k) => {
        const group = (docs.data ?? []).filter((d) => d.kind === k);
        if (!group.length) return null;
        return (
          <section key={k} className="card">
            <div className="card-head">
              <h2>
                {DOC_KIND_LABEL[k]} <small className="muted">({group.length})</small>
              </h2>
            </div>
            {k === "photo" && isOwner && !completed && (
              <p className="muted small">Mark the project completed to choose photos for the website.</p>
            )}
            {k === "photo" && isOwner && completed && (
              <p className="muted small">
                Photos marked <strong>On website</strong> appear in the website's Our Work section. Use "Select several" to add or remove many at once.
              </p>
            )}
            <DocList
              docs={group}
              onDelete={isOwner ? (d) => remove.mutate(d) : undefined}
              onToggleVisible={isOwner ? (d) => toggle.mutate(d) : undefined}
              onToggleWebsite={isOwner && completed ? (d) => website.mutate(d) : undefined}
              onCaption={isOwner ? (d, text) => captionEdit.mutate({ d, text }) : undefined}
              bulk={
                isOwner
                  ? {
                      busy: bulkUpdate.isPending || bulkRemove.isPending,
                      setVisible: (list, visible) => bulkUpdate.mutate({ list, fields: { client_visible: visible } }),
                      setWebsite: completed ? (list, show) => bulkUpdate.mutate({ list, fields: { show_on_website: show } }) : undefined,
                      remove: (list) => bulkRemove.mutate(list),
                    }
                  : undefined
              }
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
  // Arriving from "Start a project from this inquiry" fills in who to invite.
  const from = useLocation().state as { inviteName?: string; inviteEmail?: string } | null;
  const [email, setEmail] = useState(from?.inviteEmail ?? "");
  const [name, setName] = useState(from?.inviteName ?? "");
  const [result, setResult] = useState<string | null>(null);
  const { isOwner } = useAuth();
  const members = (people.data ?? []).filter((u) => u.project_members.some((m) => m.project_id === projectId));
  // People already invited who aren't on this project yet: one click adds them.
  const others = (people.data ?? []).filter((u) => u.role === "client" && !members.includes(u));

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
      ) : people.isLoading ? (
        <Loading rows={2} />
      ) : (
        <Empty icon="people">No clients can see this project yet. Invite one below: they'll get an email with a button to sign in, no password needed.</Empty>
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
            <input value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" required autoComplete="off" list="known-clients" value={email} onChange={(e) => setEmail(e.target.value)} />
            <datalist id="known-clients">
              {others.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.full_name}
                </option>
              ))}
            </datalist>
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
