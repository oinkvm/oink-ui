import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';
import type { DisplaySize } from './types';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 图示位：图标或插画 */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** 操作按钮 */
  actions?: ReactNode;
  /** 标题用什么元素，默认 h3。整页的空状态（404、空收件箱）可以用 h1 */
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  size?: DisplaySize;
}

/** 空状态：图示 + 标题 + 说明 + 操作，居中排列 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon, title, description, actions, titleAs: Title = 'h3', size = 'md', className, children, ...rest }, ref,
) {
  return (
    <div ref={ref} className={cx('ok-empty', size !== 'md' && `ok-empty--${size}`, className)} {...rest}>
      {icon != null && <div className="ok-empty__media" aria-hidden="true">{icon}</div>}
      <Title className="ok-empty__title">{title}</Title>
      {description != null && <p className="ok-empty__desc">{description}</p>}
      {children}
      {actions != null && <div className="ok-empty__actions">{actions}</div>}
    </div>
  );
});
