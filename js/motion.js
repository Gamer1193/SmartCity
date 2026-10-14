/* =====================================================================
   MOTION: scroll-triggered reveals and bar growth
   Cards, headings and list items rise into view as you scroll to them.
   Chart bars grow when their card appears. Everything runs once per
   element. Respects prefers-reduced-motion.
   ===================================================================== */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Elements that rise in on scroll. KPI tiles are left out because app.js
  // rebuilds them on every refresh, which would reset their state.
  const SELECTOR = ".card, .fact, .nav-card, .section-head, .helpline, .tips li";
  const items = Array.from(document.querySelectorAll(SELECTOR));

  // Stagger siblings: each one starts slightly after the one before it
  const countByParent = new Map();
  items.forEach((el) => {
    const parent = el.parentElement;
    const i = countByParent.get(parent) || 0;
    countByParent.set(parent, i + 1);
    el.classList.add("reveal");
    el.style.setProperty("--d", Math.min(i, 6) * 80 + "ms");
  });

  // Stagger chart bars left to right
  document.querySelectorAll(".col-bar i").forEach((bar) => {
    const col = bar.closest(".col");
    const idx = Array.from(col.parentElement.children).indexOf(col);
    bar.style.setProperty("--bd", idx * 70 + "ms");
  });

  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  items.forEach((el) => io.observe(el));
})();
