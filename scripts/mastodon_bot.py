#!/usr/bin/env python3
"""
mastodon_bot.py — Post infosec event updates to Mastodon.

Modes:
    digest   Post a weekly digest of events in the next 14 days.
    notify   Post about newly added events (based on git diff).

Usage:
    python scripts/mastodon_bot.py digest
    python scripts/mastodon_bot.py notify --added "Event Name|Date|Location|MastodonHandle"

Environment variables:
    MASTODON_TOKEN       Access token for the bot account
    MASTODON_BASE_URL    e.g. https://infosec.exchange
"""

import os
import re
import sys
import json
import argparse
import urllib.request
import urllib.parse
from datetime import date, timedelta
from pathlib import Path
import glob

# ---------------------------------------------------------------------------
# Reuse date/table parsing from generate_ics.py
# ---------------------------------------------------------------------------

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

DATE_RE = re.compile(
    r"""
    (?P<sm>[A-Za-z]{3})\s+(?P<sd>\d{1,2})
    (?:\s*[-–]\s*(?:(?P<em>[A-Za-z]{3})\s+)?(?P<ed>\d{1,2}))?
    ,\s*(?P<yr>\d{4})
    """,
    re.VERBOSE,
)

LINK_RE = re.compile(r'\[(\[?[^\]]*\]?[^\]]*)\]\(([^)]+)\)')
FLAG_RE = re.compile(r'[\U0001F1E0-\U0001F1FF]{2}')

# Matches Mastodon handles: @handle@instance or @handle@instance.tld
MASTODON_RE = re.compile(r'@[\w.-]+@[\w.-]+\.\w+')


def parse_dates(date_str):
    m = DATE_RE.search(date_str)
    if not m:
        return None, None
    year = int(m.group("yr"))
    sm = MONTHS.get(m.group("sm").lower())
    if not sm:
        return None, None
    sd = int(m.group("sd"))
    try:
        start = date(year, sm, sd)
    except ValueError:
        return None, None
    if m.group("ed"):
        em = MONTHS.get((m.group("em") or m.group("sm")).lower())
        if not em:
            return None, None
        try:
            end = date(year, em, int(m.group("ed")))
        except ValueError:
            return None, None
    else:
        end = start
    return start, end


def parse_table_row(line):
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 2:
        return None

    name_cell = cells[0]
    link_m = LINK_RE.search(name_cell)
    name = link_m.group(1) if link_m else name_cell
    url = link_m.group(2) if link_m else ""

    date_str = cells[1] if len(cells) > 1 else ""
    dtstart, dtend = parse_dates(date_str)
    if not dtstart:
        return None

    location = cells[2] if len(cells) > 2 else ""
    location = FLAG_RE.sub("", LINK_RE.sub(r'\1', location)).strip()

    # Extract Mastodon handle from Social column if present
    social_cell = cells[3] if len(cells) > 3 else ""
    mastodon_handle = None
    masto_m = MASTODON_RE.search(social_cell)
    if masto_m:
        mastodon_handle = masto_m.group(0)

    return {
        "name": name,
        "url": url,
        "dtstart": dtstart,
        "dtend": dtend,
        "location": location,
        "date_raw": date_str,
        "mastodon": mastodon_handle,
    }


def parse_markdown_file(path):
    events = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip()
            if not line.startswith("|"):
                continue
            if re.match(r'^\|[\s\-|:]+\|$', line) or "Event Name" in line:
                continue
            ev = parse_table_row(line)
            if ev:
                events.append(ev)
    return events


def load_all_events():
    files = ["README.md"] + sorted(glob.glob("20??.md"))
    all_events = []
    seen = set()
    for f in files:
        p = Path(f)
        if not p.exists():
            continue
        for ev in parse_markdown_file(p):
            key = (ev["name"], ev["date_raw"])
            if key not in seen:
                seen.add(key)
                all_events.append(ev)
    return all_events


# ---------------------------------------------------------------------------
# Mastodon API
# ---------------------------------------------------------------------------

def post_status(text, token, base_url, in_reply_to_id=None):
    """Post a status and return the new status ID."""
    url = f"{base_url.rstrip('/')}/api/v1/statuses"
    data = {"status": text, "visibility": "public"}
    if in_reply_to_id:
        data["in_reply_to_id"] = in_reply_to_id

    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        return result["id"]


def thread(posts, token, base_url):
    """Post a list of strings as a thread, each replying to the previous."""
    reply_id = None
    for text in posts:
        reply_id = post_status(text, token, base_url, in_reply_to_id=reply_id)
        print(f"  Posted: {text[:60]}...", file=sys.stderr)


# ---------------------------------------------------------------------------
# Format helpers
# ---------------------------------------------------------------------------

