/* =====================================================================
   NAVIGATION
   Injects the top bar and a wheel menu into every page.
   Click the MENU button -> the wheel opens and shows every page.
   ===================================================================== */
(function () {
  const PAGES = [
    { id: "overview",    href: "index.html",       label: "Overview",        icon: "◈",  desc: "City at a glance" },
    { id: "environment", href: "environment.html", label: "Environment",     icon: "◍",  desc: "Air, weather, lakes" },
    { id: "mobility",    href: "mobility.html",    label: "Mobility",        icon: "⇄",  desc: "Traffic & transit" },
    { id: "utilities",   href: "utilities.html",   label: "Utilities",       icon: "⚡", desc: "Water, power, waste" },
    { id: "services",    href: "services.html",    label: "Public Services", icon: "✚",  desc: "Emergency & complaints" },
  ];

  const current = document.body.dataset.page || "overview";
  const currentPage = PAGES.find(p => p.id === current) || PAGES[0];
  const n = PAGES.length;

  // Top bar
  const header = document.createElement("header");
  header.className = "topbar";
  header.innerHTML = `
    <a class="brand" href="index.html">
      <span class="brand-mark">◈</span>
      <div><strong>BHOPAL</strong> <span>Smart City</span></div>
    </a>
    <div class="clock" id="clock">--:--:--</div>`;
  document.body.prepend(header);

  // Wheel menu
  const overlay = document.createElement("div");
  overlay.className = "wheel-overlay";
  overlay.id = "wheelOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Page menu");
  overlay.innerHTML = `
    <div class="wheel-ring">
      <button class="wheel-hub" id="wheelHub" type="button" aria-label="Close menu">
        <span>You are on</span>
        <strong>${currentPage.label}</strong>
        <small>tap to close</small>
      </button>
      ${PAGES.map((p, i) => `
        <a class="wheel-item ${p.id === current ? "active" : ""}"
           href="${p.href}"
           style="--a:${(i * 360 / n - 90).toFixed(2)}deg"
           aria-label="${p.label}">
          <span class="wheel-icon">${p.icon}</span>
          <span class="wheel-label">${p.label}</span>
          <small>${p.desc}</small>
        </a>`).join("")}
    </div>`;
  document.body.appendChild(overlay);

  // Toggle button
  const toggle = document.createElement("button");
  toggle.className = "wheel-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "wheelOverlay");
  toggle.innerHTML = "<span>MENU</span>";
  document.body.appendChild(toggle);

  function setOpen(open) {
    overlay.classList.toggle("open", open);
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => setOpen(!overlay.classList.contains("open")));
  document.getElementById("wheelHub").addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
})();
