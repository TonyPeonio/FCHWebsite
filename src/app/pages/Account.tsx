import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import * as api from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth";
import { ErrorNote } from "../components/ui";

export function CalendarFeed({ compact }: { compact?: boolean }) {
  const { profile, refresh, isStaff } = useAuth();
  const [copied, setCopied] = useState(false);
  const rotate = useMutation({ mutationFn: api.rotateFeedToken, onSuccess: () => refresh() });
  if (!profile) return null;
  const url = api.feedUrl(profile.feed_token);

  return (
    <section className={compact ? "feed compact" : "card feed"}>
      <h2>Add to your phone's calendar</h2>
      <p className="muted small">
        Subscribe to this link in Google Calendar ("Other calendars → From URL"), Apple Calendar ("File → New
        Calendar Subscription"), or Outlook. It updates automatically{isStaff ? " and includes every project" : ""}. Keep it private.
      </p>
      <div className="copy-row">
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          className="btn"
          onClick={() => navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {!compact && (
        <button className="link-btn small" onClick={() => confirm("Make a new link? The old one will stop working.") && rotate.mutate()}>
          Reset link
        </button>
      )}
    </section>
  );
}

export function Account() {
  const { profile, refresh } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: () => api.updateMyProfile(profile!.id, { full_name: name.trim(), phone: phone.trim() || null }),
    onSuccess: () => {
      setSaved("Saved.");
      refresh();
    },
  });
  const setPw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword("");
      setSaved("Password updated.");
    },
  });

  return (
    <div className="page narrow">
      <h1>Your account</h1>
      <form
        className="card"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="muted">{profile?.email}</p>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Phone
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn primary" disabled={save.isPending}>Save</button>
        <ErrorNote error={save.error} />
      </form>

      <form
        className="card"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setPw.mutate();
        }}
      >
        <h2>Password (optional)</h2>
        <p className="muted small">You can always sign in with an emailed link. Set a password if you'd rather type one.</p>
        <label>
          New password
          <input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn" disabled={setPw.isPending}>Set password</button>
        <ErrorNote error={setPw.error} />
      </form>
      {saved && <p className="notice ok">{saved}</p>}

      <CalendarFeed />
    </div>
  );
}
