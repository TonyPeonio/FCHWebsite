import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";

// Split the calendar and staff pages into separate downloads so clients load less.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const Account = named(() => import("./pages/Account"), "Account");
const Schedule = named(() => import("./pages/Schedule"), "Schedule");
const Selections = named(() => import("./pages/Selections"), "Selections");
const SelectionDetail = named(() => import("./pages/SelectionDetail"), "SelectionDetail");
const Files = named(() => import("./pages/Files"), "Files");
const AdminHome = named(() => import("./pages/admin/AdminHome"), "AdminHome");
const MasterCalendar = named(() => import("./pages/admin/MasterCalendar"), "MasterCalendar");
const Projects = named(() => import("./pages/admin/Projects"), "Projects");
const ProjectDetail = named(() => import("./pages/admin/ProjectDetail"), "ProjectDetail");
const Quotes = named(() => import("./pages/admin/Quotes"), "Quotes");
const PhotoDump = named(() => import("./pages/admin/PhotoDump"), "PhotoDump");
const People = named(() => import("./pages/admin/People"), "People");

export function App() {
  const { loading, session, isStaff, isOwner } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!session) return <Login />;

  return (
    <Layout>
      <Suspense fallback={<div className="page muted">Loading…</div>}>
      <Routes>
        {isOwner ? (
          <>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminHome />} />
            <Route path="/admin/calendar" element={<MasterCalendar />} />
            <Route path="/admin/projects" element={<Projects />} />
            <Route path="/admin/projects/:id" element={<ProjectDetail />} />
            <Route path="/admin/quotes" element={<Quotes />} />
            <Route path="/admin/photos" element={<PhotoDump />} />
            <Route path="/admin/people" element={<People />} />
            <Route path="/selections/:id" element={<SelectionDetail />} />
          </>
        ) : isStaff ? (
          // Staff see only the master calendar (the database enforces the same).
          <>
            <Route path="/" element={<Navigate to="/admin/calendar" replace />} />
            <Route path="/admin/calendar" element={<MasterCalendar />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/selections" element={<Selections />} />
            <Route path="/files" element={<Files />} />
            <Route path="/selections/:id" element={<SelectionDetail />} />
          </>
        )}
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
