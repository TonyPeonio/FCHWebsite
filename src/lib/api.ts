import imageCompression from "browser-image-compression";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type {
  CalendarProject,
  CalEvent,
  Doc,
  DocumentKind,
  PersonRow,
  Project,
  Quote,
  QuoteStatus,
  Selection,
} from "./types";

/** Unwraps a Supabase result: throws on error, otherwise returns non-null data. */
function check<T>(result: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

/** Calls an edge function and surfaces its `{ error }` message on failure. */
export async function callFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data as T;
}

// ---------------------------------------------------------------- projects
/** Project names and colors for labeling calendar events (staff can't read projects themselves). */
export async function fetchCalendarProjects(): Promise<CalendarProject[]> {
  return check(await supabase.rpc("calendar_projects"));
}

export async function fetchProjects(): Promise<Project[]> {
  return check(await supabase.from("projects").select("*").order("name"));
}

export async function saveProject(project: Partial<Project>): Promise<Project> {
  const { id, ...fields } = project;
  const query = id
    ? supabase.from("projects").update(fields).eq("id", id).select().single()
    : supabase.from("projects").insert(fields).select().single();
  return check(await query);
}

// ---------------------------------------------------------------- events
export async function fetchEvents(): Promise<CalEvent[]> {
  return check(
    await supabase.from("events").select("*, event_projects(project_id)").order("starts_at"),
  ) as CalEvent[];
}

export type EventInput = Omit<CalEvent, "id" | "event_projects"> & { id?: string };

/** Saves an event and replaces its project tags. */
export async function saveEvent(event: EventInput, projectIds: string[]): Promise<void> {
  const { id, ...fields } = event;
  const saved = check<{ id: string }>(
    await (id
      ? supabase.from("events").update(fields).eq("id", id).select("id").single()
      : supabase.from("events").insert(fields).select("id").single()),
  );
  check(await supabase.from("event_projects").delete().eq("event_id", saved.id));
  if (projectIds.length) {
    check(
      await supabase
        .from("event_projects")
        .insert(projectIds.map((project_id) => ({ event_id: saved.id, project_id }))),
    );
  }
}

export async function moveEvent(id: string, starts_at: string, ends_at: string | null, all_day: boolean) {
  check(await supabase.from("events").update({ starts_at, ends_at, all_day }).eq("id", id));
}

export async function deleteEvent(id: string) {
  check(await supabase.from("events").delete().eq("id", id));
}

// ---------------------------------------------------------------- files
const safeName = (name: string) =>
  name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-100) || "file";

const SHRINKABLE = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "project-files";
const UPLOAD_TIMEOUT_MS = 3 * 60_000;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // the project-files bucket limit

/** Rejects if `promise` hasn't settled in time: a stalled phone upload would otherwise wait forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

/**
 * Resizes an image, or gives null on any trouble or after 20 s so callers can fall back.
 * No web worker: the library's worker loads a script from a CDN and never reports it if the worker
 * dies, which left phone uploads stuck on "Uploading…" forever.
 */
function resize(file: File, maxSizeMB: number, maxWidthOrHeight: number, fileType?: string): Promise<Blob | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000));
  const out = imageCompression(file, { maxSizeMB, maxWidthOrHeight, useWebWorker: false, fileType }).catch(() => null);
  return Promise.race([out, timeout]);
}

/** Shrinks big photos before upload; otherwise uploads the original (the bucket takes 50 MB). */
async function shrinkIfImage(file: File): Promise<File> {
  if (!SHRINKABLE.includes(file.type) || file.size < 1_000_000) return file;
  const out = await resize(file, 1.5, 2400);
  return out ? new File([out], file.name, { type: out.type }) : file;
}

/**
 * Uploads a file under `folder`, plus a small thumbnail for photos so grids load quickly on phones.
 * HEIC and other formats many browsers can't decode go up as they are, without a thumbnail.
 */
