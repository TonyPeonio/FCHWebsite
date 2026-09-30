# First Choice Homes LLC — Website & Client Portal

- **Website** (`/`): the public marketing page for [firstchoicehomesllc.org](https://firstchoicehomesllc.org).
- **Client portal** (`/app/`): clients log in to see their project schedule, make selections
  (tile, paint, fixtures…), and view photos and documents. Staff manage one master calendar,
  projects, selections, quote requests, and invitations.

Hosted free on GitHub Pages. The backend is [Supabase](https://supabase.com) (database, logins,
file storage, server functions). Email goes through [Resend](https://resend.com).

## How it fits together

```
Browser ──> GitHub Pages (static files built by Vite)
   │
   └──> Supabase
          ├─ Postgres + Row Level Security   who can see what (enforced by the database)
          ├─ Auth                            emailed-code/link and password logins
          ├─ Storage                         plans, photos, selection uploads (private)
          └─ Edge Functions                  sign-in emails, invites, quote emails, notifications,
                 │                           calendar feed
                 └──> Resend (email)
```

### Who sees what
| | Owner | Staff | Client |
|---|---|---|---|
| See master calendar, all projects, quotes, files | ✓ | ✓ (view only) | – |
| Add/change calendar events, projects, selections, files | ✓ | – | – |
| Invite clients, add staff, change roles | ✓ | – | – |
| Their project's schedule, selections, files | ✓ | ✓ | ✓ (own projects only) |
| Respond to selections, upload their own photos | – | – | ✓ |
| Staff-only events and hidden files | ✓ | ✓ | – |

Staff accounts are **view-only everywhere**; the database rejects any change they attempt.
Anyone who needs to edit (for example the secretary who keeps the calendar up to date) gets an
owner account.

### The master calendar
Whoever manages the schedule (an owner account) works in **one calendar** (Portal → Master Calendar). Staff can view it but not change it. Each event can be tagged to
one or more projects. A client sees an event only if it's tagged to one of their projects **and**
"Visible to clients" is checked. A shared event (e.g. one lumber truck for two sites) shows up for
both clients, and neither can tell the other project exists. Untick "Visible to clients" for
internal items like sub scheduling or pricing calls.

Anyone can subscribe to their calendar in Google, Apple, or Outlook from the portal's Account
page (read-only, auto-updating).

## Project layout
```
index.html                 Marketing page
src/site/                  Marketing page CSS + JS (quote form)
app/index.html             Portal entry point
src/app/                   Portal (React): pages/, pages/admin/, components/
src/lib/                   Supabase client, data functions (api.ts), types
public/                    Images and CNAME, copied as-is
supabase/migrations/       Database schema + security rules
supabase/functions/        Edge functions (Deno / TypeScript)
supabase/tests/            Security tests (pgTAP)
supabase/seed.sql          Local test data
.github/workflows/         Build + deploy to GitHub Pages
```

## Local development
Needs Node 20+ and Docker Desktop (running).

```bash
npm install
npx supabase start          # local database, auth, storage, and email catcher
cp .env.example .env.local  # then paste the "anon key" from `npx supabase status`
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve   # in a second terminal
npm run dev                    # http://localhost:5173 (portal at /app/)
```

- Emails (sign-in links, invites, quote notifications) are caught by Mailpit at http://localhost:54324.
- Seeded logins are listed at the top of `supabase/seed.sql`.
- `npx supabase db reset` rebuilds the database from migrations + seed.
- `npx supabase test db` runs the security tests.

## Going live (one-time setup)
1. **Supabase:** create a project (region: West US). From *Project Settings → API*, copy the
   Project URL and the anon/publishable key.
2. **Link and deploy the backend:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   npx supabase functions deploy
   npx supabase secrets set SITE_URL=https://firstchoicehomesllc.org OFFICE_EMAIL=firstchoicehomesllc@yahoo.com
   npx supabase secrets set RESEND_API_KEY=<from Resend> TURNSTILE_SECRET=<from Cloudflare>
   ```
3. **Resend:** add and verify the domain `firstchoicehomesllc.org` (Resend shows DNS records to add
   in GoDaddy; they don't affect existing email). Sign-in and invitation emails are sent by the
   `send-sign-in-email` and `invite-user` functions through Resend's API (`RESEND_API_KEY`), not by
   Supabase. For emails you send from the Supabase dashboard (step 7), also set up Resend under
   *Authentication → Emails → SMTP* and paste the files in `supabase/templates/` into
   *Authentication → Email Templates*.
4. **Cloudflare Turnstile:** create a free widget for `firstchoicehomesllc.org` to get a site key and secret.
5. **Supabase Auth settings:** turn off "Allow new users to sign up"; set Site URL to
   `https://firstchoicehomesllc.org/app/` and add it under Redirect URLs.
6. **GitHub:** *Settings → Pages → Source: GitHub Actions*. Under *Settings → Secrets and variables
   → Actions → Variables*, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`.
   Every push to `master` then deploys automatically.
7. **First owner account:** in Supabase *Authentication → Users → Invite user*, invite the owner,
   then run in the SQL editor:
   `update profiles set role = 'owner' where email = 'owner@example.com';`
   The owner can invite everyone else from the portal.
8. **Domain (GoDaddy DNS):** four `A` records for `@` → `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`; `www` CNAME → `tonypeonio.github.io`. Leave MX records
   alone. Enable "Enforce HTTPS" in Pages once it's live, then cancel the GoDaddy Website Builder plan
   (keep the domain).

**Cost:** GitHub Pages, Resend (3,000 emails/mo), and Turnstile are free. Supabase is free to start;
free projects pause after a week without activity, so move to Pro ($25/mo, includes daily backups)
once clients are using it.

## Editing the website
- **Text:** edit `index.html`; each section has a comment.
- **Gallery photos:** add a JPG (about 1600px wide) to `public/images/gallery/` and copy one of the
  `<button><img …></button>` lines.

## Ideas for later
Change orders with e-approval · allowance tracker for selections · per-project message thread ·
warranty/punch-list requests · subcontractor logins (see only their events) · draw schedule ·
SMS reminders · installable phone app (PWA).
