import { render } from '@testing-library/react';
import { installCornerFallback, cornerFallbackActive, cornerFallbackNeeded, CORNER_FALLBACK_ATTR } from './cornerFallback';
import { OinkProvider } from './theme';
import * as geometry from './corner';

// jsdom 没有 CSS.supports：每个用例自己决定“内核支不支持 corner-shape”
const g = globalThis as unknown as { CSS?: { supports: (p: string, v?: string) => boolean } };
const realCSS = g.CSS;
function mockSupport(supported: boolean) {
  g.CSS = { supports: vi.fn((p: string) => (p === 'corner-shape' ? supported : true)) };
}

// 记下创建过的观察器，并且让 ResizeObserver 在 observe 时立刻报一个尺寸（jsdom 不排版）
let created: { ro: number; mo: number } = { ro: 0, mo: 0 };
const RealMO = window.MutationObserver;
const RealRO = window.ResizeObserver;
class FakeRO {
  static instances: FakeRO[] = [];
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; created.ro++; FakeRO.instances.push(this); }
  resize(el: Element, width: number, height: number) {
    this.cb([{ target: el, borderBoxSize: [{ inlineSize: width, blockSize: height }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  observe(el: Element) {
    const entry = { target: el, borderBoxSize: [{ inlineSize: 200, blockSize: 80 }], contentRect: { width: 200, height: 80 } } as unknown as ResizeObserverEntry;
    queueMicrotask(() => this.cb([entry], this as unknown as ResizeObserver));
  }
  unobserve() {}
  disconnect() {}
}
class CountingMO extends RealMO { constructor(cb: MutationCallback) { super(cb); created.mo++; } }
// jsdom 不实现伪元素的计算样式：伪元素一律当作没有
const realGCS = window.getComputedStyle;
const gcs = ((el: Element, pseudo?: string | null) => (pseudo ? realGCS(document.createElement('i')) : realGCS(el))) as typeof window.getComputedStyle;
const undos: Array<() => void> = [];
const install = () => { const u = installCornerFallback(); undos.push(u); return u; };

beforeEach(() => {
  created = { ro: 0, mo: 0 };
  FakeRO.instances = [];
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeRO;
  window.MutationObserver = CountingMO;
  window.getComputedStyle = gcs;
});
afterEach(() => {
  undos.splice(0).forEach((u) => u());
  window.getComputedStyle = realGCS;
  g.CSS = realCSS;
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = RealRO;
  window.MutationObserver = RealMO;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

/** 一个声明了 --ok-shape（样式表里和 corner-shape 写在一起的那条）的元素 */
function host(shape = 'superellipse(1.75)') {
  const el = document.createElement('div');
  el.setAttribute('style', `--ok-shape: ${shape}; border-top-left-radius: 24px; border-top-right-radius: 24px; border-bottom-right-radius: 24px; border-bottom-left-radius: 24px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1)`);
  document.body.append(el);
  return el;
}

function transition(el: HTMLElement, propertyName: string, type = 'transitionrun') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, { propertyName: { value: propertyName }, pseudoElement: { value: '' } });
  el.dispatchEvent(event);
}

function nativeFade(el: HTMLElement, from: string, to: string) {
  const animation = {
    transitionProperty: 'box-shadow', currentTime: 16,
    effect: { pseudoElement: '', getKeyframes: () => [{ boxShadow: from, easing: 'linear' }, { boxShadow: to }], getTiming: () => ({ duration: 240, delay: 0, easing: 'ease-out' }) },
  };
  Object.defineProperty(el, 'getAnimations', { configurable: true, value: () => [animation] });
  return animation;
}

describe('超椭圆回退', () => {
  it('颜色过渡预画固定端点；中间帧不重画 SVG，尺寸改变仍重画', async () => {
    mockSupport(false);
    const el = host();
    install();
    await flush();
    const paint = vi.spyOn(geometry, 'cornerPaint');
    const from = 'inset 0 0 0 1px rgba(0, 0, 0, 0.1)';
    const to = 'inset 0 0 0 1px rgb(27, 90, 191)';
    const animation = nativeFade(el, from, to);
    el.style.boxShadow = to;
    transition(el, 'box-shadow');
    await flush();
    await new Promise((r) => requestAnimationFrame(r));
    const resource = el.style.getPropertyValue('--ok-se-paint');
    const svg = decodeURIComponent(resource);
    expect(svg).toContain('@keyframes');
    expect(svg).toContain('mix-blend-mode:plus-lighter');
    expect(svg).toContain('opacity:0');
    expect(svg).toContain('opacity:1');
    expect(svg).toContain('240ms ease-out');
    const count = paint.mock.calls.length;
    expect(count).toBe(2);
    for (let i = 0; i < 8; i++) {
      animation.currentTime += 16;
      // 模拟其它属性或交互要求重读样式，不得把中间颜色重新编码成资源。
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      expect(el.style.getPropertyValue('--ok-se-paint')).toBe(resource);
      expect(paint).toHaveBeenCalledTimes(count);
    }
    FakeRO.instances[0].resize(el, 32, 32);
    expect(paint.mock.calls.length).toBeGreaterThan(count);
    expect(el.style.getPropertyValue('--ok-se-paint')).not.toBe(resource);
  });

  it('交互先于 transitionrun 时也只预画一次；结束时保留已加载的资源', async () => {
    mockSupport(false);
    const el = host();
    install();
    await flush();
    const paint = vi.spyOn(geometry, 'cornerPaint');
    const animation = nativeFade(el, 'inset 0 0 0 1px transparent', 'inset 0 0 0 1px rgb(11, 92, 88)');
    el.style.boxShadow = 'inset 0 0 0 1px rgb(11, 92, 88)';
    await flush();
    const resource = el.style.getPropertyValue('--ok-se-paint');
    expect(decodeURIComponent(resource)).toContain('@keyframes');
    transition(el, 'box-shadow');
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.style.getPropertyValue('--ok-se-paint')).toBe(resource);
    animation.currentTime = 240;
    Object.defineProperty(el, 'getAnimations', { value: () => [] });
    transition(el, 'box-shadow', 'transitionend');
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.style.getPropertyValue('--ok-se-paint')).toBe(resource);
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('原生透明度过渡不触发逐帧补画', async () => {
    mockSupport(false);
    const el = host();
    install();
    await flush();
    const paint = vi.spyOn(geometry, 'cornerPaint');
    const resource = el.style.getPropertyValue('--ok-se-paint');
    transition(el, 'opacity');
    await new Promise((r) => requestAnimationFrame(r));
    transition(el, 'opacity', 'transitionend');
    await new Promise((r) => requestAnimationFrame(r));
    expect(paint).not.toHaveBeenCalled();
    expect(el.style.getPropertyValue('--ok-se-paint')).toBe(resource);
  });

  it('外环淡出期间保留裁切区域；结束后收回裁切并保留已加载的透明终点', async () => {
    mockSupport(false);
    const el = host();
    const from = '0 0 0 4px rgb(17, 91, 211)', to = '0 0 0 4px transparent';
    el.style.boxShadow = from;
    install();
    await flush();
    const clip = el.style.getPropertyValue('--ok-se-clip');
    nativeFade(el, from, to);
    el.style.boxShadow = to;
    transition(el, 'box-shadow');
    await flush();
    expect(el.style.getPropertyValue('--ok-se-clip')).toBe(clip);
    const resource = el.style.getPropertyValue('--ok-se-paint');
    expect(decodeURIComponent(resource)).toContain('@keyframes');
    Object.defineProperty(el, 'getAnimations', { value: () => [] });
    transition(el, 'box-shadow', 'transitionend');
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.style.getPropertyValue('--ok-se-clip')).not.toBe(clip);
    expect(el.style.getPropertyValue('--ok-se-paint')).toBe(resource);
  });

  it('相同几何的重复过渡复用端点；文字颜色不会使无边框的图像失效', async () => {
    mockSupport(false);
    const el = host();
    const from = 'inset 0 0 0 1px transparent', to = 'inset 0 0 0 1px rgb(91, 17, 211)';
    install();
    await flush();
    nativeFade(el, from, to);
    el.style.boxShadow = to;
    transition(el, 'box-shadow');
    await flush();
    const paint = vi.spyOn(geometry, 'cornerPaint');
    const resource = el.style.getPropertyValue('--ok-se-paint');
    el.style.color = 'rgb(21, 76, 34)';
    await flush();
    expect(el.style.getPropertyValue('--ok-se-paint')).toBe(resource);
    Object.defineProperty(el, 'getAnimations', { value: () => [] });
    transition(el, 'box-shadow', 'transitionend');
    await new Promise((r) => requestAnimationFrame(r));
    nativeFade(el, from, to);
    transition(el, 'box-shadow');
    await new Promise((r) => requestAnimationFrame(r));
    expect(paint).not.toHaveBeenCalled();
    // 每次播放仍有独立的时间轴，不能复用已经结束的图像动画。
    expect(el.style.getPropertyValue('--ok-se-paint')).not.toBe(resource);
  });

  it('内核支持 corner-shape 时什么都不做：不建观察器、不改 DOM', async () => {
    mockSupport(true);
    const el = host();
    expect(cornerFallbackNeeded()).toBe(false);
    const undo = install();
    await flush();
    expect(created).toEqual({ ro: 0, mo: 0 });
    expect(document.documentElement.hasAttribute(CORNER_FALLBACK_ATTR)).toBe(false);
    expect(el.hasAttribute('data-ok-se')).toBe(false);
    expect(cornerFallbackActive()).toBe(false);
    undo();
  });

  it('不支持时打开：<html> 换令牌，声明了超椭圆的元素被接管；撤销后全部清理干净', async () => {
    mockSupport(false);
    const el = host();
    const round = host('round');
    const undo = install();
    await flush();
    await flush();
    expect(document.documentElement.hasAttribute(CORNER_FALLBACK_ATTR)).toBe(true);
    expect(created.mo).toBe(1);
    expect(el.getAttribute('data-ok-se')).toBe('on');
    expect(el.style.getPropertyValue('--ok-se-clip')).toMatch(/^path\("M/);
    expect(el.style.getPropertyValue('--ok-se-paint')).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(round.hasAttribute('data-ok-se')).toBe(false);   // 全圆保持原生 border-radius

    undo();
    expect(cornerFallbackActive()).toBe(false);
    expect(document.documentElement.hasAttribute(CORNER_FALLBACK_ATTR)).toBe(false);
    expect(el.hasAttribute('data-ok-se')).toBe(false);
    expect(el.style.getPropertyValue('--ok-se-clip')).toBe('');
    expect(el.style.getPropertyValue('--ok-se-paint')).toBe('');
  });

  it('跟随挂载和卸载：后插入的元素被接管，移走的元素不再被管', async () => {
    mockSupport(false);
    const undo = install();
    await flush();
    const el = host();
    await flush();
    await flush();
    expect(el.getAttribute('data-ok-se')).toBe('on');
    el.remove();
    await flush();
    expect(el.hasAttribute('data-ok-se')).toBe(false);
    undo();
  });

  it('可以重复打开（引用计数），同一个撤销函数调两次也没事', async () => {
    mockSupport(false);
    const a = install();
    const b = install();
    expect(created.mo).toBe(1);
    a();
    a();
    expect(cornerFallbackActive()).toBe(true);
    b();
    expect(cornerFallbackActive()).toBe(false);
  });

  it('OinkProvider 默认打开、卸载时关掉；cornerFallback={false} 不打开', async () => {
    mockSupport(false);
    const { unmount } = render(<OinkProvider><div /></OinkProvider>);
    expect(cornerFallbackActive()).toBe(true);
    unmount();
    expect(cornerFallbackActive()).toBe(false);
    const off = render(<OinkProvider cornerFallback={false}><div /></OinkProvider>);
    expect(cornerFallbackActive()).toBe(false);
    expect(created.mo).toBe(1);
    off.unmount();
  });
});
