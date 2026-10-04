// The demo's made-up data. Every person, project, address, and photo here is fictional; dates are
// relative to today so the calendar always looks current.
import type { CalEvent, CustomStatus, Doc, PersonRow, Project, Quote, Selection, UsageLimits } from "../lib/types";
import type { Pattern, Room, Stage } from "./art";

/** How a stored file is drawn: an illustration, a sample document, or something the visitor uploaded. */
export type FileArt =
  | { type: "house"; stage: Stage; seed: number }
  | { type: "shop"; seed: number }
  | { type: "room"; kind: Room; seed: number }
  | { type: "tile"; color: string; grout: string; pattern: Pattern }
  | { type: "paint"; color: string; name: string }
  | { type: "planks"; color: string }
  | { type: "counter"; base: string; fleck: string }
  | { type: "doc"; name: string }
  | { type: "upload"; dataUrl: string | null };

export interface DemoData {
  profiles: PersonRow[];
  projects: Project[];
  statuses: CustomStatus[];
  events: CalEvent[];
  selections: Selection[];
  documents: Doc[];
  quotes: Quote[];
  limits: UsageLimits;
  files: Record<string, FileArt & { size: number }>;
  nextId: number;
}

export const USERS = { owner: "u-owner", staff: "u-staff", client: "u-hartley" } as const;

