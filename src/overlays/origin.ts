import { canUseDOM } from '../core';

/** 视口坐标里的一个点 */
export interface FloatPoint { x: number; y: number }

/**
 * 居中卡片（Dialog、confirm()、CommandPalette）从哪里放大出来：
 * - 'trigger'（默认）：从触发点——点按的位置，或键盘触发时焦点所在元素的中心；取不到（快捷键打开）时用屏幕中心
 * - 'center'：屏幕中心
 * - { x, y }：指定的视口坐标
 */
export type FloatOrigin = FloatPoint | 'trigger' | 'center';

export interface PointerRecord { x: number; y: number; time: number; target: Element | null }

/** 打开前多久之内的指针按下算作“这次打开的触发点” */
export const POINTER_WINDOW_MS = 1000;

/** 指针按下在这些元素上，即使浏览器没把焦点给它（Safari 点按钮不聚焦），也算是“点了触发元素” */
const INTERACTIVE = 'button, a[href], [role="button"], [role="menuitem"], [role="option"], [role="tab"], summary, label, input, select, textarea, [tabindex]';

/** 文字输入的地方：焦点在这里时按的键多半是快捷键，不算触发元素 */
function isTextEntry(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['button', 'submit', 'reset', 'checkbox', 'radio', 'image', 'file', 'color', 'range'].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

export interface ResolveTriggerInput {
  /** 最近一次指针按下 */
  pointer: PointerRecord | null;
  /** 打开前的焦点元素（document.activeElement） */
  active: Element | null;
  now: number;
  viewport: { width: number; height: number };
}

/**
 * 算触发点（纯函数，便于测试）：
 * 1. 约 1 秒内有指针按下，且焦点就在被点的元素上（或焦点没动、被点的是可交互元素）：用指针位置；
 * 2. 否则焦点在页面上一个看得见的元素上（按钮、链接…，键盘触发）：用它的矩形中心；
 * 3. 否则（快捷键：焦点在 body 或输入框里；元素看不见）：屏幕中心。
 */
export function resolveTriggerPoint({ pointer, active, now, viewport }: ResolveTriggerInput): FloatPoint {
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const doc = active?.ownerDocument;
  const blank = !active || active === doc?.body || active === doc?.documentElement;
  if (pointer && pointer.target && now - pointer.time <= POINTER_WINDOW_MS) {
    const t = pointer.target;
    if (!blank && (active === t || active!.contains(t))) return { x: pointer.x, y: pointer.y };
    if (blank && t.closest(INTERACTIVE)) return { x: pointer.x, y: pointer.y };
  }
  if (!blank && !isTextEntry(active!)) {
    const r = active!.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < viewport.width && r.top < viewport.height;
    if (visible) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return center;
}

let lastPointer: PointerRecord | null = null;
let tracking = false;

/** 开始记录指针按下（捕获阶段，全局一次）。FloatingCard 挂载时、confirm() 调用时都会确保它在跑 */
export function trackPointerDown() {
  if (tracking || !canUseDOM) return;
  tracking = true;
  document.addEventListener('pointerdown', (e) => {
    lastPointer = { x: e.clientX, y: e.clientY, time: performance.now(), target: e.target instanceof Element ? e.target : null };
  }, true);
}

/** 按 origin 取此刻的触发点（视口坐标） */
export function captureOrigin(origin: FloatOrigin = 'trigger'): FloatPoint {
  if (typeof origin === 'object') return origin;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  if (origin === 'center') return { x: viewport.width / 2, y: viewport.height / 2 };
  return resolveTriggerPoint({ pointer: lastPointer, active: document.activeElement, now: performance.now(), viewport });
}
