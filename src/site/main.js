import "./styles.css";
import { call, configured, formReady, spamCheckKey, uploadFile } from "./backend.js";
import { DEFAULT_SITE_CONTENT, mapHref, telHref, withDefaults } from "../lib/siteContent";

// How visitors reach the office; updated from the portal's Website page once it loads.
const contact = { email: DEFAULT_SITE_CONTENT.email, phone: DEFAULT_SITE_CONTENT.phone };

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
  document.querySelectorAll("[data-edit-email]").forEach((a) => {
    a.textContent = c.email;
    a.href = `mailto:${c.email}`;
  });
  document.querySelectorAll("[data-edit-address]").forEach((a) => {
    a.textContent = c.address;
    a.href = mapHref(c.address);
  });
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
  const idx = (new Date().getDay() + 6) % 7;
  if (rows[idx]) rows[idx].classList.add("today");
})();

// Lightbox: openLightbox(photos, index) with photos = [{ full, caption }]
const openLightbox = (function lightbox() {
  const dialog = document.getElementById("lightbox");
  const img = dialog.querySelector("img");
  const caption = dialog.querySelector("figcaption");
  let photos = [];
  let current = 0;

  function show(i) {
    current = (i + photos.length) % photos.length;
    img.src = photos[current].full;
    img.alt = photos[current].caption || "Project photo";
    caption.textContent = photos[current].caption;
  }

  dialog.querySelector(".lb-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  dialog.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  return (list, i) => {
    photos = list;
    show(i);
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
  const grid = section.querySelector(".gallery");
  const photoCache = new Map();

  function button(className, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.addEventListener("click", onClick);
    return b;
  }
  const mark = (container, active) =>
    container.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === active)));

  async function showProject(project, btn) {
    mark(projectsEl, btn);
    title.hidden = false;
    title.textContent = project.label;
    grid.replaceChildren();
    try {
      if (!photoCache.has(project.id)) photoCache.set(project.id, (await call(`public-gallery?project=${project.id}`)).photos);
    } catch {
      title.textContent = "Couldn't load these photos. Please try again.";
      return;
    }
    const photos = photoCache.get(project.id);
    photos.forEach((photo, i) => {
      const b = button("", () => openLightbox(photos, i));
      const img = document.createElement("img");
      img.src = photo.thumb;
      img.alt = photo.caption || project.label;
      img.loading = "lazy";
      b.append(img);
      grid.append(b);
    });
    title.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showType(category, btn) {
    mark(typesEl, btn);
    title.hidden = true;
    grid.replaceChildren();
    projectsEl.replaceChildren(
      ...category.projects.map((project) => {
        const b = button("work-project", () => showProject(project, b));
        const img = document.createElement("img");
        img.src = project.cover;
        img.alt = "";
        img.loading = "lazy";
        const label = document.createElement("span");
        label.textContent = project.label;
        b.append(img, label);
        return b;
      }),
    );
  }

  typesEl.replaceChildren(
    ...categories.map((category) => {
      const b = button("pill", () => showType(category, b));
      b.textContent = category.label;
      return b;
    }),
  );
  section.hidden = false;
  showType(categories[0], typesEl.firstElementChild);
})();

// Website inquiry form (called quote requests in the code and database): saves the inquiry +
// uploads to Supabase, which emails the office.
(function quoteForm() {
  const form = document.getElementById("quote-form");
  const status = form.querySelector(".form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const fileInput = form.querySelector('input[type="file"]');
  const fileList = form.querySelector(".attach-list");
  // Always handle submit ourselves so the browser never does a default submit (which would put
  // the visitor's details in the URL). Without Supabase settings, point people to email/phone.
  if (!formReady) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      status.textContent = `Online inquiries are almost ready. For now, please email us at ${contact.email} or call ${contact.phone}.`;
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

  function renderFiles() {
    fileList.innerHTML = "";
    files.forEach((f, i) => {
      const li = document.createElement("li");
      li.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB) `;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "remove";
      rm.addEventListener("click", () => {
        files.splice(i, 1);
        renderFiles();
      });
      li.appendChild(rm);
      fileList.appendChild(li);
    });
  }
  const addFiles = (list) => {
    files = [...files, ...list].slice(0, 10);
    renderFiles();
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get("company")) return; // honeypot
    if (!form.reportValidity()) return;
    const tooBig = files.find((f) => f.size > 50 * 1024 * 1024);
    if (tooBig) return (status.textContent = `"${tooBig.name}" is larger than 50 MB.`);
    if (spamCheckKey && !turnstileToken) return (status.textContent = "Please wait a moment for the spam check to finish, then try again.");

    submitBtn.disabled = true;
    status.textContent = "Sending…";
    try {
      const { quoteId, uploads } = await call("quote-start", {
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        address: data.get("address"),
        message: data.get("message"),
        files: files.map((f) => ({ name: f.name, size: f.size })),
        turnstileToken,
      });
      for (const [i, up] of uploads.entries()) {
        status.textContent = `Uploading ${i + 1} of ${uploads.length}…`;
        if (!(await uploadFile(up.url, files[i]))) throw new Error(`Couldn't upload ${files[i].name}`);
      }
      await call("quote-finalize", { quoteId });
      form.reset();
      files = [];
      renderFiles();
      status.textContent = "Thanks! We received your inquiry and will be in touch soon.";
    } catch (err) {
      status.textContent = `${err.message}. You can also email us at ${contact.email}.`;
    } finally {
      submitBtn.disabled = false;
      turnstileToken = "";
      if (widgetId !== null) window.turnstile.reset(widgetId);
    }
  });
})();
