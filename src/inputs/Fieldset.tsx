import { forwardRef, useId } from 'react';
import type { FieldsetHTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';

export interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /** 图例（这一组的标题） */
  legend?: ReactNode;
  /** 图例下的说明 */
  hint?: ReactNode;
}

/** 一组相关控件。原生 fieldset：disabled 会让里面的控件全部禁用 */
export const Fieldset = forwardRef<HTMLFieldSetElement, FieldsetProps>(function Fieldset({ legend, hint, className, children, 'aria-describedby': describedBy, ...rest }, ref) {
  const hintId = `ok-fieldset-${useId()}-hint`;
  return (
    <fieldset ref={ref} className={cx('ok-fieldset', className)} aria-describedby={[describedBy, hint != null && hintId].filter(Boolean).join(' ') || undefined} {...rest}>
      {legend != null && <legend className="ok-fieldset__legend">{legend}</legend>}
      {hint != null && <span className="ok-fieldset__hint" id={hintId}>{hint}</span>}
      <div className="ok-fieldset__body">{children}</div>
    </fieldset>
  );
});
