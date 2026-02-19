#!/usr/bin/env python3
"""
generate_ics.py — Convert infosec-events markdown tables to an ICS calendar file.

Usage:
    python generate_ics.py [--output events.ics] [files ...]

If no files are specified, it will process all *.md files in the current directory
(excluding README.md).

Dependencies: none (stdlib only)
"""

import re
import sys
import uuid
import argparse
import glob
from datetime import datetime, date, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Matches patterns like:
#   "Feb 28 - Mar 1, 2026"
#   "Mar 16-20, 2026"
#   "Jun 30 - Jul 2, 2026"
#   "Mar 10, 2026"
DATE_RE = re.compile(
    r"""
    (?P<sm>[A-Za-z]{3})\s+(?P<sd>\d{1,2})   # start month + day
    (?:                                        # optional end
        \s*[-–]\s*
        (?:(?P<em>[A-Za-z]{3})\s+)?           # optional end month
        (?P<ed>\d{1,2})                        # end day
    )?
    ,\s*(?P<yr>\d{4})                         # year
    """,
    re.VERBOSE,
)


def parse_dates(date_str: str):
    """Return (dtstart, dtend) as date objects. dtend is exclusive (day after)."""
    m = DATE_RE.search(date_str)
    if not m:
        return None, None

    year = int(m.group("yr"))
    sm = MONTHS.get(m.group("sm").lower())
    if not sm:
        return None, None
    sd = int(m.group("sd"))
    start = date(year, sm, sd)

    if m.group("ed"):
        em = MONTHS.get((m.group("em") or m.group("sm")).lower())
        ed = int(m.group("ed"))
        end = date(year, em, ed)
    else:
        end = start

    # ICS DTEND for all-day events is exclusive
    return start, end + timedelta(days=1)


# ---------------------------------------------------------------------------
# Markdown table row parser
# ---------------------------------------------------------------------------

# Strip markdown link syntax: [text](url) -> text, url
# Handles nested brackets like [[un]prompted](url)
LINK_RE = re.compile(r'\[(\[?[^\]]*\]?[^\]]*)\]\(([^)]+)\)')
# Strip flag emojis and clean up location strings
FLAG_RE = re.compile(r'[\U0001F1E0-\U0001F1FF]{2}')


def parse_table_row(line: str):
    """Parse a markdown table row and return a dict or None."""
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 2:
        return None

    # Cell 0: Event Name (markdown link)
    name_cell = cells[0]
    link_m = LINK_RE.search(name_cell)
    name = link_m.group(1) if link_m else name_cell
    url = link_m.group(2) if link_m else ""

    # Cell 1: Date(s)
    date_str = cells[1] if len(cells) > 1 else ""
    dtstart, dtend = parse_dates(date_str)
    if not dtstart:
        return None

    # Cell 2: Location
    location = cells[2] if len(cells) > 2 else ""
    location = FLAG_RE.sub("", location).strip()
    # Remove markdown links from location
    location = LINK_RE.sub(r'\1', location)

    return {
        "name": name,
        "url": url,
        "dtstart": dtstart,
        "dtend": dtend,
        "location": location,
        "date_raw": date_str,
    }


def parse_markdown_file(path: Path):
    """Extract all events from a markdown file's table rows."""
    events = []
    in_table = False
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip()
            if not line.startswith("|"):
                in_table = False
                continue
            # Skip separator rows like | --- | --- |
            if re.match(r'^\|[\s\-|]+\|$', line):
                in_table = True
                continue
            # Skip header rows (bold or known headers)
            if "Event Name" in line or "**" in line:
                in_table = True
                continue
            ev = parse_table_row(line)
            if ev:
                events.append(ev)
            else:
                # Only warn for lines that look like real data rows (not headers/separators)
                if not re.match(r'^\|[\s\-|:]+\|', line) and "Event Name" not in line:
                    print(f"  Warning: could not parse row: {line[:80]}", file=sys.stderr)
    return events


# ---------------------------------------------------------------------------
# ICS generation helpers
# ---------------------------------------------------------------------------

def ics_escape(s: str) -> str:
    """Escape special characters for ICS text fields."""
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_fold(line: str) -> str:
    """Fold long ICS lines at 75 octets (RFC 5545)."""
    # Work in bytes to respect UTF-8 boundaries
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    result = []
    pos = 0
    first = True
    while pos < len(encoded):
        chunk_size = 75 if first else 74  # 74 + 1 space
        chunk = encoded[pos:pos + chunk_size]
        # Back off to avoid splitting multibyte chars
        while chunk_size > 1:
            try:
                chunk.decode("utf-8")
                break
            except UnicodeDecodeError:
                chunk_size -= 1
                chunk = encoded[pos:pos + chunk_size]
        result.append(("" if first else " ") + chunk.decode("utf-8"))
        pos += chunk_size
        first = False
    return "\r\n".join(result)


def date_to_ics(d: date) -> str:
    return d.strftime("%Y%m%d")


def now_utc() -> str:
    from datetime import timezone
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def event_to_vevent(ev: dict, dtstamp: str) -> str:
    uid = str(uuid.uuid5(uuid.NAMESPACE_URL, ev["url"] or ev["name"] + ev["date_raw"]))
    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART;VALUE=DATE:{date_to_ics(ev['dtstart'])}",
        f"DTEND;VALUE=DATE:{date_to_ics(ev['dtend'])}",
        ics_fold(f"SUMMARY:{ics_escape(ev['name'])}"),
    ]
    if ev["location"]:
        lines.append(ics_fold(f"LOCATION:{ics_escape(ev['location'])}"))
    if ev["url"]:
        lines.append(ics_fold(f"URL:{ev['url']}"))
        lines.append(ics_fold(f"DESCRIPTION:{ics_escape(ev['url'])}"))
    lines.append("END:VEVENT")
    return "\r\n".join(lines)


def build_ics(events: list) -> str:
    dtstamp = now_utc()
    parts = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//xsa//infosec-events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:InfoSec Events",
        "X-WR-CALDESC:Cyber/InfoSec conferences and events — https://xsa.github.io/infosec-events/",
        "X-WR-TIMEZONE:UTC",
    ]
    for ev in events:
        parts.append(event_to_vevent(ev, dtstamp))
    parts.append("END:VCALENDAR")
    return "\r\n".join(parts) + "\r\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate ICS from infosec-events markdown files.")
    parser.add_argument("files", nargs="*", help="Markdown files to process (default: all *.md)")
    parser.add_argument("--output", "-o", default="static/events.ics", help="Output ICS file path")
    parser.add_argument("--future-only", action="store_true", default=False,
                        help="Only include events from today onwards")
    args = parser.parse_args()

    files = args.files or sorted(glob.glob("*.md"))

    all_events = []
    for f in files:
        p = Path(f)
        if not p.exists():
            print(f"Warning: {f} not found, skipping.", file=sys.stderr)
            continue
        evs = parse_markdown_file(p)
        print(f"  {p.name}: {len(evs)} events", file=sys.stderr)
        all_events.extend(evs)

    if args.future_only:
        today = date.today()
        all_events = [e for e in all_events if e["dtend"] > today]

    # Sort by start date
    all_events.sort(key=lambda e: e["dtstart"])

    ics_content = build_ics(all_events)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(ics_content, encoding="utf-8")
    print(f"\nWrote {len(all_events)} events to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
