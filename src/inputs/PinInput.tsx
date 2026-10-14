import { forwardRef, useRef } from 'react';
import type { ClipboardEvent, HTMLAttributes, KeyboardEvent } from 'react';
import { cx, useControllable, useLocale } from '../core';
import { FieldContext, useFieldControl } from './fieldContext';

export interface PinInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 位数，默认 6 */
  length?: number;
  value?: string;
  defaultValue?: string;
  /** 第一个参数是新值（已输入的字符连成的字符串） */
  onChange?: (value: string) => void;
  /** 输满时触发 */
  onComplete?: (value: string) => void;
  /** numeric 只收数字；alphanumeric 收字母和数字 */
  type?: 'numeric' | 'alphanumeric';
  /** 用圆点遮住内容 */
  mask?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** 挂载后聚焦第一格 */
  autoFocus?: boolean;
  /** 表单字段名：会多渲染一个隐藏 input */
  name?: string;
}

/** 验证码输入：一格一位。支持整段粘贴、短信自动填充、退格回退、方向键移动 */
export const PinInput = forwardRef<HTMLDivElement, PinInputProps>(function PinInput(
  {
    length = 6, value, defaultValue = '', onChange, onComplete, type = 'numeric', mask, size = 'md', disabled: disabledProp, invalid: invalidProp,
    required: requiredProp, autoFocus, name, className, id, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl(
    { id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel },
    false,
  );
  const { messages: t } = useLocale();
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const sanitize = (s: string) => s.replace(type === 'numeric' ? /\D/g : /[^a-zA-Z0-9]/g, '');
  const focus = (i: number) => { const el = cells.current[Math.max(0, Math.min(length - 1, i))]; el?.focus(); el?.select(); };

  const insert = (i: number, text: string) => {
    const ins = sanitize(text);
    if (!ins) return;
    const pos = Math.min(i, current.length);
    const next = (current.slice(0, pos) + ins + current.slice(pos + ins.length)).slice(0, length);
    setCurrent(next);
    focus(pos + ins.length);
    if (next.length === length && next !== current) onComplete?.(next);
  };

  const handleChange = (i: number, raw: string) => {
    const had = current[i] ?? '';
    let clean = sanitize(raw);
    if (!clean) {
      if (had) setCurrent(current.slice(0, i) + current.slice(i + 1));
      return;
    }
    // 在已有字符的格子里又打了一个字：只取新打的那个
    if (had && clean.length === 2) clean = clean.startsWith(had) ? clean.slice(1) : clean.slice(0, 1);
    insert(i, clean);
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !current[i] && i > 0) {
      e.preventDefault();
      setCurrent(current.slice(0, i - 1) + current.slice(i));
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
    else if (e.key === 'Home') { e.preventDefault(); focus(0); }
    else if (e.key === 'End') { e.preventDefault(); focus(Math.min(current.length, length - 1)); }
  };

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    insert(i, e.clipboardData.getData('text'));
  };

  const groupLabel = field.labelledBy ? undefined : ariaLabel ?? t.pinInput.label;

  return (
    <div
      ref={ref}
      role="group"
      className={cx('ok-pin', size === 'sm' && 'ok-pin--sm', className)}
      aria-label={groupLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      data-invalid={field.invalid ? '' : undefined}
      {...rest}
    >
      <FieldContext.Provider value={null}>
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => { cells.current[i] = el; }}
            id={i === 0 ? field.id : undefined}
            className="ok-pin__cell"
            type={mask ? 'password' : 'text'}
            inputMode={type === 'numeric' ? 'numeric' : 'text'}
            pattern={type === 'numeric' ? '[0-9]*' : undefined}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t.pinInput.cell(i + 1, length)}
            aria-invalid={field.invalid || undefined}
            aria-required={field.required || undefined}
            autoFocus={autoFocus && i === 0}
            disabled={field.disabled}
            value={current[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </FieldContext.Provider>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
});
