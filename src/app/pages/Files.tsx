import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../lib/api";
import { DOC_KIND_LABEL, type DocumentKind } from "../../lib/types";
import { useAuth } from "../auth";
import { useDocuments, useProjects } from "../hooks";
import { DocList, Empty, ErrorNote, FilePicker, Icon, Loading, plural, UploadBar, UploadFailures, useToast } from "../components/ui";

const ORDER: DocumentKind[] = ["photo", "plan", "permit", "contract", "selection", "other"];

export function Files() {
  const { session } = useAuth();
  const projects = useProjects();
  const docs = useDocuments();
  const qc = useQueryClient();
  const toast = useToast();
  const [projectId, setProjectId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<api.UploadProgress | null>(null);
  const [failed, setFailed] = useState<api.UploadFailure[]>([]);

  const activeProject = projectId || projects.data?.[0]?.id || "";
  const visible = (docs.data ?? []).filter((d) => d.project_id === activeProject);

  const upload = useMutation({
    mutationFn: () =>
      api.uploadAll(
        files,
        (file, onProgress) =>
          api.uploadToProject(file, {
            projectId: activeProject,
            folder: "uploads",
            kind: file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name) ? "photo" : "other",
            caption,
            onProgress,
          }),
        setProgress,
      ),
    onSuccess: (failures) => {
      const sent = files.length - failures.length;
      setFailed(failures);
      setFiles(failures.map((f) => f.file));
      if (!failures.length) setCaption("");
      if (sent) toast(`${plural(sent, "file")} sent to First Choice Homes.`);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onSettled: () => setProgress(null),
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
          <select
            value={activeProject}
            onChange={(e) => {
              setProjectId(e.target.value);
              setFiles([]);
              setFailed([]);
            }}
          >
            {projects.data!.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {docs.isLoading && (
        <div className="card">
          <Loading rows={4} />
        </div>
      )}
      {docs.isSuccess && visible.length === 0 && (
        <div className="card">
          <Empty icon="photo">Nothing here yet. Plans, permits, and progress photos will appear as we share them.</Empty>
        </div>
      )}
      {ORDER.map((kind) => {
        const group = visible.filter((d) => d.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className="card">
            <h2>
              {DOC_KIND_LABEL[kind]} <small className="muted">({group.length})</small>
            </h2>
            <DocList docs={group} onDelete={(d) => remove.mutate(d)} canDelete={(d) => d.uploaded_by === session?.user.id} />
          </section>
        );
      })}

      {activeProject && (
        <section className="card">
          <h2>Share something with us</h2>
          <p className="muted small">Inspiration photos, product pages saved as PDFs, documents: anything helpful. Only you and First Choice Homes can see what you send.</p>
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
              <label>
                What is it? (optional)
                <input value={caption} maxLength={200} disabled={upload.isPending} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Kitchen ideas we like" />
              </label>
              {upload.isPending ? (
                <UploadBar progress={progress} />
              ) : (
                <button className="btn primary" onClick={() => upload.mutate()}>
                  <Icon name="upload" size={16} /> Send {plural(files.length, "file")}
                </button>
              )}
            </>
          )}
          <UploadFailures failed={failed} />
          <ErrorNote error={upload.error ?? remove.error} />
        </section>
      )}
    </div>
  );
}
