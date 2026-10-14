# Bhopal Smart City Dashboard

A dashboard built with HTML, CSS and JavaScript, plus a small Python server for live data. It has five pages:

| Page | File | Data |
|---|---|---|
| Overview | `index.html` | Headline KPIs from all groups |
| Environment | `environment.html` | Air, weather, lakes |
| Mobility | `mobility.html` | Traffic, transit & parking |
| Utilities | `utilities.html` | Water, power, solid waste |
| Public Services | `services.html` | Emergency response, complaints |

**Navigation:** click the **MENU** button (bottom-left). A wheel opens with every page around it. Click a page to go there, click the centre hub or press Esc to close.

**Background:** a night-time building beside a lake, drawn in code (`js/background.js`). It changes only when you scroll: the roof lifts off and the floors fade from the top, leaving the frame lines. Scrolling back up restores it.

## Project layout

```
bhopal-smart-city-dashboard/
├── server.py         # serves the site + live-data endpoints (Python standard library only)
├── index.html / environment.html / mobility.html / utilities.html / services.html
├── css/style.css     # theme, wheel menu, layout, 3D styling
├── css/content.css   # charts, tables, lists, facts
├── js/data.js        # SAMPLE_DATA + LIVE_SOURCES + refresh interval
├── js/background.js  # scroll-triggered 3D canvas background
├── js/nav.js         # top bar + wheel menu (shared by every page)
├── js/app.js         # card rendering, live-data loop, scroll 3D
├── js/content.js     # charts, tables and lists for the pages (sample data)
├── js/pulse.js       # Bhopal City Pulse: 3D map of the city (Three.js)
├── js/pulse-status.js# City Pulse status rules and mode buttons
├── css/pulse.css     # City Pulse layout, info panel and labels
├── data/bhopal-osm.json # map data (water, roads, buildings) from OpenStreetMap
├── tools/osm_to_json.py # converts .osm files into data/bhopal-osm.json
└── README.md
```

## Run it with live data

Requires Python 3.8 or newer. No packages to install.

```bash
cd bhopal-smart-city-dashboard
python3 server.py
```

Open http://localhost:8080. Use `PORT=9000 python3 server.py` to change the port.

Running `server.py` is what turns on live data. Opening the HTML files directly (`file://`) still works, but every card shows **SAMPLE**, because the live endpoints aren't reachable from there.

## Live data that's already connected

| Card | Endpoint | Source | Key needed? |
|---|---|---|---|
| Air quality (AQI, PM2.5, PM10, NO₂, O₃, 12-hour trend) | `/api/air` | Open-Meteo Air Quality API | No |
| Weather (temperature, humidity, wind, condition, 4-day forecast) | `/api/weather` | Open-Meteo Forecast API | No |

Both return data for Bhopal's coordinates (23.26°N, 77.41°E) and cache results for 10 minutes. If the upstream fails, the server returns the last good copy, and if there isn't one, the card keeps its sample values.

Open-Meteo is a free service with no API key, but it does have usage limits and terms. Check them before any public deployment.

All other cards (lakes, traffic, transit, water, power, waste, emergency, complaints) still show sample data. Those numbers come from city systems, so they need agreements or feeds from the relevant departments. The section below shows how to connect them.

## Connect another data source

Each card has a `data-group` attribute, for example `<article class="card" data-group="lakes">`. Every `REFRESH_SECONDS` (default 300), the browser loads each group that has a URL in `LIVE_SOURCES`:

1. If the response is OK, the card shows that data and the badge reads **LIVE**.
2. If the URL is empty or the request fails, the card keeps its sample data and the badge reads **SAMPLE**.

### Step 1: Add a route in `server.py`

Add a builder function that returns the same shape as the matching entry in `SAMPLE_DATA` (see `js/data.js`), then register it in `ROUTES`:

```python
def build_lakes():
    raw = fetch_json("https://your-department.example/api/lake-levels?key=" + os.environ["LAKES_KEY"])
    return {
        "upper": {"levelM": raw["upper_m"], "capacityPct": raw["upper_pct"]},
        "lower": {"levelM": raw["lower_m"], "capacityPct": raw["lower_pct"]},
    }

ROUTES = {
    "/api/air": lambda: cached("air", build_air),
    "/api/weather": lambda: cached("weather", build_weather),
    "/api/lakes": lambda: cached("lakes", build_lakes),   # new
}
```

The `cached()` helper handles the 10-minute cache and stale-data fallback. API keys are read from environment variables, for example `LAKES_KEY=... python3 server.py`, so they never reach the browser.

### Step 2: Point the dashboard at it

In `js/data.js`:

```js
const LIVE_SOURCES = {
  air:     "/api/air",
  weather: "/api/weather",
  lakes:   "/api/lakes",   // new
  // leave others as "" to keep sample data
};
```

Reload the page. The card should now show **LIVE**.

