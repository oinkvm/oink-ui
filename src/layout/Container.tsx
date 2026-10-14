import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** 内容最大宽度档位：sm 560 / md 720 / lg 960（默认）/ xl 1200 / full 不限 */
  size?: ContainerSize;
  /** 左右留白，随视口自适应（16 → 20 → 24 → 32），并避开安全区。默认 true */
  gutter?: boolean;
  /** 水平居中，默认 true */
  center?: boolean;
}

/** 限制内容宽度并留出左右边距 */
export const Container = forwardRef<HTMLElement, ContainerProps>(function Container(
  { as, size = 'lg', gutter = true, center = true, className, ...rest },
  ref,
) {
  const Tag: ElementType = as ?? 'div';
  return <Tag ref={ref} className={cx('ok-container', className)} data-size={size} data-gutter={gutter ? undefined : 'false'} data-center={center ? undefined : 'false'} {...rest} />;
});
