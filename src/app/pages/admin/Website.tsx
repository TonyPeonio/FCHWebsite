import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../../lib/api";
import { DAYS, SITE_PHOTOS, type Faq, type Review, type SiteContent, type SitePhoto } from "../../../lib/siteContent";
import { DropZone, ErrorNote } from "../../components/ui";
import { useSignedUrls, useSiteContent } from "../../hooks";

type TextKey = Exclude<keyof SiteContent, "hours" | "photos" | "reviews" | "faq">;

const TEXT_FIELDS: { key: TextKey; label: string; long?: boolean }[] = [
  { key: "heroTitle", label: "Top of the page: heading" },
  { key: "heroText", label: "Top of the page: text", long: true },
  { key: "legacyTitle", label: "Building Dreams Together: heading" },
  { key: "legacyText", label: "Building Dreams Together: text", long: true },
  { key: "welcomeText", label: "Welcome: text", long: true },
  { key: "welcomeTagline", label: "Welcome: closing line (bold)" },
];

const sameText = (a: SiteContent, b: SiteContent) =>
  JSON.stringify({ ...a, photos: null }) === JSON.stringify({ ...b, photos: null });

/** Owner-only: edit the public home page's hours, contact details, text, and photos. */
export function Website() {
  const qc = useQueryClient();
  const saved = useSiteContent();
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (saved.data && !draft) setDraft(saved.data);
  }, [saved.data, draft]);

  const save = useMutation({
    // Photos are saved as soon as they're uploaded, so keep whatever is saved for them now.
    mutationFn: (d: SiteContent) => api.saveSiteContent({ ...d, photos: saved.data?.photos ?? {} }),
    onSuccess: () => {
      setNotice("Saved. The website shows the changes within about a minute.");
      qc.invalidateQueries({ queryKey: ["site-content"] });
    },
  });

  if (!draft || !saved.data) {
    return <div className="page">{saved.error ? <ErrorNote error={saved.error} /> : "Loading…"}</div>;
  }
  const dirty = !sameText(draft, saved.data);
  const set = (patch: Partial<SiteContent>) => {
    setNotice(null);
    setDraft({ ...draft, ...patch });
  };
  const problem =
    draft.phone.replace(/\D/g, "").length < 10
      ? "Enter the full phone number, with area code."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
        ? "Enter a valid email address."
        : null;

  return (
    <div className="page">
      <div className="title-row">
        <h1>Website</h1>
        <a className="btn" href={import.meta.env.BASE_URL} target="_blank" rel="noopener">
          View website
        </a>
      </div>
      <p className="muted small">
        Edit what visitors see on the home page. Text, hours, and contact details are saved when you press Save; photos are saved
        as soon as they upload.
      </p>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!problem) save.mutate(draft);
        }}
      >
        <section className="card">
          <h2>Hours</h2>
          <div className="hours-grid">
            {DAYS.map((day, i) => (
              <label key={day}>
                {day}
                <input
                  required
                  maxLength={60}
                  value={draft.hours[i]}
                  placeholder="e.g. 09:00 am – 05:00 pm, or Closed"
                  onChange={(e) => set({ hours: draft.hours.map((h, j) => (j === i ? e.target.value : h)) })}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Contact details</h2>
          <div className="grid-2 tight">
            <label>
              Phone
              <input required type="tel" maxLength={30} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
            </label>
            <label>
              Email
              <input required type="email" maxLength={120} value={draft.email} onChange={(e) => set({ email: e.target.value })} />
            </label>
          </div>
          <label>
            Address
            <input required maxLength={160} value={draft.address} onChange={(e) => set({ address: e.target.value })} />
          </label>
          <p className="muted small">
            Shown on the home page with a map link. Website inquiries are still emailed to the office address set up for the
            portal.
          </p>
        </section>

        <section className="card">
          <h2>Text</h2>
          {TEXT_FIELDS.map((f) => (
            <label key={f.key}>
              {f.label}
              {f.long ? (
                <textarea required rows={4} maxLength={1200} value={draft[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} />
              ) : (
                <input required maxLength={160} value={draft[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} />
              )}
            </label>
          ))}
        </section>

        <section className="card">
          <h2>Reviews</h2>
          <p className="muted small">Shown in this order. Remove them all to hide the reviews section.</p>
          {draft.reviews.map((r, i) => {
            const update = (patch: Partial<Review>) => set({ reviews: draft.reviews.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <fieldset key={i} className="list-item">
                <legend>Review {i + 1}</legend>
                <div className="grid-2 tight">
                  <label>
                    Title
                    <input maxLength={80} value={r.title} placeholder="e.g. Home Renovation" onChange={(e) => update({ title: e.target.value })} />
                  </label>
                  <label>
                    Stars
                    <select value={r.stars} onChange={(e) => update({ stars: Number(e.target.value) })}>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {"★".repeat(n)} ({n})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Name
                    <input required maxLength={80} value={r.name} onChange={(e) => update({ name: e.target.value })} />
                  </label>
                  <label>
                    Date
                    <input maxLength={40} value={r.date} placeholder="e.g. 2/12/2026" onChange={(e) => update({ date: e.target.value })} />
                  </label>
                </div>
                <label>
                  Review
                  <textarea required rows={4} maxLength={1500} value={r.text} onChange={(e) => update({ text: e.target.value })} />
                </label>
                <ListControls index={i} count={draft.reviews.length} onChange={(order) => set({ reviews: order(draft.reviews) })} noun="review" />
              </fieldset>
            );
          })}
          <button
            type="button"
            className="btn"
            onClick={() => set({ reviews: [...draft.reviews, { title: "", text: "", name: "", date: "", stars: 5 }] })}
          >
            + Add a review
          </button>
        </section>

        <section className="card">
          <h2>Frequently asked questions</h2>
          {draft.faq.map((f, i) => {
            const update = (patch: Partial<Faq>) => set({ faq: draft.faq.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <fieldset key={i} className="list-item">
                <legend>Question {i + 1}</legend>
                <label>
                  Question
                  <input required maxLength={200} value={f.question} onChange={(e) => update({ question: e.target.value })} />
                </label>
                <label>
                  Answer
                  <textarea required rows={3} maxLength={1500} value={f.answer} onChange={(e) => update({ answer: e.target.value })} />
                </label>
                <ListControls index={i} count={draft.faq.length} onChange={(order) => set({ faq: order(draft.faq) })} noun="question" />
              </fieldset>
            );
          })}
          <button type="button" className="btn" onClick={() => set({ faq: [...draft.faq, { question: "", answer: "" }] })}>
            + Add a question
          </button>
        </section>

        <div className="save-bar">
          <button className="btn primary" disabled={!dirty || save.isPending || !!problem}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          {dirty && (
            <button type="button" className="link-btn small" onClick={() => setDraft(saved.data)}>
              Undo changes
            </button>
          )}
          {dirty && problem && <span className="notice error">{problem}</span>}
          {notice && !dirty && <span className="notice ok">{notice}</span>}
          <ErrorNote error={save.error} />
        </div>
      </form>

      <section className="card">
        <h2>Photos</h2>
        <div className="site-photos">
          {SITE_PHOTOS.map((p) => (
            <PhotoSlot key={p.key} slot={p.key} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Move up / move down / remove for one entry in an editable list. */
function ListControls({
  index,
  count,
  noun,
  onChange,
}: {
  index: number;
  count: number;
  noun: string;
  onChange: (reorder: <T>(list: T[]) => T[]) => void;
}) {
  const swap = (a: number, b: number) =>
    onChange(<T,>(list: T[]) => list.map((x, i) => (i === a ? list[b] : i === b ? list[a] : x)));
  return (
    <div className="btn-row list-controls">
      <button type="button" className="link-btn small" disabled={index === 0} onClick={() => swap(index, index - 1)}>
        Move up
      </button>
      <button type="button" className="link-btn small" disabled={index === count - 1} onClick={() => swap(index, index + 1)}>
        Move down
      </button>
      <button
        type="button"
        className="link-btn small danger"
        onClick={() => confirm(`Remove this ${noun}?`) && onChange(<T,>(list: T[]) => list.filter((_, i) => i !== index))}
      >
        Remove
      </button>
    </div>
  );
}

/** One home-page photo: preview, replace by dropping or choosing a file, or go back to the original. */
function PhotoSlot({ slot }: { slot: SitePhoto }) {
  const qc = useQueryClient();
  const saved = useSiteContent();
  const info = SITE_PHOTOS.find((p) => p.key === slot)!;
  const current = saved.data?.photos[slot];
  const { data: urls } = useSignedUrls("project-files", current ? [current] : []);

  const change = useMutation({
    mutationFn: async (file: File | null) => {
      const latest = await api.fetchSiteContent(); // never overwrite text saved meanwhile
      const path = file ? await api.uploadSitePhoto(file) : null;
      const photos = { ...latest.photos };
      if (path) photos[slot] = path;
      else delete photos[slot];
      try {
        await api.saveSiteContent({ ...latest, photos });
      } catch (err) {
        if (path) await api.removeSitePhoto(path);
        throw err;
      }
      const old = latest.photos[slot];
      if (old && old !== path) await api.removeSitePhoto(old);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["site-content"] }),
  });

  const src = current ? urls?.[current] : import.meta.env.BASE_URL + info.original;
  return (
    <div className="site-photo">
      <h3>{info.label}</h3>
      <p className="muted small">{info.shape} It's cropped to fit.</p>
      {src ? <img src={src} alt={`Current ${info.label} photo`} /> : <div className="img-ph" />}
      <DropZone
        multiple={false}
        accept="image/jpeg,image/png,image/webp"
        label={change.isPending ? "Uploading…" : current ? "Choose a different photo" : "Replace photo"}
        hint="Drag and drop a photo here, or"
        disabled={change.isPending}
        onFiles={([file]) => change.mutate(file)}
      />
      {current && (
        <button
          type="button"
          className="link-btn small"
          disabled={change.isPending}
          onClick={() => confirm("Go back to the original photo?") && change.mutate(null)}
        >
          Use the original photo
        </button>
      )}
      <ErrorNote error={change.error} />
    </div>
  );
}
