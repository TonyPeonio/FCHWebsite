import { useState, type FormEvent } from "react";
import { FunctionsFetchError, FunctionsRelayError } from "@supabase/supabase-js";
import * as api from "../../lib/api";
import { clearPendingLink, linkError, pendingLink, supabase } from "../../lib/supabase";

const EXPIRED = "That sign-in link has expired or was already used. Enter your email below for a new code.";

type Message = { ok: boolean; text: string } | null;

export function Login() {
  const [mode, setMode] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(Boolean(pendingLink));
  const [message, setMessage] = useState<Message>(linkError ? { ok: false, text: linkError } : null);

  const address = email.trim().toLowerCase();

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

  async function sendCode(): Promise<Message> {
    try {
      await api.sendSignInEmail(address);
    } catch (err) {
      const offline = err instanceof FunctionsFetchError || err instanceof FunctionsRelayError;
      return { ok: false, text: offline ? "We couldn't reach the portal. Check your connection and try again." : (err as Error).message };
    }
    setCode("");
    setMode("code");
    return { ok: true, text: "Email sent. It can take a minute or two to arrive; check your spam folder if you don't see it." };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === "email") {
      setMessage(await sendCode());
    } else if (mode === "code") {
      const { error } = await supabase.auth.verifyOtp({ email: address, token: code.replace(/\D/g, ""), type: "email" });
      if (error) setMessage({ ok: false, text: "That code didn't work. Check it, or use the newest email if you asked for more than one." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: address, password });
      if (error) setMessage({ ok: false, text: "Incorrect email or password." });
    }
    setBusy(false);
  }

  async function resend() {
    setBusy(true);
    setMessage(await sendCode());
    setBusy(false);
  }

  function switchTo(next: typeof mode) {
    setMode(next);
    setMessage(null);
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <a href="/">
          <img src="/images/logo.png" alt="First Choice Homes" className="auth-logo" />
        </a>
        <h1>Client Portal</h1>
        <p className="muted">
          {mode === "email" && "Enter the email we invited you with and we'll send you a sign-in code."}
          {mode === "code" && (
            <>
              Enter the code we emailed to <strong>{address}</strong>, or press the button in that email.
            </>
          )}
          {mode === "password" && "Sign in with your password."}
        </p>
        {/* Keys make React swap in a fresh input, so the code box gets focus and no email autofill. */}
        {mode === "code" ? (
          <label key="code">
            Code
            <input
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        ) : (
          <label key="email">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          {busy ? "Please wait…" : mode === "email" ? "Email me a sign-in code" : "Sign in"}
        </button>
        {message && <p className={message.ok ? "notice ok" : "notice error"}>{message.text}</p>}
        {mode === "code" && (
          <>
            <button type="button" className="link-btn" disabled={busy} onClick={resend}>
              Send a new code
            </button>
            <button type="button" className="link-btn" onClick={() => switchTo("email")}>
              Use a different email
            </button>
          </>
        )}
        <button type="button" className="link-btn" onClick={() => switchTo(mode === "password" ? "email" : "password")}>
          {mode === "password" ? "Email me a sign-in code instead" : "Sign in with a password instead"}
        </button>
      </form>
    </div>
  );
}
