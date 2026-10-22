import { forwardRef, useRef } from 'react';
import type { CSSProperties, TextareaHTMLAttributes } from 'react';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect } from '../core';
import { useFieldControl } from './fieldContext';
import { guardImeEnter } from '../core/ime';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  /** 第一个参数是新值 */
  onChange?: (value: string) => void;
  /** 随内容自动增高，默认开。优先用 CSS field-sizing，不支持的浏览器用脚本量高度 */
  autoGrow?: boolean;
  /** 最少行数，默认 3 */
  minRows?: number;
  /** 最多行数，超过后内部滚动 */
  maxRows?: number;
  /** 允许手动拖拽改高度（关闭自动增高时才有意义） */
  resize?: 'none' | 'vertical';
  invalid?: boolean;
}

/** 多行输入框 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value, defaultValue = '', onChange, autoGrow = true, minRows = 3, maxRows, resize = 'none', invalid: invalidProp,
    className, style, id, disabled: disabledProp, required: requiredProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp });
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  const inner = useRef<HTMLTextAreaElement>(null);

  // 兜底：浏览器不认 field-sizing 时，按内容高度设置。最小 / 最大高度仍由 CSS 的行数变量限制
  useIsoLayoutEffect(() => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    if (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')) return;
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = el.scrollHeight + border + 'px';
  }, [current, autoGrow, minRows, maxRows]);

  const vars = { '--_min-rows': minRows, ...(maxRows ? { '--_max-rows': maxRows } : null) } as CSSProperties;

  return (
    <textarea
      {...rest}
      onKeyDownCapture={event => { if (!guardImeEnter(event)) rest.onKeyDownCapture?.(event); }}
      ref={mergeRefs(ref, inner)}
      id={field.id}
      rows={minRows}
      className={cx('ok-textarea ok-scroll', className)}
      style={{ ...vars, ...style }}
      data-autogrow={autoGrow ? '' : undefined}
      data-resize={resize !== 'none' ? resize : undefined}
      value={current}
      disabled={field.disabled}
      required={field.required || undefined}
      aria-invalid={field.invalid || undefined}
      aria-describedby={field.describedBy}
      onChange={(e) => setCurrent(e.target.value)}
    />
  );
});
