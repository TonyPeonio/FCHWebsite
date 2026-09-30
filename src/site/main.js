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

// Gallery lightbox
(function lightbox() {
  const dialog = document.getElementById("lightbox");
  const buttons = [...document.querySelectorAll(".gallery button")];
  const img = dialog.querySelector("img");
  const caption = dialog.querySelector("figcaption");
  let current = 0;

  function show(i) {
    current = (i + buttons.length) % buttons.length;
    const src = buttons[current].querySelector("img");
    img.src = src.src;
    img.alt = src.alt;
    caption.textContent = src.alt;
  }

  buttons.forEach((btn, i) => btn.addEventListener("click", () => { show(i); dialog.showModal(); }));
  dialog.querySelector(".lb-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  dialog.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
})();

// Quote form: saves the request + uploads to Supabase, which emails the office.
(function quoteForm() {
  const form = document.getElementById("quote-form");
  const status = form.querySelector(".form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const fileInput = form.querySelector('input[type="file"]');
  const fileList = form.querySelector(".attach-list");
  const EMAIL = "firstchoicehomesllc@yahoo.com";
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

  async function call(name, body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

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
      status.textContent = "Thanks! We received your request and will be in touch soon.";
    } catch (err) {
      status.textContent = `${err.message}. You can also email us at ${EMAIL}.`;
    } finally {
      submitBtn.disabled = false;
      turnstileToken = "";
      if (widgetId !== null) window.turnstile.reset(widgetId);
    }
  });
})();
