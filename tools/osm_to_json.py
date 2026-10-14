"""
Convert OpenStreetMap XML extracts (.osm files) into the compact JSON used by
the City Pulse 3D model (data/bhopal-osm.json).

Usage:
    python3 tools/osm_to_json.py <folder_with_osm_files> <out.json>

Environment variables (optional):
    RADIUS    keep features within this many metres of the origin (default 20000)
    SIMPLIFY  footprint simplification tolerance in metres (default 2.5)
    MIN_AREA  drop buildings whose footprint is smaller than this, in m2 (default 40)

All *.osm files in the folder are merged. Tiles overlap, so nodes and ways
are de-duplicated by OSM id before anything is written.
Map data © OpenStreetMap contributors, ODbL.
"""
import sys, os, math, json
import xml.etree.ElementTree as ET

SRC, OUT = sys.argv[1], sys.argv[2]
RADIUS_M = float(os.environ.get("RADIUS", "20000"))
SIMPLIFY_M = float(os.environ.get("SIMPLIFY", "2.5"))
MIN_AREA = float(os.environ.get("MIN_AREA", "40"))

nodes = {}          # id -> (lat, lon)
ways = {}           # id -> (tags, [node ids])
place_nodes = {}    # id -> (name, place type) for named neighbourhoods, suburbs, ...
PLACE_TYPES = {"neighbourhood", "suburb", "quarter", "locality", "village", "hamlet"}
water_rels = []     # (name, [outer way ids]) for natural=water multipolygons

for f in sorted(os.listdir(SRC)):
    if not f.endswith(".osm"):
        continue
    for _, el in ET.iterparse(os.path.join(SRC, f), events=("end",)):
        if el.tag == "node":
            nodes[el.get("id")] = (float(el.get("lat")), float(el.get("lon")))
            ntags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if ntags.get("place") in PLACE_TYPES and ntags.get("name"):
                place_nodes[el.get("id")] = (ntags["name"].strip(), ntags["place"])
        elif el.tag == "way":
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            refs = [n.get("ref") for n in el.findall("nd")]
            ways[el.get("id")] = (tags, refs)
        elif el.tag == "relation":
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if tags.get("natural") == "water" and tags.get("type") == "multipolygon":
                outers = [m.get("ref") for m in el.findall("member")
                          if m.get("type") == "way" and m.get("role") == "outer"]
                if outers:
                    water_rels.append((tags.get("name", ""), outers))
        # Free memory for top-level elements only. Clearing children here
        # would wipe the attributes that their parent still needs to read.
        if el.tag in ("node", "way", "relation"):
            el.clear()

# Origin: centre of the Upper Lake (falls back to the first water relation)
upper = next((r for r in water_rels if r[0] == "Upper Lake"), water_rels[0] if water_rels else None)
if upper is None:
    sys.exit("No water multipolygon relation found; cannot choose an origin.")
origin_pts = [nodes[r] for r in ways[upper[1][0]][1] if r in nodes]
LAT0 = sum(p[0] for p in origin_pts) / len(origin_pts)
LON0 = sum(p[1] for p in origin_pts) / len(origin_pts)
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574

def xz(lat, lon):
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)

def inside_radius(x, z):
    return math.hypot(x, z) < RADIUS_M

def rdp(pts, eps):
    """Ramer-Douglas-Peucker line simplification (keeps the end points)."""
    if len(pts) < 3:
        return pts
    x0, y0 = pts[0]; x1, y1 = pts[-1]
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    best, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = math.hypot(x - x0, y - y0) if length == 0 else abs(dy * x - dx * y + x1 * y0 - y1 * x0) / length
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)

def ring_area(pts):
    """Absolute area of a polygon in m2 (shoelace formula)."""
    n = len(pts)
    return abs(sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1]
                   for i in range(n))) / 2

def flat(pts):
    # Whole metres are plenty at city scale and keep the file small
    return [round(v) for p in pts for v in p]

def way_xz(wid):
    return [xz(*nodes[r]) for r in ways[wid][1] if r in nodes]

water, roads, buildings, areas = [], [], [], []
used_water = set()

# 1. Water from multipolygon relations (Upper Lake, Lower Lake, ...)
for name, outers in water_rels:
    for wid in outers:
        if wid not in ways or wid in used_water:
            continue
        used_water.add(wid)
        pts = way_xz(wid)
        if len(pts) >= 3 and any(inside_radius(*p) for p in pts):
            water.append({"name": name, "pts": flat(rdp(pts, SIMPLIFY_M))})

# 2. Water ways (ponds, small lakes) that are not part of a relation
for wid, (tags, refs) in ways.items():
    if tags.get("natural") == "water" and wid not in used_water:
        pts = way_xz(wid)
        if len(pts) >= 3 and any(inside_radius(*p) for p in pts):
            water.append({"name": tags.get("name", ""), "pts": flat(rdp(pts, SIMPLIFY_M))})

ROAD_W = {"motorway": 16, "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 8,
          "residential": 5, "unclassified": 5, "living_street": 4}
for wid, (tags, refs) in ways.items():
    hw = tags.get("highway")
    if hw in ROAD_W:
        pts = way_xz(wid)
        if len(pts) >= 2 and any(inside_radius(*p) for p in pts):
            roads.append({"w": ROAD_W[hw], "pts": flat(pts)})

def height_of(tags):
    try:
        return float(tags.get("height", "").replace("m", "").strip())
    except ValueError:
        pass
    try:
        return float(tags.get("building:levels", "")) * 3.2
    except ValueError:
        return 7.0

# 3. Buildings: footprints simplified, heights from tags (default 7 m)
for wid, (tags, refs) in ways.items():
    if "building" not in tags:
        continue
    pts = way_xz(wid)
    if len(pts) < 4:
        continue
    if pts[0] == pts[-1]:
        pts = pts[:-1]                      # drop the closing point
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    if not inside_radius(cx, cz):
        continue
    if MIN_AREA and ring_area(pts) < MIN_AREA:
        continue
    ring = rdp(pts + [pts[0]], SIMPLIFY_M)[:-1]   # simplify as a closed ring
    if len(ring) < 3:
        continue
    buildings.append({"h": round(min(height_of(tags), 120), 1), "pts": flat(ring)})

# Named places (areas) inside the radius, one label per name
seen_names = set()
for nid, (name, ptype) in place_nodes.items():
    if nid not in nodes or name in seen_names:
        continue
    x, z = xz(*nodes[nid])
    if inside_radius(x, z):
        seen_names.add(name)
        areas.append({"name": name, "type": ptype, "p": [round(x, 1), round(z, 1)]})

data = {
    "source": "OpenStreetMap contributors (ODbL). Extract of Bhopal tiles provided by user.",
    "origin": {"lat": round(LAT0, 6), "lon": round(LON0, 6)},
    "radius_m": RADIUS_M,
    "water": water, "roads": roads, "buildings": buildings, "areas": areas,
}
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(data, fh, separators=(",", ":"))

print("origin", round(LAT0, 6), round(LON0, 6))
print("water bodies", len(water), "named", sorted({w["name"] for w in water if w["name"]}))
print("roads", len(roads), "buildings", len(buildings), "areas", len(areas))
print("size KB", os.path.getsize(OUT) // 1024)
