// 减弱动效的完整性：组件动效时长都乘 --ok-ms，减弱时自动归零；
// 但「一直转」的加载循环用的是固定时长（乘 0 会变成 0 秒的死循环），必须各自写减弱规则。这里核对没有漏掉的。
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync, readdirSync } from 'node:fs';

const SRC = decodeURIComponent(new URL(import.meta.url).pathname).replace(/[^/]+$/, '');
const FILES = ['core', 'display', 'inputs', 'layout', 'overlays', 'popups']
  .flatMap((d) => (readdirSync(SRC + d) as string[]).filter((f) => f.endsWith('.css') && f !== 'styles.css').map((f) => `${d}/${f}`));

interface Rule { selector: string; body: string }
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const head = m[1].replace(/^[\s\S]*\{/, '').trim().replace(/\s+/g, ' ');
    if (head.startsWith('@') || /^(from|to|\d)/.test(head)) continue;
    for (const s of head.split(/,(?![^()]*\))/)) out.push({ selector: s.trim(), body: m[2] });
  }
  return out;
}

describe('减弱动效', () => {
  it('每个无限循环的动画都有 data-motion="reduced" 下的替代（描线循环按设计保留）', () => {
    const missing: string[] = [];
    let loops = 0;
    for (const f of FILES) {
      const all = rules(readFileSync(SRC + f, 'utf8'));
      const reduced = all.filter((r) => r.selector.startsWith(':root[data-motion="reduced"]') && /animation/.test(r.body));
      for (const r of all.filter((x) => /animation:[^;]*infinite/.test(x.body) && !x.selector.startsWith(':root'))) {
        if (r.selector.includes('[pathLength')) continue;   // 尾巴的描线：减弱时仍保留，作为「在加载」的提示
        loops += 1;
        const key = [...r.selector.matchAll(/\.(ok-[\w-]+)/g)].map((m) => m[1]);
        const hit = reduced.some((x) => key.every((k) => x.selector.includes(k)));
        if (!hit) missing.push(`${f}：${r.selector}`);
      }
    }
    expect(loops).toBeGreaterThanOrEqual(8);
    expect(missing).toEqual([]);
  });

  it('减弱规则同时写在系统设置（prefers-reduced-motion）里', () => {
    for (const f of FILES) {
      const css = readFileSync(SRC + f, 'utf8');
      if (!css.includes(':root[data-motion="reduced"]')) continue;
      expect(css, f).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    }
  });
});
