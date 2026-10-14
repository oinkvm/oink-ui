import { forwardRef } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';
import { cx, useControllable } from '../core';
import { useFieldControl } from './fieldContext';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'checked' | 'defaultChecked' | 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** 第一个参数是新的开关状态 */
  onChange?: (checked: boolean) => void;
  /** 文字放在开关的哪一边：end（默认）文字在后；start 文字在前、开关在后（设置列表里常见的“文字在左、开关在右”） */
  labelPosition?: 'start' | 'end';
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

/**
 * 开关：真的 input[type=checkbox] role="switch"。按住时滑块拉伸，松开弹到另一侧。
 * 没有可见文字（children）时必须给 aria-label，或放进带标签的 Field。
 * ref 和其余原生属性落在 <input> 上；className / style 落在外层 <label> 上。
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { checked, defaultChecked = false, onChange, labelPosition = 'end', children, className, style, rootClassName, rootStyle, id, disabled: disabledProp, required: requiredProp, 'aria-describedby': describedByProp, ...rest }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, 'aria-describedby': describedByProp });
  const [on, setOn] = useControllable(checked, defaultChecked, onChange);
  const label = children != null && <span className="ok-switch__label">{children}</span>;
  return (
    <label className={cx('ok-switch', rootClassName, className)} style={{ ...rootStyle, ...style }} data-label-position={labelPosition}>
      {labelPosition === 'start' && label}
      <input
        {...rest}
        ref={ref}
        id={field.id}
        type="checkbox"
        role="switch"
        checked={on}
        disabled={field.disabled}
        required={field.required || undefined}
        aria-describedby={field.describedBy}
        onChange={(e) => setOn(e.target.checked)}
      />
      <span className="ok-switch__track"><span className="ok-switch__thumb" /></span>
      {labelPosition !== 'start' && label}
    </label>
  );
});
