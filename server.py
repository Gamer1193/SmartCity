#!/usr/bin/env python3
"""
Bhopal Smart City Dashboard server.

- Serves the dashboard files (index.html, css/, js/ ...).
- Provides live-data endpoints under /api/ that fetch real data on the server,
  so any API keys stay out of the browser.
- Uses only the Python standard library. No pip install needed.

Run:   python3 server.py          (then open http://localhost:8080)
Port:  PORT=9000 python3 server.py

Live endpoints (no API key needed, from Open-Meteo):
  /api/air      air quality (US AQI, PM2.5, PM10, NO2, O3) + last 12 hours
  /api/weather  temperature, humidity, wind, condition, 4-day forecast

Any other /api/<group> returns 404, so the dashboard keeps its sample data
for that group until you add an endpoint here.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = int(os.environ.get("PORT", "8080"))
ROOT = Path(__file__).resolve().parent
LAT, LON = 23.2599, 77.4126          # Bhopal
TZ = "Asia/Kolkata"
CACHE_SECONDS = 600                  # upstream is fetched at most every 10 minutes

_cache = {}                          # name -> (fetched_at, data)


# ---------- helpers ----------

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "bhopal-smart-city-dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


def cached(name, builder):
    """Return cached data if fresh; otherwise rebuild. If the upstream fails, serve the last good copy."""
    now = time.time()
    hit = _cache.get(name)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    try:
        data = builder()
    except Exception:
        if hit:
            return hit[1]   # stale but real data beats an empty card
        raise
    _cache[name] = (now, data)
    return data


def aqi_category(aqi):
    # US EPA AQI bands
    if aqi <= 50:  return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for sensitive"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very unhealthy"
    return "Hazardous"


WMO_CONDITIONS = [
    (0, "Clear"), (1, "Mostly clear"), (2, "Partly cloudy"), (3, "Overcast"),
    (45, "Fog"), (48, "Fog"),
    (51, "Drizzle"), (53, "Drizzle"), (55, "Drizzle"),
    (61, "Light rain"), (63, "Rain"), (65, "Heavy rain"),
    (80, "Showers"), (81, "Showers"), (82, "Heavy showers"),
    (95, "Thunderstorm"), (96, "Thunderstorm"), (99, "Thunderstorm"),
]


def condition_text(code):
    if code is None:
        return "—"
    best = "—"
    for c, text in WMO_CONDITIONS:
        if code >= c:
            best = text
    return best


# ---------- data builders (each returns the schema used in js/data.js) ----------

def build_air():
    q = urllib.parse.urlencode({
        "latitude": LAT, "longitude": LON, "timezone": TZ,
        "current": "us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
        "hourly": "us_aqi", "past_days": 1, "forecast_days": 1,
    })
    raw = fetch_json(f"https://air-quality-api.open-meteo.com/v1/air-quality?{q}")
    cur = raw["current"]
    times = raw["hourly"]["time"]
    values = raw["hourly"]["us_aqi"]

    # last 12 hourly AQI values up to the current hour, for the sparkline
    idx = max((i for i, t in enumerate(times) if t <= cur["time"]), default=len(times) - 1)
    history = [round(v) for v in values[max(0, idx - 11): idx + 1] if v is not None]

    aqi = round(cur["us_aqi"])
    return {
        "aqi": aqi,
        "category": aqi_category(aqi),
        "pm25": round(cur["pm2_5"]),
        "pm10": round(cur["pm10"]),
        "no2": round(cur["nitrogen_dioxide"]),
        "o3": round(cur["ozone"]),
        "history": history or [aqi],
    }


def build_weather():
    q = urllib.parse.urlencode({
        "latitude": LAT, "longitude": LON, "timezone": TZ, "forecast_days": 5,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    })
    raw = fetch_json(f"https://api.open-meteo.com/v1/forecast?{q}")
    cur = raw["current"]
    d = raw["daily"]

    forecast = []
    for i in range(1, 5):   # the next four days (today is shown as "now")
        day = datetime.strptime(d["time"][i], "%Y-%m-%d").strftime("%a")
        forecast.append({
            "day": day,
            "high": round(d["temperature_2m_max"][i]),
            "low": round(d["temperature_2m_min"][i]),
        })

    return {
        "tempC": round(cur["temperature_2m"]),
        "feelsLikeC": round(cur["apparent_temperature"]),
        "humidity": round(cur["relative_humidity_2m"]),
        "windKmh": round(cur["wind_speed_10m"]),
        "condition": condition_text(cur.get("weather_code")),
        "rainChance": round(d["precipitation_probability_max"][0] or 0),
        "forecast": forecast,
    }


ROUTES = {
    "/api/air": lambda: cached("air", build_air),
    "/api/weather": lambda: cached("weather", build_weather),
}


# ---------- HTTP handler ----------

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/"):
            return self.handle_api(path)
        return super().do_GET()

    def handle_api(self, path):
        builder = ROUTES.get(path)
        if builder is None:
            return self.send_json(404, {"error": "no live source for " + path})
        try:
            self.send_json(200, builder())
        except Exception as exc:
            self.send_json(502, {"error": f"upstream failed: {exc}"})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Keep the console readable: log only API calls and errors.
        # Arguments can be non-strings (for example HTTPStatus on a 404), so
        # format the message first. A crash here would drop the response.
        try:
            text = fmt % args if args else fmt
        except (TypeError, ValueError):
            text = fmt + " " + " ".join(str(a) for a in args)
        if "/api/" in text or re.search(r"(?<!\d)[45]\d\d(?!\d)", text):
            print(f"{self.address_string()} - {text}")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), partial(Handler, directory=str(ROOT)))
    print(f"Bhopal Smart City Dashboard: http://localhost:{PORT}")
    print("Live endpoints: " + ", ".join(ROUTES))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
