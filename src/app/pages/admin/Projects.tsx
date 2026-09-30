import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import type { Project, ProjectStatus } from "../../../lib/types";
import { ErrorNote, Modal, ProjectDot } from "../../components/ui";
import { fmtDate, usePeople, useProjects, useSelections } from "../../hooks";

export const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Under construction" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
];

const PALETTE = ["#2f6f8f", "#b5651d", "#5b8c3a", "#8e44ad", "#c0392b", "#16a085", "#d4a017", "#34495e"];

export function ProjectForm({ project, onClose }: { project?: Project; onClose: (saved?: Project) => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState<Partial<Project>>(
    project ?? { name: "", address: "", status: "planning", color: PALETTE[Math.floor(Math.random() * PALETTE.length)] },
  );
  const save = useMutation({
    mutationFn: () =>
      api.saveProject({
        ...p,
        address: p.address || null,
        start_date: p.start_date || null,
        target_completion: p.target_completion || null,
      }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose(saved);
    },
  });

  return (
    <Modal title={project ? "Edit project" : "New project"} onClose={() => onClose()}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
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
  const [showDone, setShowDone] = useState(false);

  const rows = (projects.data ?? []).filter((p) => showDone || p.status !== "complete");
  const clientsOf = (id: string) =>
    (people.data ?? []).filter((u) => u.role === "client" && u.project_members.some((m) => m.project_id === id));
  const pending = (id: string) => (selections.data ?? []).filter((s) => s.project_id === id && s.status === "submitted").length;

  return (
    <div className="page">
      <div className="title-row">
        <h1>Projects</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New project
        </button>
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
                  {p.address && <div className="muted small">{p.address}</div>}
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