async function storeFile(file: File, folder: string) {
  const upload = await shrinkIfImage(file);
  // Checked here so a phone doesn't spend minutes sending a file the server will refuse.
  if (upload.size > MAX_FILE_BYTES) throw new Error("It's larger than 50 MB");
  const thumb =SHRINKABLE.includes(upload.type) ? await resize(upload, 0.06, 480, "image/jpeg") : null;
  const id = crypto.randomUUID();
  const path = `${folder}/${id}-${safeName(file.name)}`;
  const bucket = supabase.storage.from(BUCKET);
  check(
    await withTimeout(
      bucket.upload(path, upload, { contentType: upload.type }),
      UPLOAD_TIMEOUT_MS,
      "The upload took too long. Check your connection and try again",
    ),
  );
  let thumbPath: string | null = thumb ? `${folder}/thumbs/${id}.jpg` : null;
  if (thumb && thumbPath) {
    // Without a thumbnail the grid just shows the full photo.
    const { error } = await bucket.upload(thumbPath, thumb, { contentType: "image/jpeg" });
    if (error) thumbPath = null;
  }
  const row = { storage_path: path, thumb_path: thumbPath, file_name: file.name, mime_type: upload.type || null, size_bytes: upload.size };
  const discard = () => bucket.remove([path, ...(thumbPath ? [thumbPath] : [])]);
  return { path, row, discard };
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
    track?: boolean; // insert a documents row (false for selection option images)
  },
): Promise<string> {
  const { path, row, discard } = await storeFile(file, `${opts.projectId}/${opts.folder}`);

  if (opts.track !== false) {
    const { error } = await supabase.from("documents").insert({
      ...row,
      project_id: opts.projectId,
      selection_id: opts.selectionId ?? null,
      kind: opts.kind ?? "other",
      caption: opts.caption || null,
      client_visible: opts.clientVisible ?? true,
    });
    if (error) {
      await discard();
      throw new Error(error.message);
    }
  }
  return path;
}

export interface UploadFailure {
  file: File;
  reason: string;
}

/** Uploads files one at a time, carrying on past any that fail; returns the failures and why. */
export async function uploadAll(files: File[], upload: (file: File) => Promise<unknown>, onEach: () => void) {
  const failed: UploadFailure[] = [];
  for (const file of files) {
    try {
      await upload(file);
    } catch (err) {
      failed.push({ file, reason: err instanceof Error ? err.message : String(err) });
    }
    onEach();
  }
  return failed;
}

/** Adds a photo to the owner's photo dump (no project yet). */
export async function uploadToLibrary(file: File) {
  const { row, discard } = await storeFile(file, "library");
  const { error } = await supabase.from("documents").insert({ ...row, project_id: null, kind: "photo" });
  if (error) {
    await discard();
    throw new Error(error.message);
  }
}

/** Moves a photo-dump photo (and its thumbnail) into a project's files. */
export async function assignPhoto(doc: Doc, projectId: string) {
  const bucket = supabase.storage.from(BUCKET);
  const to = `${projectId}/docs/${doc.storage_path.split("/").pop()}`;
  check(await bucket.move(doc.storage_path, to));

  let thumbTo: string | null = null;
  if (doc.thumb_path) {
    thumbTo = `${projectId}/docs/thumbs/${doc.thumb_path.split("/").pop()}`;
    if ((await bucket.move(doc.thumb_path, thumbTo)).error) {
      await bucket.remove([doc.thumb_path]);
      thumbTo = null;
    }
  }

  const { error } = await supabase
    .from("documents")
    .update({ project_id: projectId, storage_path: to, thumb_path: thumbTo })
    .eq("id", doc.id);
  if (error) {
    // Put the files back so the photo stays in the dump.
    await bucket.move(to, doc.storage_path);
    if (thumbTo && doc.thumb_path) await bucket.move(thumbTo, doc.thumb_path);
    throw new Error(error.message);
  }
}

/** Every file under a storage folder, subfolders included. */
async function listFiles(prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const items = check(await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset }));
    for (const item of items) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) files.push(...(await listFiles(path))); // a folder
      else files.push(path);
    }
    if (items.length < 1000) return files;
  }
}

/**
 * Deletes a project for good. The database removes its client access, calendar tags, selections,
 * and file records; stored files aren't removed with them, so they're deleted here too.
 */
export async function deleteProject(id: string) {
  const files = await listFiles(id);
  const deleted = check(await supabase.from("projects").delete().eq("id", id).select("id"));
  if (!deleted.length) throw new Error("The project couldn't be deleted");
  for (let i = 0; i < files.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(files.slice(i, i + 100));
  }
}

export async function fetchDocuments(filter: { projectId?: string; selectionId?: string; library?: boolean } = {}): Promise<Doc[]> {
  let q = supabase.from("documents").select("*").order("created_at", { ascending: false });
  // The owner's photo-dump rows have no project; only the photo dump asks for them.
  q = filter.library ? q.is("project_id", null) : q.not("project_id", "is", null);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.selectionId) q = q.eq("selection_id", filter.selectionId);
  return check(await q);
}