const today = new Date();
const dateOnly = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
};
const at = (offsetDays: number, hour: number, minute = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const allDay = (offsetDays: number) => `${dateOnly(offsetDays)}T00:00:00Z`;
const ago = (days: number) => at(-days, 10);

export function seed(): DemoData {
  const files: DemoData["files"] = {};
  const documents: Doc[] = [];
  let n = 0;

  /** Adds a photo or file to a project (or the photo dump when projectId is null). */
  function addFile(
    projectId: string | null,
    art: FileArt,
    o: { name: string; caption?: string; kind?: Doc["kind"]; visible?: boolean; website?: boolean; daysAgo?: number; by?: string; selectionId?: string },
  ) {
    const id = `d${++n}`;
    const folder = projectId ? `${projectId}/${o.by === USERS.client ? "uploads" : "docs"}` : "library";
    const isImage = art.type !== "doc";
    const path = `${folder}/${id}-${o.name.replace(/\s+/g, "_")}${isImage ? ".jpg" : ".pdf"}`;
    const size = isImage ? 180_000 + ((n * 7919) % 260_000) : 420_000 + ((n * 104_729) % 900_000);
    files[path] = { ...art, size };
    documents.push({
      id,
      project_id: projectId,
      selection_id: o.selectionId ?? null,
      uploaded_by: o.by ?? USERS.owner,
      storage_path: path,
      file_name: `${o.name}${isImage ? ".jpg" : ".pdf"}`,
      mime_type: isImage ? "image/jpeg" : "application/pdf",
      size_bytes: size,
      kind: o.kind ?? (isImage ? "photo" : "other"),
      caption: o.caption ?? null,
      client_visible: o.visible ?? true,
      show_on_website: o.website ?? false,
      thumb_path: null,
      created_at: ago(o.daysAgo ?? 10),
    });
    return path;
  }

  const statuses: CustomStatus[] = [
    { id: 1, name: "Estimate pending", stage: "planning" },
    { id: 2, name: "Permitting", stage: "planning" },
    { id: 3, name: "Punch list", stage: "active" },
  ];

  const project = (p: Partial<Project> & Pick<Project, "id" | "name" | "status" | "color">): Project => ({
    address: null,
    start_date: null,
    target_completion: null,
    category: null,
    city: null,
    completed_on: null,
    custom_status_id: null,
    ...p,
  });
  const projects: Project[] = [
    project({ id: "p-hartley", name: "Hartley Residence", status: "active", color: "#2f6f8f", category: "new_construction", city: "Kalama", address: "1420 Sample Ridge Rd, Kalama, WA", start_date: dateOnly(-75), target_completion: dateOnly(140) }),
    project({ id: "p-nguyen", name: "Nguyen Shop", status: "active", color: "#b5651d", category: "shop", city: "Woodland", address: "88 Example Ln, Woodland, WA", start_date: dateOnly(-30), target_completion: dateOnly(45) }),
    project({ id: "p-wells", name: "Wells Bath Refresh", status: "active", color: "#16a085", category: "remodel", city: "Kelso", address: "312 Demo Ave, Kelso, WA", start_date: dateOnly(-50), target_completion: dateOnly(6), custom_status_id: 3 }),
    project({ id: "p-brooks", name: "Brooks Kitchen Remodel", status: "planning", color: "#8e44ad", category: "remodel", city: "Longview", address: "45 Placeholder St, Longview, WA", custom_status_id: 1 }),
    project({ id: "p-delgado", name: "Delgado ADU", status: "planning", color: "#c0392b", category: "adu", city: "Castle Rock", address: "9 Fictional Way, Castle Rock, WA", target_completion: dateOnly(220), custom_status_id: 2 }),
    project({ id: "p-river", name: "Riverside Duplex", status: "on_hold", color: "#34495e", category: "multi_family", city: "Kelso", address: "700 Mock River Dr, Kelso, WA" }),
    project({ id: "p-morales", name: "Morales Residence", status: "complete", color: "#5b8c3a", category: "new_construction", city: "Kalama", address: "5 Pretend Hill Rd, Kalama, WA", completed_on: "2025-08-22" }),
    project({ id: "p-pine", name: "Pine St. Remodel", status: "complete", color: "#d4a017", category: "remodel", city: "Longview", address: "210 Pine St (sample), Longview, WA", completed_on: "2026-03-14" }),
    project({ id: "p-cedar", name: "Cedar Lane Shop", status: "complete", color: "#7f8c8d", category: "shop", city: "Woodland", address: "17 Cedar Ln (sample), Woodland, WA", completed_on: "2025-11-05" }),
  ];

  // People: all made up, all at example.com.
  const person = (id: string, full_name: string, email: string, role: PersonRow["role"], projectIds: string[], phone: string | null = null): PersonRow => ({
    id, full_name, email, role, phone, feed_token: `demo-${id}`, project_members: projectIds.map((project_id) => ({ project_id })),
  });
  const profiles: PersonRow[] = [
    person(USERS.owner, "Pat Morgan", "owner@example.com", "owner", [], "(360) 555-0100"),
    person(USERS.staff, "Casey Office", "office@example.com", "staff", []),
    person(USERS.client, "Jordan Hartley", "jordan.hartley@example.com", "client", ["p-hartley"], "(360) 555-0142"),
    person("u-nguyen", "Linh Nguyen", "linh.nguyen@example.com", "client", ["p-nguyen"]),
    person("u-wells", "Morgan Wells", "m.wells@example.com", "client", ["p-wells"]),
    person("u-brooks", "Taylor & Chris Brooks", "brooks.family@example.com", "client", ["p-brooks"]),
    person("u-delgado", "Rosa Delgado", "rosa.d@example.com", "client", ["p-delgado"]),
  ];

  // Photos and files
  addFile("p-hartley", { type: "house", stage: "lot", seed: 11 }, { name: "Lot staked", caption: "Lot staked and ready to dig", daysAgo: 74 });
  addFile("p-hartley", { type: "house", stage: "foundation", seed: 12 }, { name: "Foundation poured", caption: "Foundation poured", daysAgo: 52 });
  addFile("p-hartley", { type: "house", stage: "framing", seed: 13 }, { name: "Framing", caption: "Walls and trusses are up!", daysAgo: 24 });
  addFile("p-hartley", { type: "house", stage: "dried-in", seed: 14 }, { name: "Dried in", caption: "Roof on and house wrapped", daysAgo: 6 });
  addFile("p-hartley", { type: "doc", name: "Hartley floor plan" }, { name: "Hartley floor plan", kind: "plan", daysAgo: 80 });
  addFile("p-hartley", { type: "doc", name: "Building permit" }, { name: "Building permit", kind: "permit", daysAgo: 78 });
  addFile("p-hartley", { type: "doc", name: "Construction contract" }, { name: "Construction contract", kind: "contract", visible: false, daysAgo: 90 });
  addFile("p-nguyen", { type: "shop", seed: 21 }, { name: "Shop frame", caption: "Steel is up", daysAgo: 4 });
  addFile("p-nguyen", { type: "doc", name: "Shop plans" }, { name: "Shop plans", kind: "plan", daysAgo: 35 });
  addFile("p-wells", { type: "room", kind: "bath", seed: 31 }, { name: "New tile", caption: "Tile is in", daysAgo: 3 });
  addFile("p-brooks", { type: "room", kind: "kitchen", seed: 41 }, { name: "Existing kitchen", caption: "Before: existing kitchen", daysAgo: 12 });
  addFile("p-morales", { type: "house", stage: "framing", seed: 51 }, { name: "Morales framing", caption: "Framing", daysAgo: 400, website: true });
  addFile("p-morales", { type: "house", stage: "siding", seed: 52 }, { name: "Morales siding", caption: "Siding going on", daysAgo: 380, website: true });
  addFile("p-morales", { type: "house", stage: "complete", seed: 53 }, { name: "Morales complete", caption: "Finished!", daysAgo: 360, website: true });
  addFile("p-morales", { type: "room", kind: "kitchen", seed: 54 }, { name: "Morales kitchen", caption: "Kitchen", daysAgo: 360, website: true });
  addFile("p-morales", { type: "room", kind: "living", seed: 55 }, { name: "Morales living room", caption: "Living room", daysAgo: 360, website: true });
  addFile("p-pine", { type: "room", kind: "kitchen", seed: 61 }, { name: "Pine kitchen", caption: "New kitchen", daysAgo: 200, website: true });
  addFile("p-pine", { type: "room", kind: "bath", seed: 62 }, { name: "Pine bath", caption: "Primary bath", daysAgo: 200, website: true });
  addFile("p-cedar", { type: "shop", seed: 71 }, { name: "Cedar shop", caption: "Finished shop", daysAgo: 330, website: true });
  addFile(null, { type: "house", stage: "siding", seed: 81 }, { name: "Site visit 1", daysAgo: 1 });
  addFile(null, { type: "room", kind: "bath", seed: 82 }, { name: "Site visit 2", daysAgo: 1 });
  addFile(null, { type: "room", kind: "living", seed: 83 }, { name: "Site visit 3", daysAgo: 0 });

  // Selections: one waiting on the client, one waiting on the owner, one done.
  const option = (selection_id: string, i: number, label: string, description: string, art: FileArt) => {
    const image_path = `${selection_id.replace("s-", "p-").split("-").slice(0, 2).join("-")}/options/${selection_id}-${i}.jpg`;
    files[image_path] = { ...art, size: 90_000 + i * 13_000 };
    return { id: `${selection_id}-o${i}`, selection_id, label, description, image_path, sort_order: i };
  };
  const selection = (s: Partial<Selection> & Pick<Selection, "id" | "project_id" | "title">): Selection => ({
    instructions: null, due_date: null, status: "requested", client_note: null, staff_note: null, chosen_option_id: null,
    submitted_at: null, decided_at: null, created_at: ago(8), selection_options: [], ...s,
  });
  const selections: Selection[] = [
    selection({
      id: "s-hartley-tile", project_id: "p-hartley", title: "Primary bath floor tile", due_date: dateOnly(5), created_at: ago(3),
      instructions: "Pick a floor tile for the primary bathroom. All three work with the vanity you chose. Upload a photo if you've seen something else you like!",
      selection_options: [
        option("s-hartley-tile", 0, "Warm gray 12×12", "Matte porcelain, easy to clean", { type: "tile", color: "#a59d93", grout: "#d8d4ce", pattern: "grid" }),
        option("s-hartley-tile", 1, "White hex", "Classic 2\" hexagon mosaic", { type: "tile", color: "#f1f0ec", grout: "#b9b6b0", pattern: "hex" }),
        option("s-hartley-tile", 2, "Oak-look herringbone", "Wood-look porcelain planks (+$3/sq ft)", { type: "tile", color: "#b8875a", grout: "#8d6a48", pattern: "herringbone" }),
      ],
    }),
    selection({
      id: "s-hartley-counter", project_id: "p-hartley", title: "Kitchen countertops", due_date: dateOnly(-2), status: "submitted", created_at: ago(14), submitted_at: ago(1),
      instructions: "Choose the countertop for the kitchen and island.", client_note: "We love the white one — can the island be the dark one instead?",
      selection_options: [
        option("s-hartley-counter", 0, "Snow quartz", "Bright white with gray flecks", { type: "counter", base: "#f2f1ee", fleck: "#9a9a9a" }),
        option("s-hartley-counter", 1, "Midnight granite", "Near-black with silver flecks", { type: "counter", base: "#24272b", fleck: "#c7c9cc" }),
      ],
    }),
    selection({
      id: "s-hartley-paint", project_id: "p-hartley", title: "Exterior paint color", status: "approved", created_at: ago(30), submitted_at: ago(25), decided_at: ago(24),
      instructions: "Siding color for the whole house.", client_note: "Sage, please!", staff_note: "Ordered. Painting starts after siding.",
      selection_options: [
        option("s-hartley-paint", 0, "Sage", "Soft green-gray", { type: "paint", color: "#8a9a8f", name: "Sage (sample)" }),
        option("s-hartley-paint", 1, "Harbor blue", "Muted blue", { type: "paint", color: "#6f7f94", name: "Harbor blue (sample)" }),
      ],
    }),
    selection({
      id: "s-nguyen-door", project_id: "p-nguyen", title: "Roll-up door color", due_date: dateOnly(-3), created_at: ago(12),
      selection_options: [
        option("s-nguyen-door", 0, "Charcoal", "", { type: "paint", color: "#3f454b", name: "Charcoal (sample)" }),
        option("s-nguyen-door", 1, "Barn red", "", { type: "paint", color: "#8e2f25", name: "Barn red (sample)" }),
      ],
    }),
    selection({
      id: "s-wells-floor", project_id: "p-wells", title: "Hallway flooring", status: "revision_requested", created_at: ago(20), submitted_at: ago(9), decided_at: ago(8),
      client_note: "The light oak", staff_note: "That one's discontinued, sorry! Could you pick again?", due_date: dateOnly(2),
      selection_options: [
        option("s-wells-floor", 0, "Light oak", "Discontinued", { type: "planks", color: "#d2b48c" }),
        option("s-wells-floor", 1, "Walnut", "", { type: "planks", color: "#6b4a33" }),
      ],
    }),
  ];
  selections.find((s) => s.id === "s-hartley-counter")!.chosen_option_id = "s-hartley-counter-o0";
  selections.find((s) => s.id === "s-hartley-paint")!.chosen_option_id = "s-hartley-paint-o0";
  selections.find((s) => s.id === "s-wells-floor")!.chosen_option_id = "s-wells-floor-o0";
  addFile("p-hartley", { type: "counter", base: "#ece9e3", fleck: "#6d6d6d" }, { name: "Countertop inspiration", caption: "Saw this at a friend's house", kind: "selection", by: USERS.client, selectionId: "s-hartley-counter", daysAgo: 1 });

  // Calendar: a few weeks around today.
  let e = 0;
  const event = (title: string, projectIds: string[], when: { day: number; hour?: number; hours?: number; days?: number }, o: { visible?: boolean; notes?: string } = {}): CalEvent => {
    const isAllDay = when.hour === undefined;
    return {
      id: `e${++e}`,
      title,
      notes: o.notes ?? null,
      starts_at: isAllDay ? allDay(when.day) : at(when.day, when.hour!),
      ends_at: isAllDay ? (when.days ? allDay(when.day + when.days) : null) : at(when.day, when.hour! + (when.hours ?? 1)),
      all_day: isAllDay,
      client_visible: o.visible ?? true,
      event_projects: projectIds.map((project_id) => ({ project_id })),
    };
  };
  const events: CalEvent[] = [
    event("Foundation inspection", ["p-hartley"], { day: -50, hour: 10 }),
    event("Framing inspection", ["p-hartley"], { day: -20, hour: 9 }),
    event("Roofing", ["p-hartley"], { day: -10, days: 3 }),
    event("Window delivery", ["p-hartley"], { day: 1, hour: 8, hours: 2 }, { notes: "Driveway needs to be clear by 8." }),
    event("Electrical rough-in", ["p-hartley"], { day: 3, days: 3 }),
    event("Walkthrough with Jordan", ["p-hartley"], { day: 7, hour: 16 }, { notes: "Bring countertop samples." }),
    event("Plumbing rough-in inspection", ["p-hartley"], { day: 10, hour: 11 }),
    event("Insulation", ["p-hartley"], { day: 13, days: 2 }),
    event("Order cabinets (internal)", ["p-hartley"], { day: 2, hour: 13 }, { visible: false }),
    event("Concrete pour: shop slab", ["p-nguyen"], { day: 2, hour: 7, hours: 4 }),
    event("Steel delivery", ["p-nguyen"], { day: 6, hour: 9 }),
    event("Final walkthrough", ["p-wells"], { day: 5, hour: 15 }),
    event("Estimate meeting", ["p-brooks"], { day: 4, hour: 17 }),
    event("Permit submittal", ["p-delgado"], { day: 8 }, { visible: false }),
    event("Lumber delivery (shared truck)", ["p-hartley", "p-nguyen"], { day: 9, hour: 8 }),
    event("Office closed", ["p-hartley", "p-nguyen", "p-wells"], { day: 15 }),
    event("Team safety meeting", [], { day: 0, hour: 7 }, { visible: false }),
    event("Supplier meeting", [], { day: 11, hour: 12 }, { visible: false }),
  ];

  // Website inquiries
  const quotes: Quote[] = [];
  const quote = (q: Partial<Quote> & Pick<Quote, "id" | "email">, daysAgo: number) =>
    quotes.push({ name: null, phone: null, address: null, message: null, file_paths: [], status: "new", staff_notes: null, project_id: null, ...q, created_at: ago(daysAgo), submitted_at: ago(daysAgo) });
  files["q1/1-house-plans.pdf"] = { type: "doc", name: "house-plans.pdf", size: 2_400_000 };
  quote({ id: "q1", name: "Avery Sample", email: "avery.sample@example.com", phone: "(360) 555-0177", address: "Lot 4, Example Rd, Kalama, WA 98625", message: "Hi! We bought a lot outside Kalama and are looking for a builder for a 3-bed, 2-bath single story, about 1,900 sq ft. Plans attached. Hoping to start next spring.", file_paths: ["q1/1-house-plans.pdf"] }, 1);
  quote({ id: "q2", name: "Sam Placeholder", email: "sam.p@example.com", message: "Looking for a quote on a 30x40 shop with a roll-up door and a small office.", status: "contacted", staff_notes: "Called 9/29, site visit next week." }, 6);
  quote({ id: "q3", name: "Taylor & Chris Brooks", email: "brooks.family@example.com", message: "Kitchen remodel: new cabinets, counters, and opening the wall to the dining room.", status: "converted", project_id: "p-brooks" }, 15);

  return {
    profiles, projects, statuses, events, selections, documents, quotes, files,
    limits: { database_limit_mb: 500, storage_limit_mb: 10240 },
    nextId: 1000,
  };
}
