/**
 * Clip recorder: one Playwright video per storyboard segment.
 *
 * Playwright videos have no cursor, so we inject a soft circle that follows the mouse
 * and pulses on click. Mouse moves are interpolated so the pointer glides rather than
 * teleports, typing runs at a human ~60ms/char, and every meaningful action is followed
 * by a readable pause.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installApiBridge } from './bridge.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS = path.join(HERE, '..', 'recordings');
const FFMPEG = (await import('ffmpeg-static')).default;
const FFPROBE = (await import('ffprobe-static')).default.path;

export const SITE = process.env.SITE ?? 'https://reconcore-app.netlify.app';
const VIEWPORT = { width: 1920, height: 1080 };

const CURSOR = `
(() => {
  if (window.__demoCursor) return;
  window.__demoCursor = true;
  const add = () => {
    const el = document.createElement('div');
    el.id = '__demo-cursor';
    el.innerHTML = '<div class="dot"></div><div class="ring"></div>';
    const css = document.createElement('style');
    css.textContent = \`
      #__demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647;
        pointer-events: none; transform: translate3d(-100px,-100px,0); will-change: transform; }
      #__demo-cursor .dot { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px;
        border-radius: 50%; background: rgba(17,24,39,.92);
        box-shadow: 0 0 0 3px rgba(255,255,255,.92), 0 6px 18px rgba(0,0,0,.35); }
      #__demo-cursor .ring { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px;
        border-radius: 50%; border: 3px solid rgba(16,185,129,.9); opacity: 0; transform: scale(1); }
      #__demo-cursor.click .ring { animation: __demo-pulse 600ms ease-out; }
      @keyframes __demo-pulse {
        0% { opacity: .95; transform: scale(1); }
        100% { opacity: 0; transform: scale(3.6); }
      }
      /* keep the frame clean: Netlify injects its badge as a srcdoc iframe */
      iframe[srcdoc], [class*="netlify-badge"], #netlify-badge { display: none !important; }
    \`;
    document.documentElement.appendChild(css);
    document.documentElement.appendChild(el);
    addEventListener('mousemove', (e) => {
      el.style.transform = \`translate3d(\${e.clientX}px, \${e.clientY}px, 0)\`;
    }, true);
    addEventListener('mousedown', () => {
      el.classList.remove('click'); void el.offsetWidth; el.classList.add('click');
    }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add);
  else add();
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeUi(page) {
  const state = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

  async function glide(x, y, steps = 26) {
    const [x0, y0] = [state.x, state.y];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      await page.mouse.move(x0 + (x - x0) * ease, y0 + (y - y0) * ease);
      await sleep(12);
    }
    state.x = x; state.y = y;
  }

  async function centreOf(locator) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error('no bounding box for target');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  return {
    state,
    glide,
    async moveTo(locator) {
      const { x, y } = await centreOf(locator);
      await glide(x, y);
    },
    async click(locator, { settle = 900 } = {}) {
      const { x, y } = await centreOf(locator);
      await glide(x, y);
      await sleep(180);
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
      await sleep(settle);
    },
    async type(locator, text, { settle = 700 } = {}) {
      const { x, y } = await centreOf(locator);
      await glide(x, y);
      await sleep(150);
      await page.mouse.down(); await sleep(60); await page.mouse.up();
      await locator.focus();
      await page.keyboard.type(text, { delay: 60 });
      await sleep(settle);
    },
    pause: (ms) => sleep(ms),
    async scrollBy(locator, pixels, { steps = 30, stepMs = 28 } = {}) {
      const { x, y } = await centreOf(locator);
      await glide(x, y, 14);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, pixels / steps);
        await sleep(stepMs);
      }
    },
  };
}

function probeDuration(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

/** Record one clip. Returns { file, seconds, errors }. */
export async function shoot(name, fn, { targetSeconds } = {}) {
  const raw = path.join(RECORDINGS, name);
  fs.rmSync(raw, { recursive: true, force: true });
  fs.mkdirSync(raw, { recursive: true });

  const browser = await chromium.launch({ args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: raw, size: VIEWPORT },
    reducedMotion: 'no-preference',
  });
  const errors = [];
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await installApiBridge(page);

  const ui = makeUi(page);
  // Recording starts with the page, so setup can run fast and be trimmed away: a scene
  // calls cut() when the part worth showing begins.
  const t0 = Date.now();
  let cutAt = 0;
  const cut = () => { cutAt = (Date.now() - t0) / 1000; };

  let failure = null;
  try {
    await fn({ page, ui, sleep, cut });
  } catch (err) {
    failure = err;
    errors.push('SCRIPT: ' + err.message.slice(0, 200));
  }

  const video = page.video();
  await context.close();
  await browser.close();
  const webm = await video.path();

  const mp4 = path.join(RECORDINGS, `${name}.mp4`);
  const args = ['-y'];
  if (cutAt) args.push('-ss', cutAt.toFixed(2));
  args.push('-i', webm, '-vf', 'fps=30,scale=1920:1080:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-an');
  if (targetSeconds) args.push('-t', String(targetSeconds));
  args.push(mp4);
  execFileSync(FFMPEG, args, { stdio: 'pipe' });

  const seconds = probeDuration(mp4);
  return { name, file: mp4, seconds, errors, failure, cutAt };
}
