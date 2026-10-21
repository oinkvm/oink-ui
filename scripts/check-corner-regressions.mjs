/**
 * 在已有 Playwright 安装上运行；截图、逐帧探针和断言结果统一写到仓库外。
 * node scripts/check-corner-regressions.mjs /path/to/playwright/index.mjs /absolute/evidence/directory
 * CORNER_BASELINE_REF 指定修复前提交；PLAYWRIGHT_WEBKIT_MODULE 可指定独立安装的 WebKit 模块。
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
const { chromium, webkit: defaultWebkit } = await import(pathToFileURL(resolve(process.argv[2])).href);
const { webkit } = process.env.PLAYWRIGHT_WEBKIT_MODULE ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_WEBKIT_MODULE)).href) : { webkit: defaultWebkit };
assert.ok(process.argv[3], '请指定仓库外的证据输出目录');
const output = resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const baseline = process.env.CORNER_BASELINE_REF;
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: baseline ? [{
  name: '圆角回归对照', enforce: 'pre', transform(_code, id) {
    const file = ['src/core/corner.ts', 'src/core/cornerFallback.ts', 'src/styles/base.css'].find((f) => id.endsWith('/' + f));
    if (file) return execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
  },
}] : [] });
/** 解码浏览器生成的 RGB / RGBA PNG。 */
function decode(png) {
  let width, height, channels;
  const chunks = [];
  for (let i = 8; i < png.length;) {
    const n = png.readUInt32BE(i), type = png.toString('ascii', i + 4, i + 8), data = png.subarray(i + 8, i + 8 + n);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : 3; }
    if (type === 'IDAT') chunks.push(data);
    i += n + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) for (let x = 0; x < stride; x++) {
    const i = y * stride + x, a = x >= channels ? pixels[i - channels] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= channels ? pixels[i - stride - channels] : 0;
    pixels[i] = raw[y * (stride + 1) + x + 1] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][raw[y * (stride + 1)]];
  }
  return { width, height, channels, pixels };
}
function differences(a, b, region) {
  let count = 0, maxDelta = 0;
  for (let y = region.y; y < region.y + region.h; y++) for (let x = region.x; x < region.x + region.w; x++) {
    const delta = Math.max(...[0, 1, 2].map((c) => Math.abs(a.pixels[(y * a.width + x) * a.channels + c] - b.pixels[(y * b.width + x) * b.channels + c])));
    maxDelta = Math.max(maxDelta, delta);
    // 绝对坐标不同的原生曲线栅格化可相差一个色阶；几何误差不应藏在宽松阈值里。
    if (delta > 1) count++;
  }
  return { diff: count, maxDelta };
}
await server.listen();
const results = [], errors = [];
try {
  for (const [engine, launcher] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 600, height: 220 }, deviceScaleFactor: 2 });
      page.on('pageerror', (error) => errors.push(String(error)));
      const fresh = async (kind) => {
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/scripts/fixtures/corner-regressions.html`);
        await page.waitForFunction(() => window.ready);
        await page.evaluate((kind) => document.querySelectorAll('.tile').forEach((el) => el.className = `tile ${kind}`), kind);
        await page.waitForTimeout(300);
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      };
      for (const scenario of ['dashed', 'dotted', 'pseudo', 'square']) {
        await fresh(scenario);
        const capture = async (id, x) => {
          const png = await page.screenshot({ clip: { x, y: 30, width: 200, height: 120 } });
          await writeFile(resolve(output, `${engine}-${scenario}-${id}.png`), png);
          return decode(png);
        };
        const target = await capture('target', 30), reference = await capture('native', 290);
        const { diff, maxDelta } = differences(target, reference, scenario === 'square' ? { x: 368, y: 0, w: 32, h: 240 } : { x: 0, y: 0, w: 400, h: 240 });
        const active = await page.locator('#target').getAttribute('data-ok-se');
        results.push({ engine, scenario, diff, maxDelta, active, pass: engine === 'chromium' ? active === null : diff === 0 });
      }
      for (const scenario of ['focus', 'fade', 'geometry']) {
        await fresh(scenario);
        await page.evaluate(() => { window.cornerProbe = (async () => {
          const el = document.querySelector('#target'), before = el.style.getPropertyValue('--ok-se-paint');
          // 在捕获阶段安排微任务，检查同一次交互结束后的资源；不让 rAF 掩盖延迟。
          const immediate = new Promise((resolve) => el.addEventListener('focusin', () => queueMicrotask(() => queueMicrotask(() => resolve(el.style.getPropertyValue('--ok-se-paint')))), { once: true }));
          el.focus();
          const first = await immediate, frames = [];
          const events = [];
          el.addEventListener('transitionrun', () => queueMicrotask(() => events.push(el.style.getPropertyValue('--ok-se-paint'))));
          for (let i = 0; i < 20; i++) {
            await new Promise(requestAnimationFrame);
            const cs = getComputedStyle(el);
            frames.push({ shadow: cs.boxShadow, paint: el.style.getPropertyValue('--ok-se-paint'), clip: cs.clipPath });
          }
          return { before, first, frames, events };
        })(); });
        await page.screenshot({ path: resolve(output, `${engine}-${scenario}-first.png`), clip: { x: 30, y: 30, width: 200, height: 120 }, animations: 'allow' });
        const probe = await page.evaluate(() => window.cornerProbe);
        await page.screenshot({ path: resolve(output, `${engine}-${scenario}.png`) });
        const resources = new Set(probe.frames.map((f) => f.paint)).size;
        results.push({ engine, scenario, resources, probe, pass: engine === 'chromium' ? probe.first === '' : scenario === 'geometry' ? probe.events.length > 0 && probe.events.every(Boolean) : probe.first !== '' && probe.first !== probe.before && (scenario !== 'fade' || (decodeURIComponent(probe.first).includes('@keyframes') && resources <= 2)) });
      }
    } finally { await browser.close(); }
  }
} finally {
  await server.close();
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify(results.map(({ probe, ...result }) => result), null, 2));
assert.deepEqual(errors, []);
assert.ok(results.every((r) => r.pass), '圆角回归断言失败');
