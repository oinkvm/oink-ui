import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { clamp, cx } from '../core';
import type { DisplaySize, DisplayTone } from './types';

export interface MeterProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  min?: number;
  max?: number;
  /** 分成几段，默认 10 */
  segments?: number;
  /** 电平的名字（aria-label） */
  label?: string;
  /** 给读屏的数值说法，如 “68%”“3 / 5 格” */
  valueText?: string;
  /** 固定颜色。不传时按 warnAt / dangerAt 自动变色 */
  tone?: Extract<DisplayTone, 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;
  /** 达到这个值的段显示成警告色（峰值表的黄区） */
  warnAt?: number;
  /** 达到这个值的段显示成危险色（峰值表的红区） */
  dangerAt?: number;
  size?: DisplaySize;
}

/** 只读的分段电平（音量、信号、容量、密码强度）。原型里可拖动的 .ok-meter 是输入控件，不在这里 */
export const Meter = forwardRef<HTMLDivElement, MeterProps>(function Meter(
  { value, min = 0, max = 100, segments = 10, label, valueText, tone, warnAt, dangerAt, size = 'md', className, ...rest }, ref,
) {
  const n = Math.max(1, Math.floor(segments));
  const now = clamp(value, min, max);
  const lit = Math.round(((now - min) / (max - min || 1)) * n);
  return (
    <div
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={valueText}
      className={cx('ok-level', size !== 'md' && `ok-level--${size}`, className)}
      data-tone={tone}
      {...rest}
    >
      {Array.from({ length: n }, (_, i) => {
        // 这一段的起点对应的数值
        const at = min + ((max - min) * i) / n;
        const zone = dangerAt != null && at >= dangerAt ? 'danger' : warnAt != null && at >= warnAt ? 'warning' : undefined;
        return <i key={i} className="ok-level__seg" data-on={i < lit ? '' : undefined} data-zone={zone} />;
      })}
    </div>
  );
});
