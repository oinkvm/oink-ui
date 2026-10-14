// 测试环境（jsdom，且 vitest 关掉了 CSS 处理）算不出布局和层叠结果，纯样式的规则只能对着样式源码断言；真实效果另在浏览器里看过。
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync } from 'node:fs';
import { floatMotion, presets } from '../core/motion';

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
      for (const selector of head.split(/,(?![^()]*\))/)) rules.push({ selector: selector.trim(), body, media });
      i = end;
    } else if (ch === '}') { media = null; prelude = ''; } else prelude += ch;
  }
  return rules;
}

const NARROW = '(max-width: 519.98px)';
const inMedia = (rules: Rule[], media: string, selector: string) => rules.filter((r) => r.media === media && r.selector === selector).map((r) => r.body).join(' ');

describe('overlays 样式', () => {
  it('手机宽度：所有停靠方式的卡片都水平居中、撑满（四周仍留缝），忽略 size；进场方向不变', () => {
    const rules = parse(read('floating-card.css'));
    expect(inMedia(rules, NARROW, '.ok-float[data-placement]')).toContain('justify-items: center');
    // align="start" / "end" 在窄屏下同样居中（特指度不低于原来的 align 规则）
    expect(inMedia(rules, NARROW, '.ok-float[data-placement]:not([data-stretch])[data-align]')).toContain('justify-items: center');
    for (const sel of [
      '.ok-float[data-placement] > .ok-float__card',
      '.ok-float[data-placement]:not([data-stretch]) > .ok-float__card',
      '.ok-float[data-placement][data-size="auto"] > .ok-float__card',
    ]) expect(inMedia(rules, NARROW, sel)).toContain('width: 100%');
    // 窄屏块只缩短进场距离，方向不变：左右停靠的仍从原来那一侧滑入（左负右正、上负下正）
    const from = (place: string) => inMedia(rules, NARROW, `.ok-float[data-placement="${place}"]:not([data-zoom]) > .ok-float__card`);
    expect(from('left')).toMatch(/--_from: translateX\(-/);
    expect(from('right')).toMatch(/--_from: translateX\(\d/);
    expect(from('top')).toMatch(/--_from: translateY\(-/);
    expect(from('bottom')).toMatch(/--_from: translateY\(\d/);
    // 窄屏只缩短进场距离，不另写过渡：曲线和时长仍是共用的那一条
    expect(rules.filter((r) => r.media === NARROW).map((r) => r.body).join(' ')).not.toContain('transition');
    // 窄屏块写在左右停靠 / align 规则之后，同特指度时它赢
    const css = read('floating-card.css');
    expect(css.indexOf('@media (max-width: 519.98px) {\n  .ok-float[data-placement]')).toBeGreaterThan(css.indexOf('[data-align="end"] { justify-items: end; }'));
  });

  it('悬浮卡片：所有位置、所有屏宽共用一条进场、一条退场（--ok-float-* 令牌），和脚本的 floatMotion 一致', () => {
    const rules = parse(read('floating-card.css'));
    const IN = 'opacity var(--ok-float-fade-dur) var(--ok-ease-out), transform var(--ok-float-in-dur) var(--ok-float-in-ease)';
    const OUT = 'opacity var(--ok-float-out-dur) var(--ok-float-out-ease), transform var(--ok-float-out-dur) var(--ok-float-out-ease)';
    const body = (sel: string) => rules.filter((r) => r.selector === sel && !r.media).map((r) => r.body).join(' ');
    expect(body('.ok-float__card')).toContain(`transition: ${OUT}`);
    expect(body('.ok-float[data-state="open"] > .ok-float__card')).toContain(`transition: ${IN}`);
    // 卡片的过渡只在这两条规则里：居中、放大进场、贴边、窄屏都不另写
    const cardTransitions = rules.filter((r) => r.selector.includes('.ok-float__card') && /(^|[;\s])transition\s*:/.test(r.body));
    expect(cardTransitions.map((r) => r.selector).sort()).toEqual(['.ok-float[data-state="open"] > .ok-float__card', '.ok-float__card']);
    // 遮罩：进退都是退场那一档时长，退场同一条曲线，和卡片一起走完
    expect(body('.ok-float__scrim')).toContain('opacity var(--ok-float-out-dur) var(--ok-float-out-ease)');
    expect(body('.ok-float[data-state="open"] > .ok-float__scrim')).toContain('opacity var(--ok-float-out-dur) var(--ok-ease-out)');

    // 令牌：进场用 soft 弹簧的曲线（不过冲），时长 = 454ms 的 2/3；退场 = 240ms 的 2/3；全部乘 --ok-ms
    const tokens = read('../styles/tokens.css');
    const token = (name: string) => tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    expect(token('--ok-float-in-dur')).toBe(`calc(${floatMotion.in}ms * var(--ok-ms))`);
    expect(token('--ok-float-fade-dur')).toBe(`calc(${floatMotion.fade}ms * var(--ok-ms))`);
    expect(token('--ok-float-out-dur')).toBe(`calc(${floatMotion.out}ms * var(--ok-ms))`);
    expect(token('--ok-float-in-ease')).toBe('var(--ok-spring-soft)');
    expect(token('--ok-float-out-ease')).toBe('var(--ok-ease-in)');
    expect(floatMotion).toEqual({ in: Math.round(presets.spring.duration * 2 / 3), fade: 100, out: 160 });
  });

  it('命令面板：高亮用共享高亮块，高亮 / 悬停时不改字号字重、不位移；结果项热区用 --ok-h-item', () => {
    const rules = parse(read('command-palette.css'));
    const hl = rules.find((r) => r.selector === '.ok-cmdk__hl' && !r.media)!;
    expect(hl.body).toContain('transform var(--ok-dur-1) var(--ok-ease-out)');
    expect(hl.body).toContain('opacity var(--ok-dur-1) var(--ok-ease-out)');
    expect(rules.some((r) => r.selector === '.ok-cmdk__list[data-hl] > .ok-cmdk__hl' && r.body.includes('opacity: 1'))).toBe(true);
    for (const r of rules.filter((x) => /\[data-active\]|:hover|\[data-hl\]/.test(x.selector))) {
      expect(r.body, r.selector).not.toMatch(/(^|[;\s])(font|font-weight|font-size|transform|translate|scale)\s*:/);
    }
    expect(rules.find((r) => r.selector === '.ok-cmdk__item' && !r.media)!.body).toContain('min-height: max(var(--ok-h-md), var(--ok-h-item))');
  });

  it('Toast：触屏 / 手机宽度下操作和关闭按钮的热区用 --ok-h-item', () => {
    const rules = parse(read('toast.css'));
    for (const media of ['(pointer: coarse)', NARROW]) {
      expect(inMedia(rules, media, '.ok-toast .ok-toast__action')).toContain('--_h: var(--ok-h-item)');
      expect(inMedia(rules, media, '.ok-toast .ok-toast__close')).toContain('--_h: var(--ok-h-item)');
    }
    expect(rules.some((r) => r.selector === '[data-touch] .ok-toast .ok-toast__action' && r.body.includes('--_h: var(--ok-h-item)'))).toBe(true);
  });
});
