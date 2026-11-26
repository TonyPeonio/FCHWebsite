import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useQuotes, useSelections } from "../hooks";
import { Icon, ToastProvider } from "./basics";

const clientNav = [
  { to: "/", label: "Overview", end: true },
  { to: "/schedule", label: "Schedule" },
  { to: "/selections", label: "Selections" },
  { to: "/files", label: "Photos & Files" },
];

const staffNav = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/calendar", label: "Calendar" },
  { to: "/admin/projects", label: "Projects" },
  { to: "/admin/selections", label: "Selections" },
  { to: "/admin/quotes", label: "Inquiries" },
  { to: "/admin/people", label: "People" },
  { to: "/admin/website", label: "Website" },
];

/** Page names for the browser tab, by the start of the address (longest match wins). */
const TITLES: [string, string][] = [
  ["/admin/calendar", "Calendar"],
  ["/admin/projects", "Projects"],
  ["/admin/selections", "Selections"],
  ["/admin/quotes", "Inquiries"],
  ["/admin/people", "People"],
  ["/admin/website", "Website"],
  ["/admin", "Overview"],
  ["/schedule", "Schedule"],
  ["/selections", "Selections"],
  ["/files", "Photos & Files"],
  ["/account", "Your account"],
  ["/", "Overview"],
];

/** How many things are waiting on the signed-in person, shown as a count beside the menu item. */
function useNavCounts(isOwner: boolean, isStaff: boolean): Record<string, number> {
  // Staff see only the calendar, so there's nothing to count (or allowed to load) for them.
  const selections = useSelections(undefined, isOwner || !isStaff);
  const quotes = useQuotes(isOwner);
  const rows = selections.data ?? [];
  if (isOwner) {
    return {
      "/admin/selections": rows.filter((s) => s.status === "submitted").length,
      "/admin/quotes": (quotes.data ?? []).filter((q) => q.status === "new").length,
    };
  }
  if (isStaff) return {};
  return { "/selections": rows.filter((s) => s.status === "requested" || s.status === "revision_requested").length };
}

export function Layout({ children }: { children: ReactNode }) {
  const { isStaff, isOwner, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  // Staff (not owners) get only the master calendar.
  const nav = isOwner ? staffNav : isStaff ? staffNav.filter((n) => n.to === "/admin/calendar") : clientNav;
  const counts = useNavCounts(isOwner, isStaff);

  // On each new page: name the browser tab, close the phone menu, and move keyboard and
  // screen-reader focus to the page so it's announced (not on first load, which would steal focus).
  useEffect(() => {
    const title = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`) || prefix === "/")?.[1];
    document.title = `${title ?? "Client Portal"} | First Choice Homes`;
    setOpen(false);
    if (first.current) first.current = false;
    else {
      main.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="shell">
        <a href="#main" className="skip-link" onClick={(e) => (e.preventDefault(), main.current?.focus())}>
          Skip to content
        </a>
        <header className={`topbar${nav.length > 5 ? " many" : ""}`}>
          <a href={import.meta.env.BASE_URL} className="brand" title="Back to the website">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="First Choice Homes: back to the website" />
          </a>
          <button className="menu-btn" aria-expanded={open} aria-controls="portal-nav" onClick={() => setOpen(!open)}>
            <Icon name={open ? "close" : "menu"} size={22} />
            <span>Menu</span>
          </button>
          <nav id="portal-nav" className={open ? "open" : ""} aria-label="Portal">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
                {counts[n.to] > 0 && (
                  <span className="nav-count" aria-label={`${counts[n.to]} waiting`}>
                    {counts[n.to]}
                  </span>
                )}
              </NavLink>
            ))}
            <NavLink to="/account" className="nav-account" title="Your account">
              {profile?.full_name || "Account"}
            </NavLink>
            <button className="link-btn" onClick={signOut}>
              Sign out
            </button>
          </nav>
        </header>
        <main className="content" id="main" tabIndex={-1} ref={main}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
