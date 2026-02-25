#!/usr/bin/env python3
"""
generate-recurring.py
Scans all markdown files in the repo (README.md + YYYY.md) and generates
RECURRING.md — a canonical, alphabetically sorted list of all known events
with TBD dates, suitable as a yearly reference and template.

Also flags events not seen in the last INACTIVE_THRESHOLD years as candidates
for INACTIVE.md, printing a report at the end without modifying INACTIVE.md
automatically (human judgement required).

Usage:
    python3 scripts/generate-recurring.py
    python3 scripts/generate-recurring.py --inactive-threshold 3

Output:
    RECURRING.md in the repo root
    Console report of inactivity candidates
"""

import re
import sys
import argparse
from pathlib import Path
from datetime import date

# Support running from repo root or from scripts/ subdirectory
_here = Path(__file__).parent
ROOT = _here.parent if (_here / "../README.md").exists() or (_here.name == "scripts") else _here
OUTPUT = ROOT / "RECURRING.md"
INACTIVE_OUTPUT = ROOT / "INACTIVE.md"

LINK_RE = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
FLAG_RE = re.compile(r'[\U0001F1E0-\U0001F1FF]{2}', re.UNICODE)
SHORTCODE_RE = re.compile(r':[a-z_]+:')
PAREN_RE = re.compile(r'\(.*?\)')
MASTODON_RE = re.compile(r'@[\w.-]+@[\w.-]+\.\w+')
YEAR_FILE_RE = re.compile(r'^(20\d{2})\.md$')

DEFAULT_INACTIVE_THRESHOLD = 2  # years without appearance → candidate

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_table_row(line):
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 3:
        return None

    name_cell = cells[0]
    link_m = LINK_RE.search(name_cell)
    if not link_m:
        return None
    name = link_m.group(1).strip()
    url = link_m.group(2).strip()

    if not name or name.lower() == "event name":
        return None

    location_raw = cells[2] if len(cells) > 2 else ""
    location_raw = LINK_RE.sub(r'\1', location_raw).strip()

    social_raw = cells[3] if len(cells) > 3 else ""
    social_raw = social_raw.strip()

    return {
        "name": name,
        "url": url,
        "location": location_raw,
        "social": social_raw,
    }

def parse_file(path):
    events = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip()
            if not line.startswith("|"):
                continue
            if re.match(r'^\|[\s\-|:]+\|$', line):
                continue
            ev = parse_table_row(line)
            if ev:
                events.append(ev)
    return events

# ---------------------------------------------------------------------------
# Deduplication — key by normalized name
# ---------------------------------------------------------------------------

def normalize_name(name):
    """Normalize for deduplication — lowercase, strip punctuation."""
    return re.sub(r'[^a-z0-9]', '', name.lower())

def load_all_events():
    """
    Load events from all files, tracking the most recent year each was seen.
    Returns (events_list, last_seen_dict).
    - events_list: deduplicated, sorted by name, with most recent occurrence's metadata
    - last_seen_dict: normalize_name -> most recent year seen (int)
    """
    year_files = sorted(ROOT.glob("20??.md"))
    all_files = year_files + [ROOT / "README.md"]

    seen = {}        # normalize_name -> event dict
    last_seen = {}   # normalize_name -> most recent year (int)

    current_year = date.today().year

    for path in all_files:
        if not path.exists():
            continue

        # Determine what year this file represents
        m = YEAR_FILE_RE.match(path.name)
        file_year = int(m.group(1)) if m else current_year

        for ev in parse_file(path):
            key = normalize_name(ev["name"])
            # Always update to most recent occurrence
            if key not in seen or file_year >= last_seen.get(key, 0):
                seen[key] = ev
                last_seen[key] = file_year

    events = sorted(seen.values(), key=lambda e: e["name"].lower())
    return events, last_seen

# ---------------------------------------------------------------------------
# Inactivity detection
# ---------------------------------------------------------------------------

def find_inactive_candidates(last_seen, threshold):
    """
    Return list of (key, last_year) for events not seen within threshold years.
    Excludes events present in README.md (active this year).
    """
    current_year = date.today().year
    cutoff = current_year - threshold

    # Events in README.md are assumed active regardless of year files
    readme_keys = set()
    readme_path = ROOT / "README.md"
    if readme_path.exists():
        for ev in parse_file(readme_path):
            readme_keys.add(normalize_name(ev["name"]))

    candidates = []
    for key, year in last_seen.items():
        if key in readme_keys:
            continue
        if year <= cutoff:
            candidates.append((key, year))

    return sorted(candidates, key=lambda x: x[1])  # oldest first

# ---------------------------------------------------------------------------
# Check for existing INACTIVE.md entries (to avoid re-suggesting them)
# ---------------------------------------------------------------------------

