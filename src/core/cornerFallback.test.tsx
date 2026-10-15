import { render } from '@testing-library/react';
import { installCornerFallback, cornerFallbackActive, cornerFallbackNeeded, CORNER_FALLBACK_ATTR } from './cornerFallback';
import { OinkProvider } from './theme';

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
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; created.ro++; }
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
});

const flush = () => new Promise((r) => setTimeout(r, 0));

/** 一个声明了 --ok-shape（样式表里和 corner-shape 写在一起的那条）的元素 */
function host(shape = 'superellipse(1.75)') {
  const el = document.createElement('div');
  el.setAttribute('style', `--ok-shape: ${shape}; border-top-left-radius: 24px; border-top-right-radius: 24px; border-bottom-right-radius: 24px; border-bottom-left-radius: 24px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1)`);
  document.body.append(el);
  return el;
}

describe('超椭圆回退', () => {
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
