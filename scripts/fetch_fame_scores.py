"""Stamps every person record with a real "fame" score (0-1000+) derived from
actual Wikipedia pageview counts, batched 50 titles per request against the
prop=pageviews API. This replaces the old approach of hand-curated "famous
name" lists (aiNames / LOCAL_AI_TAGS / famous.js) with a real, per-name signal
that the AI engine can rank on directly - and that naturally favors recent,
well-known players (a page nobody visits doesn't get many views).

Idempotent: records that already have a "fame" field are skipped, so this can
be re-run safely (e.g. after adding new categories) without re-fetching
everything.

Run: python3 scripts/fetch_fame_scores.py [path/to/file.json ...]
     (no args = every file listed in data/manifest.json)
"""
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH_SIZE = 50
MIN_SPACING = 0.6  # seconds between requests - courteous, avoids 429s


def wiki_title_for(record):
    wiki_url = record.get("wiki")
    if wiki_url:
        tail = wiki_url.rsplit("/", 1)[-1]
        return urllib.parse.unquote(tail).replace("_", " ")
    # Most curated/custom entries don't have a stored wiki URL, but for the
    # large majority of well-known names the plain display name IS the exact
    # Wikipedia title - strip any "(disambiguator)" suffix and use that.
    name = record.get("name", "")
    return re.sub(r"\s*\([^)]*\)\s*$", "", name).strip() or None


def fetch_pageviews_batch(titles):
    joined = "|".join(urllib.parse.quote(t, safe="") for t in titles)
    url = (
        "https://en.wikipedia.org/w/api.php?action=query&format=json"
        "&prop=pageviews&titles=" + joined
    )
    for attempt in range(3):
        try:
            proc = subprocess.run(
                ["curl", "-s", "-w", "\n%{http_code}", "--max-time", "20",
                 "-H", "User-Agent: NameGameFameScorer/1.0", url],
                capture_output=True, text=True, timeout=25,
            )
            body, _, status = proc.stdout.rpartition("\n")
            if status.strip() in ("429",) or status.strip().startswith("5"):
                time.sleep(2 * (attempt + 1))
                continue
            if status.strip() != "200":
                return {}
            data = json.loads(body)
            pages = data.get("query", {}).get("pages", {})
            result = {}
            for p in pages.values():
                title = p.get("title")
                views = p.get("pageviews") or {}
                total = sum(v for v in views.values() if isinstance(v, int))
                result[title] = total
            return result
        except Exception:
            time.sleep(1)
    return {}


def save_progress(path, data, people):
    if isinstance(data, dict):
        data["people"] = people
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    else:
        path.write_text(json.dumps(people, indent=2, ensure_ascii=False) + "\n")


def process_file(path):
    data = json.loads(path.read_text())
    people = data.get("people", data) if isinstance(data, dict) else data
    if not isinstance(people, list):
        print(f"skip {path}: unexpected shape")
        return

    todo = [p for p in people if "fame" not in p and p.get("name")]
    if not todo:
        print(f"{path.relative_to(ROOT)}: nothing to fetch ({len(people)} records, all scored)")
        return

    print(f"{path.relative_to(ROOT)}: fetching fame for {len(todo)}/{len(people)} records...", flush=True)
    title_to_records = {}
    for p in todo:
        title = wiki_title_for(p)
        if not title:
            continue
        title_to_records.setdefault(title, []).append(p)

    titles = list(title_to_records.keys())
    scored = 0
    retried_batches = 0
    job_start = time.time()
    for i in range(0, len(titles), BATCH_SIZE):
        batch = titles[i:i + BATCH_SIZE]
        start = time.time()
        views = fetch_pageviews_batch(batch)
        batch_elapsed = time.time() - start
        if batch_elapsed > 1.5:
            retried_batches += 1
        for title, count in views.items():
            for rec in title_to_records.get(title, []):
                rec["fame"] = count
                scored += 1
        if batch_elapsed < MIN_SPACING:
            time.sleep(MIN_SPACING - batch_elapsed)
        if (i // BATCH_SIZE) % 10 == 0:
            done = i + len(batch)
            rate = done / max(0.01, time.time() - job_start)
            eta_min = (len(titles) - done) / max(0.01, rate) / 60
            print(f"  ...{done}/{len(titles)} titles, {retried_batches} slow batches so far, ~{eta_min:.1f} min left", flush=True)
        # Checkpoint every 25 batches so a later interruption doesn't lose
        # everything scored so far - this file alone can take several minutes.
        if (i // BATCH_SIZE) % 25 == 24:
            save_progress(path, data, people)

    # Anything we couldn't resolve (redirect, no pageviews prop, etc.) gets 0
    # rather than staying unscored forever.
    for p in todo:
        p.setdefault("fame", 0)

    save_progress(path, data, people)
    print(f"{path.relative_to(ROOT)}: scored {scored} records", flush=True)


def main():
    if len(sys.argv) > 1:
        paths = [Path(a).resolve() for a in sys.argv[1:]]
    else:
        manifest = json.loads((ROOT / "data" / "manifest.json").read_text())
        paths = [ROOT / f["path"] for f in manifest["files"]]

    for path in paths:
        process_file(path)


if __name__ == "__main__":
    main()
