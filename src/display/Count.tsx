import { forwardRef, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { animate, cx, ease, mergeRefs, presets, useIsoLayoutEffect } from '../core';
import { Roll } from './Roll';
import type { DisplayTone } from './types';

export interface CountProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  /** 超过后显示成 “99+”，默认 99 */
  max?: number;
  /** 0 也显示，默认不显示 */
  showZero?: boolean;
  /** accent（默认）、danger，或中性的 neutral */
  tone?: Extract<DisplayTone, 'accent' | 'danger' | 'neutral'>;
  /** 给读屏的完整说法，如 “3 条未读通知”。不传只读出数字 */
  label?: string;
}

/** 计数角标：数字变化时滚动替换，徽标鼓一下（scale 1.35 回弹） */
export const Count = forwardRef<HTMLSpanElement, CountProps>(function Count(
  { value, max = 99, showZero, tone = 'accent', label, className, ...rest }, ref,
) {
  const node = useRef<HTMLSpanElement>(null);
  const last = useRef(value);
  useIsoLayoutEffect(() => {
    if (last.current === value) return;
    last.current = value;
    animate(node.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: presets.bouncy.duration, easing: ease.out });
  }, [value]);
  if (value === 0 && !showZero) return null;
  const text = value > max ? `${max}+` : String(value);
  return (
    <span ref={mergeRefs(ref, node)} className={cx('ok-count', className)} data-tone={tone === 'accent' ? undefined : tone} {...rest}>
      <Roll value={text} direction={value >= last.current ? 1 : -1} aria-hidden={label ? true : undefined} />
      {label && <span className="ok-sr">{label}</span>}
    </span>
  );
});
