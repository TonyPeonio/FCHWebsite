import "./styles.css";
import { call, configured, formReady, spamCheckKey, uploadFile } from "./backend.js";
import { fastJpeg } from "../lib/images";
import { DEFAULT_SITE_CONTENT, mapHref, telHref, withDefaults } from "../lib/siteContent";

// How visitors reach the office; updated from the portal's Website page once it loads.
const contact = { email: DEFAULT_SITE_CONTENT.email, phone: DEFAULT_SITE_CONTENT.phone };

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Home-page content the owner edits in the portal (Website page). index.html already shows the
// defaults, so if this can't load, the page simply keeps them.
(async function siteContent() {
  if (!configured) return;
  let data;
  try {
    data = await call("site-content");
  } catch {
    return;
  }
  const c = withDefaults(data.content);
  document.querySelectorAll("[data-edit]").forEach((el) => {
    const value = c[el.dataset.edit];
    if (typeof value === "string") el.textContent = value;
  });
  document.querySelectorAll(".hours td").forEach((td, i) => (td.textContent = c.hours[i]));
  document.querySelectorAll("[data-edit-phone]").forEach((a) => {
    a.textContent = c.phone;
    a.href = telHref(c.phone);
  });
  // "Call (360) …" buttons: the link around the number, and the number inside it.
  document.querySelectorAll("[data-phone-link]").forEach((a) => (a.href = telHref(c.phone)));
  document.querySelectorAll("[data-phone-text]").forEach((el) => (el.textContent = c.phone));
  document.querySelectorAll("[data-edit-email]").forEach((a) => {
    a.textContent = c.email;
    a.href = `mailto:${c.email}`;
  });
  document.querySelectorAll("[data-edit-address]").forEach((a) => {
    a.textContent = c.address;
    a.href = mapHref(c.address);
  });
  renderReviews(c.reviews);
  renderFaq(c.faq);
  // Each spot crops photos to its own shape, so any replacement fits.
  document.querySelectorAll("[data-photo]").forEach((img) => {
    const url = data.photoUrls?.[img.dataset.photo];
    if (url) img.src = url;
  });
  contact.email = c.email;
  contact.phone = c.phone;
})();

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Bold today's row in the hours table (week starts Monday in the table)
(function highlightToday() {
  const rows = document.querySelectorAll(".hours tr");
  const row = rows[(new Date().getDay() + 6) % 7];
  if (!row) return;
  row.classList.add("today");
  row.querySelector("th").append(el("span", "sr-only", " (today)"));
})();

// The section links: mark the one being read, and move keyboard focus with the jump so the next
// Tab press carries on from that section rather than from the top of the page.
(function sectionNav() {
  const links = [...document.querySelectorAll(".site-nav a[href^='#']")];
  const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
  document.addEventListener("click", (e) => {
    const link = e.target.closest?.("a[href^='#']");
    const target = link && document.getElementById(link.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    history.replaceState(null, "", link.hash);
  });
  if (!("IntersectionObserver" in window)) return;
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute("aria-current"));
        byId.get(entry.target.id)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) seen.observe(section);
  });
})();

// Sections ease in as they scroll into view (skipped for people who've asked for less motion).
const reveal = (function () {
  if (reducedMotion || !("IntersectionObserver" in window)) return () => {};
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        seen.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  return (nodes) =>
    nodes.forEach((node) => {
      // Anything already on screen stays put; only what's still below eases in.
      if (node.getBoundingClientRect().top < window.innerHeight) return;
      node.classList.add("reveal");
      seen.observe(node);
    });
})();
reveal(document.querySelectorAll(".split, .review, .faq-list, .quote-form, .contact-info"));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderReviews(reviews) {
  const section = document.querySelector(".reviews");
  section.hidden = reviews.length === 0;
  document.querySelector("[data-nav='reviews']").hidden = reviews.length === 0;
  section.querySelector(".review-grid").replaceChildren(
    ...reviews.map((r) => {
      const card = el("article", "review");
      const avatar = el("div", "avatar", r.name.charAt(0).toUpperCase());
      avatar.setAttribute("aria-hidden", "true");
      const stars = el("div", "stars", "★".repeat(r.stars));
      stars.setAttribute("role", "img");
      stars.setAttribute("aria-label", `${r.stars} out of 5 stars`);
      card.append(avatar, stars);
      if (r.title) card.append(el("h3", "", r.title));
      card.append(el("p", "", `“${r.text}”`), el("footer", "", r.date ? `${r.name} · ${r.date}` : r.name));
      return card;
    }),
  );
}

