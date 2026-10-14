import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { clamp, useEvent, useIsoLayoutEffect } from '../core';

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Placement = Side | `${Side}-${Align}`;

export interface RectLike { left: number; top: number; right: number; bottom: number; width: number; height: number }
/** 虚拟锚点：没有真实元素时（比如右键菜单的指针位置）给一个矩形 */
export interface VirtualElement { getBoundingClientRect: () => RectLike }
export type PositionAnchor = Element | VirtualElement;

export interface ComputePositionInput {
  anchor: RectLike;
  floating: { width: number; height: number };
  viewport: { width: number; height: number };
  placement?: Placement;
  /** 浮层与锚点的间距 */
  offset?: number;
  /** 沿对齐方向再挪一点（子菜单用它把第一项和触发项对齐） */
  alignOffset?: number;
  /** 与视口边缘保持的距离 */
  padding?: number;
  /** 主轴方向放不下时翻到对面 */
  flip?: boolean;
  /** 交叉轴方向超出视口时平移回来 */
  shift?: boolean;
}
export interface ComputePositionResult {
  x: number; y: number;
  side: Side; align: Align;
  /** 浮层最终可以占用的宽高（超出的部分应在内部滚动） */
  availableWidth: number; availableHeight: number;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
/** 上下都很挤时，浮层至少保留这么高，宁可盖住锚点也不缩成一条缝 */
const MIN_MAIN = 96;

/** 纯函数：算出浮层左上角（视口坐标）、最终朝向与可用空间 */
export function computePosition(input: ComputePositionInput): ComputePositionResult {
  const { anchor: a, floating: f, viewport: v, placement = 'bottom', offset = 8, alignOffset = 0, padding = 8, flip = true, shift = true } = input;
  const parts = placement.split('-') as [Side, Align | undefined];
  let side = parts[0];
  const align: Align = parts[1] ?? 'center';
  const vertical = side === 'top' || side === 'bottom';
  const maxW = Math.max(0, v.width - padding * 2);
  const maxH = Math.max(0, v.height - padding * 2);

  const space: Record<Side, number> = {
    top: a.top - offset - padding,
    bottom: v.height - a.bottom - offset - padding,
    left: a.left - offset - padding,
    right: v.width - a.right - offset - padding,
  };
  const need = vertical ? f.height : f.width;
  if (flip && need > space[side] && space[OPPOSITE[side]] > space[side]) side = OPPOSITE[side];

  let x: number;
  let y: number;
  let w: number;
  let h: number;
  let availableWidth = maxW;
  let availableHeight = maxH;

  if (vertical) {
    availableHeight = Math.min(maxH, Math.max(space[side], MIN_MAIN));
    w = Math.min(f.width, maxW);
    h = Math.min(f.height, availableHeight);
    y = side === 'bottom' ? a.bottom + offset : a.top - offset - h;
    x = (align === 'start' ? a.left : align === 'end' ? a.right - w : a.left + a.width / 2 - w / 2) + alignOffset;
  } else {
    // 左右放不下时不压窄内容，而是让它盖住锚点、整体留在视口里
    w = Math.min(f.width, maxW);
    h = Math.min(f.height, maxH);
    x = side === 'right' ? a.right + offset : a.left - offset - w;
    y = (align === 'start' ? a.top : align === 'end' ? a.bottom - h : a.top + a.height / 2 - h / 2) + alignOffset;
  }
  if (shift) {
    x = clamp(x, padding, Math.max(padding, v.width - padding - w));
    y = clamp(y, padding, Math.max(padding, v.height - padding - h));
  }
  return { x: Math.round(x), y: Math.round(y), side, align, availableWidth, availableHeight };
}

export interface PositionInfo extends ComputePositionResult { anchor: RectLike; width: number; height: number }

export interface UsePositionOptions {
  /** 打开时才计算和监听 */
  open: boolean;
  anchorRef: RefObject<PositionAnchor | null>;
  floatingRef: RefObject<HTMLElement | null>;
  placement?: Placement;
  offset?: number;
  alignOffset?: number;
  padding?: number;
  flip?: boolean;
  shift?: boolean;
  /** true：与锚点等宽；'min'：不窄于锚点 */
  matchWidth?: boolean | 'min';
  /** 每次定位完成后调用 */
  onPosition?: (info: PositionInfo) => void;
}

/**
 * 把 position: fixed 的浮层定位到锚点旁边。
 * 位置直接写到元素的 left / top 上，朝向写到 data-side / data-align，
 * 可用空间写到 --ok-popup-avail-w / --ok-popup-avail-h，由样式决定怎么用（限高、内部滚动）。
 * 随滚动、窗口尺寸、锚点与浮层自身尺寸变化更新，rAF 节流。
 */
export function usePosition(options: UsePositionOptions) {
  const { open, anchorRef, floatingRef, placement = 'bottom', offset = 8, alignOffset = 0, padding = 8, flip = true, shift = true, matchWidth = false } = options;
  const onPosition = useEvent(options.onPosition);
  const frame = useRef(0);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const el = floatingRef.current;
    if (!anchor || !el) return;
    const rect = anchor.getBoundingClientRect();
    const root = document.documentElement;
    const viewport = { width: root.clientWidth || window.innerWidth, height: window.innerHeight || root.clientHeight };

    if (matchWidth === true) el.style.width = rect.width + 'px';
    else if (matchWidth === 'min') el.style.minWidth = rect.width + 'px';

    // 先放开限高量出自然尺寸；量的过程会让内部滚动位置被夹回去，量完还原
    const scrollers = el.style.getPropertyValue('--ok-popup-avail-h')
      ? [el, ...Array.from(el.querySelectorAll<HTMLElement>('.ok-scroll'))].map((n) => [n, n.scrollTop] as const)
      : [];
    el.style.setProperty('--ok-popup-avail-h', '100000px');
    el.style.setProperty('--ok-popup-avail-w', Math.max(0, viewport.width - padding * 2) + 'px');
    const size = { width: el.offsetWidth, height: el.offsetHeight };

    const result = computePosition({ anchor: rect, floating: size, viewport, placement, offset, alignOffset, padding, flip, shift });
    el.style.setProperty('--ok-popup-avail-h', result.availableHeight + 'px');
    el.style.setProperty('--ok-popup-avail-w', result.availableWidth + 'px');
    el.style.left = result.x + 'px';
    el.style.top = result.y + 'px';
    el.dataset.side = result.side;
    el.dataset.align = result.align;
    scrollers.forEach(([n, top]) => { if (n.scrollTop !== top) n.scrollTop = top; });
    onPosition({
      ...result, anchor: rect,
      width: Math.min(size.width, result.availableWidth), height: Math.min(size.height, result.availableHeight),
    });
  }, [anchorRef, floatingRef, placement, offset, alignOffset, padding, flip, shift, matchWidth, onPosition]);

  // 首次定位在绘制之前完成，避免闪一下左上角
  useIsoLayoutEffect(() => { if (open) update(); }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const schedule = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => { frame.current = 0; update(); });
    };
    const onScroll = (e: Event) => {
      // 浮层内部自己的滚动不影响位置
      const el = floatingRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      schedule();
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      const anchor = anchorRef.current;
      if (anchor instanceof Element) ro.observe(anchor);
      if (floatingRef.current) ro.observe(floatingRef.current);
    }
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      ro?.disconnect();
      if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
    };
  }, [open, update, anchorRef, floatingRef]);

  return { update };
}
