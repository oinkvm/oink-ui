import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import type { DisplaySize } from './types';

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** 渲染成什么元素，默认 div；用 section 时记得给 aria-label / aria-labelledby */
  as?: ElementType;
  /** 圆角与内边距的档位：sm 32/12、md 44/16（原型）、lg 44/20。内层 Group 自动取同心圆角 */
  size?: DisplaySize;
}

/** 静态面板（原型 .ok-panel）：页面上的一块底，里面放 Group / Card */
export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface({ as = 'div', size = 'md', className, ...rest }, ref) {
  const Comp = as as ElementType;
  return <Comp ref={ref} className={cx('ok-panel', size !== 'md' && `ok-panel--${size}`, className)} {...rest} />;
});
