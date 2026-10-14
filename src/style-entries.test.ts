// 核对按需引入的样式入口：源文件不重不漏；每个入口声明的依赖覆盖了它的组件用到的全部类名。
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync, readdirSync } from 'node:fs';
import { BASE_ENTRY, STYLE_ENTRIES, styleDeps } from './style-entries';
import type { StyleEntry } from './style-entries';

const SRC = decodeURIComponent(new URL(import.meta.url).pathname).replace(/[^/]+$/, '');
const read = (p: string): string => readFileSync(SRC + p, 'utf8');
const GROUPS = ['core', 'styles', 'display', 'inputs', 'layout', 'overlays', 'popups'];
const list = (dir: string): string[] => (readdirSync(SRC + dir) as string[]).map((f) => `${dir}/${f}`);
const ALL = [BASE_ENTRY, ...STYLE_ENTRIES];
const byName = new Map<string, StyleEntry>(ALL.map((x) => [x.name, x]));

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
/** 样式表里出现在选择器中的全部类名 */
function selectorClasses(css: string): Set<string> {
  const out = new Set<string>();
  for (const m of stripComments(css).matchAll(/([^{}]+)\{/g)) {
    if (m[1].trim().startsWith('@')) continue;
    for (const c of m[1].matchAll(/\.(ok-[\w-]+)/g)) out.add(c[1]);
  }
  return out;
}
const CSS_FILES = GROUPS.flatMap(list).filter((f) => f.endsWith('.css') && !f.endsWith('/styles.css'));
const KNOWN = new Set<string>(CSS_FILES.flatMap((f) => [...selectorClasses(read(f))]));

/** 组件模块连同它引入的同库模块（core 除外，core 的样式都在 base 里） */
function moduleClosure(mods: string[]): string[] {
  const seen = new Set<string>();
  const visit = (m: string) => {
    if (seen.has(m)) return;
    seen.add(m);
    const dir = m.replace(/\/[^/]+$/, '');
    for (const imp of read(m).matchAll(/from '(\.\.?\/[^']+)'/g)) {
      const path = (dir + '/' + imp[1]).split('/').reduce<string[]>((acc, seg) => (seg === '..' ? acc.slice(0, -1) : seg === '.' ? acc : [...acc, seg]), []).join('/');
      if (path.startsWith('core')) continue;
      // internal 是各组的小工具集合（Popover 只借了 cloneWithProps，CommandPalette 只借了高亮逻辑，都不渲染菜单的对勾），按文件追会误报，不往里追
      if (path.endsWith('/internal')) continue;
      const file = ['.tsx', '.ts'].map((ext) => path + ext).find((f) => { try { read(f); return true; } catch { return false; } });
      if (file) visit(file);
    }
  };
  mods.forEach(visit);
  return [...seen];
}

describe('按需引入的样式入口', () => {
  it('每个源样式文件恰好属于一个入口；入口名不重复', () => {
    const owned = ALL.flatMap((x) => x.files);
    expect(new Set(owned).size).toBe(owned.length);
    expect([...owned].sort()).toEqual([...CSS_FILES].sort());
    expect(byName.size).toBe(ALL.length);
  });

  it('每个组件文件都归到了某个入口', () => {
    const mods = ALL.flatMap((x) => x.modules);
    const components = GROUPS.flatMap(list).filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && !/\/internal\.tsx$/.test(f));
    for (const c of components) expect(mods, c).toContain(c);
  });

  it('依赖只指向存在的入口，没有循环；被依赖的排在前面', () => {
    for (const x of STYLE_ENTRIES) {
      for (const d of x.deps) expect(byName.has(d), `${x.name} → ${d}`).toBe(true);
      expect(() => styleDeps(x.name)).not.toThrow();
    }
    expect(styleDeps('dialog')).toEqual(['button', 'floating-card']);
    expect(styleDeps('calendar')).toEqual(['button', 'popup', 'popover', 'input']);
  });

  it('组件用到的每个类名，都能在 base + 自己 + 依赖（含间接）的样式里找到', () => {
    const base = new Set<string>(BASE_ENTRY.files.flatMap((f) => [...selectorClasses(read(f))]));
    for (const x of STYLE_ENTRIES) {
      const scope = new Set<string>(base);
      for (const n of [x.name, ...styleDeps(x.name)]) for (const f of byName.get(n)!.files) selectorClasses(read(f)).forEach((c) => scope.add(c));
      for (const m of moduleClosure(x.modules)) {
        const code = stripComments(read(m));
        for (const t of code.matchAll(/(?<![\w-])ok-[a-z0-9_-]+/g)) {
          const cls = t[0].replace(/[-_]+$/, '');
          if (!KNOWN.has(cls)) continue;   // CSS 变量、data 值、动画 id 之类，不是类名
          expect(scope.has(cls), `${x.name}：${m} 用到 .${cls}，但它不在 base、${x.name} 及其依赖里`).toBe(true);
        }
      }
    }
  });

  it('整包 styles.css 引入的正好是全部入口的源文件', () => {
    const files: string[] = [];
    const walk = (p: string) => {
      const dir = p.replace(/[^/]+$/, '');
      for (const m of read(p).matchAll(/@import '([^']+)'/g)) {
        const next = (dir + m[1]).replace(/\/\.\//g, '/').replace(/^\.\//, '');
        if (next.endsWith('/styles.css') || next === 'styles.css') walk(next); else files.push(next);
      }
    };
    walk('styles.css');
    expect([...new Set(files)].sort()).toEqual(ALL.flatMap((x) => x.files).sort());
  });
});