def load_inactive_keys():
    """Return set of normalized names already in INACTIVE.md."""
    if not INACTIVE_OUTPUT.exists():
        return set()
    keys = set()
    with open(INACTIVE_OUTPUT, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip()
            if not line.startswith("|"):
                continue
            if re.match(r'^\|[\s\-|:]+\|$', line):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if not cells:
                continue
            name_cell = cells[0]
            link_m = LINK_RE.search(name_cell)
            if link_m:
                keys.add(normalize_name(link_m.group(1).strip()))
    return keys

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def format_row(ev):
    name_col = f"[{ev['name']}]({ev['url']})" if ev['url'] else ev['name']
    location = ev['location'] if ev['location'] else "TBD"
    social = ev['social'] if ev['social'] else "-"
    return f"| {name_col} | TBD | {location} | {social} | - |"

def scaffold_inactive(events_by_key, candidates):
    """
    Create INACTIVE.md if it doesn't exist, or append new candidates to it.
    Does not overwrite existing entries.
    """
    existing_keys = load_inactive_keys()
    new_candidates = [(k, y) for k, y in candidates if k not in existing_keys]

    if not new_candidates:
        return 0

    new_rows = []
    for key, last_year in new_candidates:
        ev = events_by_key.get(key, {})
        name = ev.get("name", key)
        url = ev.get("url", "")
        location = ev.get("location", "TBD")
        social = ev.get("social", "-")
        name_col = f"[{name}]({url})" if url else name
        location_col = location if location else "TBD"
        new_rows.append(
            f"| {name_col} | TBD | {location_col} | {social} | - |"
        )

    # Sort new rows alphabetically by event name (strip markdown link for sort key)
    def row_sort_key(row):
        m = re.search(r'\[([^\]]+)\]', row)
        return m.group(1).lower() if m else row.lower()

    new_rows.sort(key=row_sort_key)

    if not INACTIVE_OUTPUT.exists():
        header = [
            "# Inactive Infosec Events",
            "",
            "Events that have not been active in recent years.",
            "Kept here for historical reference and in case they resume.",
            "Before re-adding an event to `RECURRING.md`, remove it from this file.",
            "",
            "> **Maintainers:** This file is partially scaffolded by `scripts/generate-recurring.py`.",
            "> The script adds candidates automatically, but the final decision to move an event",
            "> here requires human judgement. An event skipping a year is not the same as being",
            "> dead — check the website before committing.",
            "",
            "| Event Name | Date(s) | Location | Social | Free |",
            "| --- | --- | --- | --- | --- |",
        ]
        with open(INACTIVE_OUTPUT, "w", encoding="utf-8") as f:
            f.write("\n".join(header) + "\n")
            for row in new_rows:
                f.write(row + "\n")
            f.write("\n")
    else:
        # Read existing rows, merge with new ones, re-sort, rewrite
        existing_rows = []
        header_lines = []
        in_table = False
        with open(INACTIVE_OUTPUT, "r", encoding="utf-8") as f:
            for line in f:
                line = line.rstrip()
                if line.startswith("| Event Name"):
                    in_table = True
                    header_lines.append(line)
                    continue
                if re.match(r'^\|[\s\-|:]+\|$', line) and in_table:
                    header_lines.append(line)
                    continue
                if in_table and line.startswith("|"):
                    existing_rows.append(line)
                elif not in_table:
                    header_lines.append(line)

        all_rows = existing_rows + new_rows
        all_rows.sort(key=row_sort_key)

        with open(INACTIVE_OUTPUT, "w", encoding="utf-8") as f:
            f.write("\n".join(header_lines) + "\n")
            for row in all_rows:
                f.write(row + "\n")
            f.write("\n")

    return len(new_rows)

def generate(inactive_threshold):
    events, last_seen = load_all_events()

    # Build events_by_key for INACTIVE.md scaffolding
    events_by_key = {normalize_name(ev["name"]): ev for ev in events}

    # Write RECURRING.md
    lines = [
        "# Recurring Infosec Events",
        "",
        "A canonical, alphabetically sorted list of all known infosec events.",
        "Dates are set to **TBD** until confirmed for the upcoming year.",
        "Use this as a reference to ensure no recurring event is missed.",
        "",
        "> Events not seen in recent years are listed in [INACTIVE.md](INACTIVE.md).",
        "",
        "| Event Name | Date(s) | Location | Social | Free |",
        "| --- | --- | --- | --- | --- |",
    ]

    for ev in events:
        lines.append(format_row(ev))

    lines.append("")
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"✓ Generated {OUTPUT} with {len(events)} events.")

    # Inactivity report
    candidates = find_inactive_candidates(last_seen, inactive_threshold)
    inactive_keys = load_inactive_keys()
    new_candidates = [(k, y) for k, y in candidates if k not in inactive_keys]
    already_inactive = [(k, y) for k, y in candidates if k in inactive_keys]

    if candidates:
        print(f"\n⚠  Inactivity candidates (not seen in {inactive_threshold}+ years):")
        print(f"   Threshold : last seen ≤ {date.today().year - inactive_threshold}")
        print()

        if new_candidates:
            print(f"   NEW — consider moving to INACTIVE.md ({len(new_candidates)}):")
            for key, year in new_candidates:
                ev = events_by_key.get(key, {})
                print(f"     • {ev.get('name', key)} (last seen: {year})")

        if already_inactive:
            print(f"\n   Already in INACTIVE.md ({len(already_inactive)}) — no action needed.")

        # Scaffold INACTIVE.md with new candidates
        added = scaffold_inactive(events_by_key, candidates)
        if added:
            print(f"\n✓ Added {added} new candidate(s) to {INACTIVE_OUTPUT}.")
            print(f"  Review and add notes before committing.")
    else:
        print("\n✓ No inactivity candidates found.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate RECURRING.md and flag inactive event candidates."
    )
    parser.add_argument(
        "--inactive-threshold", type=int, default=DEFAULT_INACTIVE_THRESHOLD,
        help=f"Years without appearance to flag as inactive candidate (default: {DEFAULT_INACTIVE_THRESHOLD})"
    )
    args = parser.parse_args()
    generate(args.inactive_threshold)
