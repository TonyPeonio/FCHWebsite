export type Role = "owner" | "staff" | "client";
export type ProjectStatus = "planning" | "active" | "on_hold" | "complete";
export type SelectionStatus = "requested" | "submitted" | "approved" | "revision_requested";
export type DocumentKind = "plan" | "permit" | "contract" | "photo" | "selection" | "other";
export type QuoteStatus = "draft" | "new" | "contacted" | "converted" | "declined";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  feed_token: string;
}

export interface Project {
  id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  color: string;
  start_date: string | null;
  target_completion: string | null;
}

export interface CalEvent {
  id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  category: string | null;
  client_visible: boolean;
  event_projects: { project_id: string }[];
}

export interface SelectionOption {
  id: string;
  selection_id: string;
  label: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
}

export interface Selection {
  id: string;
  project_id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  status: SelectionStatus;
  client_note: string | null;
  staff_note: string | null;
  chosen_option_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  selection_options: SelectionOption[];
}

export interface Doc {
  id: string;
  project_id: string;
  selection_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: DocumentKind;
  caption: string | null;
  client_visible: boolean;
  created_at: string;
}

export interface Quote {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  message: string | null;
  file_paths: string[];
  status: QuoteStatus;
  staff_notes: string | null;
  project_id: string | null;
  created_at: string;
  submitted_at: string | null;
}

export interface PersonRow extends Profile {
  project_members: { project_id: string }[];
}

export const EVENT_CATEGORIES = [
  "Site work",
  "Foundation",
  "Framing",
  "Roofing",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Insulation",
  "Drywall",
  "Finish work",
  "Inspection",
  "Delivery",
  "Meeting",
  "Demolition",
  "Office",
  "Internal",
];

export const SELECTION_STATUS_LABEL: Record<SelectionStatus, string> = {
  requested: "Waiting on client",
  submitted: "Needs review",
  approved: "Approved",
  revision_requested: "Changes requested",
};

export const DOC_KIND_LABEL: Record<DocumentKind, string> = {
  plan: "Plans",
  permit: "Permits",
  contract: "Contracts",
  photo: "Photos",
  selection: "Selection uploads",
  other: "Other",
};
