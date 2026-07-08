import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def slug(name):
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def letters_for(name):
    parts = [p for p in name.strip().split(" ") if p]
    first = parts[0][0].upper() if parts else ""
    last = parts[-1][0].upper() if parts else ""
    return {"first": first, "last": last}


def build_records(names, categories):
    seen = set()
    records = []
    for name in names:
        name = " ".join(name.split())
        if not name or len(name.split(" ")) < 2:
            print("SKIP (needs first+last):", name, file=sys.stderr)
            continue
        key = slug(name)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "id": key,
            "name": name,
            "aliases": [],
            "categories": categories,
            "letters": letters_for(name),
            "difficulty": 2,
            "image": None,
            "wiki": None,
        })
    return records


def load_existing(path):
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return data.get("people", data) if isinstance(data, dict) else data


def write_category_file(path, names, categories):
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing(path)
    existing_keys = {slug(p["name"]) for p in existing}

    new_records = build_records(names, categories)
    merged = list(existing)
    added = 0
    for rec in new_records:
        if rec["id"] in existing_keys:
            continue
        merged.append(rec)
        existing_keys.add(rec["id"])
        added += 1

    path.write_text(json.dumps({"people": merged}, indent=2) + "\n")
    print(f"{path.relative_to(ROOT)}: {len(existing)} existing + {added} new = {len(merged)} total")


if __name__ == "__main__":
    from category_data import CATEGORIES

    for label, info in CATEGORIES.items():
        write_category_file(ROOT / info["path"], info["names"], info["categories"])
