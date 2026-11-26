// Everything to do with photos and files in the portal: the grid and list of what's stored, the
// full-screen photo viewer, and choosing files to upload (drag and drop, paste, or pick).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { UploadFailure, UploadProgress } from "../../lib/api";
import type { Doc } from "../../lib/types";
import { fmtDate, formatBytes, useSignedUrls } from "../hooks";
import { Icon, plural } from "./basics";

const isImage = (d: Doc) => d.mime_type?.startsWith("image/");

// ---------------------------------------------------------------- stored photos & files
export interface BulkActions {
  setVisible?: (docs: Doc[], visible: boolean) => void;
  /** Only for completed projects. */
  setWebsite?: (docs: Doc[], show: boolean) => void;
  remove?: (docs: Doc[]) => void;
  busy?: boolean;
}

interface DocListProps {
  docs: Doc[];
  onDelete?: (d: Doc) => void;
  onToggleVisible?: (d: Doc) => void;
  /** Only passed for completed projects: choose photos for the public "Our Work" gallery. */
  onToggleWebsite?: (d: Doc) => void;
  canDelete?: (d: Doc) => boolean;
  /** Owner: change a photo's caption (from the photo viewer). */
  onCaption?: (d: Doc, caption: string) => void;
  /** Owner: lets several photos be selected and changed at once. */
  bulk?: BulkActions;
}

