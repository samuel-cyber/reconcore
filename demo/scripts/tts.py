#!/usr/bin/env python3
"""Render one mp3 per scene with edge-tts and measure each with ffprobe."""
from __future__ import annotations

import asyncio, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / "scripts" / "narration.json").read_text())
AUDIO = ROOT / "audio"
FFPROBE = ROOT / "scripts/node_modules/ffprobe-static/bin/linux/x64/ffprobe"

# Spoken forms: the burned-in caption keeps the written text, the voice says it naturally.
SPOKEN = {
    "POS-1042": "P O S one zero four two",
    "WB-3311": "W B three three one one",
    "Open Badges 3.0–style": "Open Badges three point oh style",
    "Ed25519": "E D twenty five five nineteen",
}


def spoken(text: str) -> str:
    for written, say in SPOKEN.items():
        text = text.replace(written, say)
    return text.replace("—", ", ")


def duration(path: Path) -> float:
    out = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


async def say(text: str, voice: str, target: Path) -> None:
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate="-4%")
    await communicate.save(str(target))


async def synth(primary: str, fallback: str) -> dict[str, str]:
    """Per-scene retries: one flaky websocket must not demote the whole track."""
    AUDIO.mkdir(parents=True, exist_ok=True)
    used: dict[str, str] = {}
    for scene in SPEC["scenes"]:
        target = AUDIO / f"{scene['id']}.mp3"
        text = spoken(scene["text"])
        for attempt in range(1, 5):
            voice = primary if attempt <= 3 else fallback
            try:
                await say(text, voice, target)
                if target.stat().st_size < 1024:
                    raise RuntimeError("suspiciously small mp3")
                used[scene["id"]] = voice
                print(f"  {scene['id']}: {duration(target):5.2f}s  {voice}")
                break
            except Exception as exc:
                print(f"  {scene['id']}: attempt {attempt} with {voice} failed ({exc!s:.60})")
                await asyncio.sleep(2 * attempt)
        else:
            raise SystemExit(f"could not synthesise {scene['id']}")
    return used


def main() -> None:
    used = asyncio.run(synth(SPEC["voice"], SPEC["fallbackVoice"]))
    voices = sorted(set(used.values()))
    voice = voices[0] if len(voices) == 1 else "+".join(voices)

    manifest = {"voice": voice, "voicePerScene": used, "scenes": []}
    total = 0.0
    for scene in SPEC["scenes"]:
        d = duration(AUDIO / f"{scene['id']}.mp3")
        total += d
        manifest["scenes"].append({**scene, "audio": f"audio/{scene['id']}.mp3", "narrationSeconds": round(d, 3)})
    manifest["narrationTotalSeconds"] = round(total, 3)
    (ROOT / "scripts" / "audio-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nnarration total: {total:.2f}s")


if __name__ == "__main__":
    main()
