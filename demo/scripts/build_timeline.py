#!/usr/bin/env python3
"""Lay out the video timeline: scene lengths, clips and caption cues.

Scene length is the narration plus padding, or the screen recording's own length when
that is longer. Caption text is the written narration, word for word; cues are timed
proportionally across the measured narration audio.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FFPROBE = ROOT / "scripts/node_modules/ffprobe-static/bin/linux/x64/ffprobe"
FPS = 30
PAD = 0.5          # breathing room after the narration
ANIM_EXTRA = 0.5   # a little more air on the animated scenes
MAX_CHARS = 84     # two comfortable lines at 40px


def duration(path: Path) -> float:
    out = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def chunk(text: str) -> list[str]:
    """Split narration into caption cues of at most two short lines."""
    sentences = re.split(r'(?<=[.!?:])\s+', text.strip())
    cues: list[str] = []
    for sentence in sentences:
        if len(sentence) <= MAX_CHARS:
            cues.append(sentence)
            continue
        # too long: break at commas, then at spaces, never after an em dash
        parts = re.split(r'(?<=,)\s+', sentence)
        current = ''
        for part in parts:
            candidate = f"{current} {part}".strip()
            if len(candidate) <= MAX_CHARS or not current:
                current = candidate
            else:
                cues.append(current)
                current = part
        if current:
            cues.append(current)

    # a cue must never dangle on a connector
    tidy: list[str] = []
    for cue in cues:
        if tidy and (tidy[-1].endswith(('—', ',', '-')) or len(tidy[-1]) < 24):
            merged = f"{tidy[-1]} {cue}".strip()
            if len(merged) <= MAX_CHARS * 1.7:
                tidy[-1] = merged
                continue
        tidy.append(cue)
    return [c.strip().rstrip('—').strip() or c for c in tidy]


def main() -> None:
    manifest = json.loads((ROOT / "scripts/audio-manifest.json").read_text())
    clip_seconds = {name: duration(ROOT / f"recordings/{name}.mp4")
                    for name in ("s4", "s5", "s6", "s8")}

    scenes = []
    for scene in manifest["scenes"]:
        sid, narration = scene["id"], scene["narrationSeconds"]
        if scene["kind"] == "screen":
            length = max(narration + PAD, clip_seconds[sid])
        else:
            length = narration + PAD + ANIM_EXTRA

        texts = chunk(scene["text"])
        total_chars = sum(len(t) for t in texts)
        cues, elapsed = [], 0.0
        for text in texts:
            share = narration * (len(text) / total_chars)
            cues.append({"text": text, "from": round(elapsed * FPS),
                         "duration": max(14, round(share * FPS))})
            elapsed += share

        scenes.append({
            "id": sid,
            "kind": scene["kind"],
            "durationInFrames": round(length * FPS),
            "audio": f"audio/{sid}.mp3",
            "narrationSeconds": narration,
            "clip": f"clips/{sid}.mp4" if scene["kind"] == "screen" else None,
            "frameCount": (len(list((ROOT / f"video/public/frames/{sid}").glob("*.jpg")))
                           if scene["kind"] == "screen" else None),
            "captions": cues,
        })

    total_frames = sum(s["durationInFrames"] for s in scenes)
    out = {"fps": FPS, "width": 1920, "height": 1080, "totalFrames": total_frames,
           "totalSeconds": round(total_frames / FPS, 2), "scenes": scenes}
    (ROOT / "video/src/timeline.json").write_text(json.dumps(out, indent=2) + "\n")

    print(f"total {out['totalSeconds']}s "
          f"({int(out['totalSeconds'] // 60)}:{out['totalSeconds'] % 60:05.2f})")
    for s in scenes:
        print(f"  {s['id']:3} {s['kind']:6} {s['durationInFrames'] / FPS:6.2f}s  "
              f"{len(s['captions'])} cues")
        for c in s["captions"]:
            print(f"        {c['from']:5} +{c['duration']:4}  {c['text']}")


if __name__ == "__main__":
    main()
