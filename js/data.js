/* =====================================================================
   DATA CONFIG + SAMPLE DATA
   ---------------------------------------------------------------------
   Every widget reads from DATA. Right now DATA holds SAMPLE values so the
   layout works offline. To go live, set `live` URLs in LIVE_SOURCES below
   (see README.md). The app keeps using the sample value for any source
   that is missing or fails, so the dashboard never shows a blank card.
   ===================================================================== */

const LIVE_SOURCES = {
  // Each key is a data group. Set a URL to your API/proxy endpoint that
  // returns JSON in the SAME shape as the matching entry in SAMPLE_DATA.
  // Leave it empty ("") to keep using sample data for that group.
  // "/api/..." routes are served by server.py (run: python3 server.py).
  air:     "/api/air",      // live: Open-Meteo air quality for Bhopal
  weather: "/api/weather",  // live: Open-Meteo forecast for Bhopal
  lakes:   "",
  traffic: "",
  transit: "",
  water:   "",
  power:   "",
  waste:   "",
  emergency: "",
  complaints: "",
};

const REFRESH_SECONDS = 300; // how often live sources are polled (weather/AQI update ~hourly)

const SAMPLE_DATA = {
  city: {
    name: "Bhopal",
    state: "Madhya Pradesh",
    nickname: "City of Lakes",
  },

  air: {
    aqi: 118,
    category: "Moderate",
    pm25: 62,
    pm10: 96,
    no2: 28,
    o3: 41,
    history: [92, 105, 110, 98, 121, 118, 115, 109, 118],
  },

  weather: {
    tempC: 31,
    feelsLikeC: 35,
    humidity: 68,
    windKmh: 12,
    condition: "Partly cloudy",
    rainChance: 30,
    forecast: [
      { day: "Thu", high: 32, low: 22 },
      { day: "Fri", high: 33, low: 23 },
      { day: "Sat", high: 30, low: 21 },
      { day: "Sun", high: 29, low: 21 },
    ],
  },

  lakes: {
    upper: { levelM: 1.2, capacityPct: 78 },
    lower: { levelM: 0.9, capacityPct: 64 },
  },

  traffic: {
    congestionPct: 54,
    avgSpeedKmh: 24,
    hotspots: [
      { name: "MP Nagar Square", level: "High" },
      { name: "Habibganj Naka", level: "Medium" },
      { name: "Kolar Road Junction", level: "Medium" },
      { name: "Hamidia Road", level: "Low" },
    ],
  },

  transit: {
    busesOnRoute: 142,
    onTimePct: 81,
    metroStatus: "Operational",
    nextTrainMin: 6,
    parkingOccupancyPct: 67,
  },

  water: {
    supplyMLD: 285,
    demandMLD: 310,
    reservoirPct: 72,
    leakageAlerts: 4,
    qualityIndex: 88,
  },

  power: {
    loadMW: 1180,
    capacityMW: 1450,
    outages: 3,
    solarSharePct: 9,
  },

  waste: {
    collectedTpd: 760,
    segregatedPct: 58,
    activeVehicles: 214,
    complaintsOpen: 37,
  },

  emergency: {
    avgResponseMin: 9,
    activeIncidents: 5,
    ambulancesAvailable: 22,
    fireTendersAvailable: 11,
    policePatrols: 48,
  },

  complaints: {
    openCount: 412,
    resolvedToday: 186,
    avgResolutionHrs: 31,
    recent: [
      { id: "BPL-20418", topic: "Streetlight out", area: "Arera Colony", status: "In progress" },
      { id: "BPL-20417", topic: "Water supply delay", area: "Shahpura", status: "Open" },
      { id: "BPL-20412", topic: "Pothole", area: "New Market", status: "Resolved" },
    ],
  },
};

/* Shared helper: returns the sample value for a group. */
function getSample(group) {
  return SAMPLE_DATA[group];
}
