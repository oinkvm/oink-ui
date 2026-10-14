import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { clamp, cx, mergeRefs, useControllable, useEvent } from '../core';
import { useFieldControl } from './fieldContext';
import { dragSession } from './internal';

export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: number;
  /** 默认取最小值 */
  defaultValue?: number;
  /** 值变化时触发（拖动过程中连续触发） */
  onChange?: (value: number) => void;
  /** 一次操作结束时触发：松手，或每次按键之后 */
  onChangeEnd?: (value: number) => void;
  /** 指针按下开始拖动时传 true，松手（或拖动被打断）时传 false，在 onChangeEnd 之前。
   *  拖动期间根节点带 data-active；连续型滑块真正移动后还会带 data-tracking（这时过渡已关掉，适合让别的元素也跟手） */
  onActiveChange?: (active: boolean) => void;
  min?: number;
  max?: number;
  /** 步长；'any' 为无极，不吸附到任何刻度 */
  step?: number | 'any';
  /** 显示刻度点（只在不超过 12 档时生效）。显示刻度时不显示数值气泡，和原型一致 */
  ticks?: boolean;
  /** 拖动或键盘聚焦时显示数值气泡，默认开 */
  bubble?: boolean;
  /** 数值的显示方式，同时用作 aria-valuetext */
  format?: (value: number) => string;
  /** 显示的小数位；无极滑块默认取整 */
  digits?: number;
  disabled?: boolean;
  /** 表单字段名：会多渲染一个隐藏 input */
  name?: string;
}

/** 把任意数值吸附到合法取值上（供 Slider / RangeSlider 共用） */
export function snapValue(v: number, min: number, max: number, step: number | 'any'): number {
  const s = step === 'any' ? clamp(v, min, max) : clamp(Math.round((v - min) / step) * step + min, min, max);
  return +s.toFixed(6);
}

/** 键盘一次移动的小步与大步 */
export function keySteps(min: number, max: number, step: number | 'any') {
  const small = step === 'any' ? (max - min) / 100 : step;
  return { small, big: Math.max(small, (max - min) / 10) };
}

/** 滑块（单值）。方向键走一步，PageUp / PageDown 走一大步（范围的十分之一），Home / End 到两端 */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    value, defaultValue, onChange, onChangeEnd, onActiveChange, min = 0, max = 100, step = 1, ticks, bubble = true, format, digits, disabled: disabledProp, name,
    className, style, id, onKeyDown, onPointerDown, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const any = step === 'any';
  const snap = (v: number) => snapValue(v, min, max, step);
  const [current, setCurrent] = useControllable(value, snap(defaultValue ?? min), onChange);
  const shown = snap(current);
  const steps = any ? Infinity : Math.round((max - min) / (step as number));
  const stepped = steps <= 12;   // 分档型：始终用弹簧吸附到刻度；连续型：拖动后直接跟手
  const places = digits ?? (any ? 0 : undefined);
  const fmt = (v: number) => (format ? format(v) : places == null ? String(v) : v.toFixed(places));

  const root = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [tracking, setTracking] = useState(false);
  const latest = useRef(shown);
  latest.current = shown;
  const commit = useEvent((v: number) => { const s = snap(v); latest.current = s; setCurrent(s); });
  const end = useEvent(() => onChangeEnd?.(latest.current));
  const activeChange = useEvent((on: boolean) => onActiveChange?.(on));
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    const node = root.current;
    if (e.defaultPrevented || e.button || field.disabled || !node) return;
    stopDrag.current?.();   // 上一次拖动如果没有正常收尾，先清掉
    setActive(true);
    activeChange(true);
    const startX = e.clientX;
    let grab = 0;
    const t = thumb.current;
    if (t && t.contains(e.target as Node)) {
      const tr = t.getBoundingClientRect();
      grab = e.clientX - (tr.left + tr.width / 2);
    }
    const fromPointer = (clientX: number) => {
      const r = node.getBoundingClientRect();
      const tw = t ? t.offsetWidth : 0;
      const p = clamp((clientX - grab - r.left - tw / 2) / (r.width - tw || 1), 0, 1);
      commit(min + p * (max - min));
    };
    fromPointer(e.clientX);
    stopDrag.current = dragSession(node, e, (ev) => {
      if (!stepped && Math.abs(ev.clientX - startX) > 2) setTracking(true);
      fromPointer(ev.clientX);
    }, () => {
      stopDrag.current = null;
      setActive(false);
      setTracking(false);
      activeChange(false);
      end();
    });
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || field.disabled) return;
    const { small, big } = keySteps(min, max, step);
    const d = ({ ArrowRight: small, ArrowUp: small, ArrowLeft: -small, ArrowDown: -small, PageUp: big, PageDown: -big } as Record<string, number>)[e.key];
    let next: number;
    if (d) next = latest.current + d;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    commit(next);
    end();
  };

  const ratio = (shown - min) / (max - min || 1);

  return (
    <div
      ref={mergeRefs(ref, root)}
      id={field.id}
      role="slider"
      tabIndex={field.disabled ? -1 : 0}
      className={cx('ok-slider ok-focusable', className)}
      style={{ '--v': ratio, ...style } as CSSProperties}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={shown}
      aria-valuetext={fmt(shown)}
      aria-orientation="horizontal"
      aria-disabled={field.disabled || undefined}
      data-ticks={ticks && stepped ? '' : undefined}
      data-active={active ? '' : undefined}
      data-tracking={tracking ? '' : undefined}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKey}
      {...rest}
    >
      <span className="ok-slider__track"><span className="ok-slider__fill" /></span>
      {ticks && stepped && (
        <span className="ok-slider__ticks" aria-hidden="true">
          {Array.from({ length: steps + 1 }, (_, i) => <i key={i} style={{ left: `${(i / steps) * 100}%` }} />)}
        </span>
      )}
      <span className="ok-slider__thumb" ref={thumb}>
        {bubble && <span className="ok-slider__bubble" aria-hidden="true">{fmt(shown)}</span>}
      </span>
      {name && <input type="hidden" name={name} value={shown} />}
    </div>
  );
});
