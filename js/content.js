/* =====================================================================
   PAGE CONTENT (sample data)
   ---------------------------------------------------------------------
   Extra charts, tables and lists for the pages. Edit the values here.
   Pages refer to these blocks by name:
     <div data-chart="name"></div>   -> CONTENT.charts.name
     <div data-table="name"></div>   -> CONTENT.tables.name
     <div data-list="name"></div>    -> CONTENT.lists.name
   Words such as "Working", "Faulty", "High", "Warning" are coloured
   automatically (see TONE below).
   All figures are placeholders, not official data.
   ===================================================================== */

const CONTENT = {
  charts: {
    aqi7d:        { unit: "AQI", labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], values: [96, 112, 124, 118, 101, 89, 104] },
    aqiHourly:    { unit: "AQI", labels: ["6am", "9am", "12pm", "3pm", "6pm", "9pm"], values: [98, 110, 121, 116, 108, 102] },
    rainfall:     { unit: "mm",  labels: ["Jun", "Jul", "Aug", "Sep", "Oct"], values: [210, 340, 280, 120, 25] },
    lakeMonthly:  { unit: "%",   labels: ["Jun", "Jul", "Aug", "Sep", "Oct"], values: [28, 61, 84, 92, 80] },
    trafficHourly:{ unit: "%",   labels: ["7am", "10am", "1pm", "4pm", "6pm", "9pm"], values: [48, 40, 36, 52, 71, 58] },
    powerHourly:  { unit: "MW",  labels: ["12am", "4am", "8am", "12pm", "4pm", "8pm"], values: [980, 920, 1080, 1260, 1340, 1410] },
    waste7d:      { unit: "t",   labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], values: [740, 752, 768, 760, 745, 702, 690] },
    complaintsByType: { unit: "", labels: ["Water", "Roads", "Lights", "Drains", "Waste", "Other"], values: [96, 84, 61, 58, 74, 39] },
  },

  tables: {
    stations: {
      headers: ["Station", "AQI", "PM2.5", "PM10", "Status"],
      rows: [
        ["Arera Colony", 118, 62, 96, "Moderate"],
        ["MP Nagar", 131, 70, 104, "Moderate"],
        ["Habibganj", 142, 78, 115, "Unhealthy"],
        ["Kolar Road", 96, 48, 77, "Good"],
        ["Govindpura", 124, 66, 99, "Moderate"],
        ["Bairagarh", 109, 55, 88, "Moderate"],
      ],
    },

    trafficSignals: {
      headers: ["Junction", "Signal", "Avg wait", "Congestion"],
      rows: [
        ["MP Nagar Square", "Working", "75 s", "High"],
        ["Habibganj Naka", "Working", "60 s", "Medium"],
        ["Kolar Road Junction", "Partial", "90 s", "Medium"],
        ["Hamidia Road", "Working", "40 s", "Low"],
        ["Arera Colony Chowk", "Faulty", "—", "High"],
        ["Bairagarh Chowk", "Working", "55 s", "Medium"],
      ],
    },

    busRoutes: {
      headers: ["Route", "From → To", "Buses", "Status"],
      rows: [
        ["1", "Railway Station → Bairagarh", 18, "On time"],
        ["4", "Habibganj → Kolar Road", 14, "Delayed"],
        ["7", "MP Nagar → Airport", 11, "On time"],
        ["9", "Shahpura → New Market", 9, "On time"],
        ["12", "Govindpura → Bhadbhada", 8, "Cancelled"],
      ],
    },

    parking: {
      headers: ["Zone", "Capacity", "Occupied", "Status"],
      rows: [
        ["MP Nagar multi-level", 600, 540, "Busy"],
        ["New Market", 320, 320, "Full"],
        ["Boat Club Road", 180, 96, "Available"],
        ["Bhadbhada Square", 240, 150, "Available"],
      ],
    },

    waterZones: {
      headers: ["Zone", "Supply (MLD)", "Pressure", "Quality", "Status"],
      rows: [
        ["North (Shahpura)", 62, "Normal", "Good", "Supplied"],
        ["South (Kolar)", 48, "Weak", "Fair", "Partial"],
        ["Central (Hamidia)", 71, "Normal", "Good", "Supplied"],
        ["East (Govindpura)", 54, "Normal", "Good", "Supplied"],
        ["West (Bairagarh)", 39, "Weak", "Poor", "Disrupted"],
      ],
    },

    powerFeeders: {
      headers: ["Feeder", "Load (MW)", "Outages (24h)", "Status"],
      rows: [
        ["11 kV Arera", 88, 0, "Normal"],
        ["11 kV MP Nagar", 104, 1, "Overloaded"],
        ["11 kV Habibganj", 76, 0, "Normal"],
        ["11 kV Kolar", 65, 2, "Maintenance"],
      ],
    },

    wardWaste: {
      headers: ["Ward", "Collected (t)", "Segregated", "Status"],
      rows: [
        ["Ward 12 · Shahpura", 14.2, "62%", "Collected"],
        ["Ward 27 · Kolar", 11.8, "48%", "Delayed"],
        ["Ward 41 · Habibganj", 16.5, "71%", "Collected"],
        ["Ward 58 · Bairagarh", 9.4, "35%", "Missed"],
      ],
    },

    emergencyZones: {
      headers: ["Zone", "Avg response", "Units free", "Status"],
      rows: [
        ["Central", "7 min", 6, "Normal"],
        ["North", "9 min", 4, "Stretched"],
        ["South", "11 min", 2, "Critical"],
        ["East", "8 min", 5, "Normal"],
      ],
    },

    complaintsRecent: {
      headers: ["ID", "Topic", "Area", "Opened", "Status"],
      rows: [
        ["BPL-20418", "Streetlight out", "Arera Colony", "2 days ago", "In progress"],
        ["BPL-20417", "Water supply delay", "Shahpura", "3 days ago", "Open"],
        ["BPL-20412", "Pothole", "New Market", "5 days ago", "Resolved"],
        ["BPL-20409", "Drain blockage", "Kolar Road", "6 days ago", "Escalated"],
        ["BPL-20405", "Garbage not collected", "Bairagarh", "1 week ago", "Resolved"],
        ["BPL-20398", "Water leakage", "Habibganj", "1 week ago", "In progress"],
      ],
    },
  },

  lists: {
    alerts: [
      { title: "Water supply disruption in Shahpura", meta: "Expected to resume by 6 pm", tag: "Critical" },
      { title: "Heavy rain forecast for Friday", meta: "Keep drains clear and avoid low-lying roads", tag: "Warning" },
      { title: "Metro maintenance on Line 1", meta: "Sunday, 1–3 am. Replacement buses available", tag: "Info" },
    ],

    announcements: [
      { title: "Street-cleaning drive in Arera Colony", meta: "This weekend, 7–10 am", tag: "Info" },
      { title: "Citizen survey on city services", meta: "Open until 31 October", tag: "Info" },
      { title: "Lake boating schedule updated", meta: "Upper Lake, from next Monday", tag: "Info" },
    ],

    roadAlerts: [
      { title: "Waterlogging at Hamidia Road underpass", meta: "Reported 15 min ago · traffic diverted", tag: "Warning" },
      { title: "Road closed at New Market for repairs", meta: "Until 6 pm today", tag: "Critical" },
      { title: "Diversion on Kolar Road for flyover work", meta: "Expected for the next 2 weeks", tag: "Info" },
    ],
  },
};

