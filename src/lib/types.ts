export type Role = "owner" | "staff" | "client";
export type ProjectStatus = "planning" | "active" | "on_hold" | "complete";
export type SelectionStatus = "requested" | "submitted" | "approved" | "revision_requested";
export type DocumentKind = "plan" | "permit" | "contract" | "photo" | "selection" | "other";
export type QuoteStatus = "draft" | "new" | "contacted" | "converted" | "declined";
export type ProjectCategory = "new_construction" | "shop" | "remodel" | "adu" | "multi_family" | "commercial";

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
  category: ProjectCategory | null;
  city: string | null;
  /** Set by "Mark completed"; with the city, labels the project on the public website. */
  completed_on: string | null;
  /** An owner-added status (e.g. "Estimate pending"); `status` is then that status's stage. */
  custom_status_id: number | null;
}

/** A status the owner added, filed under one of the built-in stages. */
export interface CustomStatus {
  id: number;
  name: string;
  stage: ProjectStatus;
}

export interface SpaceUsed {
  database_bytes: number;
  buckets: { bucket_id: string; files: number; bytes: number }[];
}

export interface UsageLimits {
  database_limit_mb: number;
  storage_limit_mb: number;
}

/** What the calendar needs to label events; staff get only this about projects. */
export type CalendarProject = Pick<Project, "id" | "name" | "color">;

export interface CalEvent {
  id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
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
  /** Null while the photo sits in the owner's photo dump. */
  project_id: string | null;
  selection_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: DocumentKind;
  caption: string | null;
  client_visible: boolean;
  /** Shown in the public "Our Work" gallery (completed projects only). */
  show_on_website: boolean;
  thumb_path: string | null;
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


export const SELECTION_STATUS_LABEL: Record<SelectionStatus, string> = {
  requested: "Waiting on client",
  submitted: "Needs review",
  approved: "Approved",
  revision_requested: "Changes requested",
};

/** Same statuses, worded for the client. */
export const SELECTION_STATUS_LABEL_CLIENT: Record<SelectionStatus, string> = {
  requested: "Needs your choice",
  submitted: "Submitted",
  approved: "Approved",
  revision_requested: "Changes requested",
};

/** The built-in project stages, in order. */
export const PROJECT_STAGE_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Under construction",
  on_hold: "On hold",
  complete: "Complete",
};

/** A project's custom status if it has one, otherwise its stage. */
export function projectStatusLabel(p: Pick<Project, "status" | "custom_status_id">, statuses: CustomStatus[] | undefined) {
  return statuses?.find((s) => s.id === p.custom_status_id)?.name ?? PROJECT_STAGE_LABEL[p.status];
}

export const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  new_construction: "New construction homes",
  shop: "Shops",
  remodel: "Remodels",
  adu: "ADUs",
  multi_family: "Multi-family",
  commercial: "Commercial",
};

export const DOC_KIND_LABEL: Record<DocumentKind, string> = {
  plan: "Plans",
  permit: "Permits",
  contract: "Contracts",
  photo: "Photos",
  selection: "Selection uploads",
  other: "Other",
};
