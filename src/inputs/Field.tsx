import { cloneElement, forwardRef, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { Icon, animate, cx } from '../core';
import { FieldContext } from './fieldContext';
import type { FieldContextValue } from './fieldContext';

/** 接到原生控件上的属性（render prop / 自动克隆时使用） */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
  disabled?: boolean;
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 标签文字 */
  label?: ReactNode;
  /** 提示文字，常驻 */
  hint?: ReactNode;
  /** 错误文字；有值即视为校验失败 */
  error?: ReactNode;
  /** 没有错误文字但要标红时用 */
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** 控件 id；不传自动生成 */
  id?: string;
  /** 标签在上（默认）或在左（sm 断点以上） */
  orientation?: 'vertical' | 'horizontal';
  /** 控件。本库的控件自动接线；原生 input / select / textarea 会被克隆接线；也可以传函数自己接 */
  children?: ReactNode | ((control: FieldControlProps) => ReactNode);
}

const NATIVE = new Set(['input', 'select', 'textarea']);

/** 表单项：标签 + 控件 + 提示 + 错误。自动把 id、aria-describedby、aria-invalid 接到子控件上 */
export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, hint, error, invalid: invalidProp, required = false, disabled = false, id: idProp, orientation = 'vertical', className, children, ...rest }, ref,
) {
  const auto = useId();
  const id = idProp ?? `ok-field-${auto}`;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error != null && error !== false && error !== '';
  const invalid = invalidProp ?? hasError;
  const describedBy = [hint != null && hintId, hasError && errorId].filter(Boolean).join(' ') || undefined;

  const ctx = useMemo<FieldContextValue>(
    () => ({ id, labelId: label != null ? labelId : undefined, describedBy, invalid, required, disabled }),
    [id, label != null, labelId, describedBy, invalid, required, disabled],   // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 校验失败的那一下：控件横向抖动（原型的 ok-shake）
  const control = useRef<HTMLDivElement>(null);
  const wasInvalid = useRef(invalid);
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    // macOS 26.6.2 WKWebView 提交组字会先 deleteCompositionText（临时空值），
    // 再 insertFromComposition。回车守卫拦不住输入事件；只在组字结束后判断抖动，
    // 不过滤 onChange、不改写受控输入值，普通编辑的错误反馈仍然即时生效。
    if (composing) return;
    if (invalid && !wasInvalid.current) {
      animate(control.current, { transform: ['translateX(0)', 'translateX(-7px)', 'translateX(6px)', 'translateX(-4px)', 'translateX(2px)', 'translateX(0)'] }, { duration: 520 });
    }
    wasInvalid.current = invalid;
  }, [invalid, composing]);

  const controlProps: FieldControlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? true : undefined,
    required: required || undefined,
    disabled: disabled || undefined,
  };

  let body: ReactNode;
  if (typeof children === 'function') body = children(controlProps);
  else if (isValidElement(children) && typeof children.type === 'string' && NATIVE.has(children.type)) {
    const el = children as ReactElement<Record<string, unknown>>;
    const own = el.props;
    body = cloneElement(el, {
      ...controlProps,
      id: (own.id as string | undefined) ?? id,
      'aria-describedby': [own['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      required: own.required ?? controlProps.required,
      disabled: own.disabled ?? controlProps.disabled,
    });
  } else body = children;

  return (
    <div
      ref={ref}
      className={cx('ok-field', orientation === 'horizontal' && 'ok-field--horizontal', className)}
      data-invalid={invalid ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      {...rest}
      onCompositionStartCapture={event => { setComposing(true); rest.onCompositionStartCapture?.(event); }}
      onCompositionEndCapture={event => { setComposing(false); rest.onCompositionEndCapture?.(event); }}
    >
      {label != null && (
        <label
          className="ok-field__label"
          id={labelId}
          htmlFor={id}
          // 触发框是按钮的控件（Select、DateRangePicker）：点标签只聚焦，不替用户点开（和原生 select 一致）
          onClick={(e) => {
            const target = e.currentTarget.ownerDocument.getElementById(id);
            if (!target || !target.hasAttribute('data-label-focus')) return;
            e.preventDefault();
            if (!(target as HTMLButtonElement).disabled) target.focus();
          }}
        >
          {label}
          {required && <span className="ok-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="ok-field__control" ref={control}>
        <FieldContext.Provider value={ctx}>{body}</FieldContext.Provider>
      </div>
      {hint != null && <span className="ok-field__hint" id={hintId}>{hint}</span>}
      {/* 错误区常驻，内容出现时由 aria-live 播报；高度用 grid 0fr → 1fr 展开 */}
      <span className="ok-field__msg" id={errorId} aria-live="polite">
        <span>{hasError && <><Icon name="alert" />{error}</>}</span>
      </span>
    </div>
  );
});
