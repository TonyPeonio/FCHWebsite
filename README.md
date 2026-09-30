# First Choice Homes LLC — Website

Source for [firstchoicehomesllc.org](https://firstchoicehomesllc.org), rebuilt as plain HTML/CSS/JS
from the original GoDaddy Website Builder site so it can be hosted on GitHub Pages and extended.

## Structure

```
index.html          The whole site (single page)
css/styles.css      Styles — colors and fonts are CSS variables at the top
js/main.js          Gallery lightbox, hours highlight, quote form submission
images/             Logo, hero, welcome photo
images/gallery/     Project photos (alt text = location / project type)
CNAME               Custom domain for GitHub Pages
```

## Preview locally

```bash
python -m http.server 8765
```

Then open http://localhost:8765.

## Editing content

- **Text** — edit `index.html` directly; each section is marked with a comment.
- **Gallery photos** — drop a JPG in `images/gallery/` (resize to ~1600px wide first) and copy one of
  the `<button><img …></button>` lines in the gallery section.
- **Reviews / FAQ** — copy an existing `<article class="review">` or `<details>` block.

## Quote form

GitHub Pages can't process forms by itself. The form posts to [Formspree](https://formspree.io):

1. Create a free Formspree account using the business email and make a new form.
2. Replace `YOUR_FORM_ID` in the `<form action="…">` in `index.html` with the form's ID.

Until that's done, submitting the form opens the visitor's email app with the message pre-filled.

## Deploying (GitHub Pages + GoDaddy domain)

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `master` / `(root)`.
2. Custom domain: `firstchoicehomesllc.org` (already in `CNAME`).
3. In GoDaddy **DNS** for the domain:
   - Delete the existing `A` record for `@` (and any "Website Builder" / forwarding record).
   - Add four `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Set the `www` record to `CNAME` → `tonypeonio.github.io`
4. Once DNS propagates (minutes to a few hours), tick **Enforce HTTPS** in Pages settings.
5. Only then cancel the GoDaddy Website Builder plan — **keep the domain registration**.

Keep any `MX` records (email) untouched when changing DNS.

## Roadmap

- Client accounts with a project schedule the office keeps up to date. GitHub Pages is static-only,
  so this needs a hosted backend for auth + database (e.g. Supabase or Firebase) that the front end
  talks to, plus a simple admin page for the secretary to edit schedules.