### Where to get data for each group

| Group | Card(s) | Typical source |
|---|---|---|
| `lakes` | Upper & Lower Lake levels | Irrigation or water department feed, level sensors |
| `traffic` | Traffic | Traffic control room system, camera analytics, licensed traffic API |
| `transit` | Buses, metro, parking | Bus operator AVL feed, metro system API, parking sensors |
| `water` | Water supply | Utility SCADA export |
| `power` | Power grid | Discom load data |
| `waste` | Solid waste | Municipal vehicle GPS or weighbridge data |
| `emergency` | Emergency response | 112 / dispatch system |
| `complaints` | Citizen complaints | Municipal grievance portal or ticketing system |

Check the terms of use for each data source before you publish the dashboard.

### Data shape reference

Example for air quality (`/api/air`):

```json
{
  "aqi": 118,
  "category": "Unhealthy for sensitive",
  "pm25": 62,
  "pm10": 96,
  "no2": 28,
  "o3": 41,
  "history": [92, 105, 110, 98, 121, 118, 115, 109, 118]
}
```

Check `js/data.js` for the exact fields of every group.

## Editing page content

Charts, tables and lists are kept in `js/content.js`, so you can change them without touching the HTML.

- `CONTENT.charts.<name>`: bar chart with `labels`, `values` and `unit`
- `CONTENT.tables.<name>`: table with `headers` and `rows`
- `CONTENT.lists.<name>`: list of items with `title`, `meta` and `tag`

A page shows one of these with a placeholder, for example `<div data-chart="aqi7d"></div>`, `<div data-table="stations"></div>` or `<div data-list="alerts"></div>`. The name must match a key in `CONTENT`.

Cell values such as `Working`, `Faulty`, `High`, `Warning` or `Critical` get a coloured badge automatically. The word lists are in `TONE` at the bottom of the block.

Some content is written straight into the HTML, such as the helpline numbers, the AQI advice table and the water and power tips. Edit those in the page itself.

All content shipped with the project is sample data.

## Adding a page

1. Copy an existing page (for example `services.html`) to a new name. Change `<body data-page="...">`, the title and the cards.
2. Add an entry to `PAGES` in `js/nav.js`. It appears as a new spoke on the wheel:

```js
{ id: "newpage", href: "newpage.html", label: "New Page", icon: "★", desc: "Short description" },
```

3. For a new data group, add the sample shape to `SAMPLE_DATA`, a key to `LIVE_SOURCES`, a renderer to `RENDER` in `js/app.js`, and a route to `server.py`.

## Bhopal City Pulse (3D map)

The overview page has a 3D model of central Bhopal. Its water, roads and building footprints come from OpenStreetMap data in `data/bhopal-osm.json`. Hover a building to see its name and value, click it for its readings, drag to turn the view and scroll to zoom. The four mode buttons (Traffic, Air quality, Water, Electricity) recolour the buildings and move the camera.

- The map needs `python3 server.py`. It loads a JSON file and uses ES modules, which browsers block when a page is opened from disk.
- Building readings are **demo values** derived from the sample figures in `js/pulse-status.js`. They are not measurements.
- Map data © OpenStreetMap contributors (ODbL).

### Rebuilding the map from your own OSM files

Export the area from openstreetmap.org (or the OSM API) as `.osm` files, put them all in one folder, then run:

```
python3 tools/osm_to_json.py <folder_with_osm_files> data/bhopal-osm.json
```

All `.osm` files in the folder are merged, and duplicates from overlapping tiles are removed. Optional settings, set as environment variables:

- `RADIUS` (default `6000`): keep features within this many metres of the Upper Lake.
- `SIMPLIFY` (default `0.5`): footprint simplification in metres. Larger values give a smaller file.

The origin is the centre of the Upper Lake. Building heights come from the `height` tag, or from `building:levels` × 3.2 m, or default to 7 m.

## Customising

- Colours, wheel size and radius: the `:root` block at the top of `css/style.css` (`--wheel-size`, `--wheel-radius`).
- Background building and scene: the constants at the top of `js/background.js` (`FLOORS`, `BW`, `BD`, `ROOF_LIFT`, `NODES`). Colours are the `TEAL`, `BLUE` and `NAVY` values there.
- Scroll 3D intensity: the `rotateX` and `translateZ` values in `onScroll()` in `js/app.js`.
- Refresh rate in the browser: `REFRESH_SECONDS` in `js/data.js`. Cache length on the server: `CACHE_SECONDS` in `server.py`.

## Notes

- Sample numbers are placeholders, not official figures.
- Motion is turned off for users who prefer reduced motion. The background also stops moving when you don't scroll.
- On small screens, the wheel shrinks and hides the descriptions.
- `server.py` is for local use or a simple deployment. For a public site, run it behind a proper web server such as nginx or a hosting platform.
