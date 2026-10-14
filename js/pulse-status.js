/* =====================================================================
   CITY PULSE: status rules and mode buttons
   Plain script (no 3D), so the status still works if the 3D view fails.
   The status is derived from the dashboard's sample figures (SAMPLE_DATA)
   using the rules below. It is not a live reading.
   ===================================================================== */
(function () {
  const D = SAMPLE_DATA;

  // Browsers block ES modules (the 3D code) when a page is opened straight
  // from disk. Explain that instead of leaving the 3D area blank.
  const stageEl = document.getElementById("pulse-stage");
  if (stageEl && location.protocol === "file:") {
    stageEl.innerHTML = `<div class="pulse-fallback"><p>The 3D view does not load when the page is opened directly from a folder.
      Run <b>python3 server.py</b> in the project folder and open <b>http://localhost:8080</b>.</p></div>`;
  }

  // Each rule turns one figure into a level: 0 = stable, 1 = watch, 2 = alert
  const RULES = [
    { mode: "traffic", label: "Traffic", value: D.traffic.congestionPct,
      text: (v) => `${v}% congestion`, level: (v) => (v <= 45 ? 0 : v <= 70 ? 1 : 2) },
    { mode: "air", label: "Air quality", value: D.air.aqi,
      text: (v) => `AQI ${v}`, level: (v) => (v <= 100 ? 0 : v <= 150 ? 1 : 2) },
    { mode: "water", label: "Water supply",
      value: Math.round((D.water.supplyMLD / D.water.demandMLD) * 100),
      text: (v) => `${v}% of demand met`, level: (v) => (v >= 95 ? 0 : v >= 85 ? 1 : 2) },
    { mode: "electricity", label: "Electricity",
      value: Math.round((D.power.loadMW / D.power.capacityMW) * 100),
      text: (v) => `${v}% of grid capacity`, level: (v) => (v <= 70 ? 0 : v <= 85 ? 1 : 2) },
  ];

  const WORDS = ["Stable", "Watch", "Alert"];
  const TONES = ["good", "warn", "bad"];

  // Results, shared with the 3D view
  const modes = {};
  RULES.forEach((r) => {
    const level = r.level(r.value);
    modes[r.mode] = { label: r.label, level, text: r.text(r.value) };
  });
  const overall = Math.max(...Object.values(modes).map((m) => m.level));
  const watchCount = Object.values(modes).filter((m) => m.level > 0).length;
  window.CITY_PULSE = { modes, overall };

  const summary = overall === 0
    ? "All four systems are within their normal range."
    : `${watchCount} of 4 systems need attention. Check the highlighted areas on the model.`;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const status = document.getElementById("pulseStatus");
  if (status) {
    status.innerHTML = `
      <div class="pulse-badge ${TONES[overall]}">
        <span class="pulse-dot"></span>
        <div><small>City Pulse</small><strong>${WORDS[overall]}</strong></div>
      </div>
      <p class="pulse-summary">${esc(summary)}</p>
      <div class="pulse-rows">
        ${RULES.map((r) => {
          const m = modes[r.mode];
          return `<div class="pulse-row">
            <span>${esc(m.label)}<br><small>${esc(m.text)}</small></span>
            <span class="badge ${TONES[m.level]}">${WORDS[m.level]}</span>
          </div>`;
        }).join("")}
      </div>
      <p class="pulse-foot">Status rules use this dashboard's demo figures. They are not live readings.</p>`;
  }

  const bar = document.getElementById("pulseModes");
  if (bar) {
    bar.innerHTML = RULES.map((r, i) =>
      `<button type="button" class="pulse-mode${i === 0 ? " active" : ""}" data-mode="${r.mode}" aria-pressed="${i === 0}">${esc(r.label)}</button>`
    ).join("");

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mode]");
      if (!btn) return;
      bar.querySelectorAll("[data-mode]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      window.dispatchEvent(new CustomEvent("pulse:mode", { detail: btn.dataset.mode }));
    });
  }
})();
