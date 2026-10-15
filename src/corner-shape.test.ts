// 超椭圆回退靠 --ok-shape 识别元素（不认识 corner-shape 的内核会丢掉那条声明）：每条 corner-shape 旁边都要有一条同值的 --ok-shape
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync, readdirSync } from 'node:fs';

const SRC = decodeURIComponent(new URL(import.meta.url).pathname).replace(/[^/]+$/, '');
const GROUPS = ['core', 'styles', 'display', 'inputs', 'layout', 'overlays', 'popups'];
const files = GROUPS.flatMap((d) => (readdirSync(SRC + d) as string[]).filter((f) => f.endsWith('.css')).map((f) => `${d}/${f}`));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('corner-shape 与 --ok-shape', () => {
  it('每条 corner-shape 声明后面紧跟一条同值的 --ok-shape', () => {
    let count = 0;
    for (const f of files) {
      const css = strip(readFileSync(SRC + f, 'utf8'));
      for (const block of css.matchAll(/\{([^{}]*)\}/g)) {
        const decls = block[1].split(';').map((d) => d.trim()).filter(Boolean);
        decls.forEach((d, i) => {
          const m = /^corner-shape\s*:\s*(.+)$/.exec(d);
          if (!m) return;
          count++;
          expect(decls[i + 1], `${f}：${d}`).toBe(`--ok-shape: ${m[1].trim()}`);
        });
      }
    }
    expect(count).toBeGreaterThan(100);
  });
});
