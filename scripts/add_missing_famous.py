"""Adds famous MLB players from js/famous.js that are missing from
data/sports/baseball.json (the original roster scrape lacks a surprising
number of superstars - Cal Ripken Jr., Ken Griffey Jr., Sandy Koufax, etc.).

Matching is normalization-aware (accents, periods, Jr./Sr. suffixes) so
"Ronald Acuna" correctly matches the existing "Ronald Acuña Jr." record
instead of creating a duplicate.

Run: python3 scripts/add_missing_famous.py   (then rebuild dist)
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "sports" / "baseball.json"
FAMOUS_JS = ROOT / "js" / "famous.js"


def norm_key(name):
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace(".", "").strip()
    s = re.sub(r"\s+(jr|sr|ii|iii)$", "", s)
    return re.sub(r"\s+", " ", s)


def load_famous_names():
    src = FAMOUS_JS.read_text()
    body = src.split("= {", 1)[1]
    names = re.findall(r'"([^"]+)"', body)
    return [n for n in names if n != "Baseball"]


def main():
    db = json.loads(DB_PATH.read_text())
    people = db["people"]
    existing = {norm_key(p["name"]) for p in people}

    added = []
    for name in load_famous_names():
        key = norm_key(name)
        if key in existing:
            continue
        existing.add(key)
        parts = name.split(" ")
        people.append({
            "id": re.sub(r"[^a-z0-9]+", "-", key).strip("-"),
            "name": name,
            "aliases": [],
            "categories": ["Any Famous Person", "Athletes", "Baseball"],
            "letters": {"first": parts[0][0].upper(), "last": parts[-1][0].upper()},
            "difficulty": 1,
            "image": None,
            "wiki": None,
            "source": "famous-fill",
        })
        added.append(name)

    db["people"] = people
    db["count"] = len(people)
    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False) + "\n")
    print(f"Added {len(added)} missing famous players ({len(people)} total):")
    for n in added:
        print(" ", n)


if __name__ == "__main__":
    main()
