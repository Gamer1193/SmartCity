/* =====================================================================
   CITY PULSE: 3D map of Bhopal (Three.js, ES module)
   Built from real OpenStreetMap data in data/bhopal-osm.json:
   water bodies (Upper, Lower, Kaliasot, Turtle), roads and building
   footprints for the centre of the city. Map data © OpenStreetMap
   contributors (ODbL).

   Performance: all buildings are merged into one mesh with per-vertex
   colours, roads are one mesh, and hover/click picking marches the
   pointer ray over a spatial grid instead of testing every triangle.
   Only the hovered and selected buildings get an extra overlay mesh.

   - Hover highlights a building; click shows its demo readings
   - Mode buttons (Traffic, Air, Water, Electricity) recolour buildings
     and move the camera
   - Drag to orbit, scroll to zoom. Renders only when something changes.
   Building values are DEMO data derived from the city-level rules in
   pulse-status.js. Nothing here is a live reading.
   ===================================================================== */
const MAP_URL = "data/bhopal-osm.json";
const SC = 0.01;            // 1 scene unit = 100 m
const EXAG = 2.2;           // vertical exaggeration so buildings read clearly

const MODE_LABEL = { traffic: "Traffic", air: "Air quality", water: "Water", electricity: "Electricity" };
const MODE_KEYS = Object.keys(MODE_LABEL);
const MODE_VIEW = {
  traffic:     { theta: 0.75,  phi: 1.0,  r: 34 },
  air:         { theta: 0.75,  phi: 0.45, r: 38 },
  water:       { theta: -0.55, phi: 0.95, r: 32 },
  electricity: { theta: 2.3,   phi: 0.8,  r: 34 },
};
const STATUS_HEX = [0x5fcf9a, 0xf5b65c, 0xf07a8b];   // softer status colours
const STATUS_RGB = STATUS_HEX.map((h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]);
const WORDS = ["Stable", "Watch", "Alert"];
const TONES = ["good", "warn", "bad"];
const BASE_STRESS = [0.2, 0.5, 0.8];          // stress centre for each city-level status
const WATER_Y = 0.05, ROAD_Y = 0.1;     // lifted above the ground to avoid flicker
const MAP_GROUND = 0xf1f2ee;    // land: soft off-white
const WATER_COLOR = 0x8cc7d8;   // lakes: soft aqua
const ROAD_COLOR = 0xd0d5dc;    // roads: light grey
const TREE_COLOR = 0xa3c9a0;    // greenery: soft sage
const MAX_ZOOM_OUT = 340;       // far enough to fit the whole 20 km city in view
const PAN_LIMIT = 200;          // how far the view can be panned, scene units (20 km)
const AREA_LABEL_MAX_R = 55;    // area names show only when zoomed in closer than this
const LAKE_LABEL_MAX_R = 120;   // lake names hide when zoomed out further than this
const GRID_CELL = 0.5;          // picking grid cell, scene units (50 m)
const MARCH = 0.025;            // picking ray step, scene units (2.5 m)
const MAX_MARCH_STEPS = 6000;

const stage = document.getElementById("pulse-stage");
const modeBar = document.getElementById("pulseModes");

// Load Three.js on demand. A static import would fail silently if the CDN
// cannot be reached, leaving "Loading 3D view…" on screen forever.
let THREE = null;
try {
  THREE = await import("three");
} catch (err) {
  console.warn("[pulse] Three.js did not load:", err.message);
}

/* ---------- WebGL check ---------- */
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

function showMessage(html) {
  if (stage) stage.innerHTML = `<div class="pulse-fallback"><p>${html}</p></div>`;
}

