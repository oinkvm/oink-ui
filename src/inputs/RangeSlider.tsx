import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { clamp, cx, mergeRefs, useControllable, useEvent, useLocale } from '../core';
import { useFieldControl } from './fieldContext';
import { dragSession } from './internal';
import { keySteps, snapValue } from './Slider';

export type RangeValue = [number, number];

export interface RangeSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** [下限, 上限] */
  value?: RangeValue;
  /** 默认 [min, max] */
  defaultValue?: RangeValue;
  onChange?: (value: RangeValue) => void;
  /** 一次操作结束时触发：松手，或每次按键之后 */
  onChangeEnd?: (value: RangeValue) => void;
  /** 指针按下开始拖动（任意一个滑块）时传 true，松手（或拖动被打断）时传 false，在 onChangeEnd 之前。
   *  拖动期间根节点带 data-active，被拖的那个滑块也带 data-active；连续型真正移动后根节点还会带 data-tracking */
  onActiveChange?: (active: boolean) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  /** 两个滑块之间至少隔多远，默认 0（可以重合，不能交叉） */
  minDistance?: number;
  bubble?: boolean;
  format?: (value: number) => string;
  digits?: number;
  disabled?: boolean;
  /** 两个滑块各自的可读名称，默认「最小值」「最大值」 */
  thumbLabels?: [string, string];
  /** 表单字段名：会渲染两个同名的隐藏 input */
  name?: string;
}

/** 双滑块：选一个区间。根节点是 role="group"，里面两个 role="slider"，各自可聚焦、可用键盘操作 */
export const RangeSlider = forwardRef<HTMLDivElement, RangeSliderProps>(function RangeSlider(
  {
    value, defaultValue, onChange, onChangeEnd, onActiveChange, min = 0, max = 100, step = 1, minDistance = 0, bubble = true, format, digits, disabled: disabledProp,
    thumbLabels: thumbLabelsProp, name, className, style, id, onPointerDown,
    'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const { messages: t } = useLocale();
  const thumbLabels = thumbLabelsProp ?? t.rangeSlider.thumbs;
  const any = step === 'any';
  const [current, setCurrent] = useControllable<RangeValue>(value, defaultValue ?? [min, max], onChange);
  const lo = snapValue(Math.min(current[0], current[1]), min, max, step);
  const hi = snapValue(Math.max(current[0], current[1]), min, max, step);
  const steps = any ? Infinity : Math.round((max - min) / (step as number));
  const stepped = steps <= 12;
  const places = digits ?? (any ? 0 : undefined);
  const fmt = (v: number) => (format ? format(v) : places == null ? String(v) : v.toFixed(places));

  const root = useRef<HTMLDivElement>(null);
  const thumbs = useRef<Array<HTMLSpanElement | null>>([null, null]);
  const [active, setActive] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const latest = useRef<RangeValue>([lo, hi]);
  latest.current = [lo, hi];

  /** 改其中一个滑块：吸附，并且不越过另一个 */
  const commit = useEvent((index: number, v: number) => {
    const [a, b] = latest.current;
    const s = snapValue(v, min, max, step);
    const next: RangeValue = index === 0 ? [Math.min(s, b - minDistance), b] : [a, Math.max(s, a + minDistance)];
    next[index] = clamp(next[index], min, max);
    if (next[0] === a && next[1] === b) return;
    latest.current = next;
    setCurrent(next);
  });
  const end = useEvent(() => onChangeEnd?.(latest.current));
  const activeChange = useEvent((on: boolean) => onActiveChange?.(on));
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    const node = root.current;
    if (e.defaultPrevented || e.button || field.disabled || !node) return;
    stopDrag.current?.();
    const tw = thumbs.current[0]?.offsetWidth ?? 0;
    const toValue = (clientX: number, grab: number) => {
      const r = node.getBoundingClientRect();
      return min + clamp((clientX - grab - r.left - tw / 2) / (r.width - tw || 1), 0, 1) * (max - min);
    };
    // 按在滑块上就拖那个；按在轨道上就动离得近的那个
    let index = thumbs.current.findIndex((t) => t && t.contains(e.target as Node));
    let grab = 0;
    if (index >= 0) {
      const tr = thumbs.current[index]!.getBoundingClientRect();
      grab = e.clientX - (tr.left + tr.width / 2);
    } else {
      const v = toValue(e.clientX, 0);
      const [a, b] = latest.current;
      index = Math.abs(v - a) <= Math.abs(v - b) ? 0 : 1;
      if (a === b) index = v < a ? 0 : 1;
    }
    const which = index;
    const startX = e.clientX;
    setActive(which);
    activeChange(true);
    thumbs.current[which]?.focus({ preventScroll: true });
    commit(which, toValue(e.clientX, grab));
    stopDrag.current = dragSession(node, e, (ev) => {
      if (!stepped && Math.abs(ev.clientX - startX) > 2) setTracking(true);
      commit(which, toValue(ev.clientX, grab));
    }, () => {
      stopDrag.current = null;
      setActive(null);
      setTracking(false);
      activeChange(false);
      end();
    });
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLSpanElement>) => {
    if (field.disabled) return;
    const { small, big } = keySteps(min, max, step);
    const d = ({ ArrowRight: small, ArrowUp: small, ArrowLeft: -small, ArrowDown: -small, PageUp: big, PageDown: -big } as Record<string, number>)[e.key];
    let next: number;
    if (d) next = latest.current[index] + d;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    commit(index, next);
    end();
  };

  const span = max - min || 1;
  const vals: RangeValue = [lo, hi];

  return (
    <div
      ref={mergeRefs(ref, root)}
      id={field.id}
      role="group"
      className={cx('ok-slider ok-slider--range', className)}
      style={{ '--a': (lo - min) / span, '--b': (hi - min) / span, ...style } as CSSProperties}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      data-disabled={field.disabled ? '' : undefined}
      data-active={active !== null ? '' : undefined}
      data-tracking={tracking ? '' : undefined}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      <span className="ok-slider__track"><span className="ok-slider__fill" /></span>
      {vals.map((v, i) => (
        <span
          key={i}
          ref={(el) => { thumbs.current[i] = el; }}
          className="ok-slider__thumb ok-focusable"
          role="slider"
          tabIndex={field.disabled ? -1 : 0}
          data-index={i}
          data-active={active === i ? '' : undefined}
          aria-label={thumbLabels[i]}
          aria-valuemin={i === 0 ? min : Math.min(max, lo + minDistance)}
          aria-valuemax={i === 0 ? Math.max(min, hi - minDistance) : max}
          aria-valuenow={v}
          aria-valuetext={fmt(v)}
          aria-orientation="horizontal"
          aria-disabled={field.disabled || undefined}
          onKeyDown={(e) => handleKey(i, e)}
        >
          {bubble && <span className="ok-slider__bubble" aria-hidden="true">{fmt(v)}</span>}
        </span>
      ))}
      {name && <><input type="hidden" name={name} value={lo} /><input type="hidden" name={name} value={hi} /></>}
    </div>
  );
});
