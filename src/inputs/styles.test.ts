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

const COARSE = '(pointer: coarse)';
const FILES = [
  'button.css', 'checkbox.css', 'chip.css', 'color-picker.css', 'color-swatches.css', 'field.css', 'fieldset.css', 'file-drop.css', 'form.css', 'hotkey.css', 'input.css',
  'kbd.css', 'label.css', 'meter.css', 'number-input.css', 'option-card.css', 'pin-input.css', 'radio.css', 'rating.css', 'segmented.css', 'slider.css',
  'switch.css', 'textarea.css',
];

describe('inputs 样式', () => {
  it('触屏放大两种写法都生效：@media (pointer: coarse) 里的每条规则都有一条声明相同的 [data-touch] 规则', () => {
    let checked = 0;
    for (const file of FILES) {
      const rules = parse(read(file));
      for (const r of rules.filter((x) => x.media === COARSE)) {
        const twin = rules.find((x) => !x.media && x.selector === `[data-touch] ${r.selector}`);
        expect(twin, `${file}：${r.selector} 缺少 [data-touch] 写法`).toBeDefined();
        expect(twin!.body, `${file}：${r.selector}`).toBe(r.body);
        checked += 1;
      }
    }
    // Chip、Rating、ColorSwatches 都在其中
    expect(checked).toBeGreaterThanOrEqual(10);
    for (const file of ['chip.css', 'rating.css', 'color-swatches.css']) {
      expect(parse(read(file)).some((r) => r.selector.startsWith('[data-touch] '))).toBe(true);
    }
  });

  it('Chip 触屏：视觉高度 36px，热区上下各扩 4px 到 44px；移除按钮 24px，热区四周各扩 10px 到 44px', () => {
    const rules = parse(read('chip.css'));
    expect(value(rules, '[data-touch] .ok-chip', 'height')).toBe('36px');
    expect(value(rules, '[data-touch] button.ok-chip::before', 'inset')).toBe('-4px 0');
    expect(36 + 4 * 2).toBe(44);
    expect(value(rules, '[data-touch] .ok-chip__remove', 'width')).toBe('24px');
    expect(value(rules, '[data-touch] .ok-chip__remove::before', 'inset')).toBe('-10px');
    expect(24 + 10 * 2).toBe(44);
    // 伪元素要相对标签 / 按钮自己定位
    expect(value(rules, '.ok-chip', 'position')).toBe('relative');
    expect(value(rules, '.ok-chip__remove', 'position')).toBe('relative');
  });

  it('色块触屏：圆点不变大，三种尺寸的热区都扩到 44px', () => {
    const rules = parse(read('color-swatches.css'));
    expect(value(rules, '[data-touch] .ok-swatch::before', 'inset')).toBe('var(--ok-swatch-hit)');
    const size = (sel: string) => parseFloat(value(rules, sel, 'width')!);
    const hit = (sel: string) => -parseFloat(value(rules, sel, '--ok-swatch-hit')!);
    expect(size('.ok-swatch') + hit('.ok-swatch') * 2).toBe(44);
    expect(size('.ok-swatches--sm .ok-swatch') + hit('.ok-swatches--sm .ok-swatch') * 2).toBe(44);
    expect(size('.ok-swatches--lg .ok-swatch') + hit('.ok-swatches--lg .ok-swatch') * 2).toBe(44);
    // 相邻色块的热区不互相压住：尺寸 + 间距 ≥ 44
    expect(size('.ok-swatch') + parseFloat(value(rules, '[data-touch] .ok-swatches', 'gap')!)).toBeGreaterThanOrEqual(44);
    expect(size('.ok-swatches--sm .ok-swatch') + parseFloat(value(rules, '[data-touch] .ok-swatches--sm', 'gap')!)).toBeGreaterThanOrEqual(44);
    expect(size('.ok-swatches--lg .ok-swatch') + parseFloat(value(rules, '.ok-swatches', 'gap')!)).toBeGreaterThanOrEqual(44);
  });

  it('Rating 触屏：可点的星放大到 44px，只读的（role="img"）不放大', () => {
    const rules = parse(read('rating.css'));
    const touch = rules.filter((r) => r.media === COARSE || r.selector.startsWith('[data-touch]'));
    expect(touch.length).toBeGreaterThan(0);
    for (const r of touch) expect(r.selector).toContain(':not([data-readonly])');
    expect(value(rules, '[data-touch] .ok-rating:not([data-readonly]) .ok-rating__star', 'width')).toBe('44px');
    expect(value(rules, '[data-touch] .ok-rating:not([data-readonly]) .ok-rating__star', 'height')).toBe('44px');
  });

  it('Slider：flex-basis 是 auto 而不是 0，纵向 flex 容器里保有 32px 的固有高度，横向仍然撑满', () => {
    const rules = parse(read('slider.css'));
    expect(value(rules, '.ok-slider', 'flex')).toBe('1 1 auto');
    expect(value(rules, '.ok-slider', 'height')).toBe('32px');
    expect(value(rules, '.ok-slider', 'min-height')).toBe('32px');
    expect(value(rules, '.ok-slider', 'max-height')).toBe('32px');
  });

  it('Segmented：放不下时原生横向滚动并隐藏滚动条；每项不窄于自己的内容；焦点环收进轨道里', () => {
    const rules = parse(read('segmented.css'));
    expect(value(rules, '.ok-seg', 'overflow-x')).toBe('auto');
    expect(value(rules, '.ok-seg', 'scrollbar-width')).toBe('none');
    expect(value(rules, '.ok-seg::-webkit-scrollbar', 'display')).toBe('none');
    expect(value(rules, '.ok-seg:not(.ok-seg--block) .ok-seg__item', 'min-width')).toBe('max-content');
    // 滑块是滚动容器里的绝对定位子元素，跟着内容一起滚
    expect(value(rules, '.ok-seg', 'position')).toBe('relative');
    expect(value(rules, '.ok-seg__thumb', 'position')).toBe('absolute');
    expect(value(rules, '.ok-seg__item.ok-focusable:focus-visible', 'outline-offset')).toBe('1px');
  });

  it('禁用且未选中的 Checkbox / Radio：不再整体变淡，有底色和原样的描边；禁用且选中才变淡', () => {
    for (const [file, off, on] of [
      ['checkbox.css', '.ok-check input:disabled + .ok-check__box', '.ok-check input:disabled:checked + .ok-check__box'],
      ['radio.css', '.ok-radio input:disabled + .ok-radio__dot', '.ok-radio input:disabled:checked + .ok-radio__dot'],
    ]) {
      const rules = parse(read(file));
      expect(value(rules, off, 'opacity')).toBeUndefined();
      expect(value(rules, off, 'background')).toBe('var(--ok-well)');
      expect(value(rules, off, 'box-shadow')).toBe('inset 0 0 0 1.5px var(--ok-line-2)');
      expect(value(rules, on, 'opacity')).toBe('.5');
      expect(value(rules, on, 'background')).toBe('var(--ok-accent)');
    }
  });

  it('带说明文字的 Checkbox / Radio：勾选框顶对齐（对齐第一行），隐藏的 input 跟着移到顶部', () => {
    for (const [file, root] of [['checkbox.css', '.ok-check'], ['radio.css', '.ok-radio']]) {
      const rules = parse(read(file));
      expect(value(rules, root, 'align-items')).toBe('center');
      expect(value(rules, `${root}[data-described]`, 'align-items')).toBe('flex-start');
      expect(value(rules, `${root}[data-described] input`, 'top')).toBe('0');
    }
  });

  it('OptionCard 示意图：有默认高度、裁切溢出、不被内容撑宽，圆角与卡片同心（卡片圆角 − 内边距）', () => {
    const rules = parse(read('option-card.css'));
    const px = (v: string | undefined) => parseFloat(/(\d+)px/.exec(v ?? '')![1]);
    // 卡片 calc(20px * rk)、内边距 8px → 示意图 (20 − 8) × rk，不小于 4 × rk：内边距也乘 rk，超椭圆转角下四角间距才均匀
    const outer = px(value(rules, '.ok-option', 'border-radius'));
    const pad = px(value(rules, '.ok-option', 'padding'));
    expect(value(rules, '.ok-option', 'border-radius')).toBe(`calc(${outer}px * var(--ok-rk))`);
    expect(value(rules, '.ok-option__art', 'border-radius')).toBe(`max(calc(4px * var(--ok-rk)), calc(${outer}px * var(--ok-rk) - ${pad}px * var(--ok-rk)))`);
    expect(value(rules, '.ok-option__art', 'height')).toBe('var(--ok-option-art-h, 68px)');
    expect(value(rules, '.ok-option__art', 'overflow')).toBe('hidden');
    expect(value(rules, '.ok-option__art', 'min-width')).toBe('0');
    expect(value(rules, '.ok-option__art > :where(svg, img, video, canvas)', 'width')).toBe('100%');
    expect(value(rules, '.ok-option__art > :where(svg, img, video, canvas)', 'height')).toBe('100%');
  });

  it('Switch 文字在前时，文字占掉剩余宽度；Field 里非 block 的 Select 不被拉伸', () => {
    expect(value(parse(read('switch.css')), '.ok-switch[data-label-position="start"] .ok-switch__label', 'flex')).toBe('1 1 auto');
    expect(parse(read('field.css')).some((r) => r.selector.includes('.ok-select:not(.ok-select--block)') && r.body.includes('justify-self: start'))).toBe(true);
  });
});
