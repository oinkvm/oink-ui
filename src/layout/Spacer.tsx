import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from '../core';
import { spaceVar } from './responsive';
import type { Space } from './responsive';

export interface SpacerProps extends HTMLAttributes<HTMLDivElement> {
  /** 固定大小（间距档位）。不传则撑满 flex 容器里剩下的空间 */
  size?: Space;
}

/** 弹性空白：放在 flex 容器（Stack / Inline / Toolbar）里把两边推开 */
export const Spacer = forwardRef<HTMLDivElement, SpacerProps>(function Spacer({ size, className, style, ...rest }, ref) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx('ok-spacer', className)}
      style={size !== undefined ? { flex: `0 0 ${spaceVar(size)}`, ...style } : style}
      {...rest}
    />
  );
});
