import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { canUseDOM } from '../core';

/** 对勾路径（16×16，pathLength=1，配合 stroke-dashoffset 描线） */
export const CHECK_D = 'M3.6 8.4l2.9 2.9 5.9-6.4';
/** 叉号路径（16×16，一笔画完两道，pathLength=1，同样描线）：按钮失败态用 */
export const CROSS_D = 'M4.5 4.5l7 7M11.5 4.5l-7 7';

/**
 * 组内方向键导航（roving tabindex）：返回应该获得焦点的下一个元素，没有可动的就返回 null。
 * 方向键循环，Home / End 跳到两端；跳过禁用项。命中时会 preventDefault。
 */
export function rovingTarget(e: ReactKeyboardEvent<HTMLElement>, selector: string): HTMLElement | null {
  const delta = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
  const edge = e.key === 'Home' ? 'first' : e.key === 'End' ? 'last' : null;
  if (!delta && !edge) return null;
  const list = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector)).filter(
    (n) => !(n as HTMLButtonElement).disabled && n.getAttribute('aria-disabled') !== 'true',
  );
  if (!list.length) return null;
  e.preventDefault();
  if (edge) return edge === 'first' ? list[0] : list[list.length - 1];
  const i = list.indexOf(document.activeElement as HTMLElement);
  return list[(i + delta + list.length) % list.length];
}

/**
 * 一次“按住拖动”的会话（照搬原型 dragSession）。
 * 抬起、取消、再次按下、窗口失焦，或移动时发现按键已松开，都会结束会话。返回主动结束的函数。
 */
export function dragSession(target: HTMLElement, e: { pointerId: number }, onMove: (ev: PointerEvent) => void, onEnd: () => void): () => void {
  if (!canUseDOM) return () => {};
  const id = e.pointerId;
  let live = true;
  const move = (ev: PointerEvent) => {
    if (!live || ev.pointerId !== id) return;
    if (!(ev.buttons & 1)) { stop(); return; }
    onMove(ev);
  };
  function stop() {
    if (!live) return;
    live = false;
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', stop, true);
    document.removeEventListener('pointercancel', stop, true);
    document.removeEventListener('pointerdown', stop, true);
    window.removeEventListener('blur', stop);
    try { target.releasePointerCapture(id); } catch { /* 已经释放 */ }
    onEnd();
  }
  try { target.setPointerCapture(id); } catch { /* 指针已失效时忽略 */ }
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', stop, true);
  document.addEventListener('pointercancel', stop, true);
  document.addEventListener('pointerdown', stop, true);   // 在当前这次按下的捕获阶段之后才注册，不会被它自己触发
  window.addEventListener('blur', stop);
  return stop;
}

/** 步长的小数位数 */
export function decimals(n: number): number {
  const s = String(n);
  if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}
