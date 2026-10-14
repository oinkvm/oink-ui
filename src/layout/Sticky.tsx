import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import { spaceVar } from './responsive';
import type { Space } from './responsive';

export interface StickyProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** 吸附在滚动容器的哪一边，默认 top */
  edge?: 'top' | 'bottom';
  /**
   * 距离那一边多远，默认 0。数字是间距档位；字符串按 CSS 长度原样使用，
   * 可以写表达式：offset="calc(var(--header-h) + 16px)"
   */
  offset?: Space | string;
}

/** 粘性定位：滚动时吸附在最近的滚动容器边缘 */
export const Sticky = forwardRef<HTMLElement, StickyProps>(function Sticky({ as, edge = 'top', offset = 0, className, style, ...rest }, ref) {
  const Tag: ElementType = as ?? 'div';
  return <Tag ref={ref} className={cx('ok-sticky', className)} data-edge={edge} style={{ [edge]: typeof offset === 'number' ? spaceVar(offset) : offset, ...style }} {...rest} />;
});
