// Home-page content the owner can edit in the portal (Website page). Stored in the site_content
// table; the public page (src/site/main.js) swaps these into index.html, whose own text matches the
// defaults below and shows until the saved content loads (or if it can't).

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type SitePhoto = "hero" | "legacy" | "welcome";

export interface SiteContent {
  heroTitle: string;
  heroText: string;
  legacyTitle: string;
  legacyText: string;
  welcomeText: string;
  welcomeTagline: string;
  phone: string;
  email: string;
  address: string;
  /** Opening hours Monday to Sunday, e.g. "09:00 am – 05:00 pm" or "Closed". */
  hours: string[];
  /** Replacement photos (file paths under site/ in storage); a missing one keeps the original. */
  photos: Partial<Record<SitePhoto, string>>;
}

/** Each spot crops its photo to a fixed shape (see src/site/styles.css), described in `shape`.
 *  `original` is relative to the site root (import.meta.env.BASE_URL). */
export const SITE_PHOTOS: { key: SitePhoto; label: string; original: string; shape: string }[] = [
  { key: "hero", label: "Top of the page", original: "images/hero.jpg", shape: "Wide (16:10). Landscape photos work best." },
  { key: "legacy", label: "Building Dreams Together", original: "images/building-dreams.jpg", shape: "Wide (16:9). Landscape photos work best." },
  { key: "welcome", label: "Welcome", original: "images/welcome.jpg", shape: "Tall (3:4). Portrait photos work best." },
];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  heroTitle: "Custom Home Builders: Cultivating Your Dream Home",
  heroText:
    "Transforming your visions into beautiful custom homes with care through our expert home building services, ensuring your dream home construction becomes a reality.",
  legacyTitle: "Our Legacy",
  legacyText:
    "First Choice Homes LLC is a family owned and operated construction company with over two decades of experience in home building services. We focus on delivering small town quality in every custom home we build, ensuring your dream home construction vision becomes a reality.",
  welcomeText:
    "We’re a family-owned custom home builder with 20+ years of experience. We craft homes that reflect your vision, lifestyle, and personality, treating every project with care, quality, and integrity.",
  welcomeTagline: "We build more than houses — we build homes you’ll love for a lifetime.",
  phone: "(360) 673-2926",
  email: "firstchoicehomesllc@yahoo.com",
  address: "175 N First St Ste A, Kalama, WA, USA",
  hours: ["09:00 am – 05:00 pm", "09:00 am – 05:00 pm", "09:00 am – 05:00 pm", "09:00 am – 05:00 pm", "09:00 am – 05:00 pm", "Closed", "Closed"],
  photos: {},
};

/** Saved content over the defaults, ignoring anything malformed. */
export function withDefaults(saved: Partial<SiteContent> | null | undefined): SiteContent {
  const out = { ...DEFAULT_SITE_CONTENT, photos: { ...(saved?.photos ?? {}) } };
  for (const key of Object.keys(DEFAULT_SITE_CONTENT) as (keyof SiteContent)[]) {
    const value = saved?.[key];
    if (key === "hours") {
      if (Array.isArray(value) && value.length === 7) out.hours = value.map(String);
    } else if (key !== "photos" && typeof value === "string" && value.trim()) {
      (out[key] as string) = value;
    }
  }
  return out;
}

/** "tel:" link for a US number like "(360) 673-2926". */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits.length === 10 ? `+1${digits}` : `+${digits}`}`;
}

export const mapHref = (address: string) => `https://maps.google.com/?q=${encodeURIComponent(address)}`;
