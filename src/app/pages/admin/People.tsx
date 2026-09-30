import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import type { PersonRow } from "../../../lib/types";
import { useAuth } from "../../auth";
import { ErrorNote, TypeToConfirm } from "../../components/ui";
import { byId, usePeople, useProjects } from "../../hooks";

const ROLE_LABEL = { owner: "Owner", staff: "Staff", client: "Client" };

export function People() {
  const { isOwner, session } = useAuth();
  const qc = useQueryClient();
  const people = usePeople();
  const projects = useProjects();
  const projectMap = byId(projects.data);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"client" | "staff">("client");
  const [projectId, setProjectId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PersonRow | null>(null);

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, fullName: name, role, projectId: projectId || undefined }),
    onSuccess: (r) => {
      setResult(r.invited ? `Invitation sent to ${email}.` : `${email} already has an account; access updated.`);
      setEmail("");
      setName("");
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.setUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });

  return (
    <div className="page">
      <h1>People</h1>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Projects</th>
              {isOwner && <th />}
            </tr>
          </thead>
          <tbody>
            {people.data?.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name || "—"}</td>
                <td>{u.email}</td>
                <td>
                  {isOwner && u.id !== session?.user.id ? (
                    <select value={u.role} onChange={(e) => confirm(`Change ${u.email} to ${e.target.value}?`) && changeRole.mutate({ id: u.id, role: e.target.value })}>
                      <option value="client">Client</option>
                      <option value="staff">Staff</option>
                      <option value="owner">Owner</option>
                    </select>
                  ) : (
                    ROLE_LABEL[u.role]
                  )}
                </td>
                <td>{u.project_members.map((m) => projectMap[m.project_id]?.name).filter(Boolean).join(", ")}</td>
                {isOwner && (
                  <td>
                    {u.role !== "owner" && u.id !== session?.user.id && (
                      <button
                        className="link-btn small danger"
                        onClick={() => {
                          remove.reset();
                          setDeleting(u);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorNote error={changeRole.error} />
      {deleting && (
        <TypeToConfirm
          title={`Delete ${ROLE_LABEL[deleting.role].toLowerCase()}`}
          name={deleting.full_name || deleting.email}
          action="Delete account"
          pending={remove.isPending}
          error={remove.error}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        >
          <p>
            This permanently deletes <strong>{deleting.full_name || deleting.email}</strong>'s account ({deleting.email}). They
            can no longer sign in and lose access to their projects. Anything they uploaded or submitted stays with the
            project. You can invite them again later. This can't be undone.
          </p>
        </TypeToConfirm>
      )}

      {isOwner && (
      <form
        className="card"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setResult(null);
          invite.mutate();
        }}
      >
        <h2>Invite someone</h2>
        <div className="grid-2 tight">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as "client" | "staff")}>
              <option value="client">Client</option>
              {isOwner && <option value="staff">Staff (sees the calendar only)</option>}
            </select>
          </label>
          {role === "client" && (
            <label>
              Project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— choose later —</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button className="btn primary" disabled={invite.isPending}>
          {invite.isPending ? "Sending…" : "Send invitation"}
        </button>
        {result && <p className="notice ok">{result}</p>}
        <ErrorNote error={invite.error} />
      </form>
      )}
    </div>
  );
}
