#!/usr/bin/env python3
"""
update-locations.py
Scans README.md for event locations, geocodes any missing cities via
Nominatim (OSM), and updates static/locations.json automatically.

Usage:
    python3 scripts/update-locations.py

Intended to be run by GitHub Actions on every push to main.
No manual steps required — contributors just add events as usual.
"""

import json
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent
README = ROOT / "README.md"
LOCATIONS = ROOT / "static" / "locations.json"

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

FLAG_RE = re.compile(r"[\U0001F1E0-\U0001F1FF]{2}", re.UNICODE)
PAREN_RE = re.compile(r"\(.*?\)")
SHORTCODE_RE = re.compile(r":[a-z_]+:")

def extract_city(location_raw):
    city = FLAG_RE.sub("", location_raw)
    city = SHORTCODE_RE.sub("", city)
    city = PAREN_RE.sub("", city)
    return city.strip()

def parse_cities_from_readme():
    """Return dict of city -> raw location string from README.md table."""
    cities = {}
    with open(README, encoding="utf-8") as f:
        for line in f:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 5:
                continue
            location_raw = parts[3]
            if not location_raw:
                continue
            # Skip header and separator rows
            if location_raw.lower() == "location":
                continue
            if re.match(r"^-+$", location_raw):
                continue
            city = extract_city(location_raw)
            if not city or re.match(r"^-+$", city) or city.lower() == "location":
                continue
            cities[city] = location_raw.strip()
    return cities

# ---------------------------------------------------------------------------
# Geocoding via Nominatim
# ---------------------------------------------------------------------------

def geocode(city, raw_location):
    """
    Try to geocode a city using Nominatim.
    Falls back to progressively broader queries if the first fails.
    Returns (lat, lng) or None.
    """
    # Extract country hint from flag emoji using Unicode regional indicators
    flags = FLAG_RE.findall(raw_location)
    country_code = None
    if flags:
        flag = flags[0]
        # Convert regional indicator pair to ISO 3166-1 alpha-2
        country_code = "".join(chr(ord(c) - 0x1F1E6 + ord("A")) for c in flag)

    queries = [city]
    if country_code:
        queries.insert(0, f"{city}, {country_code}")

    for query in queries:
        result = _nominatim_search(query)
        if result:
            return result
        time.sleep(1.1)  # Respect Nominatim rate limit (1 req/sec)

    return None

def _nominatim_search(query):
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": 1,
    })
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "infosec-events-location-updater/1.0 (https://github.com/xsa/infosec-events)"
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return round(float(data[0]["lat"]), 4), round(float(data[0]["lon"]), 4)
    except (urllib.error.URLError, ValueError, KeyError, IndexError) as e:
        print(f"    Nominatim error for {query!r}: {e}")
    return None

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Load existing locations
    with open(LOCATIONS, encoding="utf-8") as f:
        locations = json.load(f)

    # Parse cities from README
    readme_cities = parse_cities_from_readme()

    # Find missing ones
    missing = {city: raw for city, raw in readme_cities.items() if city not in locations}

    if not missing:
        print("✓ All cities in README.md have coordinates in locations.json")
        sys.exit(0)

    print(f"⚠ {len(missing)} city/cities missing from locations.json — geocoding via Nominatim...\n")

    updated = dict(locations)
    failed = []

    for city, raw in sorted(missing.items()):
        print(f"  Geocoding: {city!r}  (from: {raw!r})")
        result = geocode(city, raw)
        if result:
            lat, lng = result
            updated[city] = {"lat": lat, "lng": lng}
            print(f"    ✓ {lat}, {lng}")
        else:
            failed.append((city, raw))
            print(f"    ✗ Not found — add manually to static/locations.json")
        time.sleep(1.1)

    # Write back sorted
    sorted_locations = dict(sorted(updated.items()))
    with open(LOCATIONS, "w", encoding="utf-8") as f:
        json.dump(sorted_locations, f, indent=2, ensure_ascii=False)
        f.write("\n")

    added = len(updated) - len(locations)
    print(f"\n✓ locations.json updated — {added} new {'entry' if added == 1 else 'entries'} added.")

    if failed:
        print(f"\n⚠ {len(failed)} city/cities could not be geocoded automatically:")
        for city, raw in failed:
            print(f"  - {city!r} (from: {raw!r})")
        print("\nPlease add them manually to static/locations.json and re-run.")
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
