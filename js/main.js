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

// Quote form: submits to Formspree once a form ID is configured in index.html.
// Until then it falls back to opening the visitor's email app.
(function quoteForm() {
  const form = document.getElementById("quote-form");
  const status = form.querySelector(".form-status");
  const EMAIL = "firstchoicehomesllc@yahoo.com";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get("_gotcha")) return;

    if (form.action.includes("YOUR_FORM_ID")) {
      const body = ["name", "email", "phone", "address", "message"]
        .map((k) => `${k[0].toUpperCase() + k.slice(1)}: ${data.get(k) || ""}`)
        .join("\n");
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Free Quote Request")}&body=${encodeURIComponent(body)}`;
      return;
    }

    status.textContent = "Sending…";
    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(res.statusText);
      form.reset();
      status.textContent = "Thanks! We'll be in touch soon.";
    } catch {
      status.textContent = `Something went wrong. Please email us at ${EMAIL}.`;
    }
  });
})();
