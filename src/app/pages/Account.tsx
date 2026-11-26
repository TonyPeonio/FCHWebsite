import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import * as api from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth";
import { ErrorNote, useToast } from "../components/ui";

export function CalendarFeed({ compact }: { compact?: boolean }) {
  const { profile, refresh, isStaff } = useAuth();
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const rotate = useMutation({
    mutationFn: api.rotateFeedToken,
    onSuccess: () => {
      toast("New link made. The old one no longer works.");
      refresh();
    },
  });
  if (!profile) return null;
  const url = api.feedUrl(profile.feed_token);

  return (
    <section className={compact ? "feed compact" : "card feed"}>
      <h2>See the schedule in your own calendar</h2>
      <p className="muted small">
        Copy this private link and subscribe to it once; your calendar then stays up to date on its own{isStaff ? " and includes every project" : ""}. Don't share
        the link.
      </p>
      <div className="copy-row">
        <input readOnly aria-label="Your private calendar link" value={url} onFocus={(e) => e.target.select()} />
        <button
          className="btn"
          onClick={() =>
            navigator.clipboard.writeText(url).then(
              () => {
                setCopied(true);
                toast("Link copied.");
                setTimeout(() => setCopied(false), 2000);
              },
              () => toast("Couldn't copy. Select the link and copy it yourself.", "error"),
            )
          }
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <details className="how-to">
        <summary>How do I subscribe?</summary>
        <ul>
          <li>
            <strong>iPhone or iPad:</strong> Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar, then paste the link.
          </li>
          <li>
            <strong>Google Calendar (also for Android):</strong> on a computer, open calendar.google.com → Other calendars → + → From URL, then paste the link.
          </li>
          <li>
            <strong>Outlook:</strong> Add calendar → Subscribe from web, then paste the link.
          </li>
          <li>
            <strong>Mac Calendar:</strong> File → New Calendar Subscription, then paste the link.
          </li>
        </ul>
      </details>
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
  const toast = useToast();

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: () => api.updateMyProfile(profile!.id, { full_name: name.trim(), phone: phone.trim() || null }),
    onSuccess: () => {
      toast("Saved.");
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
      toast("Password set. You can sign in with it next time.");
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
        <p className="muted">
          Signed in as <strong>{profile?.email}</strong>
        </p>
        <label>
          Name
          <input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Phone
          <input type="tel" value={phone} autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
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
        <p className="muted small">You can always sign in with an emailed code. Set a password only if you'd rather type one.</p>
        <label>
          New password
          <input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <span className="hint">At least 8 characters.</span>
        </label>
        <button className="btn" disabled={setPw.isPending}>
          {setPw.isPending ? "Saving…" : "Set password"}
        </button>
        <ErrorNote error={setPw.error} />
      </form>

      <CalendarFeed />
    </div>
  );
}
