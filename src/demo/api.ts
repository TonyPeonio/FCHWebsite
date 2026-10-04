// Demo stand-in for src/lib/api.ts (swapped in by vite.demo.config.ts). Same functions, but they
// read and change the made-up data in ./store instead of calling Supabase or R2. Visibility follows
// the real database's rules: clients see only their own projects' shared items, staff only the
// calendar, the owner everything.
import type {
  CalendarProject,
  CalEvent,
  CustomStatus,
  Doc,
  DocumentKind,
  PersonRow,
  Project,
  ProjectStatus,
  Quote,
  QuoteStatus,
  Selection,
  SpaceUsed,
  UsageLimits,
} from "../lib/types";
import { db, fileUrl, newId, rememberUpload, save } from "./store";
import { currentUserId, getRole } from "./session";

const pause = (ms = 150) => new Promise((r) => setTimeout(r, ms)); // feels like a real request
const copy = <T>(v: T): T => structuredClone(v);
const now = () => new Date().toISOString();

const isOwner = () => getRole() === "owner";
const isStaff = () => getRole() === "owner" || getRole() === "staff";
const me = () => currentUserId() ?? "";
const myProjects = () => new Set(db.profiles.find((p) => p.id === me())?.project_members.map((m) => m.project_id) ?? []);
const isMember = (projectId: string | null) => !!projectId && myProjects().has(projectId);

function requireOwner() {
  if (!isOwner()) throw new Error("Only the owner can do that (in the demo, switch to the owner view).");
}
async function done<T>(value: T): Promise<T> {
  save();
  await pause();
  return copy(value);
}

export async function callFunction<T = unknown>(): Promise<T> {
  await pause();
  return {} as T;
}