if (!stage) {
  // Page has no City Pulse section; nothing to do.
} else if (location.protocol === "file:") {
  // Opened from disk: pulse-status.js already shows the "run python3 server.py" message.
} else if (!THREE) {
  showMessage("The 3D library (Three.js) could not be loaded. Check your internet connection, then reload the page.");
} else if (!hasWebGL()) {
  showMessage("The 3D view needs WebGL, which this browser does not support. The City Pulse status on the right still works.");
  if (modeBar) modeBar.hidden = true;
} else {
  fetch(MAP_URL, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`the map file returned HTTP ${r.status} (is data/bhopal-osm.json in the project folder?)`);
      return r.json();
    })
    .then((map) => {
      try {
        initScene(map);
      } catch (err) {
        throw new Error("the 3D scene failed to build: " + err.message);
      }
    })
    .catch((err) => {
      console.warn("[pulse] map not shown:", err);
      const reason = String(err.message || err).replace(/[<>&]/g, "");
      showMessage(`The map could not be shown. Reason: ${reason}. Run <b>python3 server.py</b> in the project folder and open <b>http://localhost:8080</b>.`);
    });
}

/* ---------- Helpers (no scene needed) ---------- */
function levelOf(s) {
  return s < 0.4 ? 0 : s < 0.7 ? 1 : 2;
}

function classOf(h) {
  return h >= 24 ? "High-rise" : h >= 10 ? "Mid-rise" : "Low-rise";
}

// Escape text before putting it into innerHTML
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// Flat ring (x, z in metres) -> shape laid on the ground
function ringShape(flat) {
  const shape = new THREE.Shape();
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i] * SC, z = flat[i + 1] * SC;
    if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
  }
  return shape;
}

// Writes one extruded footprint (walls + roof) into the shared arrays.
// poly: flat [x, z, ...] in scene units; tris: roof triangles for poly.
// Returns the next free vertex and index positions.
function writePrism(poly, top, tris, P, NM, IDX, v0, k0) {
  const n = poly.length >> 1;
  let cx = 0, cz = 0;
  for (let j = 0; j < n; j++) { cx += poly[2 * j]; cz += poly[2 * j + 1]; }
  cx /= n; cz /= n;

  let v = v0, k = k0;
  const put = (i, x, y, z, nx, ny, nz) => {
    P[3 * i] = x; P[3 * i + 1] = y; P[3 * i + 2] = z;
    NM[3 * i] = nx; NM[3 * i + 1] = ny; NM[3 * i + 2] = nz;
  };

  for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n;
    const ax = poly[2 * j], az = poly[2 * j + 1];
    const bx = poly[2 * j2], bz = poly[2 * j2 + 1];
    // Outward wall normal: perpendicular to the edge, pointing away from the centre
    let nx = bz - az, nz = ax - bx;
    const L = Math.hypot(nx, nz) || 1;
    nx /= L; nz /= L;
    const mx = (ax + bx) / 2 - cx, mz = (az + bz) / 2 - cz;
    if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }

    const base = v;
    put(v++, ax, 0, az, nx, 0, nz);
    put(v++, bx, 0, bz, nx, 0, nz);
    put(v++, bx, top, bz, nx, 0, nz);
    put(v++, ax, top, az, nx, 0, nz);
    IDX[k++] = base; IDX[k++] = base + 1; IDX[k++] = base + 2;
    IDX[k++] = base; IDX[k++] = base + 2; IDX[k++] = base + 3;
  }

  const roofBase = v;
  for (let j = 0; j < n; j++) put(v++, poly[2 * j], top, poly[2 * j + 1], 0, 1, 0);
  for (const t of tris) {
    IDX[k++] = roofBase + t[0]; IDX[k++] = roofBase + t[1]; IDX[k++] = roofBase + t[2];
  }
  return [v, k];
}

// Point-in-polygon for a flat [x, z, ...] ring (even-odd rule)
function inPoly(p, x, z) {
  let inside = false;
  for (let a = 0, b = p.length - 2; a < p.length; b = a, a += 2) {
    const xa = p[a], za = p[a + 1], xb = p[b], zb = p[b + 1];
    if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) inside = !inside;
  }
  return inside;
}

