"""Rebuilds dist/NameGame_AI_Engine_2_0.html as a single standalone file that
embeds the current CSS, JS, JSON databases, and audio - so the dist file the
README tells players to open directly always matches the source, instead of
silently going stale (which is what happened: the dist file was from Jun 27
and had none of the fixes made in js/game.js and js/ai.js since).

Run after any change to index.html, css/, js/, data/, or audio/:
    python3 scripts/build_dist.py
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "dist" / "NameGame_AI_Engine_2_0.html"

JS_FILES = [
    "js/state.js",
    "js/rules.js",
    "js/database.js",
    "js/wikipedia.js",
    "js/validator.js",
    "js/ai.js",
    "js/audio.js",
    "js/ui.js",
    "js/engine.js",
    "js/main.js",
]

AUDIO_FILES = [
    "audio/namesubmitted.mp3",
    "audio/reverse.mp3",
    "audio/yourturn.mp3",
    "audio/10secondsremaining.mp3",
]


def build_embedded_data():
    manifest_path = ROOT / "data" / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    embedded = {"data/manifest.json": manifest}
    for f in manifest.get("files", []):
        path = f["path"]
        embedded[path] = json.loads((ROOT / path).read_text())
    return embedded


def main():
    html = (ROOT / "index.html").read_text()

    css = (ROOT / "css" / "style.css").read_text()
    html = html.replace(
        '<link rel="stylesheet" href="css/style.css">',
        f'<style>\n{css}\n</style>',
        1,
    )

    embedded = build_embedded_data()
    embedded_script = (
        '<script>\nwindow.__NAME_GAME_EMBEDDED_DATA__ = '
        + json.dumps(embedded, separators=(",", ":"))
        + ';\n</script>\n'
    )

    for js_path in JS_FILES:
        src = (ROOT / js_path).read_text()
        tag = f'<script src="{js_path}"></script>'
        replacement = f'<script>\n/* {js_path} */\n{src}\n</script>'
        if js_path == "js/database.js":
            replacement = embedded_script + replacement
        if tag not in html:
            raise SystemExit(f"Could not find script tag for {js_path} in index.html")
        html = html.replace(tag, replacement, 1)

    for audio_path in AUDIO_FILES:
        data = (ROOT / audio_path).read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        data_uri = f"data:audio/mpeg;base64,{b64}"
        old_src = f'src="{audio_path}"'
        new_src = f'src="{data_uri}"'
        if old_src not in html:
            raise SystemExit(f"Could not find audio src for {audio_path} in index.html")
        html = html.replace(old_src, new_src, 1)

    OUT_PATH.write_text(html)
    print(f"Wrote {OUT_PATH.relative_to(ROOT)} ({len(html)/1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