// ---------------------------------------------------------------- projects
export async function fetchCalendarProjects(): Promise<CalendarProject[]> {
  await pause();
  return db.projects
    .filter((p) => isStaff() || isMember(p.id))
    .map(({ id, name, color }) => ({ id, name, color }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchProjects(): Promise<Project[]> {
  await pause();
  return copy(db.projects.filter((p) => isOwner() || isMember(p.id)).sort((a, b) => a.name.localeCompare(b.name)));
}

export async function saveProject(project: Partial<Project>): Promise<Project> {
  requireOwner();
  const { id, ...fields } = project;
  // Same rule as the database: a custom status sets the stage; changing only the stage drops it.
  let row = id ? db.projects.find((p) => p.id === id) : undefined;
  if (id && !row) throw new Error("Project not found");
  if (!row) {
    row = { id: newId("p-new-"), name: "", address: null, status: "planning", color: "#778899", start_date: null, target_completion: null, category: null, city: null, completed_on: null, custom_status_id: null };
    db.projects.push(row);
  }
  const before = { ...row };
  Object.assign(row, fields);
  if (id && fields.status !== undefined && fields.status !== before.status && (fields.custom_status_id ?? before.custom_status_id) === before.custom_status_id) {
    row.custom_status_id = null;
  } else if (row.custom_status_id) {
    row.status = db.statuses.find((s) => s.id === row!.custom_status_id)?.stage ?? row.status;
  }
  return done(row);
}

// ---------------------------------------------------------------- project statuses
export async function fetchCustomStatuses(): Promise<CustomStatus[]> {
  await pause();
  return copy(db.statuses);
}

export async function addCustomStatus(name: string, stage: ProjectStatus): Promise<CustomStatus> {
  requireOwner();
  if (db.statuses.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())) throw new Error(`There's already a status called "${name.trim()}".`);
  const status = { id: db.nextId++, name: name.trim(), stage };
  db.statuses.push(status);
  return done(status);
}

export async function deleteCustomStatus(id: number) {
  requireOwner();
  db.statuses = db.statuses.filter((s) => s.id !== id);
  for (const p of db.projects) if (p.custom_status_id === id) p.custom_status_id = null;
  await done(null);
}

// ---------------------------------------------------------------- space used
export async function fetchSpaceUsed(): Promise<SpaceUsed> {
  requireOwner();
  await pause();
  return { database_bytes: 14.2 * 1024 * 1024 };
}

export async function fetchUsageLimits(): Promise<UsageLimits> {
  requireOwner();
  await pause();
  return copy(db.limits);
}

export async function saveUsageLimits(limits: UsageLimits) {
  requireOwner();
  db.limits = { ...limits };
  await done(null);
}

// ---------------------------------------------------------------- events
export async function fetchEvents(): Promise<CalEvent[]> {
  await pause();
  const mine = myProjects();
  return copy(
    db.events
      .filter((e) => isStaff() || (e.client_visible && e.event_projects.some((t) => mine.has(t.project_id))))
      .map((e) => (isStaff() ? e : { ...e, event_projects: e.event_projects.filter((t) => mine.has(t.project_id)) }))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  );
}

export type EventInput = Omit<CalEvent, "id" | "event_projects"> & { id?: string };

export async function saveEvent(event: EventInput, projectIds: string[]): Promise<void> {
  requireOwner();
  const { id, ...fields } = event;
  const tags = projectIds.map((project_id) => ({ project_id }));
  const row = id && db.events.find((e) => e.id === id);
  if (row) Object.assign(row, fields, { event_projects: tags });
  else db.events.push({ id: newId("e"), ...fields, event_projects: tags });
  await done(null);
}

export async function moveEvent(id: string, starts_at: string, ends_at: string | null, all_day: boolean) {
  requireOwner();
  Object.assign(db.events.find((e) => e.id === id) ?? {}, { starts_at, ends_at, all_day });
  await done(null);
}

export async function deleteEvent(id: string) {
  requireOwner();
  db.events = db.events.filter((e) => e.id !== id);
  await done(null);
}

// ---------------------------------------------------------------- files
const safeName = (name: string) =>
  name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-100) || "file";

/** Shrinks a photo into a small saved copy so it survives a page reload in this tab. */
async function savedCopy(file: File): Promise<string | null> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

async function storeFile(file: File, folder: string) {
  if (file.size > 50 * 1024 * 1024) throw new Error("It's larger than 50 MB");
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  rememberUpload(path, file, await savedCopy(file), file.size);
  const row = { storage_path: path, thumb_path: null, file_name: file.name, mime_type: file.type || null, size_bytes: file.size };
  return { path, row };
}

function addDoc(fields: Partial<Doc> & Pick<Doc, "storage_path" | "file_name" | "kind">): Doc {
  const doc: Doc = {
    id: newId("d"), project_id: null, selection_id: null, uploaded_by: me(), mime_type: null, size_bytes: null, caption: null,
    client_visible: true, show_on_website: false, thumb_path: null, created_at: now(), ...fields,
  };
  db.documents.push(doc);
  return doc;
}

export async function uploadToProject(
  file: File,
  opts: {
    projectId: string;
    folder: "uploads" | "docs" | "options";
    kind?: DocumentKind;
    caption?: string;
    selectionId?: string;
    clientVisible?: boolean;
    track?: boolean;
  },
): Promise<string> {
  if (!isOwner() && !(isMember(opts.projectId) && opts.folder === "uploads")) throw new Error("You can't upload there");
  const { path, row } = await storeFile(file, `${opts.projectId}/${opts.folder}`);
  if (opts.track !== false) {
    addDoc({ ...row, project_id: opts.projectId, selection_id: opts.selectionId ?? null, kind: opts.kind ?? "other", caption: opts.caption || null, client_visible: opts.clientVisible ?? true });
  }
  save();
  return path;
}

export interface UploadFailure {
  file: File;
  reason: string;
}

export async function uploadAll(files: File[], upload: (file: File) => Promise<unknown>, onEach: () => void) {
  const failed: UploadFailure[] = [];
  for (const file of files) {
    try {
      await upload(file);
      await pause(250);
    } catch (err) {
      failed.push({ file, reason: err instanceof Error ? err.message : String(err) });
    }
    onEach();
  }
  return failed;
}

export async function uploadToLibrary(file: File) {
  requireOwner();
  const { row } = await storeFile(file, "library");
  addDoc({ ...row, project_id: null, kind: "photo" });
  save();
}

export async function assignPhoto(doc: Doc, projectId: string) {
  requireOwner();
  const row = db.documents.find((d) => d.id === doc.id);
  if (row) row.project_id = projectId;
  await done(null);
}

export async function deleteProject(id: string) {
  requireOwner();
  db.projects = db.projects.filter((p) => p.id !== id);
  const selectionIds = new Set(db.selections.filter((s) => s.project_id === id).map((s) => s.id));
  db.selections = db.selections.filter((s) => s.project_id !== id);
  db.documents = db.documents.filter((d) => d.project_id !== id && !selectionIds.has(d.selection_id ?? ""));
  for (const p of db.profiles) p.project_members = p.project_members.filter((m) => m.project_id !== id);
  for (const e of db.events) e.event_projects = e.event_projects.filter((t) => t.project_id !== id);
  await done(null);
}

const canSeeDoc = (d: Doc) =>
  d.project_id === null ? isOwner() : isOwner() || (isMember(d.project_id) && (d.client_visible || d.uploaded_by === me()));

export async function fetchDocuments(filter: { projectId?: string; selectionId?: string; library?: boolean } = {}): Promise<Doc[]> {
  await pause();
  return copy(
    db.documents
      .filter(canSeeDoc)
      .filter((d) => (filter.library ? d.project_id === null : d.project_id !== null))
      .filter((d) => !filter.projectId || d.project_id === filter.projectId)
      .filter((d) => !filter.selectionId || d.selection_id === filter.selectionId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

export async function deleteDocument(doc: Doc) {
  if (!isOwner() && doc.uploaded_by !== me()) throw new Error("You can only delete your own uploads");
  db.documents = db.documents.filter((d) => d.id !== doc.id);
  await done(null);
}

export async function setDocumentVisibility(id: string, client_visible: boolean) {
  requireOwner();
  Object.assign(db.documents.find((d) => d.id === id) ?? {}, { client_visible });
  await done(null);
}

export async function setShowOnWebsite(id: string, show_on_website: boolean) {
  requireOwner();
  Object.assign(db.documents.find((d) => d.id === id) ?? {}, { show_on_website });
  await done(null);
}

type FileArea = "project-files" | "quote-uploads";

export async function signedUrls(area: FileArea, paths: string[]): Promise<Record<string, string>> {
  await pause(80);
  const readable = (p: string) => {
    if (isOwner()) return true;
    if (area === "quote-uploads" || getRole() !== "client") return false;
    const [projectId, folder] = p.split("/");
    if (folder === "options") return isMember(projectId);
    return db.documents.some((d) => d.storage_path === p && canSeeDoc(d));
  };
  const out: Record<string, string> = {};
  for (const p of new Set(paths.filter(Boolean))) {
    const u = readable(p) ? fileUrl(p) : undefined;
    if (u) out[p] = u;
  }
  return out;
}

export interface FileUsage {
  areas: { area: FileArea; files: number; bytes: number }[];
}
export async function fetchFileUsage(): Promise<FileUsage> {
  requireOwner();
  await pause();
  const quoteFiles = new Set(db.quotes.flatMap((q) => q.file_paths));
  const sum = (inArea: (path: string) => boolean) => {
    const list = Object.entries(db.files).filter(([p]) => inArea(p));
    return { files: list.length, bytes: list.reduce((s, [, f]) => s + f.size, 0) };
  };
  return {
    areas: [
      { area: "project-files", ...sum((p) => !quoteFiles.has(p)) },
      { area: "quote-uploads", ...sum((p) => quoteFiles.has(p)) },
    ],
  };
}

// ---------------------------------------------------------------- selections
const canSeeSelection = (s: Selection) => isOwner() || isMember(s.project_id);

export async function fetchSelections(projectId?: string): Promise<Selection[]> {
  await pause();
  return copy(
    db.selections
      .filter(canSeeSelection)
      .filter((s) => !projectId || s.project_id === projectId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

export async function fetchSelection(id: string): Promise<Selection> {
  await pause();
  const s = db.selections.find((x) => x.id === id && canSeeSelection(x));
  if (!s) throw new Error("Selection not found");
  return copy(s);
}

export interface NewOption {
  label: string;
  description: string;
  image?: File | null;
}

export async function createSelection(
  input: { project_id: string; title: string; instructions: string; due_date: string | null },
  options: NewOption[],
): Promise<void> {
  requireOwner();
  const id = newId("s-");
  const sel: Selection = {
    id, ...input, instructions: input.instructions || null, status: "requested", client_note: null, staff_note: null,
    chosen_option_id: null, submitted_at: null, decided_at: null, created_at: now(), selection_options: [],
  };
  for (const [i, opt] of options.entries()) {
    if (!opt.label.trim()) continue;
    const image_path = opt.image ? await uploadToProject(opt.image, { projectId: input.project_id, folder: "options", track: false }) : null;
    sel.selection_options.push({ id: newId("o"), selection_id: id, label: opt.label.trim(), description: opt.description || null, image_path, sort_order: i });
  }
  db.selections.push(sel);
  await done(null);
}

export async function submitSelection(sel: Selection, note: string, optionId: string | null, files: File[]) {
  const row = db.selections.find((s) => s.id === sel.id);
  if (!row || !isMember(row.project_id)) throw new Error("Only the client can submit this selection (switch to the client view).");
  if (row.status !== "requested" && row.status !== "revision_requested") throw new Error("This selection was already submitted");
  for (const file of files) await uploadToProject(file, { projectId: row.project_id, folder: "uploads", kind: "selection", selectionId: row.id });
  Object.assign(row, { status: "submitted", client_note: note || null, chosen_option_id: optionId, submitted_at: now() });
  await done(null);
}

export async function decideSelection(id: string, approve: boolean, note: string) {
  requireOwner();
  Object.assign(db.selections.find((s) => s.id === id) ?? {}, {
    status: approve ? "approved" : "revision_requested",
    staff_note: note || null,
    decided_at: now(),
  });
  await done(null);
}

export async function deleteSelection(id: string) {
  requireOwner();
  db.selections = db.selections.filter((s) => s.id !== id);
  await done(null);
}

// ---------------------------------------------------------------- quotes
export async function fetchQuotes(): Promise<Quote[]> {
  await pause();
  if (!isOwner()) return [];
  return copy(db.quotes.filter((q) => q.status !== "draft").sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "")));
}

export async function updateQuote(id: string, fields: { status?: QuoteStatus; staff_notes?: string; project_id?: string }) {
  requireOwner();
  Object.assign(db.quotes.find((q) => q.id === id) ?? {}, fields);
  await done(null);
}

// ---------------------------------------------------------------- people
export async function fetchPeople(): Promise<PersonRow[]> {
  await pause();
  return copy(db.profiles.filter((p) => isOwner() || p.id === me()).sort((a, b) => a.full_name.localeCompare(b.full_name)));
}

export async function sendSignInEmail(): Promise<{ sent: true }> {
  await pause();
  return { sent: true };
}

export async function deleteUser(userId: string): Promise<{ deleted: true }> {
  requireOwner();
  if (userId === me()) throw new Error("You can't delete yourself");
  db.profiles = db.profiles.filter((p) => p.id !== userId);
  await done(null);
  return { deleted: true };
}

export async function inviteUser(input: { email: string; fullName: string; role: "client" | "staff"; projectId?: string }) {
  requireOwner();
  const email = input.email.trim().toLowerCase();
  let person = db.profiles.find((p) => p.email.toLowerCase() === email);
  const invited = !person;
  if (!person) {
    person = { id: newId("u-"), email, full_name: input.fullName, phone: null, role: input.role, feed_token: newId("t"), project_members: [] };
    db.profiles.push(person);
  }
  if (input.projectId && !person.project_members.some((m) => m.project_id === input.projectId)) person.project_members.push({ project_id: input.projectId });
  await done(null);
  return { userId: person.id, invited }; // in the demo nothing is actually emailed
}

export async function removeMember(projectId: string, userId: string) {
  requireOwner();
  const person = db.profiles.find((p) => p.id === userId);
  if (person) person.project_members = person.project_members.filter((m) => m.project_id !== projectId);
  await done(null);
}

export async function setUserRole(userId: string, role: string) {
  requireOwner();
  if (userId === me()) throw new Error("You can't change your own role");
  Object.assign(db.profiles.find((p) => p.id === userId) ?? {}, { role });
  await done(null);
}

export async function updateMyProfile(id: string, fields: { full_name: string; phone: string | null }) {
  if (id !== me()) throw new Error("You can only change your own profile");
  Object.assign(db.profiles.find((p) => p.id === id) ?? {}, fields);
  await done(null);
}

export async function rotateFeedToken(): Promise<string> {
  const person = db.profiles.find((p) => p.id === me());
  if (person) person.feed_token = newId("demo-feed-");
  await done(null);
  return person?.feed_token ?? "";
}

/** In the demo the calendar link is only an example; it doesn't point at a real feed. */
export const feedUrl = (token: string) => `https://example.com/sample-calendar-feed.ics?token=${token}`;