/* Words that get a colour badge automatically */
const TONE = {
  good: ["Good", "Normal", "Working", "On time", "Supplied", "Collected", "Resolved", "Available", "Low", "Active"],
  warn: ["Moderate", "Busy", "Partial", "Delayed", "Weak", "Fair", "Stretched", "Maintenance", "Medium", "In progress", "Warning"],
  bad:  ["Unhealthy", "Faulty", "Full", "High", "Open", "Escalated", "Critical", "Disrupted", "Poor", "Overloaded", "Cancelled", "Missed"],
};

(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function tone(value) {
    const v = String(value);
    for (const key of Object.keys(TONE)) {
      if (TONE[key].includes(v)) return key;
    }
    return "";
  }

  function renderChart(el, c) {
    if (!c) return;
    const max = Math.max(...c.values) || 1;
    el.innerHTML = `<div class="chart">${c.values.map((v, i) => `
      <div class="col" title="${esc(c.labels[i])}: ${v} ${esc(c.unit)}">
        <b>${v}</b>
        <div class="col-bar"><i style="height:${Math.round((v / max) * 100)}%"></i></div>
        <span>${esc(c.labels[i])}</span>
      </div>`).join("")}</div>`;
  }

  function renderTable(el, t) {
    if (!t) return;
    const head = t.headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const body = t.rows.map((r) => `<tr>${r.map((cell) => {
      const k = tone(cell);
      return `<td>${k ? `<span class="badge ${k}">${esc(cell)}</span>` : esc(cell)}</td>`;
    }).join("")}</tr>`).join("");
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderList(el, items) {
    if (!items) return;
    el.innerHTML = items.map((it) => {
      const k = tone(it.tag);
      return `<div class="row item"><span><strong>${esc(it.title)}</strong><br><small>${esc(it.meta)}</small></span>
        <span>${k ? `<span class="badge ${k}">${esc(it.tag)}</span>` : esc(it.tag)}</span></div>`;
    }).join("");
  }

  document.querySelectorAll("[data-chart]").forEach((el) => renderChart(el, CONTENT.charts[el.dataset.chart]));
  document.querySelectorAll("[data-table]").forEach((el) => renderTable(el, CONTENT.tables[el.dataset.table]));
  document.querySelectorAll("[data-list]").forEach((el) => renderList(el, CONTENT.lists[el.dataset.list]));
})();
