/**
 * infosec-events-filter.js
 * Adds continent, free-only, and date filtering to event tables.
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

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const MONTH_RE = new RegExp("\\b(" + MONTHS.join("|") + ")\\b", "i");

  // ---------------------------------------------------------------------------
  // Date parsing
  // Handles: "Apr 2, 2025"  "Apr 2-5, 2025"  "Feb 26 - Mar 1, 2025"
  // Returns a Date set to the 1st of the start month+year, or null.
  // ---------------------------------------------------------------------------
  function parseStartDate(dateText) {
    if (!dateText) return null;
    // Extract first month name
    const mMatch = dateText.match(MONTH_RE);
    if (!mMatch) return null;
    const monthIdx = MONTHS.findIndex(mo => mo.toLowerCase() === mMatch[1].toLowerCase());
    // Extract first 4-digit year found
    const yMatch = dateText.match(/\b(20\d{2})\b/);
    if (!yMatch) return null;
    const year = parseInt(yMatch[1], 10);
    return new Date(year, monthIdx, 1);
  }

  // ---------------------------------------------------------------------------
  // Date range helpers for shortcuts and month buttons
  // Returns {from: Date, to: Date} representing the filter window.
  // ---------------------------------------------------------------------------
  function rangeFromNow(months) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(now.getFullYear(), now.getMonth() + months, 1);
    return { from, to };
  }

  function rangeForHalf(half) {
    const year = new Date().getFullYear();
    return half === 1
      ? { from: new Date(year, 0, 1), to: new Date(year, 6, 1) }
      : { from: new Date(year, 6, 1), to: new Date(year, 12, 1) };
  }

  function rangeForMonths(monthIndices) {
    // For manual month toggles: match any of the selected months in ANY year
    // but only the current or next year to avoid runaway matches.
    return { monthSet: new Set(monthIndices) };
  }

  // ---------------------------------------------------------------------------
  // Existing helpers (unchanged)
  // ---------------------------------------------------------------------------
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

  function getDateCell(row) {
    const cells = row.querySelectorAll("td");
    return cells[1] ? cells[1].textContent.trim() : "";
  }

  function isFreeEvent(row) {
    const cells = row.querySelectorAll("td");
    const last = cells[cells.length - 1];
    return last && last.textContent.trim() === "Y";
  }


  function makeCheckbox(group, value, label) {
    const el = document.createElement("label");
    el.className = "ef-cb";
    el.innerHTML = `<input type="checkbox" data-group="${group}" value="${CSS.escape(value)}"><span>${label}</span>`;
    el.querySelector("input").dataset.raw = value;
    return el;
  }

  // City filter removed — city search covered by the free-text search field.

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
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
      #ef .ef-border-bottom {
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border, #383a3b);
      }
      #ef .ef-reset-row {
        padding-top: 0.5rem;
        border-top: 1px solid var(--border, #383a3b);
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

      /* ── Month toggles ── */
      #ef .ef-months {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.4rem;
        flex: 1;
      }
      #ef .ef-month-btn {
        background: none;
        border: 1px solid var(--comment, #75715e);
        color: var(--comment, #75715e);
        font-family: monospace;
        font-size: 0.78rem;
        padding: 0.1rem 0.45rem;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
        letter-spacing: 0.03em;
      }
      #ef .ef-month-btn:hover,
      #ef .ef-month-btn.active {
        border-color: var(--accent, #f4bf75);
        color: var(--accent, #f4bf75);
        background: rgba(244, 191, 117, 0.12);
      }
      #ef .ef-month-btn.ef-month-past {
        opacity: 0.35;
      }

      /* ── Quick shortcuts ── */
      #ef .ef-shortcuts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.5rem;
        flex: 1;
      }
      #ef .ef-shortcut-btn {
        background: none;
        border: 1px solid var(--comment, #75715e);
        color: var(--comment, #75715e);
        font-family: monospace;
        font-size: 0.78rem;
        padding: 0.1rem 0.55rem;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
        white-space: nowrap;
      }
      #ef .ef-shortcut-btn:hover,
      #ef .ef-shortcut-btn.active {
        border-color: var(--accent, #f4bf75);
        color: var(--accent, #f4bf75);
        background: rgba(244, 191, 117, 0.12);
      }

      /* ── Search wrapper ── */
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
      #ef-search-wrapper .ef-search-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        max-width: 24rem;
        width: 100%;
      }
      #ef-search-wrapper .ef-search-wrap .ef-search-input {
        max-width: unset;
        flex: 1;
      }
      #ef-search-wrapper .ef-search-clear {
        background: none;
        border: none;
        color: var(--comment, #75715e);
        font-family: monospace;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 0 0.15rem;
        line-height: 1;
        transition: color 0.15s;
        flex-shrink: 0;
      }
      #ef-search-wrapper .ef-search-clear:hover {
        color: var(--accent, #f4bf75);
      }

      /* ── Newsletter banner ── */
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
      #ef-newsletter-banner::before { content: "// "; opacity: 0.5; }
      #ef-newsletter-banner:hover { background: rgba(244, 191, 117, 0.14); }

      tr.ef-hidden { display: none; }
    `;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // UI builder
  // ---------------------------------------------------------------------------
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

  function buildUI(continents, total) {
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

    // Free only
    const freeRow = document.createElement("div");
    freeRow.className = "ef-row ef-border-bottom";
    freeRow.innerHTML = `
      <div class="ef-label">free only</div>
      <div class="ef-options ef-few">
        <label class="ef-cb">
          <input type="checkbox" id="ef-free"><span>yes</span>
        </label>
      </div>
    `;
    body.appendChild(freeRow);

    // Quick shortcuts
    const shortcutRow = document.createElement("div");
    shortcutRow.className = "ef-row";
    shortcutRow.innerHTML = `
      <div class="ef-label">quick</div>
      <div class="ef-shortcuts" id="ef-shortcuts">
        <button class="ef-shortcut-btn" data-shortcut="this-month">this month</button>
        <button class="ef-shortcut-btn" data-shortcut="next-3">next 3 months</button>
        <button class="ef-shortcut-btn" data-shortcut="next-6">next 6 months</button>
        <button class="ef-shortcut-btn" data-shortcut="h1">H1</button>
        <button class="ef-shortcut-btn" data-shortcut="h2">H2</button>
      </div>
    `;
    body.appendChild(shortcutRow);

    // Month toggles — dim past months
    const currentMonthIdx = new Date().getMonth();
    const monthRow = document.createElement("div");
    monthRow.className = "ef-row";
    const monthsDiv = document.createElement("div");
    monthsDiv.className = "ef-months";
    monthsDiv.id = "ef-months";
    MONTHS.forEach((mo, i) => {
      const btn = document.createElement("button");
      btn.className = "ef-month-btn" + (i < currentMonthIdx ? " ef-month-past" : "");
      btn.dataset.month = i;
      btn.textContent = mo;
      monthsDiv.appendChild(btn);
    });
    const moLabel = document.createElement("div");
    moLabel.className = "ef-label";
    moLabel.textContent = "month";
    monthRow.appendChild(moLabel);
    monthRow.appendChild(monthsDiv);
    body.appendChild(monthRow);

    // Continent
    body.appendChild(buildRow("continent", "ef-continents", true));

    // Reset button — sits below continent, left-aligned
    const resetRow = document.createElement("div");
    resetRow.className = "ef-row ef-reset-row";
    resetRow.innerHTML = `
      <div class="ef-label"></div>
      <div class="ef-options ef-few">
        <button class="ef-reset" id="ef-reset">reset filters</button>
      </div>
    `;
    body.appendChild(resetRow);

    details.appendChild(body);

    // Populate continents
    const contEl = details.querySelector("#ef-continents");
    CONTINENT_ORDER.filter(c => continents.has(c)).forEach(c =>
      contEl.appendChild(makeCheckbox("continent", c, c))
    );
    if (continents.has("Other")) contEl.appendChild(makeCheckbox("continent", "Other", "Other"));

    return details;
  }

  // ---------------------------------------------------------------------------
  // Filter logic
  // dateFilter is null (no filter), or {from, to} for shortcuts,
  // or {monthSet} for manual month toggles (year-aware: current year only).
  // ---------------------------------------------------------------------------
  function matchesDateFilter(startDate, dateFilter) {
    if (!dateFilter) return true;
    if (!startDate) return false;
    if (dateFilter.from !== undefined) {
      // Range filter: from <= startDate < to
      return startDate >= dateFilter.from && startDate < dateFilter.to;
    }
    if (dateFilter.monthSet) {
      // Month toggle: match month index AND only current/next year
      const now = new Date();
      const currentYear = now.getFullYear();
      const eventYear = startDate.getFullYear();
      return dateFilter.monthSet.has(startDate.getMonth()) &&
             (eventYear === currentYear || eventYear === currentYear + 1);
    }
    return true;
  }

  function applyFilters(rows, selConts, freeOnly, searchTerm, dateFilter) {
    let visible = 0;
    rows.forEach(({ row, continent, free, name, location, startDate }) => {
      const show =
        (selConts.size === 0 || selConts.has(continent)) &&
        (!freeOnly || free) &&
        (!searchTerm || name.includes(searchTerm) || location.includes(searchTerm)) &&
        matchesDateFilter(startDate, dateFilter);
      row.classList.toggle("ef-hidden", !show);
      if (show) visible++;
    });
    return visible;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    const tables = Array.from(document.querySelectorAll("table"));
    if (!tables.length) return;

    const allRows = [];
    const continents = new Set();

    tables.forEach(table => {
      table.querySelectorAll("tbody tr").forEach(row => {
        const location = getLocationCell(row);
        const dateText = getDateCell(row);
        const flag = extractFlag(location);
        const continent = getContinent(flag);
        const name = row.querySelectorAll("td")[0]
          ? row.querySelectorAll("td")[0].textContent.trim().toLowerCase()
          : "";
        const startDate = parseStartDate(dateText);

        continents.add(continent);

        allRows.push({ row, continent, free: isFreeEvent(row), name, location: location.toLowerCase(), startDate });
      });
    });

    injectStyles();

    const ui = buildUI(continents, allRows.length);

    // Search box
    const searchWrapper = document.createElement("div");
    searchWrapper.id = "ef-search-wrapper";
    searchWrapper.innerHTML = `
      <div class="ef-row ef-search-row">
        <div class="ef-label">search</div>
        <div class="ef-options ef-few">
          <div class="ef-search-wrap">
            <input type="text" id="ef-search" class="ef-search-input" placeholder="event name, city...">
            <button type="button" id="ef-search-clear" class="ef-search-clear" aria-label="Clear search" style="display:none">✕</button>
          </div>
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

    // Insert order: search → banner → filter → (map) → table
    tables[0].parentNode.insertBefore(searchWrapper, tables[0]);
    tables[0].parentNode.insertBefore(banner, tables[0]);
    tables[0].parentNode.insertBefore(ui, tables[0]);

    // State
    const selConts   = new Set();
    const selMonths  = new Set(); // tracks which month buttons are active (UI only)
    let dateFilter   = null;      // the actual date filter passed to applyFilters
    let freeOnly     = false;
    let searchTerm   = "";
    let activeShortcut = null;

    function refresh() {
      const visible = applyFilters(allRows, selConts, freeOnly, searchTerm, dateFilter);
      const isFiltered = selConts.size || freeOnly || searchTerm || dateFilter;
      document.getElementById("ef-count").textContent =
        isFiltered ? `${visible} of ${allRows.length} events` : `${allRows.length} events`;
    }

    function syncMonthButtons() {
      ui.querySelectorAll(".ef-month-btn").forEach(btn =>
        btn.classList.toggle("active", selMonths.has(Number(btn.dataset.month)))
      );
    }

    function clearMonths() {
      selMonths.clear();
      dateFilter = null;
      syncMonthButtons();
    }

    function applyShortcut(key) {
      clearMonths();
      switch (key) {
        case "this-month":
          dateFilter = rangeFromNow(1);
          selMonths.add(new Date().getMonth());
          break;
        case "next-3":
          dateFilter = rangeFromNow(3);
          [0,1,2].forEach(i => selMonths.add((new Date().getMonth() + i) % 12));
          break;
        case "next-6":
          dateFilter = rangeFromNow(6);
          [0,1,2,3,4,5].forEach(i => selMonths.add((new Date().getMonth() + i) % 12));
          break;
        case "h1":
          dateFilter = rangeForHalf(1);
          [0,1,2,3,4,5].forEach(m => selMonths.add(m));
          break;
        case "h2":
          dateFilter = rangeForHalf(2);
          [6,7,8,9,10,11].forEach(m => selMonths.add(m));
          break;
      }
      syncMonthButtons();
    }

    // Shortcut buttons — toggle off if clicked again
    ui.querySelectorAll(".ef-shortcut-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.shortcut;
        if (activeShortcut === key) {
          activeShortcut = null;
          btn.classList.remove("active");
          clearMonths();
        } else {
          activeShortcut = key;
          ui.querySelectorAll(".ef-shortcut-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          applyShortcut(key);
        }
        refresh();
      });
    });

    // Month buttons — manual toggle clears any active shortcut
    ui.querySelectorAll(".ef-month-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeShortcut = null;
        ui.querySelectorAll(".ef-shortcut-btn").forEach(b => b.classList.remove("active"));
        const m = Number(btn.dataset.month);
        selMonths.has(m) ? selMonths.delete(m) : selMonths.add(m);
        // Build dateFilter from current selMonths as a monthSet (year-aware)
        dateFilter = selMonths.size > 0 ? rangeForMonths([...selMonths]) : null;
        syncMonthButtons();
        refresh();
      });
    });

    // Continent checkboxes
    ui.querySelectorAll('input[data-group="continent"]').forEach(cb =>
      cb.addEventListener("change", () => {
        cb.checked ? selConts.add(cb.dataset.raw) : selConts.delete(cb.dataset.raw);
        refresh();
      })
    );

    // Search
    const searchInput = document.getElementById("ef-search");
    const searchClear = document.getElementById("ef-search-clear");

    function updateSearchClear() {
      searchClear.style.display = searchInput.value.length > 0 ? "" : "none";
    }

    searchInput.addEventListener("input", e => {
      searchTerm = e.target.value.trim().toLowerCase();
      updateSearchClear();
      refresh();
      if (searchTerm.length >= 3) ui.removeAttribute("open");
    });
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        searchTerm = e.target.value.trim().toLowerCase();
        refresh();
        if (searchTerm) ui.removeAttribute("open");
      }
    });
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchTerm = "";
      searchClear.style.display = "none";
      searchInput.focus();
      refresh();
    });

    // Free only
    document.getElementById("ef-free").addEventListener("change", e => {
      freeOnly = e.target.checked;
      refresh();
    });

    // Reset — clears everything
    document.getElementById("ef-reset").addEventListener("click", () => {
      ui.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      document.getElementById("ef-search").value = "";
      document.getElementById("ef-search-clear").style.display = "none";
      selConts.clear();
      freeOnly     = false;
      searchTerm   = "";
      activeShortcut = null;
      dateFilter   = null;
      clearMonths();
      ui.querySelectorAll(".ef-shortcut-btn").forEach(b => b.classList.remove("active"));
      refresh();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
