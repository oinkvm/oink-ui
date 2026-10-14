import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CSSProperties, InputHTMLAttributes, KeyboardEvent, PointerEvent } from 'react';
import { Icon, animate, clamp, cx, mergeRefs, useControllable, useLocale } from '../core';
import { useFieldControl } from './fieldContext';
import { decimals } from './internal';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step' | 'type'> {
  value?: number;
  defaultValue?: number;
  /** 第一个参数是新值 */
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  /** 步长，默认 1 */
  step?: number;
  /** PageUp / PageDown 的步长，默认 step × 10 */
  largeStep?: number;
  /** 保留的小数位，默认取步长的小数位 */
  precision?: number;
  /** 显示格式（失焦时），同时用作 aria-valuetext */
  format?: (value: number) => string;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  decrementLabel?: string;
  incrementLabel?: string;
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

const REPEAT_DELAY = 400;
const REPEAT_EVERY = 60;

/**
 * 数字输入（步进器）。键盘 ↑ / ↓ 加减一步，PageUp / PageDown 加减一大步，Home / End 到两端；按住按钮连发。
 * ref 和其余原生属性落在 <input role="spinbutton"> 上；className / style 落在外框上。
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value, defaultValue, onChange, min = -Infinity, max = Infinity, step = 1, largeStep, precision, format, size = 'md', invalid: invalidProp,
    decrementLabel: decrementLabelProp, incrementLabel: incrementLabelProp, className, style, rootClassName, rootStyle,
    id, disabled: disabledProp, required: requiredProp, readOnly, 'aria-describedby': describedByProp, onKeyDown, onBlur, onFocus, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp });
  const { messages: t } = useLocale();
  const decrementLabel = decrementLabelProp ?? t.numberInput.decrement;
  const incrementLabel = incrementLabelProp ?? t.numberInput.increment;
  const digits = precision ?? decimals(step);
  const norm = (v: number) => clamp(+v.toFixed(digits), min, max);
  const [current, setCurrent] = useControllable(value, norm(defaultValue ?? 0), onChange);
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inner = useRef<HTMLInputElement>(null);
  const locked = field.disabled || !!readOnly;

  // 连发期间可能还没重渲染，用 ref 记住最新值
  const latest = useRef(current);
  latest.current = current;
  const apply = useRef(setCurrent);
  apply.current = setCurrent;

  /** 把正在输入的文字落成数值；不是数字就丢弃 */
  const commitDraft = () => {
    if (draft === null) return;
    const n = parseFloat(draft.replace(/,/g, ''));
    setDraft(null);
    if (Number.isFinite(n)) { const v = norm(n); latest.current = v; apply.current(v); }
  };

  const moveTo = (target: number, dir: number) => {
    const next = norm(target);
    const el = inner.current;
    if (next === latest.current) {
      // 到头了：数值朝该方向轻推一下再弹回，表示“不行”
      animate(el, [{ transform: 'translateX(0)' }, { transform: `translateX(${dir * 6}px)` }, { transform: 'translateX(0)' }], { spring: 'bouncy' });
      return false;
    }
    latest.current = next;
    apply.current(next);
    // 数字按方向滚入
    animate(el, [{ transform: `translateY(${dir * 60}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { spring: 'spring' });
    return true;
  };
  const stepBy = (dir: number, amount = step) => moveTo(latest.current + dir * amount, dir);

  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; every?: ReturnType<typeof setInterval> }>({});
  const stopRepeat = () => { clearTimeout(timers.current.delay); clearInterval(timers.current.every); timers.current = {}; };
  useEffect(() => stopRepeat, []);

  // 指针按下立刻走一步，按住 400ms 后每 60ms 连发；随后到来的 click 要跳过（读屏的虚拟点击没有 pointerdown，走 click）
  const byPointer = useRef(false);
  const press = (dir: number) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button || locked) return;
      byPointer.current = true;
      commitDraft();
      stopRepeat();
      if (!stepBy(dir)) return;
      timers.current.delay = setTimeout(() => {
        timers.current.every = setInterval(() => { if (!stepBy(dir)) stopRepeat(); }, REPEAT_EVERY);
      }, REPEAT_DELAY);
    },
    onPointerUp: stopRepeat,
    onPointerCancel: () => { stopRepeat(); byPointer.current = false; },
    onPointerLeave: () => { stopRepeat(); },
    onClick: () => {
      if (byPointer.current) { byPointer.current = false; return; }
      if (locked) return;
      commitDraft();
      stepBy(dir);
    },
  });

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || locked) return;
    const big = largeStep ?? step * 10;
    const act: Record<string, () => void> = {
      ArrowUp: () => stepBy(1),
      ArrowDown: () => stepBy(-1),
      PageUp: () => stepBy(1, big),
      PageDown: () => stepBy(-1, big),
    };
    if (Number.isFinite(min)) act.Home = () => moveTo(min, -1);
    if (Number.isFinite(max)) act.End = () => moveTo(max, 1);
    if (e.key === 'Enter') { commitDraft(); return; }
    const fn = act[e.key];
    if (!fn) return;
    e.preventDefault();
    commitDraft();
    fn();
  };

  const shown = draft ?? (format && !focused ? format(current) : current.toFixed(digits));
  const atMin = current <= min;
  const atMax = current >= max;

  return (
    <div
      className={cx('ok-stepper', size !== 'md' && `ok-stepper--${size}`, rootClassName, className)}
      style={{ ...rootStyle, ...style }}
      data-invalid={field.invalid ? '' : undefined}
      data-disabled={field.disabled ? '' : undefined}
    >
      <button type="button" className="ok-stepper__btn" tabIndex={-1} aria-label={decrementLabel} aria-disabled={atMin || locked} {...press(-1)}>
        <Icon name="minus" />
      </button>
      <input
        {...rest}
        ref={mergeRefs(ref, inner)}
        id={field.id}
        className="ok-stepper__value"
        type="text"
        inputMode={digits > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        role="spinbutton"
        aria-valuenow={current}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={format ? format(current) : undefined}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        aria-required={field.required || undefined}
        value={shown}
        disabled={field.disabled}
        readOnly={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); commitDraft(); onBlur?.(e); }}
        onKeyDown={handleKey}
      />
      <button type="button" className="ok-stepper__btn" tabIndex={-1} aria-label={incrementLabel} aria-disabled={atMax || locked} {...press(1)}>
        <Icon name="plus" />
      </button>
    </div>
  );
});
