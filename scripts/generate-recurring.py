#!/usr/bin/env python3
"""
generate-recurring.py
Scans all markdown files in the repo (README.md + YYYY.md) and generates
RECURRING.md — a canonical, alphabetically sorted list of all known events
with TBD dates, suitable as a yearly reference and template.

Usage:
    python3 scripts/generate-recurring.py

Output:
    RECURRING.md in the repo root
"""

import re
import glob
from pathlib import Path
from collections import defaultdict

# Support running from repo root or from scripts/ subdirectory
_here = Path(__file__).parent
ROOT = _here.parent if (_here / "../README.md").exists() or (_here.name == "scripts") else _here
OUTPUT = ROOT / "RECURRING.md"

LINK_RE = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
FLAG_RE = re.compile(r'[\U0001F1E0-\U0001F1FF]{2}', re.UNICODE)
SHORTCODE_RE = re.compile(r':[a-z_]+:')
PAREN_RE = re.compile(r'\(.*?\)')
MASTODON_RE = re.compile(r'@[\w.-]+@[\w.-]+\.\w+')

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

    # Skip header/separator
    if not name or name.lower() == "event name":
        return None

    location_raw = cells[2] if len(cells) > 2 else ""
    location_raw = LINK_RE.sub(r'\1', location_raw).strip()

    # Extract social handle
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
# Deduplication — key by (name, url) to handle slight name variations
# ---------------------------------------------------------------------------

def normalize_name(name):
    """Normalize for deduplication — lowercase, strip punctuation."""
    return re.sub(r'[^a-z0-9]', '', name.lower())

def load_all_events():
    files = sorted(ROOT.glob("20??.md")) + [ROOT / "README.md"]
    seen = {}  # normalize_name -> event dict

    for path in files:
        if not path.exists():
            continue
        for ev in parse_file(path):
            key = normalize_name(ev["name"])
            if key not in seen:
                seen[key] = ev

    # Sort alphabetically by name
    return sorted(seen.values(), key=lambda e: e["name"].lower())

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def format_row(ev):
    name_col = f"[{ev['name']}]({ev['url']})" if ev['url'] else ev['name']
    location = ev['location'] if ev['location'] else "TBD"
    social = ev['social'] if ev['social'] else "-"
    return f"| {name_col} | TBD | {location} | {social} | - |"

def generate():
    events = load_all_events()

    lines = [
        "# Recurring Infosec Events",
        "",
        "A canonical, alphabetically sorted list of all known infosec events.",
        "Dates are set to **TBD** until confirmed for the upcoming year.",
        "Use this as a reference to ensure no recurring event is missed.",
        "",
        "| Event Name | Date(s) | Location | Social | Free |",
        "| --- | --- | --- | --- | --- |",
    ]

    for ev in events:
        lines.append(format_row(ev))

    lines.append("")
    content = "\n".join(lines)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"✓ Generated {OUTPUT} with {len(events)} events.")

if __name__ == "__main__":
    generate()
