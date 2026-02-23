#!/usr/bin/env python3
"""
check-recurring.py
Compares RECURRING.md against the current year's events (README.md + YYYY.md)
and reports which recurring events have not yet been added this year.

Usage:
    python3 scripts/check-recurring.py
    python3 scripts/check-recurring.py --year 2026
    python3 scripts/check-recurring.py --verbose

Output:
    A list of events present in RECURRING.md but missing from the current year.
"""

import re
import sys
import argparse
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# Path resolution — works from repo root or scripts/ subdirectory
# ---------------------------------------------------------------------------
_here = Path(__file__).parent
ROOT = _here.parent if _here.name == "scripts" else _here

LINK_RE = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_events(path):
    """Return a list of event dicts from a markdown file."""
    events = []
    if not path.exists():
        return events
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip()
            if not line.startswith("|"):
                continue
            if re.match(r'^\|[\s\-|:]+\|$', line):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) < 2:
                continue
            name_cell = cells[0]
            if "Event Name" in name_cell or not name_cell:
                continue
            if name_cell.startswith("~"):
                continue
            link_m = LINK_RE.search(name_cell)
            if not link_m:
                continue
            name = link_m.group(1).strip()
            url = link_m.group(2).strip()
            location = LINK_RE.sub(r'\1', cells[2]).strip() if len(cells) > 2 else ""
            location = re.sub(r'<br\s*/?>', ' ', location).strip()
            events.append({"name": name, "url": url, "location": location})
    return events


def normalize(name):
    """Normalize event name for fuzzy deduplication."""
    # Strip trailing year numbers: "DEF CON 33" -> "DEF CON"
    name = re.sub(r'\s+\d{2,4}$', '', name.strip())
    # Strip year in parens
    name = re.sub(r'\s*\(\d{4}\)', '', name)
    # Strip subtitle after colon or em-dash (e.g. "Wild West Hackin' Fest: Deadwood")
    name = re.sub(r'\s*[:\u2014].*$', '', name)
    # Lowercase, alphanumeric only
    return re.sub(r'[^a-z0-9]', '', name.lower())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Find recurring events missing from the current year."
    )
    parser.add_argument(
        "--year", type=int, default=date.today().year,
        help="Year to check against (default: current year)"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Also show events found in both (confirmed present)"
    )
    args = parser.parse_args()

    year = args.year

    # Load RECURRING.md
    recurring_path = ROOT / "RECURRING.md"
    if not recurring_path.exists():
        print(f"✗ RECURRING.md not found at {recurring_path}", file=sys.stderr)
        sys.exit(1)
    recurring = parse_events(recurring_path)

    # Primary source: README.md (upcoming events)
    # YYYY.md is past/archived — included only to avoid false positives for
    # events that already happened this year and were moved to the archive.
    current_events = []
    sources_found = []

    readme_path = ROOT / "README.md"
    archive_path = ROOT / f"{year}.md"

    for path in [readme_path, archive_path]:
        evs = parse_events(path)
        if evs:
            current_events.extend(evs)
            sources_found.append(path.name)

    if not current_events:
        print(f"✗ No events found (checked README.md and {year}.md)", file=sys.stderr)
        sys.exit(1)

    # Build normalized key sets
    current_keys = {normalize(ev["name"]) for ev in current_events}
    readme_keys = {normalize(ev["name"]) for ev in parse_events(readme_path)}

    # Compare
    missing = []
    present = []

    for ev in recurring:
        key = normalize(ev["name"])
        if key in current_keys:
            present.append(ev)
        else:
            missing.append(ev)

    # Separate missing into: not in README (upcoming) vs. only in archive
    missing_upcoming = []
    missing_archived_only = []
    for ev in missing:
        key = normalize(ev["name"])
        if key in {normalize(e["name"]) for e in parse_events(archive_path)} if archive_path.exists() else set():
            missing_archived_only.append(ev)
        else:
            missing_upcoming.append(ev)

    # Report
    print(f"\nRecurring event check for {year}")
    print(f"  RECURRING.md : {len(recurring)} events")
    print(f"  README.md    : {len(parse_events(readme_path))} upcoming events")
    if archive_path.exists():
        print(f"  {year}.md      : {len(parse_events(archive_path))} archived events")
    print()

    # Strip flag emoji from location for clean terminal output
    flag_re = re.compile(r'[\U0001F1E0-\U0001F1FF]{2}|:[a-z_]+:', re.UNICODE)

    def fmt_loc(loc):
        loc = flag_re.sub('', loc).strip()
        loc = re.sub(r'\s+', ' ', loc).strip()
        return f" [{loc}]" if loc else ""

    if missing_upcoming:
        print(f"MISSING from README.md ({len(missing_upcoming)} not yet scheduled for {year}):\n")
        for ev in sorted(missing_upcoming, key=lambda e: e["name"].lower()):
            url = f"  {ev['url']}" if ev["url"] else ""
            print(f"  {ev['name']}{fmt_loc(ev['location'])}{url}")
    else:
        print(f"All recurring events are accounted for in README.md!")

    if missing_archived_only:
        print(f"\nARCHIVED in {year}.md only ({len(missing_archived_only)} past events, no action needed):\n")
        for ev in sorted(missing_archived_only, key=lambda e: e["name"].lower()):
            url = f"  {ev['url']}" if ev["url"] else ""
            print(f"  {ev['name']}{url}")

    if args.verbose and present:
        print(f"\nPRESENT ({len(present)} confirmed):\n")
        for ev in sorted(present, key=lambda e: e["name"].lower()):
            in_readme = normalize(ev["name"]) in readme_keys
            tag = "(upcoming)" if in_readme else "(archived)"
            print(f"  {ev['name']} {tag}")

    print()
    return len(missing_upcoming)


if __name__ == "__main__":
    sys.exit(0 if main() == 0 else 1)
