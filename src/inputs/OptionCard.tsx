import { createContext, forwardRef, useContext } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx, useControllable } from '../core';
import { FieldContext, useFieldControl } from './fieldContext';
import { CHECK_D, rovingTarget } from './internal';

interface OptionGroupContextValue { values: string[]; multiple: boolean; pick: (v: string) => void; disabled: boolean; tabStop: string | undefined }
const OptionGroupContext = createContext<OptionGroupContextValue | null>(null);

export interface OptionCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> {
  value: string;
  /** 卡片上半部分的示意图 */
  art?: ReactNode;
  /** 标题下的说明 */
  description?: ReactNode;
  /** 不在 OptionCardGroup 里单独使用时的选中状态 */
  checked?: boolean;
  /** 单独使用时：点击后触发，参数是新的选中状态 */
  onChange?: (checked: boolean) => void;
}

/** 选项卡片。children 是标题。放在 OptionCardGroup 里：单选时是 role="radio"，多选时是 role="checkbox" */
export const OptionCard = forwardRef<HTMLButtonElement, OptionCardProps>(function OptionCard(
  { value, art, description, checked, onChange, disabled, className, children, onClick, ...rest }, ref,
) {
  const group = useContext(OptionGroupContext);
  const on = group ? group.values.includes(value) : !!checked;
  const radio = group ? !group.multiple : false;
  return (
    <button
      ref={ref}
      type="button"
      role={radio ? 'radio' : 'checkbox'}
      className={cx('ok-option ok-focusable', className)}
      aria-checked={on}
      tabIndex={radio ? (group!.tabStop === value ? 0 : -1) : undefined}
      disabled={disabled ?? group?.disabled}
      data-value={value}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (group) group.pick(value);
        onChange?.(group ? (group.multiple ? !on : true) : !on);
      }}
      {...rest}
    >
      {art != null && <span className="ok-option__art">{art}</span>}
      <span className="ok-option__foot">
        <span className="ok-option__title">{children}</span>
        <span className="ok-option__check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d={CHECK_D} pathLength={1} /></svg></span>
      </span>
      {description != null && <span className="ok-option__desc">{description}</span>}
    </button>
  );
});

interface OptionGroupBase extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  disabled?: boolean;
  /** 每列最小宽度（px），默认 128；列数随容器宽度自动增减 */
  minItemWidth?: number;
}
export interface OptionCardGroupSingleProps extends OptionGroupBase {
  multiple?: false;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
}
export interface OptionCardGroupMultipleProps extends OptionGroupBase {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
}
export type OptionCardGroupProps = OptionCardGroupSingleProps | OptionCardGroupMultipleProps;

const toList = (v: string | string[] | null | undefined): string[] | undefined => (v === undefined ? undefined : v === null ? [] : Array.isArray(v) ? v : [v]);

/**
 * 选项卡片组。
 * · 单选（默认）：role="radiogroup"，方向键移动并选中，Home / End 到两端
 * · 多选（multiple）：role="group"，每张卡片各自可 Tab 到，空格 / Enter 切换
 */
export const OptionCardGroup = forwardRef<HTMLDivElement, OptionCardGroupProps>(function OptionCardGroup(props, ref) {
  const {
    multiple = false, value, defaultValue, onChange, disabled: disabledProp, minItemWidth, className, style, children, id, onKeyDown,
    'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  } = props as OptionGroupBase & { multiple?: boolean; value?: string | string[] | null; defaultValue?: string | string[] | null; onChange?: (v: never) => void };
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const emit = onChange as ((v: string | string[]) => void) | undefined;
  const [values, setValues] = useControllable<string[]>(toList(value), toList(defaultValue) ?? [], (list) => {
    if (multiple) emit?.(list);
    else if (list.length) emit?.(list[0]);
  });
  const pick = (v: string) => {
    if (multiple) setValues(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    else if (values[0] !== v) setValues([v]);
  };

  // 单选时的 Tab 落点：选中项；都没选就落在第一张卡片上
  let firstValue: string | undefined;
  const scan = (node: ReactNode) => {
    if (firstValue !== undefined || node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(scan); return; }
    const el = node as { props?: { value?: unknown; disabled?: boolean; children?: ReactNode } };
    if (typeof el.props?.value === 'string' && !el.props.disabled) firstValue = el.props.value;
    else if (el.props?.children) scan(el.props.children);
  };
  if (!multiple && !values.length) scan(children);
  const tabStop = values[0] ?? firstValue;

  return (
    <div
      ref={ref}
      id={field.id}
      role={multiple ? 'group' : 'radiogroup'}
      className={cx('ok-options', className)}
      style={minItemWidth ? { gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`, ...style } : style}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || multiple) return;
        const next = rovingTarget(e, '[role="radio"]');
        if (!next) return;
        next.focus();
        if (next.dataset.value !== undefined) pick(next.dataset.value);
      }}
      {...rest}
    >
      <FieldContext.Provider value={null}>
        <OptionGroupContext.Provider value={{ values, multiple, pick, disabled: field.disabled, tabStop }}>{children}</OptionGroupContext.Provider>
      </FieldContext.Provider>
    </div>
  );
});
