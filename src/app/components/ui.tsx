import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Doc, SelectionStatus } from "../../lib/types";
import { SELECTION_STATUS_LABEL, SELECTION_STATUS_LABEL_CLIENT } from "../../lib/types";
import { useAuth } from "../auth";
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
  const { isStaff } = useAuth();
  const labels = isStaff ? SELECTION_STATUS_LABEL : SELECTION_STATUS_LABEL_CLIENT;
  return <span className={`badge badge-${status}`}>{labels[status]}</span>;
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

/** Photos render as a thumbnail grid (tap for the full photo); everything else as a download list. */
export function DocList({
  docs,
  onDelete,
  onToggleVisible,
  onToggleWebsite,
  canDelete,
}: {
  docs: Doc[];
  onDelete?: (d: Doc) => void;
  onToggleVisible?: (d: Doc) => void;
  /** Only passed for completed projects: choose photos for the public "Our Work" gallery. */
  onToggleWebsite?: (d: Doc) => void;
  canDelete?: (d: Doc) => boolean;
}) {
  const { data: urls = {} } = useSignedUrls(
    "project-files",
    docs.flatMap((d) => (d.thumb_path ? [d.storage_path, d.thumb_path] : [d.storage_path])),
  );
  const images = docs.filter(isImage);
  const others = docs.filter((d) => !isImage(d));

  const actions = (d: Doc) => (
    <span className="doc-actions">
      {onToggleWebsite && isImage(d) && (
        <button className="link-btn small" onClick={() => onToggleWebsite(d)}>
          {d.show_on_website ? "Remove from website" : "Show on website"}
        </button>
      )}
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
                {urls[d.thumb_path ?? d.storage_path] ? (
                  <img src={urls[d.thumb_path ?? d.storage_path]} alt={d.caption ?? d.file_name} loading="lazy" />
                ) : (
                  <div className="img-ph" />
                )}
                {d.show_on_website && <span className="web-badge">On website</span>}
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

/** Lists uploads that failed; they stay selected so pressing Upload again retries them. */
export function UploadFailures({ failed }: { failed: { file: File; reason: string }[] }) {
  if (!failed.length) return null;
  return (
    <div className="notice error">
      {failed.length === 1 ? "1 file" : `${failed.length} files`} didn't upload. They're still selected, so you can try again.
      <ul>
        {failed.map((f, i) => (
          <li key={i}>
            {f.file.name}: {f.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Confirms a permanent delete: the button only works once `name` is typed (capitals don't matter). */
export function TypeToConfirm({
  title,
  name,
  action,
  pending,
  error,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  name: string;
  action: string;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (matches) onConfirm();
        }}
      >
        {children}
        <label>
          Type <strong>{name}</strong> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoComplete="off" />
        </label>
        <div className="btn-row">
          <button className="btn danger" disabled={!matches || pending}>
            {pending ? "Deleting…" : action}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
        <ErrorNote error={error} />
      </form>
    </Modal>
  );
}
