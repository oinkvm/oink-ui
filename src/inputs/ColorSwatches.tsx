import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cx, useControllable } from '../core';
import { useFieldControl } from './fieldContext';
import { rovingTarget } from './internal';

export interface ColorSwatch {
  /** 选中后回传的值 */
  value: string;
  /** 任意 CSS 颜色 */
  color: string;
  /** 颜色的名字（读屏和悬停提示用），必填：不能只靠颜色区分 */
  label: string;
  disabled?: boolean;
}

export interface ColorSwatchesProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  colors: ColorSwatch[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/** 色板单选：role="radiogroup"。方向键移动并选中 */
export const ColorSwatches = forwardRef<HTMLDivElement, ColorSwatchesProps>(function ColorSwatches(
  {
    colors, value, defaultValue = null, onChange, size = 'md', disabled: disabledProp, className, id, onKeyDown,
    'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue, onChange as ((v: string | null) => void) | undefined);
  const tabStop = colors.some((c) => c.value === current) ? current : colors.find((c) => !c.disabled)?.value;
  return (
    <div
      ref={ref}
      id={field.id}
      role="radiogroup"
      className={cx('ok-swatches', size !== 'md' && `ok-swatches--${size}`, className)}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const next = rovingTarget(e, '[role="radio"]');
        if (!next) return;
        next.focus();
        if (next.dataset.value !== undefined) setCurrent(next.dataset.value);
      }}
      {...rest}
    >
      {colors.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          className="ok-swatch ok-focusable"
          style={{ '--c': c.color } as CSSProperties}
          aria-checked={c.value === current}
          aria-label={c.label}
          title={c.label}
          tabIndex={c.value === tabStop ? 0 : -1}
          disabled={field.disabled || c.disabled}
          data-value={c.value}
          onClick={() => setCurrent(c.value)}
        />
      ))}
    </div>
  );
});