export async function deleteDocument(doc: Doc) {
  check(await supabase.from("documents").delete().eq("id", doc.id));
  await supabase.storage.from(BUCKET).remove([doc.storage_path, ...(doc.thumb_path ? [doc.thumb_path] : [])]);
}

export async function setDocumentVisibility(id: string, client_visible: boolean) {
  check(await supabase.from("documents").update({ client_visible }).eq("id", id));
}

export async function setShowOnWebsite(id: string, show_on_website: boolean) {
  check(await supabase.from("documents").update({ show_on_website }).eq("id", id));
}

/** Returns a map of storage path -> short-lived signed URL. */
export async function signedUrls(bucket: string, paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const data = check(await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn));
  const map: Record<string, string> = {};
  for (const item of data) if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
  return map;
}

// ---------------------------------------------------------------- selections
export async function fetchSelections(projectId?: string): Promise<Selection[]> {
  let q = supabase
    .from("selections")
    .select("*, selection_options!selection_options_selection_id_fkey(*)")
    .order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const rows = check(await q) as Selection[];
  rows.forEach((s) => s.selection_options.sort((a, b) => a.sort_order - b.sort_order));
  return rows;
}

export async function fetchSelection(id: string): Promise<Selection> {
  const row = check(
    await supabase
      .from("selections")
      .select("*, selection_options!selection_options_selection_id_fkey(*)")
      .eq("id", id)
      .single(),
  ) as Selection;
  row.selection_options.sort((a, b) => a.sort_order - b.sort_order);
  return row;
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
  const sel = check<{ id: string }>(await supabase.from("selections").insert(input).select("id").single());
  const rows = [];
  for (const [i, opt] of options.entries()) {
    if (!opt.label.trim()) continue;
    const image_path = opt.image
      ? await uploadToProject(opt.image, { projectId: input.project_id, folder: "options", track: false })
      : null;
    rows.push({ selection_id: sel.id, label: opt.label.trim(), description: opt.description || null, image_path, sort_order: i });
  }
  if (rows.length) check(await supabase.from("selection_options").insert(rows));
  await callFunction("notify", { type: "selection_requested", selectionId: sel.id }).catch(console.error);
}

export async function submitSelection(sel: Selection, note: string, optionId: string | null, files: File[]) {
  for (const file of files) {
    await uploadToProject(file, { projectId: sel.project_id, folder: "uploads", kind: "selection", selectionId: sel.id });
  }
  check(await supabase.rpc("submit_selection", { p_selection_id: sel.id, p_note: note, p_option_id: optionId }));
  await callFunction("notify", { type: "selection_submitted", selectionId: sel.id }).catch(console.error);
}

export async function decideSelection(id: string, approve: boolean, note: string) {
  check(await supabase.rpc("decide_selection", { p_selection_id: id, p_approve: approve, p_staff_note: note || null }));
  await callFunction("notify", { type: "selection_decided", selectionId: id }).catch(console.error);
}

export async function deleteSelection(id: string) {
  check(await supabase.from("selections").delete().eq("id", id));
}

// ---------------------------------------------------------------- quotes
export async function fetchQuotes(): Promise<Quote[]> {
  return check(
    await supabase.from("quote_requests").select("*").neq("status", "draft").order("submitted_at", { ascending: false }),
  );
}

export async function updateQuote(id: string, fields: { status?: QuoteStatus; staff_notes?: string; project_id?: string }) {
  check(await supabase.from("quote_requests").update(fields).eq("id", id));
}

// ---------------------------------------------------------------- people
export async function fetchPeople(): Promise<PersonRow[]> {
  return check(await supabase.from("profiles").select("*, project_members(project_id)").order("full_name"));
}

/** Emails a sign-in button and code (see supabase/functions/send-sign-in-email). */
export async function sendSignInEmail(email: string) {
  return callFunction<{ sent: true }>("send-sign-in-email", { email });
}

export async function inviteUser(input: { email: string; fullName: string; role: "client" | "staff"; projectId?: string }) {
  return callFunction<{ userId: string; invited: boolean }>("invite-user", input);
}

export async function removeMember(projectId: string, userId: string) {
  check(await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId));
}

export async function setUserRole(userId: string, role: string) {
  check(await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role }));
}

export async function updateMyProfile(id: string, fields: { full_name: string; phone: string | null }) {
  check(await supabase.from("profiles").update(fields).eq("id", id));
}

export async function rotateFeedToken(): Promise<string> {
  return check(await supabase.rpc("rotate_feed_token")) as string;
}

export const feedUrl = (token: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-ics?token=${token}`;
