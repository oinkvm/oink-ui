import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import { cx } from '../core';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** 显示必填标记（* 只是视觉提示，控件本身还要有 required） */
  required?: boolean;
  /** 置灰 */
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/** 独立标签。用 htmlFor 指向控件 id */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label({ required, disabled, size = 'sm', className, children, ...rest }, ref) {
  return (
    <label ref={ref} className={cx('ok-label', size === 'md' && 'ok-label--md', className)} data-disabled={disabled ? '' : undefined} {...rest}>
      {children}
      {required && <span className="ok-label__required" aria-hidden="true">*</span>}
    </label>
  );
});
