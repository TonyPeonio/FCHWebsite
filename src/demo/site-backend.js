// Demo stand-in for src/site/backend.js (swapped in by vite.demo.config.ts): the sample website's
// gallery shows the made-up completed projects, and inquiries go into the demo portal's Inquiries
// (in this browser tab only) instead of being emailed.
import { db, fileUrl, save } from "./store";
import "./demo.css";

export const configured = true;
export const spamCheckKey = null;
export const formReady = true;

const CATEGORY_LABEL = {
  new_construction: "New construction homes",
  shop: "Shops",
  remodel: "Remodels",
  adu: "ADUs",
  multi_family: "Multi-family",
  commercial: "Commercial",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = (p) => {
  const [year, month] = (p.completed_on ?? "").split("-");
  return year ? `${p.city}-${MONTHS[Number(month) - 1]}-${year}` : p.city;
};
const pause = () => new Promise((r) => setTimeout(r, 200));

// Same rules as the public-gallery function: completed projects with a build type and city, and
// only photos marked "Show on website".
function gallery(projectId) {
  const projects = db.projects
    .filter((p) => p.status === "complete" && p.category && p.city?.trim())
    .sort((a, b) => (b.completed_on ?? "").localeCompare(a.completed_on ?? ""));
  const photos = db.documents
    .filter((d) => d.show_on_website && d.mime_type?.startsWith("image/") && d.project_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (projectId) {
    return {
      photos: photos
        .filter((d) => d.project_id === projectId)
        .map((d) => ({ full: fileUrl(d.storage_path), thumb: fileUrl(d.thumb_path ?? d.storage_path), caption: d.caption ?? "" })),
    };
  }
  const covers = new Map();
  for (const d of photos) if (!covers.has(d.project_id)) covers.set(d.project_id, fileUrl(d.thumb_path ?? d.storage_path));
  return {
    categories: Object.entries(CATEGORY_LABEL)
      .map(([key, name]) => ({
        key,
        label: name,
        projects: projects.filter((p) => p.category === key && covers.has(p.id)).map((p) => ({ id: p.id, label: label(p), cover: covers.get(p.id) })),
      }))
      .filter((c) => c.projects.length > 0),
  };
}

export async function call(name, body) {
  await pause();
  if (name.startsWith("public-gallery")) return gallery(new URLSearchParams(name.split("?")[1] ?? "").get("project"));
  if (name === "quote-start") {
    const id = `q${++db.nextId}`;
    const paths = body.files.map((f, i) => `${id}/${i + 1}-${f.name.replace(/[^\w.\-]+/g, "_")}`);
    db.quotes.push({
      id,
      name: body.name || null,
      email: body.email,
      phone: body.phone || null,
      address: body.address || null,
      message: body.message || null,
      file_paths: paths,
      status: "draft",
      staff_notes: null,
      project_id: null,
      created_at: new Date().toISOString(),
      submitted_at: null,
    });
    save();
    return { quoteId: id, uploads: paths.map((path) => ({ path, url: path })) };
  }
  if (name === "quote-finalize") {
    const q = db.quotes.find((x) => x.id === body.quoteId);
    if (q) Object.assign(q, { status: "new", submitted_at: new Date().toISOString() });
    save();
    return { ok: true };
  }
  throw new Error("Not available in the demo");
}

/** "Uploads" an attachment: in the demo it's only listed by name in the portal. */
export async function uploadFile(path, file) {
  db.files[path] = { type: "doc", name: file.name, size: file.size };
  save();
  return true;
}
