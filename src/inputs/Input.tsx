import { forwardRef, useRef, useState } from 'react';
import type { CSSProperties, InputHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Icon, cx, mergeRefs, useControllable, useLocale } from '../core';
import type { IconName } from '../core';
import { useFieldControl } from './fieldContext';
import { guardImeEnter } from '../core/ime';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  /** 第一个参数是新值 */
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  /** 全圆（搜索框用） */
  pill?: boolean;
  /** 撑满容器宽度，默认开；关掉后变成行内宽度 */
  block?: boolean;
  /** 前置图标：聚焦时变强调色并放大 */
  icon?: IconName;
  /** 前缀插槽（图标、单位、文字） */
  prefix?: ReactNode;
  /** 后缀插槽 */
  suffix?: ReactNode;
  /** 有内容时显示清除按钮 */
  clearable?: boolean;
  clearLabel?: string;
  onClear?: () => void;
  /** type="password" 时显示“显示 / 隐藏密码”按钮，默认开 */
  revealable?: boolean;
  /** 校验失败 */
  invalid?: boolean;
  /** 根节点（外框）的类名与样式；className / style 也是给根节点的 */
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

/**
 * 输入框。默认是一块凹槽，聚焦时浮成白色、描边变强调色。
 * ref 和其余原生属性落在里面的 <input> 上；className / style 落在外框上。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value, defaultValue = '', onChange, size = 'md', pill, block = true, icon, prefix, suffix, clearable, clearLabel: clearLabelProp, onClear,
    revealable = true, invalid: invalidProp, type = 'text', className, style, rootClassName, rootStyle,
    id, disabled: disabledProp, required: requiredProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp });
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  const { messages: t } = useLocale();
  const clearLabel = clearLabelProp ?? t.common.clear;
  const [revealed, setRevealed] = useState(false);
  const inner = useRef<HTMLInputElement>(null);
  const isPassword = type === 'password';
  const hasValue = current !== '';

  // 点在外框的空白处也聚焦输入框（不用 <label> 包裹，免得前后缀文字混进可读名称）
  const focusInput = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, button, a, select')) return;
    e.preventDefault();
    inner.current?.focus();
  };

  return (
    <div
      className={cx('ok-input', size !== 'md' && `ok-input--${size}`, pill && 'ok-input--pill', !block && 'ok-input--inline', rootClassName, className)}
      style={{ ...rootStyle, ...style }}
      data-has-value={hasValue ? '' : undefined}
      data-invalid={field.invalid ? '' : undefined}
      data-disabled={field.disabled ? '' : undefined}
      onMouseDown={focusInput}
    >
      {icon && <Icon name={icon} className="ok-input__icon" />}
      {prefix != null && <span className="ok-input__affix">{prefix}</span>}
      <input
        {...rest}
        onKeyDownCapture={event => { if (!guardImeEnter(event)) rest.onKeyDownCapture?.(event); }}
        ref={mergeRefs(ref, inner)}
        id={field.id}
        type={isPassword && revealed ? 'text' : type}
        value={current}
        disabled={field.disabled}
        required={field.required || undefined}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        onChange={(e) => setCurrent(e.target.value)}
      />
      {clearable && (
        <button
          type="button"
          className="ok-input__clear"
          aria-label={clearLabel}
          disabled={!hasValue || field.disabled}
          tabIndex={hasValue ? undefined : -1}
          onClick={() => { setCurrent(''); onClear?.(); inner.current?.focus(); }}
        >
          <Icon name="x" />
        </button>
      )}
      {isPassword && revealable && (
        <button
          type="button"
          className="ok-input__toggle ok-focusable"
          aria-label={t.input.showPassword}
          aria-pressed={revealed}
          disabled={field.disabled}
          onClick={() => setRevealed((v) => !v)}
        >
          <Icon>
            {revealed
              ? <path d="M3 3l14 14M8.3 5.200A7.600 7.600 0 0 1 10 5c4.200 0 6.800 3.600 7.500 5-.3.600-1 1.700-2.100 2.700M12.700 14.400A7 7 0 0 1 10 15c-4.200 0-6.800-3.600-7.500-5 .4-.8 1.400-2.300 3-3.400M8.200 8.300a2.500 2.500 0 0 0 3.500 3.500" />
              : <><path d="M2.500 10C3.200 8.600 5.800 5 10 5s6.800 3.600 7.500 5c-.7 1.400-3.300 5-7.500 5s-6.800-3.600-7.500-5z" /><circle cx="10" cy="10" r="2.500" /></>}
          </Icon>
        </button>
      )}
      {suffix != null && <span className="ok-input__affix">{suffix}</span>}
    </div>
  );
});
