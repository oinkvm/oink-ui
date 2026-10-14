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
