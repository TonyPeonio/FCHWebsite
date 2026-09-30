import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import { CATEGORY_LABEL } from "../../../lib/types";
import { Empty, ErrorNote, FilePicker, UploadFailures } from "../../components/ui";
import { fmtDate, useDocuments, useProjects, useSignedUrls } from "../../hooks";

/** Owner-only: upload photos straight from a phone, then move them into projects later. */
export function PhotoDump() {
  const qc = useQueryClient();
  const docs = useDocuments({ library: true });
  const projects = useProjects();
  const photos = docs.data ?? [];
  const { data: urls = {} } = useSignedUrls(
    "project-files",
    photos.flatMap((d) => (d.thumb_path ? [d.storage_path, d.thumb_path] : [d.storage_path])),
  );

  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<api.UploadFailure[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["documents"] });
  // Photos that were moved or deleted drop out of the selection on their own.
  const chosen = photos.filter((d) => selected.has(d.id));

  const upload = useMutation({
    mutationFn: async () => {
      setDone(0);
      return api.uploadAll(files, api.uploadToLibrary, () => setDone((n) => n + 1));
    },
    onSuccess: (failures) => {
      setFailed(failures);
      setFiles(failures.map((f) => f.file));
      refresh();
    },
  });

  // One at a time so a single failure doesn't strand the rest; failures stay selected.
  const assign = useMutation({
    mutationFn: async () => {
      let failures = 0;
      for (const d of chosen) {
        try {
          await api.assignPhoto(d, projectId);
        } catch {
          failures++;
        }
      }
      if (failures) throw new Error(`${failures} photo${failures > 1 ? "s" : ""} couldn't be moved and are still selected. Try again.`);
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async () => {
      for (const d of chosen) await api.deleteDocument(d);
    },
    onSettled: refresh,
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="page">
      <h1>Photo dump</h1>
      <p className="muted small">
        Only you can see these. Add photos from your phone any time, then select them and move them into a project.
      </p>

      <section className="card">
        <FilePicker
          files={files}
          onChange={(f) => {
            setFiles(f);
            setFailed([]);
          }}
          accept="image/*"
          label="Add photos"
        />
        {files.length > 0 && (
          <button className="btn primary" disabled={upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending
              ? `Uploading ${Math.min(done + 1, files.length)} of ${files.length}…`
              : `Upload ${files.length} photo${files.length > 1 ? "s" : ""}`}
          </button>
        )}
        <UploadFailures failed={failed} />
        <ErrorNote error={upload.error} />
      </section>

      {photos.length === 0 ? (
        <Empty>{docs.isLoading ? "Loading…" : "No photos waiting to be sorted."}</Empty>
      ) : (
        <>
          <div className="btn-row dump-tools">
            <button className="link-btn small" onClick={() => setSelected(new Set(photos.map((d) => d.id)))}>
              Select all
            </button>
            {chosen.length > 0 && (
              <button className="link-btn small" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            )}
          </div>
          <div className="photo-grid dump-grid">
            {photos.map((d) => (
              <figure key={d.id} className={selected.has(d.id) ? "picked" : ""}>
                <button type="button" onClick={() => toggle(d.id)} aria-pressed={selected.has(d.id)} aria-label={`Select ${d.file_name}`}>
                  {urls[d.thumb_path ?? d.storage_path] ? (
                    <img src={urls[d.thumb_path ?? d.storage_path]} alt={d.caption ?? d.file_name} loading="lazy" />
                  ) : (
                    <div className="img-ph" />
                  )}
                  {selected.has(d.id) && <span className="pick-mark">✓</span>}
                </button>
                <figcaption>
                  {d.caption && <span>{d.caption}</span>}
                  <small>
                    {fmtDate(d.created_at)} ·{" "}
                    <a href={urls[d.storage_path]} target="_blank" rel="noopener">
                      View
                    </a>
                  </small>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {chosen.length > 0 && (
        <div className="dump-bar">
          <strong>{chosen.length} selected</strong>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
            <option value="">Move to project…</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.category ? ` (${CATEGORY_LABEL[p.category]})` : ""}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={!projectId || assign.isPending} onClick={() => assign.mutate()}>
            {assign.isPending ? "Moving…" : "Move"}
          </button>
          <button
            className="btn danger"
            disabled={remove.isPending}
            onClick={() => confirm(`Delete ${chosen.length} photo${chosen.length > 1 ? "s" : ""}?`) && remove.mutate()}
          >
            Delete
          </button>
          <ErrorNote error={assign.error ?? remove.error} />
        </div>
      )}
    </div>
  );
}
