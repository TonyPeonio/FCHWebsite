import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import { CATEGORY_LABEL, type Project, type ProjectCategory, type ProjectStatus } from "../../../lib/types";
import { ErrorNote, Modal, ProjectDot } from "../../components/ui";
import { useAuth } from "../../auth";
import { fmtDate, usePeople, useProjects, useSelections } from "../../hooks";

export const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Under construction" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
];

const PALETTE = ["#2f6f8f", "#b5651d", "#5b8c3a", "#8e44ad", "#c0392b", "#16a085", "#d4a017", "#34495e"];

export function ProjectForm({
  project,
  completing,
  onClose,
}: {
  project?: Project;
  /** Opened by "Mark completed" because the build type or city is missing. */
  completing?: boolean;
  onClose: (saved?: Project) => void;
}) {
  const qc = useQueryClient();
  const [p, setP] = useState<Partial<Project>>(
    project
      ? { ...project, ...(completing && { status: "complete" as const }) }
      : { name: "", address: "", status: "planning", color: PALETTE[Math.floor(Math.random() * PALETTE.length)] },
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
          <input required value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Smith Residence" />
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
          </label>
        </div>
        <div className="grid-2 tight">
          <label>
            Status
            <select value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as ProjectStatus })}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Calendar color
            <input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} />
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
        <button className="btn primary" disabled={save.isPending}>
          Save
        </button>
        <ErrorNote error={save.error} />
      </form>
    </Modal>
  );
}

export function Projects() {
  const projects = useProjects();
  const people = usePeople();
  const selections = useSelections();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { isOwner } = useAuth();
  const [showDone, setShowDone] = useState(false);

  const rows = (projects.data ?? []).filter((p) => showDone || p.status !== "complete");
  const clientsOf = (id: string) =>
    (people.data ?? []).filter((u) => u.role === "client" && u.project_members.some((m) => m.project_id === id));
  const pending = (id: string) => (selections.data ?? []).filter((s) => s.project_id === id && s.status === "submitted").length;

  return (
    <div className="page">
      <div className="title-row">
        <h1>Projects</h1>
        {isOwner && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            + New project
          </button>
        )}
      </div>
      <label className="check inline">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
      </label>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Clients</th>
              <th>Target</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <ProjectDot color={p.color} /> <Link to={`/admin/projects/${p.id}`}>{p.name}</Link>
                  <div className="muted small">{[p.category && CATEGORY_LABEL[p.category], p.address].filter(Boolean).join(" · ")}</div>
                </td>
                <td>{STATUS_OPTIONS.find((s) => s.value === p.status)?.label}</td>
                <td>{clientsOf(p.id).map((c) => c.full_name || c.email).join(", ") || <span className="muted">—</span>}</td>
                <td>{fmtDate(p.target_completion)}</td>
                <td>{pending(p.id) > 0 && <span className="badge badge-submitted">{pending(p.id)} to review</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
