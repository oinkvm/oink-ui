import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cx, useControllable, useLocale } from '../core';
import { useFieldControl } from './fieldContext';
import { rovingTarget } from './internal';

export interface RatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 当前星数，0 表示未评分。只读时可以是小数（4.6 显示为四颗整星加一颗填了六成的星） */
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** 总星数，默认 5 */
  max?: number;
  /** 再点一次当前的星可以清零，默认开 */
  allowClear?: boolean;
  /** 只读：只展示，不可操作。此时是一张图（role="img"），名称默认「评分：n / max」，可以用 aria-label 整个换掉 */
  readOnly?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** 每颗星的可读名称，默认「n 星」 */
  starLabel?: (n: number) => string;
  /** 表单字段名：会多渲染一个隐藏 input */
  name?: string;
}

/** 星形在 20×20 画布里的左右边界（裁切小数星时按星的实际宽度算，不按画布宽度） */
const STAR_LEFT = 2.9;
const STAR_RIGHT = 17.1;
const STAR = 'M10 2.600l2.200 4.700 5.100.600-3.800 3.500 1 5-4.500-2.500-4.500 2.500 1-5-3.800-3.500 5.100-.600z';

/** 星级评分：role="radiogroup"，每颗星是一个 role="radio"。方向键增减，Home / End 到两端。只读时是一张带名称的图 */
export const Rating = forwardRef<HTMLDivElement, RatingProps>(function Rating(
  {
    value, defaultValue = 0, onChange, max = 5, allowClear = true, readOnly, disabled: disabledProp, size = 'md', starLabel: starLabelProp, name,
    className, id, onKeyDown, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const { messages: t } = useLocale();
  const starLabel = starLabelProp ?? t.rating.star;
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const cls = cx('ok-rating', size !== 'md' && `ok-rating--${size}`, className);
  const star = <svg viewBox="0 0 20 20" aria-hidden="true"><path d={STAR} /></svg>;

  if (readOnly) {
    return (
      <div
        ref={ref}
        id={field.id}
        role="img"
        className={cls}
        data-readonly=""
        aria-label={labelledByProp ? undefined : ariaLabel ?? t.rating.value(current, max)}
        aria-labelledby={labelledByProp}
        aria-describedby={field.describedBy}
        {...rest}
      >
        {stars.map((n) => {
          // 这颗星填了多少：整星走 data-on，零头叠一层裁过的星
          const part = Math.min(1, Math.max(0, current - (n - 1)));
          const partial = part > 0 && part < 1;
          const cut = 100 - ((STAR_LEFT + part * (STAR_RIGHT - STAR_LEFT)) / 20) * 100;
          return (
            <span key={n} className="ok-rating__star" data-on={part >= 1 ? '' : undefined} data-partial={partial ? '' : undefined}>
              {star}
              {partial && (
                <svg className="ok-rating__fill" viewBox="0 0 20 20" aria-hidden="true" style={{ '--ok-rating-cut': `${+cut.toFixed(2)}%` } as CSSProperties}>
                  <path d={STAR} />
                </svg>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      id={field.id}
      role="radiogroup"
      className={cls}
      aria-label={field.labelledBy ? undefined : ariaLabel ?? t.rating.label}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      aria-disabled={field.disabled || undefined}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || field.disabled) return;
        const next = rovingTarget(e, '[role="radio"]');
        if (!next) return;
        next.focus();
        setCurrent(Number(next.dataset.value));
      }}
      {...rest}
    >
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          className="ok-rating__star ok-focusable"
          aria-checked={n === current}
          aria-label={starLabel(n)}
          tabIndex={n === (current || 1) ? 0 : -1}
          disabled={field.disabled}
          data-value={n}
          data-on={n <= current ? '' : undefined}
          onClick={() => setCurrent(allowClear && n === current ? 0 : n)}
        >
          {star}
        </button>
      ))}
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
});
