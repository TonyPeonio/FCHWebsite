import { useState, type FormEvent } from "react";
import { clearPendingLink, linkError, pendingLink, portalUrl, supabase } from "../../lib/supabase";

const EXPIRED = "That sign-in link has expired or was already used. Enter your email below for a new one.";

export function Login() {
  const [mode, setMode] = useState<"link" | "code" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(Boolean(pendingLink));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    linkError ? { ok: false, text: linkError } : null,
  );

  async function confirmLink() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp(pendingLink!);
    clearPendingLink();
    if (error) {
      setConfirming(false);
      setMessage({ ok: false, text: EXPIRED });
    }
    setBusy(false);
  }

  if (confirming) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <img src="/images/logo.png" alt="First Choice Homes" className="auth-logo" />
          <h1>Client Portal</h1>
          <p className="muted">You're almost in. Press the button below to finish signing in.</p>
          <button className="btn primary block" disabled={busy} onClick={confirmLink}>
            {busy ? "Please wait…" : "Sign in to the portal"}
          </button>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === "link") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: portalUrl },
      });
      if (error) {
        setMessage({ ok: false, text: "We couldn't send a link to that address. Check the spelling, or contact the office if you haven't been invited yet." });
      } else {
        setMode("code");
        setMessage({ ok: true, text: `Check ${email} for a sign-in link. It may take a minute to arrive.` });
      }
    } else if (mode === "code") {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error) setMessage({ ok: false, text: "That code didn't work. Check it, or use the newest email if you requested more than one." });
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
            : mode === "code"
              ? "Click the link in the email, or type the 6-digit code from it here."
              : "Sign in with your password."}
        </p>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === "code" && (
          <label>
            Code from the email
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
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
        {mode === "code" && (
          <button type="button" className="link-btn" onClick={() => { setMode("link"); setMessage(null); }}>
            Send a new link
          </button>
        )}
        <button type="button" className="link-btn" onClick={() => { setMode(mode === "password" ? "link" : "password"); setMessage(null); }}>
          {mode === "password" ? "Email me a sign-in link instead" : "Sign in with a password instead"}
        </button>
      </form>
    </div>
  );
}