function renderFaq(faq) {
  document.querySelector(".faq-list").replaceChildren(
    ...faq.map((f) => {
      const item = el("details");
      item.append(el("summary", "", f.question), el("p", "", f.answer));
      return item;
    }),
  );
}

// Lightbox: openLightbox(photos, index) with photos = [{ full, caption }]. Arrow keys, the side
// buttons, or a swipe move between photos; Esc, the ×, or a click outside the photo closes it.
const openLightbox = (function lightbox() {
  const dialog = document.getElementById("lightbox");
  const img = dialog.querySelector("img");
  const caption = dialog.querySelector("figcaption");
  const count = dialog.querySelector(".lb-count");
  const arrows = dialog.querySelectorAll(".lb-prev, .lb-next");
  let photos = [];
  let current = 0;
  let opener = null;

  function show(i) {
    current = (i + photos.length) % photos.length;
    dialog.classList.add("loading");
    img.src = photos[current].full;
    img.alt = photos[current].caption || "Project photo";
    caption.textContent = photos[current].caption;
    count.textContent = `${current + 1} of ${photos.length}`;
    // Fetch the next one now so moving on feels instant.
    if (photos.length > 1) new Image().src = photos[(current + 1) % photos.length].full;
  }
  img.addEventListener("load", () => dialog.classList.remove("loading"));
  img.addEventListener("error", () => dialog.classList.remove("loading"));

  dialog.querySelector(".lb-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  dialog.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.tagName === "FIGURE") dialog.close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (photos.length < 2) return;
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  let touchX = null;
  dialog.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  dialog.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - (touchX ?? e.changedTouches[0].clientX);
    if (Math.abs(dx) > 60 && photos.length > 1) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("no-scroll");
    opener?.focus();
  });
  return (list, i) => {
    photos = list;
    opener = document.activeElement;
    arrows.forEach((b) => (b.hidden = list.length < 2));
    show(i);
    document.documentElement.classList.add("no-scroll");
    dialog.showModal();
  };
})();

// Our Work: pick a type of build, then a project (City-Month-Year), then see its photos.
// Everything comes from the portal via the public-gallery function; the section stays hidden
// until there's something to show.
(async function ourWork() {
  const section = document.getElementById("our-work");
  if (!configured) return;
  let categories;
  try {
    ({ categories } = await call("public-gallery"));
  } catch {
    return;
  }
  if (!categories?.length) return;

  const typesEl = section.querySelector(".work-types");
  const projectsEl = section.querySelector(".work-projects");
  const title = section.querySelector(".work-title");
  const status = section.querySelector(".work-status");
  const grid = section.querySelector(".gallery");
  const photoCache = new Map();
  let showing = null;

  function button(className, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.addEventListener("click", onClick);
    return b;
  }
  const mark = (container, active) =>
    container.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === active)));

  async function showProject(project, btn, scroll = true) {
    showing = project.id;
    mark(projectsEl, btn);
    title.hidden = false;
    title.textContent = project.label;
    grid.replaceChildren();
    if (!photoCache.has(project.id)) {
      status.textContent = "Loading photos…";
      // A few grey tiles hold the space so the page doesn't jump when the photos arrive.
      grid.replaceChildren(...Array.from({ length: 4 }, () => el("div", "gallery-ph")));
      try {
        photoCache.set(project.id, (await call(`public-gallery?project=${project.id}`)).photos);
      } catch {
        if (showing !== project.id) return;
        grid.replaceChildren();
        status.textContent = "Couldn't load these photos. Please try again.";
        return;
      }
    }
    // Someone quick may have picked another project while this one was loading.
    if (showing !== project.id) return;
    const photos = photoCache.get(project.id);
    status.textContent = photos.length === 1 ? "1 photo. Select it to see it larger." : `${photos.length} photos. Select one to see it larger.`;
    grid.replaceChildren(
      ...photos.map((photo, i) => {
        const b = button("", () => openLightbox(photos, i));
        const img = document.createElement("img");
        img.src = photo.thumb;
        img.alt = photo.caption || `${project.label}, photo ${i + 1}`;
        img.loading = "lazy";
        img.decoding = "async";
        b.append(img);
        return b;
      }),
    );
    if (scroll) title.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  function showType(category, btn) {
    mark(typesEl, btn);
    const buttons = category.projects.map((project) => {
      const b = button("work-project", () => showProject(project, b));
      const img = document.createElement("img");
      img.src = project.cover;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      const label = document.createElement("span");
      label.textContent = project.label;
      b.append(img, label);
      return b;
    });
    projectsEl.replaceChildren(...buttons);
    // Open the newest project straight away, so there are photos to look at without another click.
    showProject(category.projects[0], buttons[0], false);
  }

  typesEl.replaceChildren(
    ...categories.map((category) => {
      const b = button("pill", () => showType(category, b));
      b.textContent = category.label;
      return b;
    }),
  );
  // With one type of build there's nothing to choose between.
  typesEl.hidden = categories.length < 2;
  section.hidden = false;
  document.querySelector("[data-nav='our-work']").hidden = false;
  showType(categories[0], typesEl.firstElementChild);
})();

