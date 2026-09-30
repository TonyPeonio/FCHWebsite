import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";

const clientNav = [
  { to: "/", label: "Overview", end: true },
  { to: "/schedule", label: "Schedule" },
  { to: "/selections", label: "Selections" },
  { to: "/files", label: "Photos & Files" },
];

const staffNav = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/calendar", label: "Master Calendar" },
  { to: "/admin/projects", label: "Projects" },
  { to: "/admin/quotes", label: "Inquiries" },
  { to: "/admin/people", label: "People" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { isStaff, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = isStaff ? staffNav : clientNav;

  return (
    <div className="shell">
      <header className="topbar">
        <a href="/" className="brand" title="Back to website">
          <img src="/images/logo.png" alt="First Choice Homes" />
        </a>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
          ☰
        </button>
        <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/account" className="nav-account">
            {profile?.full_name || "Account"}
          </NavLink>
          <button className="link-btn" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
