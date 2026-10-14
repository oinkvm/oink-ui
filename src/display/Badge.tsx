import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from '../core';
import type { DisplayTone } from './types';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: DisplayTone;
  /** soft（默认）：柔和底 + 同色相文字；solid：实色底；ink：反色底（如 “Pro”） */
  variant?: 'soft' | 'solid' | 'ink';
  /** 文字前的状态点 */
  dot?: boolean;
  /** 状态点向外扩散（“进行中”）。隐含 dot */
  ping?: boolean;
}

/** 徽标：高 24 的全圆标签。颜色之外请让文字本身说明状态 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', variant = 'soft', dot, ping, className, children, ...rest }, ref,
) {
  return (
    <span
      ref={ref}
      className={cx('ok-badge', tone !== 'neutral' && `ok-badge--${tone}`, variant === 'solid' && 'ok-badge--solid', variant === 'ink' && 'ok-badge--ink', className)}
      {...rest}
    >
      {(dot || ping) && <span className={cx('ok-dot', ping && 'ok-dot--live')} aria-hidden="true" />}
      {children}
    </span>
  );
});
