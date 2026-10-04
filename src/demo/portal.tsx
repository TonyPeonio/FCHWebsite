// Entry point of the demo portal: the real portal app, on made-up data (see ./api), with a "sample
// data" banner, a switch between the owner's and a client's view, and a guided tour.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AuthProvider } from "./auth";
import { App } from "../app/App";
import { reset } from "./store";
import { getRole, onRoleChange, setRole, type DemoRole } from "./session";
import { Tour } from "./tour";
import "../app/app.css";
import "./demo.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } },
});

const ROLE_LABEL: Record<DemoRole, string> = { owner: "Owner", client: "Client", staff: "Office staff" };

function useRole() {
  const [role, set] = useState(getRole());
  useEffect(() => onRoleChange(() => set(getRole())), []);
  return role;
}

function Banner({ onTour }: { onTour: () => void }) {
  const role = useRole();
  const qc = useQueryClient();
  const switchTo = (r: DemoRole) => {
    qc.clear();
    setRole(r);
    window.location.hash = "/";
  };
  return (
    <div className="demo-banner" role="note">
      <p>
        <strong>Demo with sample data.</strong> The people, projects and photos are made up. Nothing you do here is sent
        anywhere; it resets when you close the tab.
      </p>
      <div className="demo-actions">
        {role && (
          <label>
            Viewing as{" "}
            <select value={role} onChange={(e) => switchTo(e.target.value as DemoRole)} aria-label="View the portal as">
              {(Object.keys(ROLE_LABEL) as DemoRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        )}
        {(role === "owner" || role === "client") && (
          <button className="demo-btn" onClick={onTour}>
            Guided tour
          </button>
        )}
        <button
          className="demo-btn"
          onClick={() => {
            if (!confirm("Start the demo over with the original sample data?")) return;
            reset();
            setRole(null);
            window.location.hash = "/";
            window.location.reload();
          }}
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}

function Chooser({ onPick }: { onPick: (r: DemoRole) => void }) {
  return (
    <div className="auth-page">
      <div className="card auth-card demo-chooser">
        <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="First Choice Homes" className="auth-logo" />
        <h1>Client Portal demo</h1>
        <p className="muted">
          A walk through the portal with made-up projects and clients. Pick a side to start a short guided tour; you can
          switch at any time from the bar at the top.
        </p>
        <button className="btn primary block" onClick={() => onPick("owner")}>
          See the owner's side
        </button>
        <button className="btn block" onClick={() => onPick("client")}>
          See a client's side
        </button>
        <a href={import.meta.env.BASE_URL} className="link-btn small">
          ← Back to the sample website
        </a>
      </div>
    </div>
  );
}

function DemoPortal() {
  const role = useRole();
  const qc = useQueryClient();
  const [tour, setTour] = useState<{ role: "owner" | "client"; step: number } | null>(null);

  const start = (r: DemoRole) => {
    qc.clear();
    setRole(r);
    if (r === "owner" || r === "client") setTour({ role: r, step: 0 });
    else window.location.hash = "/";
  };
  // The tour belongs to one view; switching views from the bar ends it.
  useEffect(() => {
    if (tour && role !== tour.role) setTour(null);
  }, [role, tour]);

  return (
    <>
      <Banner onTour={() => (role === "owner" || role === "client") && setTour({ role, step: 0 })} />
      {role ? (
        <AuthProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </AuthProvider>
      ) : (
        <Chooser onPick={start} />
      )}
      <div className="demo-tag">SAMPLE DATA</div>
      {tour && role === tour.role && (
        <Tour role={tour.role} step={tour.step} onStep={(step) => setTour({ ...tour, step })} onClose={() => setTour(null)} onSwitch={start} />
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DemoPortal />
    </QueryClientProvider>
  </StrictMode>,
);
