# First Choice Homes LLC — Website & Client Portal

- **Website** (`/`): the public marketing page for [firstchoicehomesllc.org](https://firstchoicehomesllc.org).
- **Client portal** (`/app/`): clients log in to see their project schedule, make selections
  (tile, paint, fixtures…), and view photos and documents. Staff manage one master calendar,
  projects, selections, website inquiries, and invitations.

Hosted free on GitHub Pages. The backend is [Supabase](https://supabase.com) (database, logins,
server functions); files (photos, plans, inquiry uploads) are stored in
[Cloudflare R2](https://developers.cloudflare.com/r2/). Email goes through [Resend](https://resend.com).

## How it fits together

```
Browser ──> GitHub Pages (static files built by Vite)
   │
   └──> Supabase
          ├─ Postgres + Row Level Security   who can see what (enforced by the database)
          ├─ Auth                            emailed-code/link and password logins
          └─ Edge Functions                  sign-in emails, invites, inquiry emails, notifications,
                 │                           calendar feed, file access (`files`)
                 ├──> Resend (email)
                 └──> Cloudflare R2           plans, photos, selection and inquiry uploads (private
                                              bucket; browsers get short-lived signed links only
                                              after the database's permission check)
```

### Who sees what
| | Owner | Staff | Client |
|---|---|---|---|
| Master calendar, including staff-only events (project names and colors only) | ✓ | ✓ (view only) | – |
| Projects, photos and files, selections, inquiries, people, photo dump | ✓ | – | – |
| Add/change calendar events, projects, selections, files | ✓ | – | – |
| Invite clients, add staff, change roles | ✓ | – | – |
| Their project's schedule, selections, files | ✓ | – | ✓ (own projects only) |
| Respond to selections, upload their own photos | – | – | ✓ |

Staff accounts see **only the master calendar** and can't change anything; the database enforces
both. Anyone who needs to edit (for example the secretary who keeps the calendar up to date) gets
an owner account.

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
src/site/                  Marketing page CSS + JS (inquiry form)
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
npx supabase start          # local database, auth, and email catcher
# Local stand-in for Cloudflare R2 (file storage), then create its bucket:
docker run -d --name fch-r2 --network supabase_network_FCHWebsite -p 9000:9000 -e RUSTFS_ACCESS_KEY=minioadmin -e RUSTFS_SECRET_KEY=minioadmin rustfs/rustfs
node scripts/local-r2-setup.mjs
cp .env.example .env.local  # then paste the "anon key" from `npx supabase status`
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve   # in a second terminal
npm run dev                    # http://localhost:5173 (portal at /app/)
```

- Emails (sign-in codes, invites, inquiry notifications) are caught by Mailpit at http://localhost:54324.
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
   npx supabase secrets set R2_ACCOUNT_ID=<id> R2_ACCESS_KEY_ID=<key> R2_SECRET_ACCESS_KEY=<secret> R2_BUCKET=<bucket>
   ```
   For R2: in Cloudflare, *R2 → Create bucket* (private). Under the bucket's *Settings → CORS policy*,
   allow `GET` and `PUT` from `https://firstchoicehomesllc.org` with any header. Then *R2 → Manage API
   tokens → Create API token* with *Object Read & Write* on that bucket; it shows the access key and
   secret once. The account ID is on the R2 overview page.
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

**Photo storage:** photos go in Cloudflare R2, shrunk to at most 1.5 MB each (usually a few hundred
KB) plus a small thumbnail. R2 includes 10 GB free, then about $0.015 per GB per month, with no
download fees. The overview's *Space used* card shows files and database against limits you set.

**Moving files from Supabase Storage (one time):** the `copy-files-to-r2` function copies every
stored file into R2 under the same paths, using the R2 secrets already in Supabase; the comment at
the top of `supabase/functions/copy-files-to-r2/index.ts` shows how to run it. It skips files
already copied, so it's safe to run again; it never deletes anything from Supabase.

## Editing the website
- **Text:** edit `index.html`; each section has a comment.
- **Our Work photos** come from the portal, not from files in this repo:
  1. Upload photos in *Photo dump* (owner only; works from a phone), then select them and move them
     into a project.
  2. Give the project a build type and city, then press *Mark completed*.
  3. On the project's *Photos & files* tab, press *Show on website* on the photos to show.
  The front page lists each build type that has such photos, then projects as `City-Month-Year` (e.g. `Kalama-January-2025`)
  (served by the `public-gallery` function; changes appear within a minute).

## Ideas for later
Change orders with e-approval · allowance tracker for selections · per-project message thread ·
warranty/punch-list requests · subcontractor logins (see only their events) · draw schedule ·
SMS reminders · installable phone app (PWA).
