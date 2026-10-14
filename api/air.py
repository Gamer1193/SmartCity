"""
Vercel serverless function: GET /api/air

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


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload, status = build_air(), 200
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
