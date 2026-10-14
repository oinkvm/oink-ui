import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { clamp, cx } from '../core';
import { Roll } from './Roll';
import type { DisplaySize, DisplayTone } from './types';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 当前值；不传（或 null）就是不确定进度 */
  value?: number | null;
  max?: number;
  /** 进度条的名字（aria-label）。没有可见标签时必须给 */
  label?: string;
  /** 条的颜色，默认强调色；到 100% 自动变成成功色 */
  tone?: Extract<DisplayTone, 'accent' | 'success' | 'warning' | 'danger' | 'info'>;
  /** 条的粗细：sm 4、md 8（原型）、lg 12 */
  size?: DisplaySize;
  /** 到 100% 时不要自动变绿 */
  noDoneState?: boolean;
}

/** 进度条：用 soft 弹簧追赶真实进度；不确定时 1.5s 循环 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, max = 100, label, tone = 'accent', size = 'md', noDoneState, className, style, ...rest }, ref,
) {
  const known = value != null;
  const v = known ? clamp(value / (max || 1), 0, 1) : 0;
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? max : undefined}
      aria-valuenow={known ? clamp(value, 0, max) : undefined}
      className={cx('ok-progress', !known && 'ok-progress--indeterminate', size !== 'md' && `ok-progress--${size}`, className)}
      data-tone={tone === 'accent' ? undefined : tone}
      data-done={known && v >= 1 && !noDoneState ? '' : undefined}
      style={{ '--v': v, ...style } as CSSProperties}
      {...rest}
    >
      <div className="ok-progress__bar" />
    </div>
  );
});

export interface ProgressRingProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  label?: string;
  /** 直径：sm 40、md 64（原型）、lg 96，或像素值 */
  size?: DisplaySize | number;
  /** 环的粗细（按 36 的视图坐标），默认 6 */
  thickness?: number;
  /** 中间显示滚动的百分比数字，默认显示（sm 放不下，默认不显示） */
  showValue?: boolean;
  /** 自定义中间的内容，替换百分比 */
  children?: ReactNode;
  noDoneState?: boolean;
}

const RING = { sm: 40, md: 64, lg: 96 } as const;

/** 进度环：描边长度跟着进度走，中间的数字滚动 */
export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(function ProgressRing(
  { value = 0, max = 100, label, size = 'md', thickness = 6, showValue, noDoneState, className, style, children, ...rest }, ref,
) {
  const v = clamp(value / (max || 1), 0, 1);
  const px = typeof size === 'number' ? size : RING[size];
  const show = showValue ?? px >= 56;
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamp(value, 0, max)}
      className={cx('ok-ring', className)}
      data-done={v >= 1 && !noDoneState ? '' : undefined}
      style={{ '--v': v, '--size': `${px}px`, ...style } as CSSProperties}
      {...rest}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true" style={{ strokeWidth: thickness }}>
        <circle className="ok-ring__track" cx="18" cy="18" r="15" />
        <circle className="ok-ring__bar" cx="18" cy="18" r="15" pathLength={100} />
      </svg>
      {children != null ? <span className="ok-ring__label">{children}</span> : show ? <Roll className="ok-ring__label" value={Math.round(v * 100)} aria-hidden="true" /> : null}
    </div>
  );
});