SITE_URL = "https://xsa.github.io/infosec-events/"
CHAR_LIMIT = 500


def format_event_line(ev):
    """Format a single event as a bullet line, tagging Mastodon handle if known."""
    handle = f" {ev['mastodon']}" if ev["mastodon"] else ""
    return f"• {ev['name']}{handle} — {ev['date_raw']}, {ev['location']}"


def build_digest_posts(events):
    """
    Build a list of post strings for the weekly digest.
    Splits into multiple posts (thread) if needed to stay under CHAR_LIMIT.
    """
    if not events:
        return []

    header = "📅 Upcoming #infosec events in the next 14 days:\n\n"
    footer = f"\nFull list & calendar subscription → {SITE_URL}\n#cybersecurity #conference"
    lines = [format_event_line(ev) for ev in events]

    posts = []
    current_lines = []
    is_first = True

    for line in lines:
        candidate = (header if is_first else "📅 (continued)\n\n") + \
                    "\n".join(current_lines + [line]) + \
                    (footer if is_first else "")
        if len(candidate) > CHAR_LIMIT and current_lines:
            # Flush current batch
            body = (header if is_first else "📅 (continued)\n\n") + \
                   "\n".join(current_lines)
            if is_first:
                body += footer
            posts.append(body)
            current_lines = [line]
            is_first = False
        else:
            current_lines.append(line)

    if current_lines:
        body = (header if is_first else "📅 (continued)\n\n") + \
               "\n".join(current_lines)
        if is_first:
            body += footer
        else:
            body += f"\n\nFull list → {SITE_URL}"
        posts.append(body)

    return posts


def build_new_event_post(events):
    """Build a single post announcing newly added events."""
    if not events:
        return None

    if len(events) == 1:
        ev = events[0]
        handle = f" {ev['mastodon']}" if ev["mastodon"] else ""
        text = (
            f"🆕 New event added:{handle}\n\n"
            f"📌 {ev['name']}\n"
            f"📅 {ev['date_raw']}\n"
            f"📍 {ev['location']}\n"
        )
        if ev["url"]:
            text += f"🔗 {ev['url']}\n"
        text += f"\n#infosec #cybersecurity #conference"
    else:
        lines = [format_event_line(ev) for ev in events]
        text = f"🆕 {len(events)} new events added:\n\n" + \
               "\n".join(lines) + \
               f"\n\nFull list → {SITE_URL}\n#infosec #cybersecurity #conference"

    # Truncate gracefully if somehow over limit
    if len(text) > CHAR_LIMIT:
        text = text[:CHAR_LIMIT - 3] + "..."

    return text


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def mode_digest(token, base_url):
    today = date.today()
    cutoff = today + timedelta(days=14)
    all_events = load_all_events()
    upcoming = [
        ev for ev in all_events
        if ev["dtstart"] and today <= ev["dtstart"] <= cutoff
    ]
    upcoming.sort(key=lambda e: e["dtstart"])

    if not upcoming:
        print("No events in the next 14 days, nothing to post.", file=sys.stderr)
        return

    posts = build_digest_posts(upcoming)
    print(f"Posting digest: {len(upcoming)} events in {len(posts)} post(s).", file=sys.stderr)
    thread(posts, token, base_url)


def mode_notify(token, base_url, added_json):
    """
    added_json: JSON string — list of raw markdown table rows that were added,
    as produced by the workflow via git diff.
    """
    rows = json.loads(added_json)
    events = []
    for row in rows:
        # Reconstruct a pipe-delimited line for the parser
        ev = parse_table_row("| " + " | ".join(row) + " |")
        if ev:
            events.append(ev)

    if not events:
        print("No parseable new events found, nothing to post.", file=sys.stderr)
        return

    text = build_new_event_post(events)
    print(f"Posting new event notification:\n{text}", file=sys.stderr)
    post_status(text, token, base_url)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)

    sub.add_parser("digest", help="Post weekly digest of upcoming events")

    notify_p = sub.add_parser("notify", help="Post about newly added events")
    notify_p.add_argument(
        "--added",
        required=True,
        help='JSON array of new event rows, e.g. [["Name","Date","Location","Social","Free"]]',
    )

    args = parser.parse_args()

    token = os.environ.get("MASTODON_TOKEN")
    base_url = os.environ.get("MASTODON_BASE_URL", "https://infosec.exchange")

    if not token:
        print("Error: MASTODON_TOKEN environment variable not set.", file=sys.stderr)
        sys.exit(1)

    if args.mode == "digest":
        mode_digest(token, base_url)
    elif args.mode == "notify":
        mode_notify(token, base_url, args.added)


if __name__ == "__main__":
    main()