// Website inquiry form (called quote requests in the code and database): saves the inquiry +
// uploads to Supabase, which emails the office.
(function quoteForm() {
  const form = document.getElementById("quote-form");
  const status = form.querySelector(".form-status");
  const progress = form.querySelector(".send-progress");
  const submitBtn = form.querySelector('button[type="submit"]');
  const fileInput = form.querySelector('input[type="file"]');
  const fileList = form.querySelector(".attach-list");
  const emailInput = form.elements.email;
  const emailError = form.querySelector("#email-error");
  const MAX_FILES = 10;
  const MAX_BYTES = 50 * 1024 * 1024;

  /** Shows a message under the form: "ok" (green), "error" (red), or plain while working. */
  function say(text, kind = "") {
    status.textContent = text;
    status.className = `form-status ${kind}`.trim();
  }
  function checkEmail() {
    const value = emailInput.value.trim();
    const problem = !value ? "Please enter your email so we can reply." : emailInput.validity.valid ? "" : "That email doesn't look right. Please check it.";
    emailError.textContent = problem;
    emailError.hidden = !problem;
    emailInput.setAttribute("aria-invalid", String(Boolean(problem)));
    return !problem;
  }
  emailInput.addEventListener("blur", () => emailInput.value && checkEmail());
  emailInput.addEventListener("input", () => emailError.hidden || checkEmail());

  // Always handle submit ourselves so the browser never does a default submit (which would put
  // the visitor's details in the URL). Without Supabase settings, point people to email/phone.
  if (!formReady) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      say(`Online inquiries are almost ready. For now, please email us at ${contact.email} or call ${contact.phone}.`);
    });
    return;
  }
  let files = [];
  let turnstileToken = "";
  let widgetId = null;

  // Cloudflare Turnstile: invisible-ish spam check, loaded on demand.
  if (spamCheckKey) {
    window.onTurnstileLoad = () => {
      widgetId = window.turnstile.render("#turnstile", {
        sitekey: spamCheckKey,
        callback: (token) => (turnstileToken = token),
        "expired-callback": () => (turnstileToken = ""),
      });
    };
    const ts = document.createElement("script");
    ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    ts.async = true;
    document.head.appendChild(ts);
  }

  const sizeOf = (f) => (f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`);
  function renderFiles() {
    fileList.replaceChildren(
      ...files.map((f, i) => {
        const li = el("li", f.size > MAX_BYTES ? "too-big" : "");
        li.append(el("span", "attach-name", f.name), el("span", "attach-size", f.size > MAX_BYTES ? `${sizeOf(f)}: over 50 MB` : sizeOf(f)));
        const rm = el("button", "", "Remove");
        rm.type = "button";
        rm.setAttribute("aria-label", `Remove ${f.name}`);
        rm.addEventListener("click", () => {
          files.splice(i, 1);
          renderFiles();
        });
        li.append(rm);
        return li;
      }),
    );
  }
  const addFiles = (list) => {
    const added = [...list].filter((a) => !files.some((f) => f.name === a.name && f.size === a.size && f.lastModified === a.lastModified));
    const room = MAX_FILES - files.length;
    files = [...files, ...added.slice(0, room)];
    renderFiles();
    if (added.length > room) say(`Only ${MAX_FILES} files can be attached, so ${added.length - room} ${added.length - room === 1 ? "was" : "were"} left out.`, "error");
    else if (status.classList.contains("error")) say("");
  };
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });
  // Files can also be dragged onto the attachments area.
  const dropArea = form.querySelector(".attach");
  dropArea.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dropArea.classList.add("over");
  });
  dropArea.addEventListener("dragleave", (e) => {
    if (!dropArea.contains(e.relatedTarget)) dropArea.classList.remove("over");
  });
  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("over");
    addFiles(e.dataTransfer.files);
  });

  /**
   * Phone photos of plans are often 5 MB or more each; shrinking them first makes sending far
   * quicker on mobile data while keeping the detail readable. On any trouble the original goes.
   */
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 2_000_000) return file;
    if (file.type === "image/jpeg") {
      const quick = await fastJpeg(file, 3200, 0.85);
      if (quick && quick.size < file.size) return new File([quick], file.name, { type: "image/jpeg" });
    }
    try {
      const { default: compress } = await import("browser-image-compression");
      const out = await Promise.race([
        compress(file, { maxSizeMB: 2.5, maxWidthOrHeight: 3200, useWebWorker: false }),
        new Promise((resolve) => setTimeout(() => resolve(null), 20_000)),
      ]);
      return out && out.size < file.size ? new File([out], file.name, { type: out.type }) : file;
    } catch {
      return file;
    }
  }

  /** Sends the attachments three at a time, moving the progress bar by bytes sent. */
  async function sendFiles(uploads, toSend) {
    const sent = toSend.map(() => 0);
    const total = toSend.reduce((sum, f) => sum + f.size, 0) || 1;
    let done = 0;
    let next = 0;
    const update = () => {
      progress.value = Math.round((sent.reduce((sum, part, i) => sum + part * toSend[i].size, 0) / total) * 100);
      say(`Uploading ${Math.min(done + 1, toSend.length)} of ${toSend.length}…`);
    };
    update();
    async function worker() {
      while (next < toSend.length) {
        const i = next++;
        const ok = await uploadFile(uploads[i].url, toSend[i], (part) => {
          sent[i] = part;
          update();
        });
        if (!ok) throw new Error(`Couldn't upload ${toSend[i].name}`);
        sent[i] = 1;
        done++;
        update();
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, toSend.length) }, worker));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get("company")) return; // honeypot
    if (!checkEmail()) return emailInput.focus();
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) return say(`"${tooBig.name}" is larger than 50 MB. Remove it, or email it to us instead.`, "error");
    if (spamCheckKey && !turnstileToken) return say("Please wait a moment for the spam check to finish, then try again.", "error");

    submitBtn.disabled = true;
    form.setAttribute("aria-busy", "true");
    say(files.length ? "Getting your files ready…" : "Sending…");
    try {
      const toSend = [];
      for (const f of files) toSend.push(await shrink(f));
      const { quoteId, uploads } = await call("quote-start", {
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        address: data.get("address"),
        message: data.get("message"),
        files: toSend.map((f) => ({ name: f.name, size: f.size })),
        turnstileToken,
      });
      if (toSend.length) {
        progress.hidden = false;
        await sendFiles(uploads, toSend);
      }
      say("Finishing up…");
      await call("quote-finalize", { quoteId });
      form.reset();
      files = [];
      renderFiles();
      say("Thanks! We received your inquiry and will be in touch soon.", "ok");
    } catch (err) {
      say(`${String(err.message).replace(/\.$/, "")}. Nothing was lost: please try again, or email us at ${contact.email}.`, "error");
    } finally {
      submitBtn.disabled = false;
      form.removeAttribute("aria-busy");
      progress.hidden = true;
      progress.value = 0;
      turnstileToken = "";
      if (widgetId !== null) window.turnstile.reset(widgetId);
    }
  });
})();