/** Photos render as a thumbnail grid (tap to view them full screen); everything else as a download list. */
export function DocList({ docs, onDelete, onToggleVisible, onToggleWebsite, canDelete, onCaption, bulk }: DocListProps) {
  const { data: urls = {} } = useSignedUrls(
    "project-files",
    docs.flatMap((d) => (d.thumb_path ? [d.storage_path, d.thumb_path] : [d.storage_path])),
  );
  const images = docs.filter(isImage);
  const others = docs.filter((d) => !isImage(d));
  const [viewing, setViewing] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const chosen = images.filter((d) => picked.has(d.id));
  const mayDelete = (d: Doc) => !!onDelete && (canDelete?.(d) ?? true);

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  const actions = (d: Doc) => (
    <span className="doc-actions">
      {onToggleWebsite && isImage(d) && (
        <button type="button" className="link-btn small" onClick={() => onToggleWebsite(d)}>
          {d.show_on_website ? "Remove from website" : "Show on website"}
        </button>
      )}
      {onToggleVisible && (
        <button type="button" className="link-btn small" onClick={() => onToggleVisible(d)}>
          {d.client_visible ? "Hide from client" : "Show to client"}
        </button>
      )}
      {mayDelete(d) && (
        <button type="button" className="link-btn small danger" onClick={() => confirm(`Delete ${d.file_name}? This can't be undone.`) && onDelete!(d)}>
          Delete
        </button>
      )}
    </span>
  );

  return (
    <>
      {bulk && images.length > 1 && (
        <div className={`bulk-bar${selecting ? " on" : ""}`}>
          {!selecting ? (
            <button type="button" className="btn small" onClick={() => setSelecting(true)}>
              Select several
            </button>
          ) : (
            <>
              <strong aria-live="polite">{chosen.length} selected</strong>
              <button type="button" className="link-btn small" onClick={() => setPicked(new Set(chosen.length === images.length ? [] : images.map((d) => d.id)))}>
                {chosen.length === images.length ? "Select none" : "Select all"}
              </button>
              <span className="bulk-actions">
                {bulk.setWebsite && (
                  <>
                    <button type="button" className="btn small" disabled={!chosen.length || bulk.busy} onClick={() => bulk.setWebsite!(chosen, true)}>
                      Show on website
                    </button>
                    <button type="button" className="btn small" disabled={!chosen.length || bulk.busy} onClick={() => bulk.setWebsite!(chosen, false)}>
                      Remove from website
                    </button>
                  </>
                )}
                {bulk.setVisible && (
                  <>
                    <button type="button" className="btn small" disabled={!chosen.length || bulk.busy} onClick={() => bulk.setVisible!(chosen, true)}>
                      Show to client
                    </button>
                    <button type="button" className="btn small" disabled={!chosen.length || bulk.busy} onClick={() => bulk.setVisible!(chosen, false)}>
                      Hide from client
                    </button>
                  </>
                )}
                {bulk.remove && (
                  <button
                    type="button"
                    className="btn small danger"
                    disabled={!chosen.length || bulk.busy}
                    onClick={() => {
                      if (!confirm(`Delete ${plural(chosen.length, "photo")}? This can't be undone.`)) return;
                      bulk.remove!(chosen);
                      setPicked(new Set());
                    }}
                  >
                    Delete
                  </button>
                )}
              </span>
              <button type="button" className="btn small primary" onClick={stopSelecting}>
                Done
              </button>
            </>
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="photo-grid">
          {images.map((d) => {
            const isPicked = picked.has(d.id);
            const name = d.caption || d.file_name;
            return (
              <figure key={d.id} className={`${d.client_visible ? "" : "internal"}${isPicked ? " picked" : ""}`}>
                <button
                  type="button"
                  className="photo-btn"
                  aria-pressed={selecting ? isPicked : undefined}
                  aria-label={selecting ? `Select photo: ${name}` : `View photo: ${name}`}
                  onClick={() => (selecting ? togglePick(d.id) : setViewing(d.id))}
                >
                  <Thumb src={urls[d.thumb_path ?? d.storage_path]} alt="" />
                  {d.show_on_website && <span className="web-badge">On website</span>}
                  {!d.client_visible && (
                    <span className="staff-badge">
                      <Icon name="eyeOff" size={12} /> Staff only
                    </span>
                  )}
                  {selecting && (
                    <span className="pick-mark" aria-hidden="true">
                      {isPicked && <Icon name="check" size={14} />}
                    </span>
                  )}
                </button>
                <figcaption>
                  {d.caption && <span>{d.caption}</span>}
                  <small className="muted">{fmtDate(d.created_at)}</small>
                  {!selecting && actions(d)}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <ul className="doc-list">
          {others.map((d) => (
            <li key={d.id} className={d.client_visible ? "" : "internal"}>
              <a href={urls[d.storage_path]} target="_blank" rel="noopener" className="doc-link">
                <Icon name="file" /> {d.file_name}
              </a>
              <small className="muted">
                {d.caption && <>{d.caption} · </>}
                {fmtDate(d.created_at)} {formatBytes(d.size_bytes) && `· ${formatBytes(d.size_bytes)}`}
                {!d.client_visible && " · staff only"}
              </small>
              {actions(d)}
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <PhotoViewer
          photos={images}
          urls={urls}
          startId={viewing}
          onClose={() => setViewing(null)}
          onCaption={onCaption}
          actions={(d) => actions(d)}
        />
      )}
    </>
  );
}

/** A thumbnail that falls back to a plain tile if the photo can't be shown (e.g. an old HEIC upload). */
function Thumb({ src, alt }: { src: string | undefined; alt: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src) return <div className="img-ph" />;
  if (broken) {
    return (
      <div className="img-ph no-preview">
        <Icon name="photo" size={26} />
        <small>No preview</small>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

/** Full-screen photo viewer: arrow keys or the side buttons move between photos, Esc closes. */
function PhotoViewer({
  photos,
  urls,
  startId,
  onClose,
  onCaption,
  actions,
}: {
  photos: Doc[];
  urls: Record<string, string>;
  startId: string;
  onClose: () => void;
  onCaption?: (d: Doc, caption: string) => void;
  actions: (d: Doc) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)));
  const [editing, setEditing] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  // A photo deleted from here drops out of the list: stay in range, or close when none are left.
  useEffect(() => {
    if (photos.length === 0) onClose();
    else if (index > photos.length - 1) setIndex(photos.length - 1);
  }, [photos.length, index, onClose]);

  const photo = photos[Math.min(index, photos.length - 1)];
  if (!photo) return null;
  const go = (step: number) => {
    setEditing(null);
    setIndex((i) => (i + step + photos.length) % photos.length);
  };
  const full = urls[photo.storage_path];

  return (
    <dialog
      ref={ref}
      className="viewer"
      aria-label="Photo viewer"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => {
        if (editing !== null) return;
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 60 && photos.length > 1) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="viewer-top">
        <span aria-live="polite">
          {index + 1} of {photos.length}
        </span>
        {full && (
          <a href={full} target="_blank" rel="noopener" className="viewer-link">
            <Icon name="external" size={16} /> Full size
          </a>
        )}
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={24} />
        </button>
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" className="viewer-nav prev" aria-label="Previous photo" onClick={() => go(-1)}>
            <Icon name="left" size={28} />
          </button>
          <button type="button" className="viewer-nav next" aria-label="Next photo" onClick={() => go(1)}>
            <Icon name="right" size={28} />
          </button>
        </>
      )}
      <figure>
        {full ? <img key={photo.id} src={full} alt={photo.caption ?? photo.file_name} /> : <div className="viewer-wait">Loading…</div>}
        <figcaption>
          {editing !== null ? (
            <form
              className="caption-edit"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                onCaption?.(photo, editing.trim());
                setEditing(null);
              }}
            >
              <input autoFocus aria-label="Caption" maxLength={200} value={editing} onChange={(e) => setEditing(e.target.value)} placeholder="e.g. Trusses are up!" />
              <button className="btn small primary">Save</button>
              <button type="button" className="btn small" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <p>
                {photo.caption || <span className="muted">{onCaption ? "No caption" : ""}</span>}
                {onCaption && (
                  <>
                    {" "}
                    <button type="button" className="link-btn small" onClick={() => setEditing(photo.caption ?? "")}>
                      {photo.caption ? "Edit caption" : "Add a caption"}
                    </button>
                  </>
                )}
              </p>
              <small>
                {fmtDate(photo.created_at)}
                {photo.show_on_website && " · on the website"}
                {!photo.client_visible && " · staff only"}
              </small>
              {actions(photo)}
            </>
          )}
        </figcaption>
      </figure>
    </dialog>
  );
}

// ---------------------------------------------------------------- choosing files to upload
/** Whether a file matches an <input accept> list like "image/*,.pdf" (no list accepts anything). */
function accepts(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (rule.startsWith(".")) return name.endsWith(rule);
    // iPhone photos saved as .heic often arrive with no type at all.
    if (rule === "image/*" && /\.(heic|heif)$/.test(name)) return true;
    if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1));
    return file.type === rule;
  });
}

const draggingFiles = (e: DragEvent | React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/**
 * A drop target with a button to choose files: drag files onto it, or press the button.
 * With `wholePage`, files can be dropped anywhere on the page or pasted (Ctrl+V), and a miss no
 * longer makes the browser open the file instead. Use at most one of those per page.
 * Dropped files that don't match `accept` are ignored, as the picker would hide them.
 */
export function DropZone({
  onFiles,
  accept,
  multiple = true,
  label,
  hint,
  disabled,
  wholePage,
  compact,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
  wholePage?: boolean;
  /** A slimmer zone, for once some files are already chosen. */
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const take = (list: FileList | File[] | null | undefined) => {
    const picked = Array.from(list ?? []).filter((f) => accepts(f, accept));
    if (picked.length) onFiles(multiple ? picked : picked.slice(0, 1));
  };
  // Kept in a ref so the page-wide listeners below always call the latest version.
  const takeRef = useRef(take);
  takeRef.current = take;

  useEffect(() => {
    if (!wholePage || disabled) return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!draggingFiles(e)) return;
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!draggingFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const dragOver = (e: DragEvent) => {
      if (!draggingFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const drop = (e: DragEvent) => {
      if (!draggingFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      takeRef.current(e.dataTransfer?.files);
    };
    const paste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files?.length) return;
      e.preventDefault();
      takeRef.current(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", dragOver);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", dragOver);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, [wholePage, disabled]);

  const ownHandlers = wholePage
    ? {}
    : {
        onDragOver: (e: React.DragEvent) => {
          if (disabled || !draggingFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setOver(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          // Only when the pointer actually leaves the zone, not when it crosses into a child.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files);
        },
      };

  return (
    <div className={`drop-zone${over ? " over" : ""}${disabled ? " disabled" : ""}${compact ? " compact" : ""}`} {...ownHandlers}>
      {wholePage && over && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <Icon name="upload" size={40} />
            <strong>Drop to add</strong>
          </div>
        </div>
      )}
      {!compact && <Icon name="upload" size={26} />}
      <p className="drop-hint">{hint ?? (multiple ? "Drag and drop files here, or" : "Drag and drop a file here, or")}</p>
      <label className={`btn${disabled ? " disabled" : ""}`}>
        {label}
        <input
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={accept}
          disabled={disabled}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {wholePage && !compact && <p className="drop-hint small">You can drop anywhere on this page, or paste a copied photo.</p>}
    </div>
  );
}

/** A small preview of a file waiting to be uploaded. */
function FilePreview({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <li>
      {url && !broken ? (
        <img src={url} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="file-tile">
          <Icon name={/\.(heic|heif)$/i.test(file.name) || file.type.startsWith("image/") ? "photo" : "file"} size={24} />
        </span>
      )}
      <span className="file-name" title={file.name}>
        {file.name}
      </span>
      <small className="muted">{formatBytes(file.size) || "0 KB"}</small>
      {!disabled && (
        <button type="button" className="file-remove" aria-label={`Remove ${file.name}`} onClick={onRemove}>
          <Icon name="close" size={14} />
        </button>
      )}
    </li>
  );
}

/** Choose files to upload, with a preview of each. The same file isn't added twice. */
export function FilePicker({
  files,
  onChange,
  accept,
  label = "Choose files",
  wholePage,
  disabled,
}: {
  files: File[];
  onChange: (f: File[]) => void;
  accept?: string;
  label?: string;
  /** Accept drops anywhere on the page, and pasted photos. One per page. */
  wholePage?: boolean;
  disabled?: boolean;
}) {
  const same = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return (
    <div className="file-picker">
      <DropZone
        accept={accept}
        label={files.length ? "Add more" : label}
        hint={accept === "image/*" ? "Drag and drop photos here, or" : "Drag and drop photos or files here, or"}
        wholePage={wholePage}
        disabled={disabled}
        compact={files.length > 0}
        onFiles={(added) => onChange([...files, ...added.filter((a) => !files.some((f) => same(a, f)))])}
      />
      {files.length > 0 && (
        <>
          <p className="picked-summary" aria-live="polite">
            <strong>{plural(files.length, "file")} ready</strong> <span className="muted">· {formatBytes(total) || "0 KB"}</span>
            {!disabled && files.length > 1 && (
              <button type="button" className="link-btn small" onClick={() => onChange([])}>
                Clear all
              </button>
            )}
          </p>
          <ul className="file-previews">
            {files.map((f, i) => (
              <FilePreview key={`${f.name}-${f.size}-${f.lastModified}`} file={f} disabled={disabled} onRemove={() => onChange(files.filter((_, j) => j !== i))} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** A progress bar for a batch of uploads. */
export function UploadBar({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;
  const pct = Math.round(progress.fraction * 100);
  return (
    <div className="upload-bar" role="status">
      <div className="upload-bar-head">
        <span>
          Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
        </span>
        <span>{pct}%</span>
      </div>
      <progress max={100} value={pct} aria-label="Upload progress" />
      <small className="muted">Keep this page open until it finishes.</small>
    </div>
  );
}

/** Lists uploads that failed; they stay selected so pressing Upload again retries them. */
export function UploadFailures({ failed }: { failed: UploadFailure[] }) {
  if (!failed.length) return null;
  return (
    <div className="notice error" role="alert">
      {plural(failed.length, "file")} didn't upload. {failed.length === 1 ? "It's" : "They're"} still selected, so you can try again.
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
