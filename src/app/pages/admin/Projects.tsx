import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import {
  CATEGORY_LABEL,
  PROJECT_STAGE_LABEL,
  projectStatusLabel,
  type CustomStatus,
  type Project,
  type ProjectCategory,
  type ProjectStatus,
} from "../../../lib/types";
import { Empty, ErrorNote, Icon, Loading, Modal, ProjectDot, useToast } from "../../components/ui";
import { useAuth } from "../../auth";
import { fmtDate, useCustomStatuses, usePeople, useProjects, useSelections } from "../../hooks";

const STAGES = Object.keys(PROJECT_STAGE_LABEL) as ProjectStatus[];

const PALETTE = ["#2f6f8f", "#b5651d", "#5b8c3a", "#8e44ad", "#c0392b", "#16a085", "#d4a017", "#34495e"];

export function ProjectForm({
  project,
  completing,
  defaults,
  onClose,
}: {
  project?: Project;
  /** Opened by "Mark completed" because the build type or city is missing. */
  completing?: boolean;
  /** Starting values for a new project (e.g. the name and address from a website inquiry). */
  defaults?: Partial<Project>;
  onClose: (saved?: Project) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const statuses = useCustomStatuses();
  const [p, setP] = useState<Partial<Project>>(
    project
      ? { ...project, ...(completing && { status: "complete" as const, custom_status_id: null }) }
      : { name: "", address: "", status: "planning", color: PALETTE[Math.floor(Math.random() * PALETTE.length)], ...defaults },
  );
  const save = useMutation({
    mutationFn: () =>
      api.saveProject({
        ...p,
        address: p.address || null,
        city: p.city?.trim() || null,
        start_date: p.start_date || null,
        target_completion: p.target_completion || null,
        // Completed projects always have a date: with the city it labels them on the website.
        completed_on: p.status === "complete" ? p.completed_on || new Date().toLocaleDateString("en-CA") : null,
      }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast(project ? "Project saved." : "Project created.");
      onClose(saved);
    },
  });

  return (
    <Modal title={completing ? "Mark completed" : project ? "Edit project" : "New project"} onClose={() => onClose()}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {completing && (
          <p className="notice warn">Add a build type and city so this project can appear on the website, then save.</p>
        )}
        <label>
          Name
          <input required autoFocus={!project} value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Smith Residence" />
          <span className="hint">Only you and the project's clients see this name; it's never shown on the website.</span>
        </label>
        <label>
          Address
          <input value={p.address ?? ""} onChange={(e) => setP({ ...p, address: e.target.value })} />
        </label>
        <div className="grid-2 tight">
          <label>
            Build type
            <select required value={p.category ?? ""} onChange={(e) => setP({ ...p, category: e.target.value as ProjectCategory })}>
              <option value="" disabled>
                Choose…
              </option>
              {(Object.keys(CATEGORY_LABEL) as ProjectCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            {/* Completed projects are labeled City-Month-Year on the website. */}
            <input
              required={p.status === "complete"}
              value={p.city ?? ""}
              onChange={(e) => setP({ ...p, city: e.target.value })}
              placeholder="e.g. Kalama"
            />
            <span className="hint">Labels the finished project on the website, e.g. Kalama-January-2025.</span>
          </label>
        </div>
        <div className="grid-2 tight">
          <label>
            Status
            {/* Each stage, then the owner's statuses filed under it. Custom ones are "c<id>". */}
            <select
              value={p.custom_status_id ? `c${p.custom_status_id}` : p.status}
              onChange={(e) => {
                const custom = statuses.data?.find((s) => `c${s.id}` === e.target.value);
                setP({ ...p, status: custom?.stage ?? (e.target.value as ProjectStatus), custom_status_id: custom?.id ?? null });
              }}
            >
              {STAGES.map((stage) => (
                <optgroup key={stage} label={PROJECT_STAGE_LABEL[stage]}>
                  <option value={stage}>{PROJECT_STAGE_LABEL[stage]}</option>
                  {statuses.data
                    ?.filter((s) => s.stage === stage)
                    .map((s) => (
                      <option key={s.id} value={`c${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Calendar color
            <input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} />
            <span className="swatches" role="group" aria-label="Suggested colors">
              {PALETTE.map((c) => (
                <button key={c} type="button" className={`swatch${p.color === c ? " on" : ""}`} style={{ background: c }} aria-label={`Use color ${c}`} aria-pressed={p.color === c} onClick={() => setP({ ...p, color: c })} />
              ))}
            </span>
          </label>
          <label>
            Start date
            <input type="date" value={p.start_date ?? ""} onChange={(e) => setP({ ...p, start_date: e.target.value })} />
          </label>
          <label>
            Target completion
            <input type="date" value={p.target_completion ?? ""} onChange={(e) => setP({ ...p, target_completion: e.target.value })} />
          </label>
          {p.status === "complete" && (
            <label>
              Completed on
              <input type="date" value={p.completed_on ?? ""} onChange={(e) => setP({ ...p, completed_on: e.target.value })} />
            </label>
          )}
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : project ? "Save" : "Create project"}
          </button>
          <button type="button" className="btn" onClick={() => onClose()}>
            Cancel
          </button>
        </div>
        <ErrorNote error={save.error} />
      </form>
    </Modal>
  );
}

export function Projects() {
  const projects = useProjects();
  const people = usePeople();
  const selections = useSelections();
  const statuses = useCustomStatuses();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const { isOwner } = useAuth();
  // ?stage=planning etc. (linked from the overview); no stage = everything not yet complete.
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") as ProjectStatus | "all" | null;
  const [search, setSearch] = useState("");

  const clientsOf = (id: string) =>
    (people.data ?? []).filter((u) => u.role === "client" && u.project_members.some((m) => m.project_id === id));
  const all = projects.data ?? [];
  const words = search.trim().toLowerCase();
  const inStage = (p: Project) => (stage === "all" ? true : stage ? p.status === stage : p.status !== "complete");
  // Searching looks through every project, whatever stage is picked.
  const rows = all.filter((p) =>
    words ? [p.name, p.address, p.city].some((v) => v?.toLowerCase().includes(words)) || clientsOf(p.id).some((c) => `${c.full_name} ${c.email}`.toLowerCase().includes(words)) : inStage(p),
  );
  const pending = (id: string) => (selections.data ?? []).filter((s) => s.project_id === id && s.status === "submitted").length;

  return (
    <div className="page">
      <div className="title-row">
        <h1>Projects</h1>
        {isOwner && (
          <div className="btn-row">
            <button className="btn" onClick={() => setManaging(true)}>
              Statuses
            </button>
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> New project
            </button>
          </div>
        )}
      </div>
      <div className="chips filter" role="group" aria-label="Show projects">
        {([null, ...STAGES, "all"] as const).map((s) => (
          <button key={s ?? "open"} className={`chip ${stage === s && !words ? "on" : ""}`} aria-pressed={stage === s && !words} onClick={() => (setSearch(""), setParams(s ? { stage: s } : {}))}>
            {s === null ? "In progress" : s === "all" ? "All" : PROJECT_STAGE_LABEL[s]}{" "}
            <span className="chip-count">{s === null ? all.filter((p) => p.status !== "complete").length : s === "all" ? all.length : all.filter((p) => p.status === s).length}</span>
          </button>
        ))}
        <label className="search">
          <span className="sr-only">Search projects</span>
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search by name, address, or client" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {projects.isLoading ? (
        <Loading rows={5} />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty
            icon="home"
            action={
              isOwner && !words && all.length === 0 ? (
                <button className="btn primary" onClick={() => setCreating(true)}>
                  Create your first project
                </button>
              ) : undefined
            }
          >
            {words ? `No projects match "${search.trim()}".` : all.length === 0 ? "No projects yet. A project holds a job's schedule, selections, photos, files, and the clients who can see it." : "No projects in this stage."}
          </Empty>
        </div>
      ) : (
      <div className="table-wrap">
        <table className="table stack">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Clients</th>
              <th>{stage === "complete" ? "Completed" : "Target"}</th>
              <th>
                <span className="sr-only">Needs attention</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <ProjectDot color={p.color} /> <Link to={`/admin/projects/${p.id}`}>{p.name}</Link>
                  <div className="muted small">{[p.category && CATEGORY_LABEL[p.category], p.address].filter(Boolean).join(" · ")}</div>
                </td>
                <td data-label="Status">{projectStatusLabel(p, statuses.data)}</td>
                <td data-label="Clients">{clientsOf(p.id).map((c) => c.full_name || c.email).join(", ") || <span className="muted">None yet</span>}</td>
                <td data-label={p.status === "complete" ? "Completed" : "Target"}>{fmtDate(p.status === "complete" ? p.completed_on : p.target_completion)}</td>
                <td>{pending(p.id) > 0 && <Link to={`/admin/projects/${p.id}?tab=selections`} className="badge badge-submitted">{pending(p.id)} to review</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {managing && <StatusManager onClose={() => setManaging(false)} />}
      {creating && (
        <ProjectForm
          onClose={(saved) => {
            setCreating(false);
            if (saved) navigate(`/admin/projects/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}

/** Owner-only: add statuses like "Estimate pending" under a stage, or remove ones no longer needed. */
function StatusManager({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const statuses = useCustomStatuses();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<ProjectStatus>("planning");
  const refresh = () => qc.invalidateQueries({ queryKey: ["project-statuses"] });
  const add = useMutation({
    mutationFn: () => api.addCustomStatus(name, stage),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (s: CustomStatus) => api.deleteCustomStatus(s.id),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <Modal title="Project statuses" onClose={onClose}>
      <p className="muted small">
        Add your own statuses and pick the stage each belongs to. The stage decides how the project is counted, and only
        Complete projects can appear on the website. Clients see the status name.
      </p>
      <form
        className="inline-add"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <input aria-label="New status name" maxLength={40} placeholder="e.g. Estimate pending" value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value as ProjectStatus)}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="btn primary" disabled={!name.trim() || add.isPending}>
          Add
        </button>
      </form>
      <ErrorNote error={add.error ?? remove.error} />
      <ul className="status-list">
        {STAGES.map((s) => (
          <li key={s}>
            <strong>{PROJECT_STAGE_LABEL[s]}</strong>
            <ul>
              {statuses.data
                ?.filter((c) => c.stage === s)
                .map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <button
                      className="link-btn small danger"
                      disabled={remove.isPending}
                      onClick={() => confirm(`Remove "${c.name}"? Projects using it will show "${PROJECT_STAGE_LABEL[s]}".`) && remove.mutate(c)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
