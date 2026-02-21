/**
 * infosec-events-filter.js
 * Adds continent, city, and free-only filtering to event tables.
 * Drop into static/js/ and include in your Hugo layout.
 * No dependencies. Matches hugo-theme-terminal aesthetic.
 */

(function () {
  "use strict";

  const CONTINENTS = {
    "🇺🇸": "Americas", "🇨🇦": "Americas", "🇲🇽": "Americas",
    "🇨🇷": "Americas", "🇨🇺": "Americas", "🇵🇦": "Americas",
    "🇬🇹": "Americas", "🇭🇳": "Americas", "🇳🇮": "Americas",
    "🇸🇻": "Americas", "🇧🇿": "Americas", "🇯🇲": "Americas",
    "🇭🇹": "Americas", "🇩🇴": "Americas", "🇵🇷": "Americas",
    "🇧🇷": "Americas", "🇦🇷": "Americas", "🇨🇱": "Americas",
    "🇨🇴": "Americas", "🇵🇪": "Americas", "🇻🇪": "Americas",
    "🇪🇨": "Americas", "🇧🇴": "Americas", "🇵🇾": "Americas",
    "🇺🇾": "Americas", "🇬🇾": "Americas",
    "🇬🇧": "Europe", "🇩🇪": "Europe", "🇫🇷": "Europe", "🇮🇹": "Europe",
    "🇪🇸": "Europe", "🇳🇱": "Europe", "🇧🇪": "Europe", "🇨🇭": "Europe",
    "🇦🇹": "Europe", "🇸🇪": "Europe", "🇳🇴": "Europe", "🇩🇰": "Europe",
    "🇫🇮": "Europe", "🇵🇱": "Europe", "🇨🇿": "Europe", "🇸🇰": "Europe",
    "🇭🇺": "Europe", "🇷🇴": "Europe", "🇧🇬": "Europe", "🇭🇷": "Europe",
    "🇸🇮": "Europe", "🇷🇸": "Europe", "🇲🇪": "Europe", "🇧🇦": "Europe",
    "🇦🇱": "Europe", "🇬🇷": "Europe", "🇵🇹": "Europe", "🇮🇪": "Europe",
    "🇮🇸": "Europe", "🇱🇺": "Europe", "🇲🇹": "Europe", "🇨🇾": "Europe",
    "🇱🇹": "Europe", "🇱🇻": "Europe", "🇪🇪": "Europe", "🇲🇩": "Europe",
    "🇺🇦": "Europe", "🇧🇾": "Europe", "🇷🇺": "Europe", "🇲🇰": "Europe",
    "🇽🇰": "Europe", "🇦🇩": "Europe", "🇱🇮": "Europe", "🇲🇨": "Europe",
    "🇸🇲": "Europe", "🇻🇦": "Europe",
    "🇯🇵": "Asia", "🇨🇳": "Asia", "🇰🇷": "Asia", "🇮🇳": "Asia",
    "🇸🇬": "Asia", "🇭🇰": "Asia", "🇹🇼": "Asia", "🇮🇱": "Asia",
    "🇦🇪": "Asia", "🇸🇦": "Asia", "🇶🇦": "Asia", "🇰🇼": "Asia",
    "🇧🇭": "Asia", "🇴🇲": "Asia", "🇯🇴": "Asia", "🇱🇧": "Asia",
    "🇹🇷": "Asia", "🇮🇷": "Asia", "🇮🇶": "Asia", "🇵🇰": "Asia",
    "🇧🇩": "Asia", "🇱🇰": "Asia", "🇳🇵": "Asia", "🇲🇾": "Asia",
    "🇹🇭": "Asia", "🇻🇳": "Asia", "🇵🇭": "Asia", "🇮🇩": "Asia",
    "🇰🇭": "Asia", "🇲🇲": "Asia", "🇲🇳": "Asia", "🇰🇿": "Asia",
    "🇺🇿": "Asia", "🇦🇿": "Asia", "🇬🇪": "Asia", "🇦🇲": "Asia",
    "🇦🇺": "Oceania", "🇳🇿": "Oceania", "🇵🇬": "Oceania", "🇫🇯": "Oceania",
    "🇿🇦": "Africa", "🇳🇬": "Africa", "🇰🇪": "Africa", "🇪🇬": "Africa",
    "🇬🇭": "Africa", "🇹🇳": "Africa", "🇲🇦": "Africa", "🇩🇿": "Africa",
    "🇪🇹": "Africa", "🇺🇬": "Africa", "🇷🇼": "Africa", "🇸🇳": "Africa",
    "🇿🇲": "Africa", "🇿🇼": "Africa", "🇲🇿": "Africa", "🇹🇿": "Africa",
  };

  const CONTINENT_ORDER = ["Americas", "Europe", "Asia", "Oceania", "Africa"];

  function extractFlag(text) {
    const m = text.match(/[\u{1F1E0}-\u{1F1FF}]{2}/u);
    return m ? m[0] : null;
  }

  function getContinent(flag) {
    return flag ? (CONTINENTS[flag] || "Other") : "Other";
  }

  function getLocationCell(row) {
    const cells = row.querySelectorAll("td");
    return cells[2] ? cells[2].textContent.trim() : "";
  }

  function isFreeEvent(row) {
    const cells = row.querySelectorAll("td");
    const last = cells[cells.length - 1];
    return last && last.textContent.trim() === "Y";
  }

  // Extract city name: first word(s) before any parenthetical or flag
  // e.g. "San Francisco (CA) 🇺🇸" → "San Francisco"
  // e.g. "Heidelberg 🇩🇪" → "Heidelberg"
  function extractCity(location) {
    return location
      .replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, "")  // strip flag
      .replace(/\(.*?\)/g, "")                       // strip (CA) etc
      .trim();
  }

  function makeCheckbox(group, value, label) {
    const el = document.createElement("label");
    el.className = "ef-cb";
    el.innerHTML = `<input type="checkbox" data-group="${group}" value="${CSS.escape(value)}"><span>${label}</span>`;
    // Store raw value separately since CSS.escape changes it for attribute matching
    el.querySelector("input").dataset.raw = value;
    return el;
  }

  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #ef {
        border: 1px solid var(--accent, #f4bf75);
        margin-bottom: 1.5rem;
        font-family: monospace;
        font-size: 0.85rem;
      }

      #ef summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.55rem 1rem;
        cursor: pointer;
        user-select: none;
        list-style: none;
      }
      #ef summary::-webkit-details-marker { display: none; }

      #ef .ef-summary-left {
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }

      #ef .ef-title {
        color: var(--accent, #f4bf75);
        font-weight: bold;
        letter-spacing: 0.04em;
      }

      #ef .ef-count {
        color: var(--comment, #75715e);
        font-size: 0.78rem;
      }

      #ef .ef-arrow {
        color: var(--comment, #75715e);
        font-size: 0.7rem;
        transition: transform 0.18s;
      }
      #ef[open] .ef-arrow { transform: rotate(180deg); }

      #ef .ef-body {
        border-top: 1px solid var(--border, #383a3b);
        padding: 0.85rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      #ef .ef-row {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }

      #ef .ef-label {
        color: var(--comment, #75715e);
        font-size: 0.75rem;
        letter-spacing: 0.07em;
        white-space: nowrap;
        min-width: 5rem;
        padding-top: 0.15rem;
        flex-shrink: 0;
      }

      #ef .ef-options {
        columns: 3;
        column-gap: 1.5rem;
        flex: 1;
      }

      #ef .ef-options.ef-few {
        columns: unset;
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem 0.9rem;
      }

      #ef .ef-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border, #383a3b);
      }

      #ef .ef-reset {
        background: none;
        border: 1px solid var(--comment, #75715e);
        color: var(--comment, #75715e);
        font-family: monospace;
        font-size: 0.78rem;
        padding: 0.15rem 0.6rem;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
      }
      #ef .ef-reset:hover {
        border-color: var(--accent, #f4bf75);
        color: var(--accent, #f4bf75);
      }

      #ef .ef-cb {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        cursor: pointer;
        color: var(--foreground, #fcfcfc);
        white-space: nowrap;
        transition: color 0.15s;
        break-inside: avoid;
        margin-bottom: 0.2rem;
      }
      #ef .ef-cb:hover { color: var(--accent, #f4bf75); }
      #ef .ef-cb input {
        accent-color: var(--accent, #f4bf75);
        cursor: pointer;
        flex-shrink: 0;
      }

      #ef-search-wrapper .ef-search-input {
        background: none;
        border: none;
        border-bottom: 1px solid var(--comment, #75715e);
        color: var(--foreground, #fcfcfc);
        font-family: monospace;
        font-size: 0.85rem;
        padding: 0.1rem 0.25rem;
        width: 100%;
        max-width: 24rem;
        transition: border-color 0.15s;
        outline: none;
      }
      #ef-search-wrapper .ef-search-input:focus {
        border-bottom-color: var(--accent, #f4bf75);
      }
      #ef-search-wrapper .ef-search-input::placeholder {
        color: var(--comment, #75715e);
      }

      #ef-search-wrapper {
        border: 1px solid var(--accent, #f4bf75);
        padding: 0.55rem 1rem;
        font-family: monospace;
        font-size: 0.85rem;
        margin-bottom: 1.5rem;
      }

      #ef-search-wrapper .ef-row {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      #ef-search-wrapper .ef-label {
        color: var(--comment, #75715e);
        font-family: monospace;
        font-size: 0.75rem;
        letter-spacing: 0.07em;
        white-space: nowrap;
        min-width: 5rem;
        flex-shrink: 0;
      }

      #ef-newsletter-banner {
        display: block;
        border: 1px solid var(--accent, #f4bf75);
        background: rgba(244, 191, 117, 0.07);
        padding: 0.55rem 1rem;
        font-family: monospace;
        font-size: 0.8rem;
        color: var(--accent, #f4bf75);
        text-decoration: none;
        margin-bottom: 1.5rem;
        letter-spacing: 0.03em;
        transition: background 0.15s;
      }
      #ef-newsletter-banner::before {
        content: "// ";
        opacity: 0.5;
      }
      #ef-newsletter-banner:hover {
        background: rgba(244, 191, 117, 0.14);
      }

      tr.ef-hidden { display: none; }
    `;
    document.head.appendChild(s);
  }

  function buildRow(labelText, optionsId, few) {
    const row = document.createElement("div");
    row.className = "ef-row";
    const optClass = "ef-options" + (few ? " ef-few" : "");
    row.innerHTML = `
      <div class="ef-label">${labelText}</div>
      <div class="${optClass}" id="${optionsId}"></div>
    `;
    return row;
  }

  function buildUI(continents, cities, total) {
    const details = document.createElement("details");
    details.id = "ef";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <div class="ef-summary-left">
        <span class="ef-title">[ filter events ]</span>
        <span class="ef-count" id="ef-count">${total} events</span>
      </div>
      <span class="ef-arrow">▼</span>
    `;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "ef-body";

    // Free + reset row at the top
    const footer = document.createElement("div");
    footer.className = "ef-footer";
    footer.innerHTML = `
      <div class="ef-row">
        <div class="ef-label">free only</div>
        <div class="ef-options ef-few">
          <label class="ef-cb">
            <input type="checkbox" id="ef-free"><span>yes</span>
          </label>
        </div>
      </div>
      <button class="ef-reset" id="ef-reset">reset</button>
    `;
    body.appendChild(footer);

    // Continent row — few items, use flex
    const contRow = buildRow("continent", "ef-continents", true);
    body.appendChild(contRow);

    // City row — many items, use columns
    const cityRow = buildRow("city", "ef-cities", false);
    body.appendChild(cityRow);
    details.appendChild(body);

    // Populate continents
    const contEl = details.querySelector("#ef-continents");
    CONTINENT_ORDER.filter(c => continents.has(c)).forEach(c =>
      contEl.appendChild(makeCheckbox("continent", c, c))
    );
    if (continents.has("Other")) contEl.appendChild(makeCheckbox("continent", "Other", "Other"));

    // Populate cities (sorted alphabetically, labelled "City 🇫🇷")
    const cityEl = details.querySelector("#ef-cities");
    Array.from(cities).sort((a, b) => a.city.localeCompare(b.city)).forEach(({ city, flag }) => {
      const label = flag ? `${city} ${flag}` : city;
      cityEl.appendChild(makeCheckbox("city", city, label));
    });

    return details;
  }

  function applyFilters(rows, selConts, selCities, freeOnly, searchTerm) {
    let visible = 0;
    rows.forEach(({ row, city, continent, free, name, location }) => {
      const show =
        (selConts.size === 0 || selConts.has(continent)) &&
        (selCities.size === 0 || selCities.has(city)) &&
        (!freeOnly || free) &&
        (!searchTerm || name.includes(searchTerm) || location.includes(searchTerm));
      row.classList.toggle("ef-hidden", !show);
      if (show) visible++;
    });
    return visible;
  }

  function init() {
    const tables = Array.from(document.querySelectorAll("table"));
    if (!tables.length) return;

    const allRows = [];
    const continents = new Set();
    const cityMap = new Map(); // city string → flag emoji

    tables.forEach(table => {
      table.querySelectorAll("tbody tr").forEach(row => {
        const location = getLocationCell(row);
        const flag = extractFlag(location);
        const continent = getContinent(flag);
        const city = extractCity(location);
        const name = row.querySelectorAll("td")[0] ? row.querySelectorAll("td")[0].textContent.trim().toLowerCase() : "";

        continents.add(continent);
        if (city && !cityMap.has(city)) cityMap.set(city, flag);

        allRows.push({ row, city, continent, free: isFreeEvent(row), name, location: location.toLowerCase() });
      });
    });

    injectStyles();

    const cityArr = Array.from(cityMap.entries()).map(([city, flag]) => ({ city, flag }));
    const ui = buildUI(continents, cityArr, allRows.length);

    // Insert search first, then newsletter banner, then filter: search → banner → filter → map → table
    const searchWrapper = document.createElement("div");
    searchWrapper.id = "ef-search-wrapper";
    searchWrapper.innerHTML = `
      <div class="ef-row ef-search-row">
        <div class="ef-label">search</div>
        <div class="ef-options ef-few">
          <input type="text" id="ef-search" class="ef-search-input" placeholder="event name, city...">
        </div>
      </div>
    `;

    // Newsletter banner
    const banner = document.createElement("a");
    banner.id = "ef-newsletter-banner";
    banner.href = "https://infosec-mashup.santolaria.net/?utm_source=infosec-events&utm_medium=banner";
    banner.target = "_blank";
    banner.rel = "noopener";
    banner.textContent = "📨 enjoy this? → subscribe to infosecMASHUP, a weekly cybersecurity newsletter";

    tables[0].parentNode.insertBefore(searchWrapper, tables[0]);
    tables[0].parentNode.insertBefore(banner, tables[0]);
    tables[0].parentNode.insertBefore(ui, tables[0]);

    const selConts = new Set();
    const selCities = new Set();
    let freeOnly = false;
    let searchTerm = "";

    function refresh() {
      const visible = applyFilters(allRows, selConts, selCities, freeOnly, searchTerm);
      const isFiltered = selConts.size > 0 || selCities.size > 0 || freeOnly || searchTerm;
      document.getElementById("ef-count").textContent =
        isFiltered ? `${visible} of ${allRows.length} events` : `${allRows.length} events`;
    }

    ui.querySelectorAll('input[data-group="continent"]').forEach(cb =>
      cb.addEventListener("change", () => {
        cb.checked ? selConts.add(cb.dataset.raw) : selConts.delete(cb.dataset.raw);
        refresh();
      })
    );

    ui.querySelectorAll('input[data-group="city"]').forEach(cb =>
      cb.addEventListener("change", () => {
        cb.checked ? selCities.add(cb.dataset.raw) : selCities.delete(cb.dataset.raw);
        refresh();
      })
    );

    document.getElementById("ef-search").addEventListener("input", e => {
      const val = e.target.value.trim().toLowerCase();
      searchTerm = val;
      refresh();
      // Auto-collapse filter box only when search is meaningful (3+ chars)
      if (val.length >= 3) ui.removeAttribute("open");
    });

    document.getElementById("ef-search").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        searchTerm = e.target.value.trim().toLowerCase();
        refresh();
        if (searchTerm) ui.removeAttribute("open");
      }
    });

    document.getElementById("ef-free").addEventListener("change", e => {
      freeOnly = e.target.checked;
      refresh();
    });

    document.getElementById("ef-reset").addEventListener("click", () => {
      ui.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      document.getElementById("ef-search").value = "";
      selConts.clear();
      selCities.clear();
      freeOnly = false;
      searchTerm = "";
      refresh();
    });  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
