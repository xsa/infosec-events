/**
 * infosec-events-map.js
 * Renders a collapsible Leaflet map of upcoming events.
 * Reads event data directly from the existing table on the page.
 * Requires locations.json to be served from the same base path.
 * No build step. Drop into static/js/ and include in layout.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Parse events from the table already on the page
  // ---------------------------------------------------------------------------

  function parseEvents() {
    const events = [];
    document.querySelectorAll("table tbody tr").forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) return;

      const nameCell = cells[0];
      const dateCell = cells[1];
      const locationCell = cells[2];

      const link = nameCell.querySelector("a");
      const name = nameCell.textContent.trim();
      const url = link ? link.href : null;
      const date = dateCell.textContent.trim();
      const locationFull = locationCell.textContent.trim();

      // Extract city: strip flag emoji and state/country abbreviation in parens
      const city = locationFull
        .replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, "")
        .replace(/\(.*?\)/g, "")
        .trim();

      if (city) events.push({ name, url, date, city, locationFull });
    });
    return events;
  }

  // ---------------------------------------------------------------------------
  // Inject styles
  // ---------------------------------------------------------------------------

  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #ef-map-details {
        border: 1px solid var(--accent, #f4bf75);
        margin-bottom: 1.5rem;
        font-family: monospace;
        font-size: 0.85rem;
      }

      #ef-map-details summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.55rem 1rem;
        cursor: pointer;
        user-select: none;
        list-style: none;
      }
      #ef-map-details summary::-webkit-details-marker { display: none; }

      #ef-map-details .ef-map-summary-left {
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }

      #ef-map-details .ef-map-title {
        color: var(--accent, #f4bf75);
        font-weight: bold;
        letter-spacing: 0.04em;
      }

      #ef-map-details .ef-map-subtitle {
        color: var(--comment, #75715e);
        font-size: 0.78rem;
      }

      #ef-map-details .ef-map-arrow {
        color: var(--comment, #75715e);
        font-size: 0.7rem;
        transition: transform 0.18s;
      }
      #ef-map-details[open] .ef-map-arrow { transform: rotate(180deg); }

      #ef-map-container {
        border-top: 1px solid var(--border, #383a3b);
        height: 420px;
        position: relative;
      }

      /* Leaflet popup styling to match terminal theme */
      .ef-popup {
        font-family: monospace;
        font-size: 0.82rem;
        line-height: 1.4;
      }
      .ef-popup strong {
        color: #232627;
      }
      .ef-popup .ef-popup-date {
        color: #555;
        font-size: 0.76rem;
      }
      .ef-popup a {
        color: #f4bf75;
        text-decoration: none;
      }
      .ef-popup a:hover {
        text-decoration: underline;
      }

      /* Override Leaflet default tile attribution to be less intrusive */
      .leaflet-control-attribution {
        font-size: 0.65rem !important;
        opacity: 0.6;
      }
    `;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Build the collapsible details element
  // ---------------------------------------------------------------------------

  function buildMapUI() {
    const details = document.createElement("details");
    details.id = "ef-map-details";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <div class="ef-map-summary-left">
        <span class="ef-map-title">[ map view ]</span>
        <span class="ef-map-subtitle">upcoming events by location</span>
      </div>
      <span class="ef-map-arrow">▼</span>
    `;
    details.appendChild(summary);

    const container = document.createElement("div");
    container.id = "ef-map-container";
    details.appendChild(container);

    return details;
  }

  // ---------------------------------------------------------------------------
  // Load Leaflet dynamically (only when map is opened)
  // ---------------------------------------------------------------------------

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(); return; }

      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // ---------------------------------------------------------------------------
  // Load locations.json
  // ---------------------------------------------------------------------------

  function loadLocations(basePath) {
    return fetch(basePath + "locations.json")
      .then(r => r.json());
  }

  // ---------------------------------------------------------------------------
  // Render map
  // ---------------------------------------------------------------------------

  function renderMap(events, locations) {
    const container = document.getElementById("ef-map-container");

    const map = L.map(container, {
      center: [30, 10],
      zoom: 2,
      minZoom: 2,
    });

    // OpenStreetMap tiles
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom amber pin marker to match terminal theme
    const pinIcon = L.divIcon({
      className: "",
      html: `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="5" fill="#f4bf75" stroke="#232627" stroke-width="1.5"/>
      </svg>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10],
    });

    // Group events by city to stack multiple events at same location
    const byCity = new Map();
    events.forEach(ev => {
      const loc = locations[ev.city];
      if (!loc) return; // unknown city — skip silently
      if (!byCity.has(ev.city)) byCity.set(ev.city, { loc, events: [] });
      byCity.get(ev.city).events.push(ev);
    });

    byCity.forEach(({ loc, events: cityEvents }, city) => {
      const popupLines = cityEvents.map(ev => {
        const nameHtml = ev.url
          ? `<a href="${ev.url}" target="_blank" rel="noopener">${ev.name}</a>`
          : `<strong>${ev.name}</strong>`;
        return `<div class="ef-popup">${nameHtml}<br><span class="ef-popup-date">${ev.date} · ${ev.locationFull}</span></div>`;
      }).join("<hr style='margin:4px 0;border-color:#ddd'>");

      L.marker([loc.lat, loc.lng], { icon: pinIcon })
        .addTo(map)
        .bindPopup(popupLines, { maxWidth: 260 });
    });

    // Fit map to markers if any exist
    const coords = Array.from(byCity.values()).map(({ loc }) => [loc.lat, loc.lng]);
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [30, 30], maxZoom: 5 });
    }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    const tables = document.querySelectorAll("table");
    if (!tables.length) return;

    injectStyles();

    const events = parseEvents();
    if (!events.length) return;

    const ui = buildMapUI();

    // Insert after the search wrapper if present, otherwise after filter box, otherwise before first table
    const searchWrapper = document.getElementById("ef-search-wrapper");
    const filterBox = document.getElementById("ef");
    if (searchWrapper) {
      searchWrapper.parentNode.insertBefore(ui, searchWrapper.nextSibling);
    } else if (filterBox) {
      filterBox.parentNode.insertBefore(ui, filterBox.nextSibling);
    } else {
      tables[0].parentNode.insertBefore(ui, tables[0]);
    }

    // Determine base path for locations.json
    const basePath = document.querySelector('meta[name="base-url"]')
      ? document.querySelector('meta[name="base-url"]').content.replace(/\/?$/, "/")
      : "/infosec-events/";

    let mapRendered = false;

    ui.addEventListener("toggle", () => {
      if (ui.open && !mapRendered) {
        mapRendered = true;
        Promise.all([loadLeaflet(), loadLocations(basePath)])
          .then(([, locations]) => renderMap(events, locations))
          .catch(err => {
            document.getElementById("ef-map-container").innerHTML =
              `<div style="padding:1rem;color:var(--comment,#75715e);font-family:monospace">failed to load map.</div>`;
            console.error("Map load error:", err);
          });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
