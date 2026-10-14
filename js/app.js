/* =====================================================================
   APP: rendering cards, live data loop, clock, 3D scroll effects.
   Each element with data-group="<name>" is filled automatically.
   ===================================================================== */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : n);

  let DATA = JSON.parse(JSON.stringify(SAMPLE_DATA)); // start from samples
  const usingLive = {};                               // group -> true/false

  /* ---------- Helpers ---------- */
  const row = (label, value) => `<div class="row"><span>${label}</span><span>${value}</span></div>`;
  const bar = (pct, cls = "") => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
  const levelClass = (level) => ({ High: "bad", Medium: "warn", Low: "good" }[level] || "");
  const liveTag = (group) => usingLive[group]
    ? `<span class="badge good">LIVE</span>`
    : `<span class="badge warn">SAMPLE</span>`;

  function sparkline(values) {
    if (!values || values.length < 2) return "";
    const W = 300, H = 60;
    const min = Math.min(...values), max = Math.max(...values);
    const pts = values.map((v, i) => [
      (i / (values.length - 1)) * W,
      H - ((v - min) / (max - min || 1)) * (H - 8) - 4,
    ]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return `
      <svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#38e1c4" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#38e1c4" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="area" d="${d} L${W} ${H} L0 ${H} Z"/>
        <path d="${d}"/>
      </svg>`;
  }

  /* ---------- Card renderers (one per data group) ---------- */
  const RENDER = {
    air(d) {
      return `
        <h3>Air Quality ${liveTag("air")}</h3>
        <div class="big">${d.aqi} <small>AQI · ${d.category}</small></div>
        ${sparkline(d.history)}
        ${row("PM2.5", d.pm25 + " µg/m³")}
        ${row("PM10", d.pm10 + " µg/m³")}
        ${row("NO₂", d.no2 + " µg/m³")}
        ${row("O₃", d.o3 + " µg/m³")}`;
    },
    weather(d) {
      const fc = d.forecast.map(f => row(f.day, `${f.high}° / ${f.low}°`)).join("");
      return `
        <h3>Weather ${liveTag("weather")}</h3>
        <div class="big">${d.tempC}°C <small>${d.condition}</small></div>
        <p class="note">Feels like ${d.feelsLikeC}°C</p>
        ${row("Humidity", d.humidity + "%")}
        ${row("Wind", d.windKmh + " km/h")}
        ${row("Rain chance", d.rainChance + "%")}
        <p class="note" style="margin-top:12px">4-day forecast</p>${fc}`;
    },
    lakes(d) {
      return `
        <h3>Upper & Lower Lake ${liveTag("lakes")}</h3>
        <p class="note">Upper Lake · level ${d.upper.levelM} m</p>
        ${bar(d.upper.capacityPct)}
        <p class="note" style="margin-top:14px">Lower Lake · level ${d.lower.levelM} m</p>
        ${bar(d.lower.capacityPct)}
        <p class="note" style="margin-top:14px">Capacity: Upper ${d.upper.capacityPct}% · Lower ${d.lower.capacityPct}%</p>`;
    },
    traffic(d) {
      const spots = d.hotspots.map(s =>
        `<div class="row"><span>${s.name}</span><span class="badge ${levelClass(s.level)}">${s.level}</span></div>`).join("");
      return `
        <h3>Traffic ${liveTag("traffic")}</h3>
        <div class="big">${d.congestionPct}<small>% congestion</small></div>
        ${bar(d.congestionPct, d.congestionPct > 70 ? "bad" : d.congestionPct > 45 ? "warn" : "")}
        ${row("Average speed", d.avgSpeedKmh + " km/h")}
        <p class="note" style="margin:14px 0 6px">Hotspots</p>${spots}`;
    },
    transit(d) {
      return `
        <h3>Public Transit & Parking ${liveTag("transit")}</h3>
        <div class="big">${d.busesOnRoute} <small>buses on route</small></div>
        ${row("On-time performance", d.onTimePct + "%")}
        ${row("Metro status", d.metroStatus)}
        ${row("Next metro", "in " + d.nextTrainMin + " min")}
        ${row("Parking occupancy", d.parkingOccupancyPct + "%")}
        ${bar(d.parkingOccupancyPct, d.parkingOccupancyPct > 85 ? "bad" : "")}`;
    },
    water(d) {
      const pct = Math.round((d.supplyMLD / d.demandMLD) * 100);
      return `
        <h3>Water Supply ${liveTag("water")}</h3>
        <div class="big">${d.supplyMLD} <small>MLD supplied</small></div>
        ${row("Demand", d.demandMLD + " MLD")}
        ${row("Supply vs demand", pct + "%")}
        ${bar(pct, pct < 90 ? "warn" : "")}
        ${row("Reservoir level", d.reservoirPct + "%")}
        ${row("Leakage alerts", d.leakageAlerts)}
        ${row("Quality index", d.qualityIndex + " / 100")}`;
    },
    power(d) {
      const pct = Math.round((d.loadMW / d.capacityMW) * 100);
      return `
        <h3>Power Grid ${liveTag("power")}</h3>
        <div class="big">${fmt(d.loadMW)} <small>MW load</small></div>
        ${row("Capacity", fmt(d.capacityMW) + " MW")}
        ${row("Utilisation", pct + "%")}
        ${bar(pct, pct > 85 ? "bad" : pct > 70 ? "warn" : "")}
        ${row("Active outages", d.outages)}
        ${row("Solar share", d.solarSharePct + "%")}`;
    },
    waste(d) {
      return `
        <h3>Solid Waste ${liveTag("waste")}</h3>
        <div class="big">${fmt(d.collectedTpd)} <small>tonnes/day</small></div>
        ${row("Segregated at source", d.segregatedPct + "%")}
        ${bar(d.segregatedPct)}
        ${row("Active vehicles", d.activeVehicles)}
        ${row("Open complaints", d.complaintsOpen)}`;
    },
    emergency(d) {
      return `
        <h3>Emergency Response ${liveTag("emergency")}</h3>
        <div class="big">${d.avgResponseMin} <small>min avg response</small></div>
        ${row("Active incidents", d.activeIncidents)}
        ${row("Ambulances available", d.ambulancesAvailable)}
        ${row("Fire tenders available", d.fireTendersAvailable)}
        ${row("Police patrols on duty", d.policePatrols)}`;
    },
    complaints(d) {
      const items = d.recent.map(c =>
        `<div class="row"><span>${c.id} · ${c.topic}<br><small>${c.area}</small></span>
         <span class="badge ${c.status === "Resolved" ? "good" : c.status === "Open" ? "bad" : "warn"}">${c.status}</span></div>`).join("");
      return `
        <h3>Citizen Complaints ${liveTag("complaints")}</h3>
        <div class="big">${fmt(d.openCount)} <small>open</small></div>
        ${row("Resolved today", d.resolvedToday)}
        ${row("Avg resolution time", d.avgResolutionHrs + " hrs")}
        <p class="note" style="margin:14px 0 6px">Recent</p>${items}`;
    },
  };

  /* ---------- Rendering ---------- */
  function renderCards() {
    document.querySelectorAll("[data-group]").forEach(el => {
      const group = el.dataset.group;
      if (RENDER[group]) el.innerHTML = RENDER[group](DATA[group]);
    });
  }

  function renderHero() {
    const hero = document.getElementById("heroKpis");
    if (!hero) return;
    const k = [
      { label: "AQI", value: DATA.air.aqi, unit: DATA.air.category },
      { label: "Temperature", value: DATA.weather.tempC, unit: "°C" },
      { label: "Traffic congestion", value: DATA.traffic.congestionPct, unit: "%" },
      { label: "Water supply", value: DATA.water.supplyMLD, unit: "MLD" },
      { label: "Power load", value: fmt(DATA.power.loadMW), unit: "MW" },
      { label: "Open complaints", value: fmt(DATA.complaints.openCount), unit: "" },
    ];
    hero.innerHTML = k.map(i =>
      `<div class="kpi"><div class="label">${i.label}</div>
       <div class="value">${i.value}<span class="unit">${i.unit}</span></div></div>`).join("");
  }

  function renderAll() {
    renderCards();
    renderHero();
  }

  /* ---------- Live data loop ---------- */
  async function refreshLive() {
    let anyLive = false;
    await Promise.all(Object.entries(LIVE_SOURCES).map(async ([group, url]) => {
      if (!url) { usingLive[group] = false; return; }
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        DATA[group] = await res.json();
        usingLive[group] = true;
        anyLive = true;
      } catch (err) {
        console.warn("[live] " + group + " failed, keeping sample data:", err.message);
        DATA[group] = getSample(group);
        usingLive[group] = false;
      }
    }));
    renderAll();
    const last = document.getElementById("lastUpdated");
    if (last) last.textContent = new Date().toLocaleTimeString();
    const status = document.getElementById("liveStatus");
    if (status) status.textContent = anyLive ? "Live data" : "Sample data";
    const dot = document.querySelector(".dot");
    if (dot) dot.classList.toggle("live", anyLive);
  }

  /* ---------- Clock ---------- */
  function tickClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata", hour12: false,
    }) + " IST";
  }

  /* ---------- Scroll 3D + card tilt ---------- */
  function onScroll() {
    const sections = document.querySelectorAll(".section");
    sections.forEach(sec => {
      const r = sec.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      sec.style.transform = `rotateX(${(0.5 - p) * 10}deg) translateZ(${-(1 - p) * 50}px)`;
      sec.style.opacity = "1";   // keep text fully readable; only the 3D tilt moves
    });
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (window.BG) window.BG.setScroll(max > 0 ? window.scrollY / max : 0);
  }

  function enableCardTilt() {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest && e.target.closest(".card");
      document.querySelectorAll(".card").forEach(c => { if (c !== card) c.style.transform = ""; });
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
  }

  /* ---------- Boot ---------- */
  renderAll();
  tickClock();
  setInterval(tickClock, 1000);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
  enableCardTilt();
  refreshLive();
  setInterval(refreshLive, REFRESH_SECONDS * 1000);
})();
