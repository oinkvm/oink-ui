import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from '../core';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  /** 线的方向，默认 horizontal */
  orientation?: 'horizontal' | 'vertical';
  /** 文字的位置（仅横向带文字时），默认 center */
  labelAlign?: 'start' | 'center' | 'end';
  /** 纯装饰：不暴露给读屏（role="none"） */
  decorative?: boolean;
}

/** 分隔线：横 / 纵，可以带文字 */
export const Divider = forwardRef<HTMLDivElement, DividerProps>(function Divider(
  { orientation = 'horizontal', labelAlign = 'center', decorative, className, children, ...rest },
  ref,
) {
  const hasLabel = children !== undefined && children !== null && children !== false && orientation === 'horizontal';
  return (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={!decorative && orientation === 'vertical' ? 'vertical' : undefined}
      aria-label={!decorative && hasLabel && typeof children === 'string' ? children : undefined}
      className={cx('ok-divider', hasLabel && 'ok-divider--label', className)}
      data-orientation={orientation}
      data-label-align={hasLabel ? labelAlign : undefined}
      {...rest}
    >
      {hasLabel ? <span className="ok-divider__label">{children}</span> : null}
    </div>
  );
});
