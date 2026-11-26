// Small shared pieces used on every portal page: dialogs, notices, loading placeholders, tabs,
// toasts. The file and photo pieces live in ./files; import everything from ./ui.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { ProjectStatus, SelectionStatus } from "../../lib/types";
import { PROJECT_STAGE_LABEL, SELECTION_STATUS_LABEL, SELECTION_STATUS_LABEL_CLIENT } from "../../lib/types";
import { useAuth } from "../auth";

// ---------------------------------------------------------------- icons
const ICONS = {
  upload: "M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h6",
  photo: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm0 10 4.5-4.5a1.5 1.5 0 0 1 2 0L16 17m-2-2 1.5-1.5a1.5 1.5 0 0 1 2 0L20 16M15 9h.01",
  calendar: "M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  inbox: "M4 13l2.5-7.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13m-16 0v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5m-16 0h4.5l1 2h5l1-2H20",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  people: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M14.5 4.13a4 4 0 0 1 0 7.75M13.5 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  eyeOff: "M4 4l16 16M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.6 3.7M6.5 6.6A13 13 0 0 0 2.5 12c1 2.5 4.500 7 9.5 7a9.700 9.700 0 0 0 4.200-1M9.900 9.900a3 3 0 0 0 4.200 4.200",
  home: "M4 11.500 12 4l8 7.500M6 10v9a1 1 0 0 0 1 1h3.500v-5.500h3V20H17a1 1 0 0 0 1-1v-9",
  external: "M14 4h6v6m0-6-9 9M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  plus: "M12 5v14M5 12h14",
  pencil: "M4 20h4L19 9a2.100 2.100 0 0 0-3-3L5 17l-1 3Zm10-13 3 3",
  trash: "M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13M10 11v5m4-5v5",
  download: "M12 4v12m0 0-4-4m4 4 4-4M4 18v0a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v0",
} as const;
export type IconName = keyof typeof ICONS;

/** A small line icon; decorative unless given a `label`. */
export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------- dialogs
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " wide" : ""}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
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

// ---------------------------------------------------------------- status & notices
export function StatusBadge({ status }: { status: SelectionStatus }) {
  const { isStaff } = useAuth();
  const labels = isStaff ? SELECTION_STATUS_LABEL : SELECTION_STATUS_LABEL_CLIENT;
  return <span className={`badge badge-${status}`}>{labels[status]}</span>;
}

/** What to show when a list is empty: a line of text, optionally with an icon and a next step. */
export function Empty({ children, icon, action }: { children: ReactNode; icon?: IconName; action?: ReactNode }) {
  if (!icon && !action) return <p className="empty">{children}</p>;
  return (
    <div className="empty-state">
      {icon && <Icon name={icon} size={30} />}
      <p>{children}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="notice error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function ProjectDot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} aria-hidden="true" />;
}

/** Grey placeholder lines while a list loads, so the page doesn't jump when it arrives. */
export function Loading({ rows = 3, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} style={{ width: `${88 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Where a project is on the way from planning to complete (clients' overview). */
export function StageSteps({ stage }: { stage: ProjectStatus }) {
  const steps: ProjectStatus[] = ["planning", "active", "complete"];
  // On hold isn't a step of its own: it pauses wherever the project had got to (building, usually).
  const at = stage === "on_hold" ? 1 : steps.indexOf(stage);
  return (
    <ol className={`steps${stage === "on_hold" ? " paused" : ""}`} aria-label="Project progress">
      {steps.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "current" : ""} aria-current={i === at ? "step" : undefined}>
          <span className="step-mark" aria-hidden="true">
            {i < at ? <Icon name="check" size={13} /> : i + 1}
          </span>
          {PROJECT_STAGE_LABEL[s]}
          {i < at && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- tabs
/** Tabs with the usual keyboard behaviour: arrow keys move between them, Home/End jump to the ends. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onKeyDown(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === value);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls="tab-panel"
          tabIndex={value === t.id ? 0 : -1}
          className={value === t.id ? "on" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastContext = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

/** Brief confirmations ("12 photos uploaded") that appear at the bottom of the screen and fade. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const show = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === "error" ? 8000 : 4500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === "ok" ? "check" : "close"} size={16} />
            <span>{t.text}</span>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** "1 photo" / "3 photos". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
