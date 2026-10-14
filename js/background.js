/* =====================================================================
   3D BACKGROUND (scroll-triggered, drawn in code)
   A night-time office building beside a lake, with a grid and a
   network of sky nodes. Scrolling down strips the building: the roof
   lifts off, then the faces fade floor by floor from the top, leaving
   only the frame lines. Nothing animates on its own. The drawing only
   changes when you scroll or resize the window.
   ===================================================================== */
(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Colours (RGB triplets). Neutral silver for lines, teal for highlights.
  const TEAL = "63, 240, 208";
  const SILVER = "200, 212, 228";
  const NAVY = "8, 10, 14";

  // Scene (world units; camera sits at the origin looking along +z)
  const FLOORS = 8;
  const FLOOR_H = 0.25;
  const BW = 1.2, BD = 0.9;      // building width and depth
  const BX = -0.9, BZ = 3.6;     // building centre (x, depth)
  const GROUND = -1.2;           // lake surface height
  const COLS = 5;                // windows per floor
  const ROOF_LIFT = 1.1;         // how far the roof rises by the end of the scroll

  // Sky nodes for the "smart city" network (world coordinates)
  const NODES = [
    [-2.4, 1.2, 4.2], [-1.2, 1.7, 5.0], [0.2, 1.0, 4.4], [1.5, 1.6, 6.0],
    [2.6, 0.9, 4.8], [-0.4, 0.5, 3.4], [1.0, 0.3, 3.2],
  ];
  const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [0, 5]];

  let w = 0, h = 0, dpr = 1, f = 1, horizon = 0;
  let s = 0;                     // scroll progress 0..1
  let drawQueued = false;

  // Fixed window pattern from a seeded generator, so it never changes between draws
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lit = [];
  for (let i = 0; i < FLOORS; i++) {
    lit.push([]);
    for (let c = 0; c < COLS; c++) lit[i].push(rand() > 0.35);
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.min(w, h * 1.2) * 0.55;   // focal length in pixels
    horizon = h * 0.6;
    requestDraw();
  }

  // Perspective projection: world (x, y, z) -> screen (px, py)
  function P(x, y, z) {
    return [w / 2 + (x / z) * f, horizon - (y / z) * f];
  }

  function quad(pts, fill) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [sx, sy] = P(p[0], p[1], p[2]);
      if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function line(a, b, color, alpha, width = 1) {
    const [x1, y1] = P(a[0], a[1], a[2]);
    const [x2, y2] = P(b[0], b[1], b[2]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawBackdrop() {
    // Soft neutral glow around the horizon
    const g = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(60, 70, 80, 0.35)");
    g.addColorStop(1, "rgba(7, 9, 13, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Darker upper-left corner so text on top stays readable
    const v = ctx.createLinearGradient(0, 0, w, h);
    v.addColorStop(0, "rgba(7, 9, 13, 0.7)");
    v.addColorStop(0.5, "rgba(7, 9, 13, 0)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  function drawGround() {
    // Grid on the lake surface
    for (const z of [2.4, 2.9, 3.5, 4.2, 5.2, 6.6, 8.5]) {
      line([-6, GROUND, z], [6, GROUND, z], SILVER, 0.32);
    }
    for (let x = -6; x <= 6; x += 1.5) {
      line([x, GROUND, 2.2], [x, GROUND, 9], SILVER, 0.26);
    }
  }

  function drawNetwork() {
    const pts = NODES.map(([x, y, z]) => P(x, y, z));
    for (const [a, b] of LINKS) {
      ctx.beginPath();
      ctx.moveTo(pts[a][0], pts[a][1]);
      ctx.lineTo(pts[b][0], pts[b][1]);
      ctx.strokeStyle = `rgba(${SILVER}, 0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const [sx, sy] of pts) {
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TEAL}, 1)`;
      ctx.fill();
    }
  }

  // Draw one horizontal slab (a floor, or the roof) between heights yA and yB
  function drawSlab(yA, yB, solid, litRow) {
    const x0 = BX - BW / 2, x1 = BX + BW / 2;
    const z0 = BZ - BD / 2, z1 = BZ + BD / 2;

    if (solid > 0.01) {
      // front and right faces
      quad([[x0, yA, z0], [x1, yA, z0], [x1, yB, z0], [x0, yB, z0]], `rgba(${NAVY}, ${0.8 * solid})`);
      quad([[x1, yA, z0], [x1, yA, z1], [x1, yB, z1], [x1, yB, z0]], `rgba(${NAVY}, ${0.55 * solid})`);

      // windows on the front face
      if (litRow) {
        const vA = yA + FLOOR_H * 0.2, vB = yB - FLOOR_H * 0.2;
        for (let c = 0; c < COLS; c++) {
          const u0 = x0 + ((c + 0.2) / COLS) * BW;
          const u1 = x0 + ((c + 0.8) / COLS) * BW;
          const color = litRow[c] ? TEAL : SILVER;
          const a = (litRow[c] ? 0.95 : 0.18) * solid;
          quad([[u0, vA, z0], [u1, vA, z0], [u1, vB, z0], [u0, vB, z0]], `rgba(${color}, ${a})`);
        }
      }
    }

    // Frame lines: always drawn, so the structure remains at the end of the scroll
    const e = 0.85;
    line([x0, yA, z0], [x1, yA, z0], TEAL, e);   // front bottom
    line([x0, yB, z0], [x1, yB, z0], TEAL, e);   // front top
    line([x0, yA, z0], [x0, yB, z0], TEAL, e);   // front left
    line([x1, yA, z0], [x1, yB, z0], TEAL, e);   // front right
    line([x1, yA, z0], [x1, yA, z1], TEAL, e);   // side bottom
    line([x1, yB, z0], [x1, yB, z1], TEAL, e);   // side top
    line([x1, yA, z1], [x1, yB, z1], TEAL, e);   // back right
  }

  function drawBuilding() {
    // Floors strip from the top down: top floor fades first, ground floor last
    for (let i = 0; i < FLOORS; i++) {
      const yA = GROUND + i * FLOOR_H;
      const yB = yA + FLOOR_H;
      const start = ((FLOORS - 1 - i) / FLOORS) * 0.6;
      const solid = 1 - clamp01((s - start) / 0.4);
      drawSlab(yA, yB, solid, lit[i]);
    }

    // Roof lifts off as the page scrolls, then fades
    const top = GROUND + FLOORS * FLOOR_H;
    const roofY = top + s * ROOF_LIFT;
    drawSlab(roofY, roofY + 0.08, clamp01(1 - s * 1.4), null);

    // Antenna on the roof
    const tip = roofY + 0.08 + 0.35;
    line([BX, roofY + 0.08, BZ], [BX, tip, BZ], TEAL, 0.9);
    const [ax, ay] = P(BX, tip, BZ);
    ctx.beginPath();
    ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${TEAL}, 1)`;
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawBackdrop();
    drawGround();
    drawNetwork();
    drawBuilding();
  }

  // Draw at most once per animation frame, and only when something changed
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      draw();
    });
  }

  // Public hook used by app.js on every scroll event
  window.BG = {
    setScroll(ratio) {
      s = clamp01(ratio);
      requestDraw();
    },
  };

  window.addEventListener("resize", resize);
  resize();
})();
