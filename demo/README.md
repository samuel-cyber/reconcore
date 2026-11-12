# ReconCore demo video

Fully automated: the screen segments are recorded from the live site with Playwright, the
voiceover is synthesised with edge-tts, and Remotion composites animation, zooms and
burned-in captions into the final MP4.

## Rebuild it

```bash
cd demo
pip install edge-tts
(cd scripts && npm install)
(cd video && npm install)

# 1. backend on :8000 — the live bundle calls localhost, see the note below
(cd ../backend && DB_PATH=/tmp/demo.db \
   CORS_ORIGINS=https://reconcore-app.netlify.app,http://localhost:3000 \
   uvicorn app.main:app --port 8000)

python3 scripts/tts.py                 # audio/*.mp3 + scripts/audio-manifest.json
node scripts/record.mjs                # recordings/s4..s8.mp4 (add names to re-shoot one)
python3 scripts/build_timeline.py      # video/src/timeline.json
cp audio/*.mp3 video/public/audio/ && cp recordings/*.mp4 video/public/clips/
(cd video && npx remotion render ReconCoreDemo ../out/reconcore-demo.mp4)
node scripts/postprocess.mjs           # checks, 720p export, contact sheet
```

## Pieces

| Path | What it is |
| --- | --- |
| `scripts/narration.json` | The nine scenes and their exact voiceover text |
| `scripts/tts.py` | edge-tts (en-NG-AbeoNeural) with per-scene retries, ffprobe measurement |
| `scripts/bridge.mjs` | Routes the live site's API calls to the local backend during recording |
| `scripts/shoot.mjs` | Clip recorder: visible cursor overlay, glided mouse, 60ms/char typing |
| `scripts/scenes.mjs` | The four screen segments; each sets up its own state so it can be re-shot alone |
| `scripts/build_timeline.py` | Scene lengths and caption cues, timed from the measured audio |
| `video/` | Remotion project: animated scenes, push-in zooms, burned-in captions |
| `scripts/postprocess.mjs` | ffprobe checks, 720p export, contact sheet |

## Why the recording bridges the API

The deployed Netlify bundle was built without `NEXT_PUBLIC_API_URL`, so it calls
`http://localhost:8000`, and Chrome's Private Network Access blocks an HTTPS page from
reaching a local address. `bridge.mjs` intercepts those calls in Playwright and fulfils
them from the local backend, so the recording shows the real live site driving real
backend data. Once the frontend is rebuilt against the deployed API URL, delete the
`installApiBridge` call and nothing else changes.
