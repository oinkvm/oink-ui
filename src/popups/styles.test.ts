// 测试环境（jsdom，且 vitest 关掉了 CSS 处理）算不出布局和层叠结果，纯样式的修复只能对着样式源码断言；真实效果另在浏览器里看过。
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync } from 'node:fs';

interface Rule { selector: string; body: string; media: string | null }

// 不写 new URL('./x.css', import.meta.url)：vite 会把这种写法当成资源引用改写掉
const DIR = decodeURIComponent(new URL(import.meta.url).pathname).replace(/[^/]+$/, '');
const read = (name: string): string => readFileSync(DIR + name, 'utf8');

/** 把样式表拆成一条条规则（去掉注释；记下它在哪个 @media 里） */
function parse(css: string): Rule[] {
  const rules: Rule[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let media: string | null = null;
  let prelude = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      const head = prelude.trim().replace(/\s+/g, ' ');
      prelude = '';
      if (head.startsWith('@media')) { media = head.slice(6).trim(); continue; }
      const end = src.indexOf('}', i);
      const body = src.slice(i + 1, end).trim().replace(/\s+/g, ' ');
      // 只在最外层的逗号处拆开（:where(a, b) 里面的不算）
      for (const selector of head.split(/,(?![^()]*\))/)) rules.push({ selector: selector.trim(), body, media });
      i = end;
    } else if (ch === '}') { media = null; prelude = ''; } else prelude += ch;
  }
  return rules;
}

/** 某个选择器（不在 @media 里的）全部声明，按出现顺序拼起来 */
const decl = (rules: Rule[], selector: string) => rules.filter((r) => r.selector === selector && !r.media).map((r) => r.body).join(' ');
/** 取某条声明最后一次出现的值（同一选择器后写的盖掉先写的） */
function value(rules: Rule[], selector: string, prop: string): string | undefined {
  const all = [...decl(rules, selector).matchAll(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+)`, 'g'))];
  return all.length ? all[all.length - 1][1].trim() : undefined;
}

describe('popups 样式', () => {
  it('Select：触发框不再写死 min-width，起步宽度由带 max-width: 100% 的占位提供，任何时候都不超出父容器', () => {
    const rules = parse(read('select.css'));
    expect(value(rules, '.ok-select__trigger', 'min-width')).toBe('0');
    expect(value(rules, '.ok-select__trigger', 'max-width')).toBe('100%');
    expect(value(rules, '.ok-select', 'max-width')).toBe('100%');
    expect(value(rules, '.ok-select', 'min-width')).toBe('0');
    expect(value(rules, '.ok-select', '--ok-select-min')).toBe('168px');
    expect(value(rules, '.ok-select::after', 'width')).toBe('var(--ok-select-min)');
    expect(value(rules, '.ok-select::after', 'max-width')).toBe('100%');
    expect(value(rules, '.ok-select[data-size="sm"] .ok-select__trigger', 'min-width')).toBeUndefined();
  });

  it('Select block：撑满容器，文字省略', () => {
    const rules = parse(read('select.css'));
    expect(value(rules, '.ok-select--block', 'width')).toBe('100%');
    expect(value(rules, '.ok-select__value', 'min-width')).toBe('0');
    expect(value(rules, '.ok-select__value', 'text-overflow')).toBe('ellipsis');
    expect(value(rules, '.ok-select__chips', 'min-width')).toBe('0');
  });

  it('菜单：只要有一项带图标，不带图标的项就留出图标列（17px 图标 + 10px 间距 + 10px 内边距）', () => {
    const rules = parse(read('menu.css'));
    expect(value(rules, '.ok-menu:has(.ok-menu__item[data-icon]) .ok-menu__item:not([data-icon])', 'padding-left')).toBe('37px');
    expect(value(rules, '.ok-menu__item .ok-icon', 'width')).toBe('17px');
    expect(value(rules, '.ok-menu__item', 'gap')).toBe('10px');
    expect(value(rules, '.ok-menu__item', 'padding')).toBe('0 10px');
  });
  it('列表项点按热区：菜单项和共享高亮块的高度都用 --ok-h-item（桌面 36，触屏 / 手机宽度 44）', () => {
    const rules = parse(read('menu.css'));
    expect(value(rules, '.ok-menu__item', 'min-height')).toBe('var(--ok-h-item)');
    expect(value(rules, '.ok-menu__hl', 'height')).toBe('var(--ok-h-item)');
  });

  it('单选列表（data-check="instant"）的对勾不描线', () => {
    const rules = parse(read('menu.css'));
    expect(value(rules, '.ok-menu[data-check="instant"] .ok-menu__item .ok-menu__check path', 'transition')).toBe('none');
  });

  it('悬停 / 高亮 / 键盘焦点时不改字号字重、不位移不缩放（文字不跳）', () => {
    for (const file of ['menu.css', 'select.css', 'combobox.css', 'calendar.css', 'popover.css', 'popup.css', 'tooltip.css']) {
      const hovered = parse(read(file)).filter((r) => /:hover|\[data-active\]|\[data-hl\]|:focus-visible|\[data-highlighted\]/.test(r.selector));
      for (const r of hovered) {
        expect(r.body, `${file} ${r.selector}`).not.toMatch(/(^|[;\s])(font|font-weight|font-size|transform|translate|scale)\s*:/);
      }
    }
  });
});
