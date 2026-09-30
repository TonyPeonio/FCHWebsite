import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth";

/**
 * Staff must use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
 * First visit: scan a QR code to enroll. Later visits: enter the 6-digit code.
 */
export function Mfa() {
  const { signOut, profile } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError(listError.message);
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setFactorId(verified.id);

      // Clean up half-finished enrollments, then start a new one.
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError) return setError(enrollError.message);
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
    })();
  }, []);

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (verifyError) {
      setError("That code didn't work. Codes change every 30 seconds — try the current one.");
      setBusy(false);
    }
    // On success the auth listener reloads the app with staff access.
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={verify}>
        <h1>Two-step verification</h1>
        {qr ? (
          <>
            <p className="muted">
              Staff accounts can see every client's information, so they need an authenticator app. Scan this code
              with Google Authenticator, Microsoft Authenticator, or similar, then enter the 6-digit code it shows.
            </p>
            <img className="qr" src={qr} alt="Authenticator QR code" />
            <details>
              <summary>Can't scan? Enter this key manually</summary>
              <code className="secret">{secret}</code>
            </details>
          </>
        ) : (
          <p className="muted">Hi {profile?.full_name || "there"} — enter the 6-digit code from your authenticator app.</p>
        )}
        <label>
          Code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <button className="btn primary block" disabled={busy || !factorId}>
          Verify
        </button>
        {error && <p className="notice error">{error}</p>}
        <button type="button" className="link-btn" onClick={signOut}>
          Sign out
        </button>
      </form>
    </div>
  );
}
