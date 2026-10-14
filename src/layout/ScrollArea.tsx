import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from '../core';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** 允许滚动的方向，默认 vertical */
  direction?: 'vertical' | 'horizontal' | 'both';
  /** 读屏标签（等价于 aria-label）。可滚动区域需要一个名字 */
  label?: string;
  /** 键盘可聚焦（聚焦后用方向键 / 翻页键滚动），默认 true */
  focusable?: boolean;
}

/**
 * 滚动区域：滚动完全是原生的，这里只套 .ok-scroll 的外观、限定方向，
 * 并让它能被键盘聚焦（没有可聚焦子元素时，键盘用户也滚得动）。
 * 高度 / 最大高度由外层布局或 style 决定。
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { direction = 'vertical', label, focusable = true, className, role, tabIndex, ...rest },
  ref,
) {
  const named = Boolean(label ?? rest['aria-label'] ?? rest['aria-labelledby']);
  return (
    <div
      ref={ref}
      role={role ?? (named ? 'region' : 'group')}
      aria-label={label}
      tabIndex={tabIndex ?? (focusable ? 0 : undefined)}
      className={cx('ok-scroll ok-scroll-area', className)}
      data-direction={direction}
      {...rest}
    />
  );
});
