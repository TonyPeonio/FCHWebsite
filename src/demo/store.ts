// The demo's "database": the made-up data from seed.ts plus whatever the visitor changes, kept in
// this browser tab only (sessionStorage), so the sample website and sample portal share it and it
// all disappears when the tab closes. Nothing here ever talks to a server.
import * as art from "./art";
import { seed, type DemoData, type FileArt } from "./seed";

const KEY = "fch-demo-v1";

function load(): DemoData {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as DemoData;
  } catch {
    // private windows can refuse storage; the demo still works, it just won't survive a reload
  }
  return seed();
}

export const db: DemoData = load();

/** Saves changes for this tab. Uploaded photos are dropped from the saved copy if it gets too big. */
export function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    try {
      const slim = { ...db, files: Object.fromEntries(Object.entries(db.files).map(([k, f]) => [k, f.type === "upload" ? { ...f, dataUrl: null } : f])) };
      sessionStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* storage unavailable */
    }
  }
}

/** Starts the demo over with the original sample data. */
export function reset() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export const newId = (prefix: string) => `${prefix}${++db.nextId}`;

// Uploads made this visit, kept as blob links (they can't be saved, but last until a reload).
const uploads = new Map<string, string>();
export function rememberUpload(path: string, file: Blob, dataUrl: string | null, size: number) {
  uploads.set(path, URL.createObjectURL(file));
  db.files[path] = { type: "upload", dataUrl, size };
}

function draw(f: FileArt): string {
  switch (f.type) {
    case "house": return art.house(f.stage, f.seed);
    case "shop": return art.shop(f.seed);
    case "room": return art.room(f.kind, f.seed);
    case "tile": return art.tile(f.color, f.grout, f.pattern);
    case "paint": return art.paint(f.color, f.name);
    case "planks": return art.planks(f.color);
    case "counter": return art.counter(f.base, f.fleck);
    case "doc": return art.sampleDocument(f.name);
    case "upload": return f.dataUrl ?? art.sampleDocument("This upload was cleared when the page reloaded");
  }
}

/** A viewable link for a stored file, or undefined if there's no such file. */
export function fileUrl(path: string): string | undefined {
  const uploaded = uploads.get(path);
  if (uploaded) return uploaded;
  const f = db.files[path];
  return f ? draw(f) : undefined;
}
