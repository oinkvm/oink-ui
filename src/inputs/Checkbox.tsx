import { createContext, forwardRef, useContext, useEffect, useRef } from 'react';
import type { CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cx, mergeRefs, useControllable } from '../core';
import { FieldContext, useFieldControl } from './fieldContext';
import { CHECK_D } from './internal';

interface CheckboxGroupContextValue { value: string[]; toggle: (v: string) => void; name?: string; disabled: boolean; invalid: boolean }
const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'checked' | 'defaultChecked' | 'onChange' | 'value'> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** 第一个参数是新的选中状态 */
  onChange?: (checked: boolean) => void;
  /** 半选（“部分选中”），只影响外观和读屏播报，点击后由 onChange 决定去向 */
  indeterminate?: boolean;
  /** 在 CheckboxGroup 里用来标识这一项；单独使用时就是表单提交的值 */
  value?: string;
  /** 标签下的说明文字 */
  description?: ReactNode;
  invalid?: boolean;
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

/**
 * 复选框：真的 input[type=checkbox]。
 * ref 和其余原生属性落在 <input> 上；className / style 落在外层 <label> 上。
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    checked, defaultChecked = false, onChange, indeterminate = false, value, description, invalid: invalidProp, children,
    className, style, rootClassName, rootStyle, id, disabled: disabledProp, required: requiredProp, name, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const group = useContext(CheckboxGroupContext);
  const field = useFieldControl({ id, disabled: disabledProp ?? (group?.disabled || undefined), required: requiredProp, invalid: invalidProp ?? (group?.invalid || undefined), 'aria-describedby': describedByProp });
  const inGroup = !!group && value !== undefined;
  const [own, setOwn] = useControllable(checked, defaultChecked, onChange);
  const isOn = inGroup ? group.value.includes(value) : own;
  const inner = useRef<HTMLInputElement>(null);

  // indeterminate 没有对应的 HTML 属性，只能写 DOM 属性
  useEffect(() => { if (inner.current) inner.current.indeterminate = indeterminate; }, [indeterminate, isOn]);

  return (
    <label
      className={cx('ok-check', rootClassName, className)}
      style={{ ...rootStyle, ...style }}
      data-invalid={field.invalid ? '' : undefined}
      data-described={description != null ? '' : undefined}
    >
      <input
        {...rest}
        ref={mergeRefs(ref, inner)}
        id={field.id}
        type="checkbox"
        name={name ?? group?.name}
        value={value}
        checked={isOn}
        disabled={field.disabled}
        required={field.required || undefined}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        onChange={(e) => {
          if (inGroup) { group.toggle(value); onChange?.(e.target.checked); }
          else setOwn(e.target.checked);
        }}
      />
      <span className="ok-check__box" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path className="ok-check__tick" d={CHECK_D} pathLength={1} /></svg>
        <svg viewBox="0 0 16 16"><path className="ok-check__dash" d="M4 8h8" pathLength={1} /></svg>
      </span>
      {description != null
        ? <span className="ok-check__text"><span>{children}</span><span className="ok-check__desc">{description}</span></span>
        : children}
    </label>
  );
});

export interface CheckboxGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 选中项的 value 列表 */
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** 组内复选框共用的字段名 */
  name?: string;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  invalid?: boolean;
}

const EMPTY: string[] = [];

/** 复选组：role="group"。放进 Field 里会自动用 Field 的标签命名；否则请给 aria-label */
export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(function CheckboxGroup(
  {
    value, defaultValue = EMPTY, onChange, name, orientation = 'vertical', disabled: disabledProp, invalid: invalidProp, className, children,
    id, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, invalid: invalidProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  const toggle = (v: string) => setCurrent(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  return (
    <div
      ref={ref}
      id={field.id}
      role="group"
      className={cx('ok-check-group', orientation === 'horizontal' && 'ok-check-group--horizontal', className)}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid || undefined}
      {...rest}
    >
      {/* 组内的每一项不再各自接 Field（否则会拿到重复的 id） */}
      <FieldContext.Provider value={null}>
        <CheckboxGroupContext.Provider value={{ value: current, toggle, name, disabled: field.disabled, invalid: field.invalid }}>
          {children}
        </CheckboxGroupContext.Provider>
      </FieldContext.Provider>
    </div>
  );
});
