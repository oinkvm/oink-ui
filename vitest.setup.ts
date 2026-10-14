import '@testing-library/jest-dom/vitest';

// jsdom 没有这些 API：给个最小实现，组件里的动效和响应式逻辑才能跑
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
if (!Element.prototype.animate) {
  Element.prototype.animate = (() => ({
    finished: Promise.resolve(), cancel() {}, finish() {}, play() {}, pause() {},
    addEventListener() {}, removeEventListener() {},
  })) as unknown as typeof Element.prototype.animate;
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

// 组件的 locale 默认跟随浏览器语言（'auto'）。现有测试按中文文案断言，测试环境里把浏览器语言设成中文；
// 英文和自动检测的用例在 src/locale.test.tsx 里自己改
Object.defineProperty(window.navigator, 'languages', { value: ['zh-CN', 'zh'], configurable: true });
Object.defineProperty(window.navigator, 'language', { value: 'zh-CN', configurable: true });
