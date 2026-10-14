"""
Vercel serverless function: GET /api/weather

Same data as the local server.py route, so the dashboard works on Vercel
without running server.py. Uses only the Python standard library.
Results are cached at Vercel's edge for 10 minutes (see Cache-Control).
"""
import json
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler

LAT, LON = 23.2599, 77.4126          # Bhopal
TZ = "Asia/Kolkata"

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "bhopal-smart-city-dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))

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


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload, status = build_weather(), 200
        except Exception as exc:
            payload, status = {"error": f"upstream failed: {exc}"}, 502
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if status == 200:
            self.send_header("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600")
        else:
            self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
