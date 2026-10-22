/** 使用现有 Playwright 安装验证真实渲染；不向组件库添加测试工具依赖。 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const modulePath = process.argv[2] || 'playwright';
const { webkit: defaultWebkit, chromium } = await import(modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath);
const { webkit } = process.env.PLAYWRIGHT_WEBKIT_MODULE ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_WEBKIT_MODULE)).href) : { webkit: defaultWebkit };
const output = resolve(process.argv[3] || '.claude/ring-evidence/frames');
await mkdir(output, { recursive: true });

/** 只需处理浏览器截图的 8 位 RGB/RGBA PNG；无需增加图像依赖。 */
function decode(png) {
  let width, height, channels;
  const chunks = [];
  for (let i = 8; i < png.length;) {
    const n = png.readUInt32BE(i), type = png.toString('ascii', i + 4, i + 8), data = png.subarray(i + 8, i + 8 + n);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); assert.equal(data[8], 8); channels = data[9] === 6 ? 4 : 3; }
    if (type === 'IDAT') chunks.push(data);
    i += n + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= channels ? pixels[i - channels] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= channels ? pixels[i - stride - channels] : 0;
      pixels[i] = raw[y * (stride + 1) + x + 1] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
    }
  }
  return { width, height, channels, pixels };
}
function chroma(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  return Math.max(0, img.pixels[i + 2] - img.pixels[i]);
}
function cornerScores(img, reference, radius) {
  const scores = [];
  for (const [left, top] of [[true, true], [false, true], [false, false], [true, false]]) {
    let actual = 0, expected = 0;
    for (let y = top ? 0 : img.height - radius; y < (top ? radius : img.height); y++) {
      for (let x = left ? 0 : img.width - radius; x < (left ? radius : img.width); x++) {
        const c = chroma(reference, x, y);
        if (c > 30) { expected += c; actual += chroma(img, x, y); }
      }
    }
    scores.push(expected ? actual / expected : 1);
  }
  let actual = 0, expected = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = Math.floor(img.width * .4); x < img.width * .6; x++) {
      const c = chroma(reference, x, y);
      if (c > 30) { expected += c; actual += chroma(img, x, y); }
    }
  }
  return { corners: scores, straight: expected ? actual / expected : 0 };
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function encode(width, height, pixels) {
  const chunk = (name, data) => { const t = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([size, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function sheet(images) {
  const columns = 5, rows = Math.ceil(images.length / columns), w = images[0].width, h = images[0].height, width = w * columns, height = h * rows, pixels = Buffer.alloc(width * height * 3, 245);
  images.forEach((img, index) => {
    const dx = (index % columns) * w, dy = Math.floor(index / columns) * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) pixels[((dy + y) * width + dx + x) * 3 + c] = img.pixels[(y * w + x) * img.channels + c];
  });
  return encode(width, height, pixels);
}

/** 固定几何上的实色像素作掩码：每帧比较四角与直边的 RGB，不把红色过渡当作消失。 */
function colourMask(reference, inset) {
  const { width: w, height: h } = reference;
  const pixel = (x, y) => [...reference.pixels.subarray((y * w + x) * reference.channels, (y * w + x) * reference.channels + 3)];
  const delta = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
  const y = inset ? 17 : 10;
  const edge = pixel(Math.floor(w / 2), y);
  const straight = Array.from({ length: Math.floor(w / 3) }, (_, i) => [Math.floor(w / 3) + i, y]);
  const corners = [[true, true], [false, true], [false, false], [true, false]].map(([left, top]) => {
    const points = [];
    for (let py = top ? 0 : h - 70; py < (top ? 70 : h); py++) for (let px = left ? 0 : w - 70; px < (left ? 70 : w); px++) {
      if (delta(pixel(px, py), edge) <= 5) points.push([px, py]);
    }
    assert.ok(points.length > 8, '参考帧缺少实色曲线像素');
    return points;
  });
  return [straight, ...corners];
}
function colourMismatch(img, mask) {
  const means = mask.map(points => [0, 1, 2].map(c => points.reduce((sum, [x, y]) => sum + img.pixels[(y * img.width + x) * img.channels + c], 0) / points.length));
  return Math.max(...means.slice(1).flatMap(corner => corner.map((value, c) => Math.abs(value - means[0][c]))));
}

const baseline = process.env.CORNER_BASELINE === '1';
const baselineRef = process.env.CORNER_BASELINE_REF || '6d2fd52';
const server = await createServer({
  plugins: baseline ? [{ name: '圆角回归对照', enforce: 'pre', transform(_code, id) { if (id.endsWith('/src/core/cornerFallback.ts')) return execFileSync('git', ['show', `${baselineRef}:src/core/cornerFallback.ts`], { encoding: 'utf8' }); } }] : [],
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
});
await server.listen();
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}/scripts/fixtures/corner-transition.html`;
const results = [];
try {
  for (const [engine, launcher] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await launcher.launch({ headless: true, ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL } : {}), ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: resolve(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 520, height: 650 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(url);
      await page.locator('#focus-input').waitFor();
      await page.waitForTimeout(300);
      for (const scenario of ['input', 'pin', 'card']) {
        await page.locator('#away').focus();
        await page.locator('#ring-card').evaluate((el) => el.setAttribute('aria-pressed', 'false'));
        await page.waitForTimeout(300);
        const target = page.locator(scenario === 'input' ? '.ok-input' : scenario === 'pin' ? '.ok-pin__cell:first-child' : '#ring-card');
        const rect = await target.boundingBox(), margin = 8;
        const clip = { x: rect.x - margin, y: rect.y - margin, width: rect.width + margin * 2, height: rect.height + margin * 2 };
        // 单个截图不等待动画结束；让浏览器自然推进，记录实际的帧时间与资源。
        await page.evaluate((name) => {
          const el = document.querySelector(name === 'input' ? '.ok-input' : name === 'pin' ? '.ok-pin__cell' : '#ring-card');
          window.samples = [];
          let frames = 0;
          const tick = (time) => {
            const cs = getComputedStyle(el);
            window.samples.push({ time, paint: cs.getPropertyValue('--ok-se-paint'), clip: cs.clipPath, boxShadow: cs.boxShadow });
            if (++frames < 40) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          if (name === 'card') el.setAttribute('aria-pressed', 'true');
          else (name === 'input' ? el.querySelector('input') : el).focus();
        }, scenario);
        const frames = [], times = [];
        const started = Date.now();
        for (let i = 0; i < 20; i++) {
          if (i && process.env.CORNER_CAPTURE_MODE !== 'rapid') await page.evaluate(() => new Promise(requestAnimationFrame));
          times.push(Date.now() - started);
          const png = await page.screenshot({ clip, animations: 'allow', caret: 'hide' });
          await writeFile(resolve(output, `${engine}-${scenario}-${String(i).padStart(2, '0')}.png`), png);
          frames.push(decode(png));
        }
        await page.waitForTimeout(300);
        const final = await page.screenshot({ clip, animations: 'allow', caret: 'hide' });
        await writeFile(resolve(output, `${engine}-${scenario}-final.png`), final);
        const samples = await page.evaluate(() => window.samples.slice());
        // 静止资源作为独立真值，防止动画图像永远不显示角部时被误判为通过。
        const shape = await target.evaluate((el) => getComputedStyle(el).getPropertyValue('--ok-shape'));
        await target.evaluate((el) => { el.style.setProperty('--ok-shape', 'round'); el.setAttribute('data-reference', 'off'); });
        await page.waitForTimeout(50);
        await target.evaluate((el, shape) => { el.style.setProperty('--ok-shape', shape); el.setAttribute('data-reference', 'on'); }, shape);
        await page.waitForTimeout(100);
        const referencePng = await page.screenshot({ clip, animations: 'allow', caret: 'hide' });
        await writeFile(resolve(output, `${engine}-${scenario}-reference.png`), referencePng);
        const reference = decode(referencePng), scores = frames.map((img) => cornerScores(img, reference, scenario === 'pin' ? 52 : scenario === 'input' ? 50 : 72));
        const broken = scores.flatMap((score, index) => score.straight > .12 && score.corners.some((v) => v < score.straight * .6) ? [index] : []);
        const paints = [...new Set(samples.map((s) => s.paint))];
        if (!baseline && engine === 'webkit') assert.ok(paints.length <= 2, '颜色过渡更换了中间资源');
        const fallback = await target.getAttribute('data-ok-se');
        await writeFile(resolve(output, `${engine}-${scenario}-sheet.png`), sheet(frames));
        const result = { engine, scenario, fallback, frames: frames.length, times, broken, scores, paintResources: paints.length, samples, errors };
        results.push(result);
        console.log(JSON.stringify({ engine, scenario, fallback, frames: frames.length, broken, paintResources: paints.length, times: times.slice(0, 8), scores: scores.slice(0, 4), errors }));
      }
      for (const scenario of ['accent', 'invalid']) {
        await page.evaluate(() => {
          window.cornerTransition.setAccent('blue'); window.cornerTransition.setInvalid(false);
          document.querySelector('#ring-card').setAttribute('aria-pressed', 'true');
          document.querySelector('#focus-input').focus();
        });
        await page.waitForTimeout(350);
        const target = page.locator(scenario === 'accent' ? '#ring-card' : '.ok-input');
        const rect = await target.boundingBox();
        const clip = { x: rect.x - 8, y: rect.y - 8, width: rect.width + 16, height: rect.height + 16 };
        const mask = colourMask(decode(await page.screenshot({ clip, animations: 'allow', caret: 'hide' })), scenario === 'invalid');
        const frames = [], scores = [], samples = [];
        for (let i = 0; i < 48; i++) {
          if (i % 8 === 0) await page.evaluate(({ scenario, i }) => {
            if (scenario === 'accent') window.cornerTransition.setAccent(['orange', 'amber', 'blue', 'pink', 'violet', 'blue'][i / 8]);
            else window.cornerTransition.setInvalid(i % 16 === 0);
          }, { scenario, i });
          await page.evaluate(() => new Promise(requestAnimationFrame));
          samples.push(await target.evaluate(el => ({ paint: el.style.getPropertyValue('--ok-se-paint'), shadow: getComputedStyle(el).boxShadow })));
          const png = await page.screenshot({ clip, animations: 'allow', caret: 'hide' });
          await writeFile(resolve(output, `${engine}-${scenario}-${String(i).padStart(2, '0')}.png`), png);
          const img = decode(png); frames.push(img); scores.push(colourMismatch(img, mask));
        }
        const broken = scores.flatMap((score, index) => score > 24 ? [index] : []);
        const result = { engine, scenario, frames: frames.length, broken, scores, paintResources: new Set(samples.map(s => s.paint)).size, samples, errors };
        results.push(result);
        await writeFile(resolve(output, `${engine}-${scenario}-sheet.png`), sheet(frames));
        console.log(JSON.stringify({ engine, scenario, broken, maxColourMismatch: Math.max(...scores), paintResources: result.paintResources }));
        if (!baseline && engine === 'webkit') assert.equal(result.paintResources, 1, '颜色变化替换了 canvas 图像源');
      }
      // 原生 opacity 选中环：首帧起即有固定资源，淡入时无需再生成。
      await page.locator('.ok-option').click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: resolve(output, `${engine}-option-selected.png`), animations: 'allow' });
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  await server.close();
}
if (!baseline) assert.ok(results.every((r) => r.broken.length === 0), '检测到缺角帧');
