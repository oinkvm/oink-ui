import { forwardRef } from 'react';
import type { FormEvent, FormHTMLAttributes, HTMLAttributes } from 'react';
import { cx } from '../core';

export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** 项与项的间距 */
  size?: 'sm' | 'md' | 'lg';
  /** 提交：第一个参数是表单数据（FormData），第二个是原生事件。默认行为（整页跳转）已被阻止 */
  onSubmit?: (data: FormData, event: FormEvent<HTMLFormElement>) => void;
}

/** 纵向表单布局。校验交给浏览器原生（required / type / pattern），通过后才触发 onSubmit */
export const Form = forwardRef<HTMLFormElement, FormProps>(function Form({ size = 'md', onSubmit, className, children, ...rest }, ref) {
  return (
    <form
      ref={ref}
      className={cx('ok-form', size !== 'md' && `ok-form--${size}`, className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(new FormData(e.currentTarget), e);
      }}
      {...rest}
    >
      {children}
    </form>
  );
});

export interface FormActionsProps extends HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end' | 'between';
  /** 窄屏（< 520）时按钮竖排并撑满，默认开 */
  stack?: boolean;
}

/** 表单底部的操作区 */
export const FormActions = forwardRef<HTMLDivElement, FormActionsProps>(function FormActions({ align = 'start', stack = true, className, ...rest }, ref) {
  return <div ref={ref} className={cx('ok-form__actions', align !== 'start' && `ok-form__actions--${align}`, stack && 'ok-form__actions--stack', className)} {...rest} />;
});
