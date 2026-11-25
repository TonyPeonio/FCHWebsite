// Home-page content the owner can edit in the portal (Website page). Stored in the site_content
// table; the public page (src/site/main.js) swaps these into index.html, whose own text matches the
// defaults below and shows until the saved content loads (or if it can't).

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type SitePhoto = "hero" | "legacy" | "welcome";

export interface Review {
  title: string;
  /** Shown in quotation marks. */
  text: string;
  name: string;
  /** As written, e.g. "2/12/2026". */
  date: string;
  /** 1 to 5. */
  stars: number;
}

export interface Faq {
  question: string;
  answer: string;
}

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
  /** Shown in order; an empty list hides the reviews section. */
  reviews: Review[];
  /** Shown in order; an empty list leaves just the "reach us" line. */
  faq: Faq[];
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
  reviews: [
    {
      title: "Home Renovation",
      text: "We had a full home renovation completed on a pretty tight timeline, and couldn’t be happier with how everything turned out! First Choice Homes worked with our budget without cutting corners, and their attention to detail shows in every room. Communication was clear and consistent throughout the entire process, which made what could have been stressful feel manageable.",
      name: "Steve Schreiner",
      date: "2/12/2026",
      stars: 5,
    },
    {
      title: "Pleasure",
      text: "It has been my pleasure to be a sub contractor for First Choice Homes LLC for over 17 years. Quality work, respect, friendships, craftsmanship, and family is how I would explain this company. Thanks Riley and Jessica for all your hard work!!!!",
      name: "Matt Rich",
      date: "10/11/2024",
      stars: 5,
    },
  ],
  faq: [
    { question: "How long does it take to build a house?", answer: "Generally around nine months." },
    { question: "How long does it take to get started?", answer: "Depending on availability, usually around one month." },
    {
      question: "What do we need to give you an estimate?",
      answer: "House plans and preferred materials are necessities, and extra details are always welcome!",
    },
  ],
  photos: {},
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const asReview = (v: unknown): Review | null => {
  const r = (v ?? {}) as Record<string, unknown>;
  const review = { title: text(r.title), text: text(r.text), name: text(r.name), date: text(r.date), stars: Math.min(5, Math.max(1, Math.round(Number(r.stars) || 5))) };
  return review.text && review.name ? review : null;
};
const asFaq = (v: unknown): Faq | null => {
  const f = (v ?? {}) as Record<string, unknown>;
  const faq = { question: text(f.question), answer: text(f.answer) };
  return faq.question && faq.answer ? faq : null;
};

/** Saved content over the defaults, ignoring anything malformed. */
export function withDefaults(saved: Partial<SiteContent> | null | undefined): SiteContent {
  const out = { ...DEFAULT_SITE_CONTENT, photos: { ...(saved?.photos ?? {}) } };
  for (const key of Object.keys(DEFAULT_SITE_CONTENT) as (keyof SiteContent)[]) {
    const value = saved?.[key];
    if (key === "hours") {
      if (Array.isArray(value) && value.length === 7) out.hours = value.map(String);
    } else if (key === "reviews") {
      if (Array.isArray(value)) out.reviews = value.map(asReview).filter((r): r is Review => r !== null);
    } else if (key === "faq") {
      if (Array.isArray(value)) out.faq = value.map(asFaq).filter((f): f is Faq => f !== null);
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
