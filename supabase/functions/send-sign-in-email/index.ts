// Public: emails a portal sign-in button and code to someone who already has an account.
// Replaces Supabase's own sign-in email; see _shared/signin.ts for why.
import { sendSignInEmail } from "../_shared/signin.ts";
import { adminClient, HttpError, isEmail, json, serve } from "../_shared/util.ts";

// Same per-person limit Supabase's own sign-in email had.
const COOLDOWN_MS = 60_000;

const NOT_FOUND =
  "We couldn't find a portal account for that email. Check the spelling, or contact the office if you haven't been invited yet.";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email address.");

  // Look the person up first: generateLink would create an account for an unknown address.
  const db = adminClient();
  const { data: profile, error } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!profile) throw new HttpError(404, NOT_FOUND);

  const { data: found, error: userError } = await db.auth.admin.getUserById(profile.id);
  if (userError || !found.user) throw new HttpError(404, NOT_FOUND);

  const lastSent = found.user.recovery_sent_at ? Date.parse(found.user.recovery_sent_at) : 0;
  if (Date.now() - lastSent < COOLDOWN_MS) {
    throw new HttpError(429, "We just sent you an email. Please wait a minute before asking for another.");
  }

  try {
    await sendSignInEmail(db, email);
  } catch (err) {
    console.error(err);
    throw new HttpError(502, "We couldn't send the email just now. Please try again in a minute, or contact the office.");
  }
  return json({ sent: true });
});
