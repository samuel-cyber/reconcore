/** Shoot the screen clips. `node record.mjs` shoots all; `node record.mjs s5 s8` re-shoots some.
 * A clip with a script failure, a console error or a short runtime is re-shot (3 tries). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shoot } from './shoot.mjs';
import { scenes, TARGETS } from './scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).filter((a) => a in scenes);
const names = only.length ? only : Object.keys(scenes);
const report = [];

for (const name of names) {
  let result = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    result = await shoot(name, scenes[name], { targetSeconds: TARGETS[name] });
    const short = result.seconds < TARGETS[name] - 0.5;
    const bad = result.failure || result.errors.length || short;
    const why = result.failure ? 'script failure'
      : result.errors.length ? `console errors: ${result.errors.slice(0, 2).join(' | ')}`
      : short ? `clip short (${result.seconds.toFixed(1)}s < ${TARGETS[name]}s)` : '';
    console.log(`${name} attempt ${attempt}: ${result.seconds.toFixed(2)}s cut@${result.cutAt.toFixed(1)}s ${bad ? 'RESHOOT — ' + why : 'OK'}`);
    if (!bad) break;
  }
  report.push({ name, seconds: result.seconds, errors: result.errors, ok: !result.failure && !result.errors.length });
}

fs.writeFileSync(path.join(HERE, 'clips.json'), JSON.stringify(report, null, 2) + '\n');
console.log('\n' + report.map((r) => `${r.name}: ${r.seconds.toFixed(2)}s ${r.ok ? 'ok' : 'PROBLEM'}`).join('\n'));
