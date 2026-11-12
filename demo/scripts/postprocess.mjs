/** Quality checks, 720p export and contact sheet for the finished render. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.join(HERE, '..');
const FFMPEG = (await import('ffmpeg-static')).default;
const FFPROBE = (await import('ffprobe-static')).default.path;

const MASTER = path.join(DEMO, 'reconcore-demo.mp4');
const SMALL = path.join(DEMO, 'reconcore-demo-720p.mp4');
const SHEET = path.join(DEMO, 'contact-sheet.jpg');
const SOURCE = path.join(DEMO, 'out', 'reconcore-demo.mp4');

const probe = (file) => JSON.parse(execFileSync(FFPROBE,
  ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }));

function describe(file) {
  const info = probe(file);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  return {
    file,
    seconds: Number(info.format.duration),
    size: `${v.width}x${v.height}`,
    fps: eval(v.r_frame_rate),
    video: v.codec_name,
    audio: a ? `${a.codec_name} ${a.channels}ch ${a.sample_rate}Hz` : 'MISSING',
    megabytes: +(Number(info.format.size) / 1e6).toFixed(1),
  };
}

/** Longest stretch of near-silence, which would read as a dead gap. */
function silenceGaps(file) {
  const out = execFileSync(FFMPEG,
    ['-i', file, '-af', 'silencedetect=noise=-45dB:d=1.5', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] + '' , maxBuffer: 1 << 26 });
  return out;
}

const master = describe(SOURCE);
console.log('master:', master);

const issues = [];
if (master.seconds < 150 || master.seconds > 170) issues.push(`duration ${master.seconds.toFixed(2)}s outside 2:30-2:50`);
if (master.size !== '1920x1080') issues.push(`size ${master.size}`);
if (Math.round(master.fps) !== 30) issues.push(`fps ${master.fps}`);
if (master.audio === 'MISSING') issues.push('no audio stream');
if (master.video !== 'h264') issues.push(`video codec ${master.video}`);

// silence report
let silence = '';
try {
  execFileSync(FFMPEG, ['-hide_banner', '-nostats', '-i', SOURCE, '-af',
    'silencedetect=noise=-45dB:d=1.5', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  silence = String(e.stderr ?? '');
}
if (!silence) {
  const res = execFileSync('/bin/sh', ['-c',
    `"${FFMPEG}" -hide_banner -nostats -i "${SOURCE}" -af silencedetect=noise=-45dB:d=1.5 -f null - 2>&1 || true`],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  silence = res;
}
const gaps = [...silence.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_duration: ([\d.]+)/g)]
  .map((m) => ({ start: +m[1], seconds: +m[2] }));
const longGaps = gaps.filter((g) => g.seconds > 1.5);
console.log('silent gaps > 1.5s:', longGaps.length ? longGaps : '(none)');
if (longGaps.length) issues.push(`${longGaps.length} silent gaps over 1.5s`);

// deliverables
fs.copyFileSync(SOURCE, MASTER);
execFileSync(FFMPEG, ['-y', '-i', SOURCE, '-vf', 'scale=1280:720:flags=lanczos',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', SMALL], { stdio: 'pipe' });

// contact sheet: one frame every 10s
const tiles = Math.ceil(master.seconds / 10);
const cols = 4;
execFileSync(FFMPEG, ['-y', '-i', SOURCE, '-vf',
  `fps=1/10,scale=640:-1,tile=${cols}x${Math.ceil(tiles / cols)}`,
  '-frames:v', '1', '-q:v', '3', SHEET], { stdio: 'pipe' });

console.log('720p   :', describe(SMALL));
console.log('sheet  :', SHEET, `${tiles} frames`);
console.log(issues.length ? `\nISSUES:\n- ${issues.join('\n- ')}` : '\nall checks passed');
