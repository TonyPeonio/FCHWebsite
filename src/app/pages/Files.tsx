import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../lib/api";
import { DOC_KIND_LABEL, type DocumentKind } from "../../lib/types";
import { useAuth } from "../auth";
import { useDocuments, useProjects } from "../hooks";
import { DocList, Empty, ErrorNote, FilePicker } from "../components/ui";

const ORDER: DocumentKind[] = ["photo", "plan", "permit", "contract", "selection", "other"];

export function Files() {
  const { session } = useAuth();
  const projects = useProjects();
  const docs = useDocuments();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");

  const activeProject = projectId || projects.data?.[0]?.id || "";
  const visible = (docs.data ?? []).filter((d) => d.project_id === activeProject);

  const upload = useMutation({
    mutationFn: async () => {
      for (const file of files) {
        await api.uploadToProject(file, {
          projectId: activeProject,
          folder: "uploads",
          kind: file.type.startsWith("image/") ? "photo" : "other",
          caption,
        });
      }
    },
    onSuccess: () => {
      setFiles([]);
      setCaption("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  return (
    <div className="page">
      <h1>Photos & files</h1>
      {(projects.data?.length ?? 0) > 1 && (
        <label className="inline">
          Project{" "}
          <select value={activeProject} onChange={(e) => setProjectId(e.target.value)}>
            {projects.data!.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {visible.length === 0 && <Empty>No files yet. Plans, permits, and progress photos will appear here.</Empty>}
      {ORDER.map((kind) => {
        const group = visible.filter((d) => d.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className="card">
            <h2>{DOC_KIND_LABEL[kind]}</h2>
            <DocList docs={group} onDelete={(d) => remove.mutate(d)} canDelete={(d) => d.uploaded_by === session?.user.id} />
          </section>
        );
      })}

      {activeProject && (
        <section className="card">
          <h2>Share something with us</h2>
          <p className="muted small">Inspiration photos, product links saved as PDFs, documents — anything helpful.</p>
          <FilePicker files={files} onChange={setFiles} />
          {files.length > 0 && (
            <>
              <label>
                Description (optional)
                <input value={caption} onChange={(e) => setCaption(e.target.value)} />
              </label>
              <button className="btn primary" disabled={upload.isPending} onClick={() => upload.mutate()}>
                {upload.isPending ? "Uploading…" : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
              </button>
            </>
          )}
          <ErrorNote error={upload.error ?? remove.error} />
        </section>
      )}
    </div>
  );
}
