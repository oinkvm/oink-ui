import { createContext, forwardRef, useContext, useId } from 'react';
import type { CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cx, useControllable } from '../core';
import { FieldContext, useFieldControl } from './fieldContext';

interface RadioGroupContextValue { value: string | null; select: (v: string) => void; name: string; disabled: boolean; required: boolean }
const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange' | 'value'> {
  /** 这一项的值 */
  value: string;
  /** 不在 RadioGroup 里单独使用时：被选中时触发，参数是这一项的 value */
  onChange?: (value: string) => void;
  /** 标签下的说明文字 */
  description?: ReactNode;
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

/**
 * 单选项：真的 input[type=radio]，通常放在 RadioGroup 里。
 * ref 和其余原生属性落在 <input> 上；className / style 落在外层 <label> 上。
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { value, onChange, description, children, className, style, rootClassName, rootStyle, name, checked, disabled, required, ...rest }, ref,
) {
  const group = useContext(RadioGroupContext);
  return (
    <label className={cx('ok-radio', rootClassName, className)} style={{ ...rootStyle, ...style }} data-described={description != null ? '' : undefined}>
      <input
        {...rest}
        ref={ref}
        type="radio"
        name={name ?? group?.name}
        value={value}
        checked={group ? group.value === value : checked}
        disabled={disabled ?? group?.disabled}
        required={required ?? (group?.required || undefined)}
        onChange={(e) => {
          if (!e.target.checked) return;
          if (group) group.select(value);
          onChange?.(value);
        }}
      />
      <span className="ok-radio__dot" aria-hidden="true" />
      {description != null
        ? <span className="ok-radio__text"><span>{children}</span><span className="ok-radio__desc">{description}</span></span>
        : children}
    </label>
  );
});

export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: string | null;
  defaultValue?: string | null;
  /** 第一个参数是选中项的 value */
  onChange?: (value: string) => void;
  /** 字段名；不传自动生成（同名的原生单选才能用方向键互相移动） */
  name?: string;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
}

/**
 * 单选组：role="radiogroup"。方向键在组内移动并选中 —— 这是同名原生单选的浏览器行为，没有用脚本重做。
 * 放进 Field 里会自动用 Field 的标签命名；否则请给 aria-label。
 */
export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  {
    value, defaultValue = null, onChange, name, orientation = 'vertical', disabled: disabledProp, required: requiredProp, invalid: invalidProp,
    className, children, id, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl(
    { id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel },
    false,
  );
  const auto = `ok-radio-${useId()}`;
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue, onChange as ((v: string | null) => void) | undefined);
  return (
    <div
      ref={ref}
      id={field.id}
      role="radiogroup"
      className={cx('ok-radio-group', orientation === 'horizontal' && 'ok-radio-group--horizontal', className)}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      aria-orientation={orientation}
      aria-required={field.required || undefined}
      aria-invalid={field.invalid || undefined}
      data-invalid={field.invalid ? '' : undefined}
      {...rest}
    >
      <FieldContext.Provider value={null}>
        <RadioGroupContext.Provider value={{ value: current, select: setCurrent, name: name ?? auto, disabled: field.disabled, required: field.required }}>
          {children}
        </RadioGroupContext.Provider>
      </FieldContext.Provider>
    </div>
  );
});
