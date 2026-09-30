import { useEffect, useRef, type ReactNode } from "react";
import type { Doc, SelectionStatus } from "../../lib/types";
import { SELECTION_STATUS_LABEL } from "../../lib/types";
import { fmtDate, formatBytes, useSignedUrls } from "../hooks";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export function StatusBadge({ status }: { status: SelectionStatus }) {
  return <span className={`badge badge-${status}`}>{SELECTION_STATUS_LABEL[status]}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="notice error">{error instanceof Error ? error.message : String(error)}</p>;
}

export function ProjectDot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} aria-hidden="true" />;
}

const isImage = (d: Doc) => d.mime_type?.startsWith("image/");

/** Photos render as a thumbnail grid; everything else as a download list. */
export function DocList({
  docs,
  onDelete,
  onToggleVisible,
  canDelete,
}: {
  docs: Doc[];
  onDelete?: (d: Doc) => void;
  onToggleVisible?: (d: Doc) => void;
  canDelete?: (d: Doc) => boolean;
}) {
  const { data: urls = {} } = useSignedUrls("project-files", docs.map((d) => d.storage_path));
  const images = docs.filter(isImage);
  const others = docs.filter((d) => !isImage(d));

  const actions = (d: Doc) => (
    <span className="doc-actions">
      {onToggleVisible && (
        <button className="link-btn small" onClick={() => onToggleVisible(d)}>
          {d.client_visible ? "Hide from client" : "Show to client"}
        </button>
      )}
      {onDelete && (canDelete?.(d) ?? true) && (
        <button className="link-btn small danger" onClick={() => confirm(`Delete ${d.file_name}?`) && onDelete(d)}>
          Delete
        </button>
      )}
    </span>
  );

  return (
    <>
      {images.length > 0 && (
        <div className="photo-grid">
          {images.map((d) => (
            <figure key={d.id} className={d.client_visible ? "" : "internal"}>
              <a href={urls[d.storage_path]} target="_blank" rel="noopener">
                {urls[d.storage_path] ? <img src={urls[d.storage_path]} alt={d.caption ?? d.file_name} loading="lazy" /> : <div className="img-ph" />}
              </a>
              <figcaption>
                {d.caption && <span>{d.caption}</span>}
                <small>{fmtDate(d.created_at)}{!d.client_visible && " · staff only"}</small>
                {actions(d)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="doc-list">
          {others.map((d) => (
            <li key={d.id} className={d.client_visible ? "" : "internal"}>
              <a href={urls[d.storage_path]} target="_blank" rel="noopener">
                📄 {d.file_name}
              </a>
              <small>
                {d.caption && <>{d.caption} · </>}
                {fmtDate(d.created_at)} {formatBytes(d.size_bytes) && `· ${formatBytes(d.size_bytes)}`}
                {!d.client_visible && " · staff only"}
              </small>
              {actions(d)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function FilePicker({ files, onChange, accept, label = "Attach files" }: { files: File[]; onChange: (f: File[]) => void; accept?: string; label?: string }) {
  return (
    <div className="file-picker">
      <label className="btn">
        {label}
        <input
          type="file"
          multiple
          accept={accept}
          hidden
          onChange={(e) => {
            onChange([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <ul>
          {files.map((f, i) => (
            <li key={i}>
              {f.name} <small>{formatBytes(f.size)}</small>{" "}
              <button type="button" className="link-btn small" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
