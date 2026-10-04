// The demo's guided tour: walks a prospective customer through the owner's side, then the
// client's side, highlighting each part of the screen with a short explanation.
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { DemoRole } from "./session";

interface Step {
  route: string;
  /** What to highlight: a CSS selector, or the card whose heading starts with this text. */
  sel?: string;
  heading?: string;
  title: string;
  body: string;
}

export const TOURS: Record<"owner" | "client", Step[]> = {
  owner: [
    { route: "/admin", sel: ".stats", title: "The owner's overview", body: "Everything that needs attention at a glance: new website inquiries, selections to review or waiting on clients, and how many jobs are in planning or under construction. Each box opens the matching list." },
    { route: "/admin", heading: "Next up", title: "What's coming up", body: "The next few calendar items across every job, color-coded by project." },
    { route: "/admin", heading: "In planning", title: "Projects by stage", body: "Jobs under construction and in planning, with their status. Statuses are yours to define, like \"Estimate pending\" or \"Permitting\"." },
    { route: "/admin", heading: "Space used", title: "Storage at a glance", body: "How much photo and file storage you're using against your plan, so there are no surprise bills." },
    { route: "/admin/calendar", sel: ".calendar-wrap", title: "One master calendar", body: "Every job's schedule in one place. Drag to reschedule, tag an event to one or more projects, and choose whether the client sees it (dashed = internal only). Clients only ever see their own project's shared events." },
    { route: "/admin/projects", sel: ".table-wrap", title: "All your projects", body: "Filter by stage, see who the clients are, and spot selections waiting for your review. \"Statuses\" lets you add your own." },
    { route: "/admin/projects/p-hartley", sel: ".tabs", title: "A project's home", body: "Each project has its schedule, selections, photos & files, and the clients who can see it. You decide which files the client sees, and which photos appear on the public website once it's done." },
    { route: "/admin/selections", sel: ".chips.filter", title: "Selections across every job", body: "Tile, paint, fixtures, anything the client needs to choose. See what's waiting on clients, what's overdue, and what needs your review." },
    { route: "/selections/s-hartley-counter", heading: "Review", title: "Approve or ask for changes", body: "Jordan picked a countertop and left a note. Approve it, or send it back with a comment. The client gets an email either way (not in this demo)." },
    { route: "/admin/photos", sel: ".dump-grid", title: "Photo dump", body: "Snap photos on site from your phone, then sort them into projects later. Only you see this area." },
    { route: "/admin/quotes", sel: ".quote", title: "Website inquiries", body: "When someone fills out the website's inquiry form (with plans attached), it lands here and in your email. Track each one from new to project." },
    { route: "/admin/people", heading: "Invite someone", title: "Clients and staff", body: "Invite a client to their project by email; they sign in with a one-time code, no password to forget. Staff can be given calendar-only access." },
  ],
  client: [
    { route: "/", sel: ".project-cards", title: "The client's home", body: "Your client sees their project, its status, and the target completion date, and nothing about anyone else's job." },
    { route: "/", heading: "Waiting on you", title: "What needs their input", body: "Selections they still need to make, with due dates, front and center." },
    { route: "/", heading: "Coming up", title: "What's happening next", body: "The upcoming schedule items you've chosen to share with them." },
    { route: "/schedule", sel: ".calendar-wrap", title: "Their schedule", body: "A calendar of just their project. They can also subscribe on their phone so it updates automatically." },
    { route: "/selections/s-hartley-tile", sel: ".options", title: "Making a selection", body: "Try it: pick a tile, add a note, maybe upload a photo of something they like, and submit. The owner is notified and can approve or ask for changes." },
    { route: "/files", sel: ".page", title: "Photos & files", body: "Progress photos, plans, and permits you've shared, plus a place for them to send you photos or documents." },
  ],
};

function findTarget(step: Step): Element | null {
  if (step.sel) return document.querySelector(step.sel);
  if (step.heading) {
    const h = [...document.querySelectorAll("main h1, main h2")].find((el) => el.textContent?.trim().startsWith(step.heading!));
    return h?.closest("section, .card") ?? h ?? null;
  }
  return null;
}

export function Tour({
  role,
  step,
  onStep,
  onClose,
  onSwitch,
}: {
  role: "owner" | "client";
  step: number;
  onStep: (n: number) => void;
  onClose: () => void;
  onSwitch: (role: DemoRole) => void;
}) {
  const steps = TOURS[role];
  const current = steps[step];
  const [box, setBox] = useState<DOMRect | null>(null);

  // Go to the step's page.
  useEffect(() => {
    if (current && window.location.hash.replace(/^#/, "") !== current.route) window.location.hash = current.route;
  }, [current]);

  // Find what to highlight once the page has loaded it, and keep the ring on it as things move.
  const measure = useCallback(() => {
    const el = current && findTarget(current);
    setBox(el ? el.getBoundingClientRect() : null);
    return el;
  }, [current]);
  useLayoutEffect(() => {
    setBox(null);
    let tries = 0;
    let scrolled = false;
    const timer = setInterval(() => {
      const el = measure();
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (++tries > 40) clearInterval(timer); // keep tracking for ~8 s while content loads
    }, 200);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  if (!current) return null;
  const last = step === steps.length - 1;
  const pad = 6;

  return (
    <>
      {box && (
        <div
          className="tour-ring"
          style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }}
          aria-hidden="true"
        />
      )}
      <div className="tour-card" role="dialog" aria-label="Guided tour">
        <div className="tour-head">
          <small>
            {role === "owner" ? "Owner's side" : "Client's side"} · {step + 1} of {steps.length}
          </small>
          <button className="link-btn small" onClick={onClose}>
            End tour
          </button>
        </div>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        <div className="btn-row">
          {step > 0 && (
            <button className="btn" onClick={() => onStep(step - 1)}>
              Back
            </button>
          )}
          {!last && (
            <button className="btn primary" onClick={() => onStep(step + 1)}>
              Next
            </button>
          )}
          {last && role === "owner" && (
            <button className="btn primary" onClick={() => onSwitch("client")}>
              Now see the client's side →
            </button>
          )}
          {last && role === "client" && (
            <>
              <button className="btn primary" onClick={onClose}>
                Explore on my own
              </button>
              <button className="btn" onClick={() => onSwitch("owner")}>
                Back to the owner's side
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
