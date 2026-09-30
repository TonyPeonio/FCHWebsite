import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth";
import { App } from "./App";
import { isConfigured } from "../lib/supabase";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

function NotReady() {
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <a href="/">
          <img src="/images/logo.png" alt="First Choice Homes" className="auth-logo" />
        </a>
        <h1>Client Portal</h1>
        <p className="muted">The client portal is almost ready. Please check back soon!</p>
        <p className="muted">
          In the meantime, reach us at <a href="mailto:firstchoicehomesllc@yahoo.com">firstchoicehomesllc@yahoo.com</a> or{" "}
          <a href="tel:+13606732926">(360) 673-2926</a>.
        </p>
        <a href="/" className="btn block">
          Back to the website
        </a>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  isConfigured ? (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
  ) : (
    <NotReady />
  ),
);
