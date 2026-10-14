import { forwardRef, useRef } from 'react';
import type { FocusEvent, HTMLAttributes, KeyboardEvent } from 'react';
import { cx, mergeRefs, useIsoLayoutEffect } from '../core';
import { arrowIndex, isTextEntry, rovingItems } from './internal';
import { layoutVars } from './responsive';
import type { Responsive, Space } from './responsive';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** 排列方向，默认 horizontal（← → 移动）；vertical 用 ↑ ↓ */
  orientation?: 'horizontal' | 'vertical';
  /** 子项间距（间距档位），默认 2 */
  gap?: Responsive<Space>;
  /** 方向键走到头后回到另一端，默认 true */
  loop?: boolean;
  /** 放不下时换行（默认是横向滚动）。只对横向工具栏有效 */
  wrap?: boolean;
}

/**
 * 工具栏：role="toolbar"。整条只占一个 Tab 停靠点，方向键 / Home / End 在控件间移动；
 * 放不下时沿主轴原生滚动。记得给 aria-label。
 */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { orientation = 'horizontal', gap, loop = true, wrap = false, className, style, onKeyDown, onFocus, ...rest },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  // roving tabindex：只有当前项能被 Tab 到
  const sync = () => {
    const root = rootRef.current;
    if (!root) return;
    const items = rovingItems(root);
    if (!items.length) return;
    const active = activeRef.current && items.includes(activeRef.current) ? activeRef.current : items[0];
    activeRef.current = active;
    items.forEach((n) => { n.tabIndex = n === active ? 0 : -1; });
  };
  // 子项随时可能增减，每次渲染后都对一遍
  useIsoLayoutEffect(sync);

  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    onFocus?.(e);
    const root = rootRef.current;
    const target = e.target as HTMLElement;
    if (root && target !== root && rovingItems(root).includes(target)) {
      activeRef.current = target;
      sync();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    const root = rootRef.current;
    if (e.defaultPrevented || !root || e.altKey || e.ctrlKey || e.metaKey || isTextEntry(e.target)) return;
    const items = rovingItems(root);
    const index = items.indexOf(e.target as HTMLElement);
    if (index < 0) return;
    const next = arrowIndex(e.key, index, items.length, orientation, loop);
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  };

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      role="toolbar"
      aria-orientation={orientation}
      className={cx('ok-l ok-toolbar', className)}
      data-orientation={orientation}
      data-wrap={wrap && orientation === 'horizontal' ? '' : undefined}
      style={layoutVars({ gap }, style)}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
});
