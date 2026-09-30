import "./styles.css";
import { createClient } from "@supabase/supabase-js";

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Bold today's row in the hours table (week starts Monday in the table)
(function highlightToday() {
  const rows = document.querySelectorAll(".hours tr");
  const idx = (new Date().getDay() + 6) % 7;
  if (rows[idx]) rows[idx].classList.add("today");
})();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Calls an edge function; GET when there's no body.
async function call(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

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
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
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
  const EMAIL = "firstchoicehomesllc@yahoo.com";
  // Always handle submit ourselves so the browser never does a default submit (which would put
  // the visitor's details in the URL). Without Supabase settings, point people to email/phone.
  if (!SUPABASE_URL || !SUPABASE_KEY || !import.meta.env.VITE_TURNSTILE_SITE_KEY) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      status.textContent = `Online inquiries are almost ready. For now, please email us at ${EMAIL} or call (360) 673-2926.`;
    });
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  let files = [];
  let turnstileToken = "";
  let widgetId = null;

  // Cloudflare Turnstile: invisible-ish spam check, loaded on demand.
  window.onTurnstileLoad = () => {
    widgetId = window.turnstile.render("#turnstile", {
      sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
      callback: (token) => (turnstileToken = token),
      "expired-callback": () => (turnstileToken = ""),
    });
  };
  const ts = document.createElement("script");
  ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
  ts.async = true;
  document.head.appendChild(ts);

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
  fileInput.addEventListener("change", () => {
    files = [...files, ...fileInput.files].slice(0, 10);
    fileInput.value = "";
    renderFiles();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get("company")) return; // honeypot
    if (!form.reportValidity()) return;
    const tooBig = files.find((f) => f.size > 50 * 1024 * 1024);
    if (tooBig) return (status.textContent = `"${tooBig.name}" is larger than 50 MB.`);
    if (!turnstileToken) return (status.textContent = "Please wait a moment for the spam check to finish, then try again.");

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
        const { error } = await supabase.storage.from("quote-uploads").uploadToSignedUrl(up.path, up.token, files[i]);
        if (error) throw new Error(`Couldn't upload ${files[i].name}`);
      }
      await call("quote-finalize", { quoteId });
      form.reset();
      files = [];
      renderFiles();
      status.textContent = "Thanks! We received your inquiry and will be in touch soon.";
    } catch (err) {
      status.textContent = `${err.message}. You can also email us at ${EMAIL}.`;
    } finally {
      submitBtn.disabled = false;
      turnstileToken = "";
      if (widgetId !== null) window.turnstile.reset(widgetId);
    }
  });
})();