/* ---------- Scene ---------- */
function initScene(map) {
  stage.innerHTML = "";
  const city = window.CITY_PULSE || { modes: {}, overall: 0 };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  stage.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);   // near plane 0.5 keeps depth precise at distance
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe4ea, 1.3));   // daylight sky and ground bounce
  const key = new THREE.DirectionalLight(0xffffff, 1.3);           // neutral daylight
  key.position.set(10, 18, 6);
  scene.add(key);

  /* ---------- Ground ---------- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ color: MAP_GROUND, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  /* ---------- Water (lakes and ponds from the map) ---------- */
  const waterMat = new THREE.MeshStandardMaterial({ color: WATER_COLOR, roughness: 0.25, metalness: 0.05, emissive: 0x124a5a });
  for (const w of map.water) {
    if (w.pts.length < 6) continue;
    let g;
    try {
      g = new THREE.ShapeGeometry(ringShape(w.pts));
    } catch (e) {
      continue;                       // skip a malformed outline rather than fail the view
    }
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, waterMat);
    m.position.y = WATER_Y;
    scene.add(m);
  }

  /* ---------- Roads (one merged mesh) ---------- */
  const roadPos = [];
  for (const r of map.roads) {
    const half = (r.w / 2) * SC;
    const p = r.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i] * SC, z0 = p[i + 1] * SC, x1 = p[i + 2] * SC, z1 = p[i + 3] * SC;
      const dx = x1 - x0, dz = z1 - z0;
      const L = Math.hypot(dx, dz);
      if (L === 0) continue;
      const nx = (-dz / L) * half, nz = (dx / L) * half;
      const a = [x0 + nx, z0 + nz], b = [x0 - nx, z0 - nz], c = [x1 - nx, z1 - nz], d = [x1 + nx, z1 + nz];
      for (const q of [a, b, c, a, c, d]) roadPos.push(q[0], ROAD_Y, q[1]);
    }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ color: ROAD_COLOR, roughness: 0.8 })));

  /* ---------- Buildings: prepare footprints ---------- */
  const B = map.buildings.filter((b) => b.pts.length >= 6);
  const N = B.length;
  const polys = new Array(N);
  const tris = new Array(N);
  const tops = new Float32Array(N);
  const heights = new Float32Array(N);
  const bx0 = new Float32Array(N), bz0 = new Float32Array(N);
  const bx1 = new Float32Array(N), bz1 = new Float32Array(N);
  let totalV = 0, totalI = 0;
  let GX0 = Infinity, GZ0 = Infinity, GX1 = -Infinity, GZ1 = -Infinity;

  for (let i = 0; i < N; i++) {
    const src = B[i];
    const n = src.pts.length >> 1;
    const poly = new Float32Array(n * 2);
    const contour = new Array(n);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let j = 0; j < n; j++) {
      const x = src.pts[2 * j] * SC, z = src.pts[2 * j + 1] * SC;
      poly[2 * j] = x; poly[2 * j + 1] = z;
      contour[j] = new THREE.Vector2(x, z);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    polys[i] = poly;
    tris[i] = THREE.ShapeUtils.triangulateShape(contour, []);
    heights[i] = Math.max(3, src.h);
    tops[i] = heights[i] * SC * EXAG;
    bx0[i] = x0; bz0[i] = z0; bx1[i] = x1; bz1[i] = z1;
    GX0 = Math.min(GX0, x0); GZ0 = Math.min(GZ0, z0);
    GX1 = Math.max(GX1, x1); GZ1 = Math.max(GZ1, z1);
    totalV += 5 * n;                              // 4 wall verts per edge + n roof verts
    totalI += 6 * n + 3 * tris[i].length;
  }

  /* ---------- Buildings: one merged mesh ---------- */
  const P = new Float32Array(totalV * 3);
  const NM = new Float32Array(totalV * 3);
  const COL = new Float32Array(totalV * 3);
  const IDX = new Uint32Array(totalI);
  const vStart = new Uint32Array(N);
  {
    let v = 0, k = 0;
    for (let i = 0; i < N; i++) {
      vStart[i] = v;
      const r = writePrism(polys[i], tops[i], tris[i], P, NM, IDX, v, k);
      v = r[0]; k = r[1];
    }
  }
  const colorAttr = new THREE.BufferAttribute(COL, 3);
  const buildingGeo = new THREE.BufferGeometry();
  buildingGeo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  buildingGeo.setAttribute("normal", new THREE.BufferAttribute(NM, 3));
  buildingGeo.setAttribute("color", colorAttr);
  buildingGeo.setIndex(new THREE.BufferAttribute(IDX, 1));
  buildingGeo.computeBoundingSphere();
  scene.add(new THREE.Mesh(
    buildingGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide })
  ));

  /* ---------- Demo stress values (seeded, one per building per mode) ---------- */
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stress = new Float32Array(N * 4);
  const levels = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    for (let m = 0; m < MODE_KEYS.length; m++) {
      const mm = city.modes[MODE_KEYS[m]];
      const lvl = mm ? mm.level : 0;
      const s = BASE_STRESS[lvl] + (rnd() - 0.5) * 0.4;
      stress[i * 4 + m] = Math.max(0.02, Math.min(0.98, s));
    }
  }

  /* ---------- Spatial grid for picking ---------- */
  const gw = Math.ceil((GX1 - GX0) / GRID_CELL) + 1;
  const gh = Math.ceil((GZ1 - GZ0) / GRID_CELL) + 1;
  const cells = new Array(gw * gh);
  for (let i = 0; i < N; i++) {
    const cx0 = Math.floor((bx0[i] - GX0) / GRID_CELL), cx1 = Math.floor((bx1[i] - GX0) / GRID_CELL);
    const cz0 = Math.floor((bz0[i] - GZ0) / GRID_CELL), cz1 = Math.floor((bz1[i] - GZ0) / GRID_CELL);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * gw + cx;
        (cells[c] || (cells[c] = [])).push(i);
      }
    }
  }

  // Walk the pointer ray through the scene; return the first building whose
  // footprint contains the ray point below its roof, or -1.
  function pickBuilding(ray) {
    const o = ray.origin, d = ray.direction;
    for (let s = 0, t = 0; s < MAX_MARCH_STEPS; s++, t += MARCH) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < 0) return -1;
      if (y > 4 && d.y > 0) return -1;
      const cx = Math.floor((x - GX0) / GRID_CELL), cz = Math.floor((z - GZ0) / GRID_CELL);
      if (cx < 0 || cz < 0 || cx >= gw || cz >= gh) continue;
      const list = cells[cz * gw + cx];
      if (!list) continue;
      for (const i of list) {
        if (y < tops[i] && inPoly(polys[i], x, z)) return i;
      }
    }
    return -1;
  }

  /* ---------- Overlays for the hovered and selected building ---------- */
  function prismGeometry(i) {
    const poly = polys[i], n = poly.length >> 1;
    const pos = new Float32Array(5 * n * 3);
    const nor = new Float32Array(5 * n * 3);
    const idx = new Uint32Array(6 * n + 3 * tris[i].length);
    writePrism(poly, tops[i], tris[i], pos, nor, idx, 0, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }

  function makeOverlay(color, opacity) {
    const m = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      })
    );
    m.visible = false;
    m.raycast = () => {};
    scene.add(m);
    return m;
  }

  const hovOverlay = makeOverlay(0x9ff8ea, 0.45);
  const selOverlay = makeOverlay(0xffffff, 0.3);

  function showOverlay(mesh, i) {
    if (i < 0) { mesh.visible = false; return; }
    mesh.geometry.dispose();
    mesh.geometry = prismGeometry(i);
    mesh.visible = true;
    requestRender();
  }

  /* ---------- Greenery around the Upper Lake ---------- */
  const treeGeo = new THREE.ConeGeometry(0.04, 0.12, 6);
  const treeMat = new THREE.MeshStandardMaterial({ color: TREE_COLOR, roughness: 0.9 });
  const lake = map.water.find((w) => w.name === "Upper Lake") || map.water.find((w) => w.pts.length >= 6);
  if (lake) {
    const pts = lake.pts;
    for (let i = 0; i + 1 < pts.length; i += 12) {
      const x = pts[i] * SC, z = pts[i + 1] * SC;
      const len = Math.hypot(x, z) || 1;
      const k = 1 + 0.6 / len;            // a little outside the shoreline
      const t = new THREE.Mesh(treeGeo, treeMat);
      t.position.set(x * k, 0.06, z * k);
      t.scale.setScalar(0.7 + rnd() * 0.6);
      scene.add(t);
    }
  }

  /* ---------- Colour by mode ---------- */
  let mode = "traffic";

  function valueText(i, m) {
    const s = stress[i * 4 + MODE_KEYS.indexOf(m)];
    if (m === "traffic") return `${Math.round(s * 100)}% congestion`;
    if (m === "air") return `AQI ${Math.round(s * 300)}`;
    if (m === "water") return `${Math.round(s * 40)}% supply gap`;
    return `${Math.round(50 + s * 50)}% of capacity`;
  }

  function paint(m) {
    const mi = MODE_KEYS.indexOf(m);
    for (let i = 0; i < N; i++) {
      const s = stress[i * 4 + mi];
      const lvl = levelOf(s);
      levels[i] = lvl;
      const k = 0.9 + 0.1 * s;              // brighter where the stress is higher
      const rgb = STATUS_RGB[lvl];
      const a = vStart[i], b = i + 1 < N ? vStart[i + 1] : totalV;
      for (let q = a; q < b; q++) {
        COL[3 * q] = rgb[0] * k;
        COL[3 * q + 1] = rgb[1] * k;
        COL[3 * q + 2] = rgb[2] * k;
      }
    }
    colorAttr.needsUpdate = true;
  }

  /* ---------- Labels: lakes and named areas (names from the map data) ---------- */
  const labelEls = [];
  function addLabel(name, x, z, kind) {
    const el = document.createElement("span");
    el.className = kind === "area" ? "pulse-label area" : "pulse-label";
    el.dataset.kind = kind;
    el.textContent = name;
    stage.appendChild(el);
    labelEls.push({ el, v: new THREE.Vector3(x, 0.3, z), kind });
  }
  // One label per lake name, using its largest outline
  const lakeByName = new Map();
  for (const w of map.water) {
    if (!w.name || w.pts.length < 6) continue;
    const prev = lakeByName.get(w.name);
    if (!prev || w.pts.length > prev.pts.length) lakeByName.set(w.name, w);
  }
  for (const w of lakeByName.values()) {
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i + 1 < w.pts.length; i += 2) { sx += w.pts[i]; sz += w.pts[i + 1]; n++; }
    addLabel(w.name, (sx / n) * SC, (sz / n) * SC, "lake");
  }
  const areas = map.areas || [];
  for (const a of areas) addLabel(a.name, a.p[0] * SC, a.p[1] * SC, "area");

  // Nearest named area to each building, computed when needed (cached)
  const AREA_RANGE2 = 30 * 30;          // 3 km, squared, in scene units
  const areaOf = new Int16Array(N).fill(-2);   // -2 = not yet computed
  function nearestArea(i) {
    if (areaOf[i] !== -2) return areaOf[i];
    const cx = (bx0[i] + bx1[i]) / 2, cz = (bz0[i] + bz1[i]) / 2;
    let best = -1, bestD = AREA_RANGE2;
    for (let k = 0; k < areas.length; k++) {
      const dx = areas[k].p[0] * SC - cx, dz = areas[k].p[1] * SC - cz;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = k; }
    }
    areaOf[i] = best;
    return best;
  }
  function placeName(i) {
    const k = nearestArea(i);
    return k >= 0 ? `Near ${areas[k].name}` : "Central Bhopal";
  }

  const credit = document.createElement("div");
  credit.className = "pulse-credit";
  credit.textContent = "Map data © OpenStreetMap contributors";
  stage.appendChild(credit);

  /* ---------- Camera ---------- */
  const target = new THREE.Vector3(0, 0, 0);
  const sph = { ...MODE_VIEW.traffic };
  let tween = null;
  let rafId = 0;
  let width = 1, height = 1;

  function updateCamera() {
    camera.position.set(
      target.x + sph.r * Math.sin(sph.phi) * Math.sin(sph.theta),
      target.y + sph.r * Math.cos(sph.phi),
      target.z + sph.r * Math.sin(sph.phi) * Math.cos(sph.theta)
    );
    camera.lookAt(target);
  }

  function updateLabels() {
    for (const { el, v, kind } of labelEls) {
      const p = v.clone().project(camera);
      const hiddenByZoom = (kind === "area" && sph.r > AREA_LABEL_MAX_R) || (kind === "lake" && sph.r > LAKE_LABEL_MAX_R);
      const visible = p.z < 1 && p.x > -1.1 && p.x < 1.1 && !hiddenByZoom;
      el.style.display = visible ? "block" : "none";
      el.style.transform = `translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px)`;
    }
  }

  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function loop(now) {
    rafId = 0;
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease in-out
      sph.theta = tween.from.theta + (tween.to.theta - tween.from.theta) * e;
      sph.phi = tween.from.phi + (tween.to.phi - tween.from.phi) * e;
      sph.r = tween.from.r + (tween.to.r - tween.from.r) * e;
      target.lerpVectors(tween.tFrom, tween.tTo, e);
      if (k >= 1) tween = null;
      updateCamera();
      renderer.render(scene, camera);
      updateLabels();
      if (tween) requestRender();
      return;
    }
    renderer.render(scene, camera);
    updateLabels();
  }

  function moveCameraTo(view, to = new THREE.Vector3(0, 0, 0)) {
    tween = { from: { ...sph }, to: view, tFrom: target.clone(), tTo: to.clone(), t0: performance.now(), dur: 1400 };
    requestRender();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateCamera();
    requestRender();
  }
  new ResizeObserver(resize).observe(stage);

  /* ---------- Hover, click, drag, zoom ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tip = document.createElement("div");
  tip.className = "pulse-tip";
  stage.appendChild(tip);

  const info = document.createElement("aside");
  info.className = "pulse-info";
  info.setAttribute("aria-live", "polite");
  stage.appendChild(info);

  let hovered = -1;
  let selected = -1;
  let drag = null;
  const pointers = new Map();   // active touches and mouse buttons (for pinch and pan)
  let pinch = null;
  let hoverQueued = null;
  let hoverFrame = 0;

  // Pan the view across the ground. Moves the target along the screen's
  // right and forward directions, scaled to the current zoom.
  function panBy(dx, dy) {
    const k = (2 * sph.r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height;
    const rightX = Math.cos(sph.theta), rightZ = -Math.sin(sph.theta);
    const fwdX = -Math.sin(sph.theta), fwdZ = -Math.cos(sph.theta);
    target.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, target.x + (-rightX * dx + fwdX * dy) * k));
    target.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, target.z + (-rightZ * dx + fwdZ * dy) * k));
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pickAt(e) {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    return pickBuilding(raycaster.ray);
  }

  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    showOverlay(hovOverlay, i);
    canvas.style.cursor = i >= 0 ? "pointer" : "";
    if (i < 0) tip.style.display = "none";
  }

  canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      // A second finger turns the gesture into pinch-zoom and two-finger pan
      drag = null;
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    // Right button, middle button or Shift + drag pans; plain drag turns the view
    drag = { x: e.clientX, y: e.clientY, moved: 0, pan: e.button === 1 || e.button === 2 || e.shiftKey };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("auxclick", (e) => e.preventDefault());   // no middle-click scroll

  canvas.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (dist > 0 && pinch.dist > 0) sph.r = Math.max(8, Math.min(MAX_ZOOM_OUT, sph.r * pinch.dist / dist));
      panBy(mx - pinch.mx, my - pinch.my);
      pinch = { dist, mx, my };
      tween = null;
      updateCamera();
      requestRender();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 4) {
        if (drag.pan) {
          panBy(dx, dy);
        } else {
          sph.theta -= dx * 0.006;
          sph.phi = Math.max(0.25, Math.min(1.25, sph.phi - dy * 0.004));
        }
        tween = null;
        updateCamera();
        requestRender();
      }
      return;
    }
    // Throttle picking to one check per frame
    hoverQueued = { clientX: e.clientX, clientY: e.clientY };
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const ev = hoverQueued;
      const i = pickAt(ev);
      setHover(i);
      if (i >= 0) {
        tip.textContent = `${placeName(i)} · ${valueText(i, mode)}`;
        const r = stage.getBoundingClientRect();
        tip.style.left = `${ev.clientX - r.left}px`;
        tip.style.top = `${ev.clientY - r.top}px`;
        tip.style.display = "block";
      }
    });
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  }

  canvas.addEventListener("pointerup", (e) => {
    endPointer(e);
    const wasClick = drag && drag.moved <= 4 && !drag.pan;
    drag = null;
    if (!wasClick) return;
    const i = pickAt(e);
    if (i >= 0) openInfo(i); else closeInfo();
  });
  canvas.addEventListener("pointercancel", (e) => { endPointer(e); drag = null; });

  canvas.addEventListener("pointerleave", () => setHover(-1));

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const step = Math.sign(e.deltaY) * 0.08;
    sph.r = Math.max(8, Math.min(MAX_ZOOM_OUT, sph.r * (1 + step)));
    tween = null;
    updateCamera();
    requestRender();
  }, { passive: false });

  function openInfo(i) {
    selected = i;
    showOverlay(selOverlay, i);
    const floors = Math.max(1, Math.round(heights[i] / 3.2));
    info.innerHTML = `
      <div class="pi-head"><b>${esc(placeName(i))}</b><button type="button" class="pi-close" aria-label="Close">×</button></div>
      <p class="pi-zone">${classOf(heights[i])} building · about ${floors} floors</p>
      <div class="pi-rows">
        ${MODE_KEYS.map((m) => {
          const lvl = levelOf(stress[i * 4 + MODE_KEYS.indexOf(m)]);
          return `<div class="pi-row"><span>${MODE_LABEL[m]}</span>
            <span class="pi-val ${TONES[lvl]}">${valueText(i, m)}</span></div>`;
        }).join("")}
      </div>
      <p class="pi-note">Demo values for this building. Not measured.</p>`;
    info.classList.add("open");
    info.querySelector(".pi-close").addEventListener("click", closeInfo);
    requestRender();
  }

  function closeInfo() {
    selected = -1;
    showOverlay(selOverlay, -1);
    info.classList.remove("open");
    requestRender();
  }

  /* ---------- Navigation: buttons, keys, double-click ---------- */
  function zoomBy(f) {
    moveCameraTo({ theta: sph.theta, phi: sph.phi, r: Math.max(8, Math.min(MAX_ZOOM_OUT, sph.r * f)) }, target.clone());
  }
  function resetView() {
    moveCameraTo(MODE_VIEW[mode]);                    // back to the centre, on the lake
  }
  function fitCity() {
    moveCameraTo({ theta: 0.75, phi: 0.8, r: MAX_ZOOM_OUT * 0.9 });   // whole city in view
  }

  const nav = document.createElement("div");
  nav.className = "pulse-nav";
  nav.innerHTML = `
    <button type="button" data-act="in" aria-label="Zoom in">+</button>
    <button type="button" data-act="out" aria-label="Zoom out">−</button>
    <button type="button" data-act="fit">Whole city</button>
    <button type="button" data-act="reset">Reset</button>`;
  stage.appendChild(nav);
  nav.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "in") zoomBy(0.8);
    else if (act === "out") zoomBy(1.25);
    else if (act === "fit") fitCity();
    else if (act === "reset") resetView();
  });
  nav.addEventListener("dblclick", (e) => e.stopPropagation());

  // Keyboard: click the map (or Tab to it), then arrows pan, +/- zoom, R resets
  stage.tabIndex = 0;
  stage.addEventListener("keydown", (e) => {
    const step = 60;
    const pans = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (pans[e.key]) {
      e.preventDefault();
      tween = null;
      panBy(...pans[e.key]);
      updateCamera();
      requestRender();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault(); zoomBy(0.8);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault(); zoomBy(1.25);
    } else if (e.key === "r" || e.key === "R" || e.key === "0") {
      e.preventDefault(); resetView();
    }
  });

  // Double-click a spot on the ground to zoom in on it
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundHit = new THREE.Vector3();
  canvas.addEventListener("dblclick", (e) => {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, groundHit)) return;
    const to = new THREE.Vector3(
      Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, groundHit.x)), 0,
      Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, groundHit.z))
    );
    moveCameraTo({ theta: sph.theta, phi: 0.9, r: 26 }, to);
  });

  /* ---------- Mode switching ---------- */
  window.addEventListener("pulse:mode", (e) => {
    if (!MODE_VIEW[e.detail]) return;
    mode = e.detail;
    paint(mode);
    moveCameraTo(MODE_VIEW[mode]);
  });

  /* ---------- Start ---------- */
  paint(mode);
  updateCamera();
  resize();
  requestRender();
}
