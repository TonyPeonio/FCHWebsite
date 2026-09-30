import { useState, type FormEvent } from "react";
import { portalUrl, supabase } from "../../lib/supabase";

export function Login() {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === "link") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: portalUrl },
      });
      setMessage(
        error
          ? { ok: false, text: "We couldn't send a link to that address. Check the spelling, or contact the office if you haven't been invited yet." }
          : { ok: true, text: `Check ${email} for a sign-in link. It may take a minute to arrive.` },
      );
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ ok: false, text: "Incorrect email or password." });
    }
    setBusy(false);
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <a href="/">
          <img src="/images/logo.png" alt="First Choice Homes" className="auth-logo" />
        </a>
        <h1>Client Portal</h1>
        <p className="muted">
          {mode === "link"
            ? "Enter the email we invited you with and we'll send you a sign-in link."
            : "Sign in with your password."}
        </p>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === "password" && (
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Please wait…" : mode === "link" ? "Email me a sign-in link" : "Sign in"}
        </button>
        {message && <p className={message.ok ? "notice ok" : "notice error"}>{message.text}</p>}
        <button type="button" className="link-btn" onClick={() => setMode(mode === "link" ? "password" : "link")}>
          {mode === "link" ? "Sign in with a password instead" : "Email me a sign-in link instead"}
        </button>
      </form>
    </div>
  );
}
