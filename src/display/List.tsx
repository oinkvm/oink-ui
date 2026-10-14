import { forwardRef } from 'react';
import type { HTMLAttributes, LiHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../core';
import type { DisplaySize } from './types';

export interface ListProps extends HTMLAttributes<HTMLElement> {
  /** ul（默认）或 ol */
  as?: 'ul' | 'ol';
  /** 项目符号：none（默认）、bullet 圆点、number 序号 */
  marker?: 'none' | 'bullet' | 'number';
  /** 条目之间加发丝线 */
  divided?: boolean;
  /** 条目的上下间距 */
  size?: DisplaySize;
}

export const List = forwardRef<HTMLElement, ListProps>(function List({ as, marker = 'none', divided, size = 'md', className, ...rest }, ref) {
  const Comp = (as ?? (marker === 'number' ? 'ol' : 'ul')) as 'ul';
  // list-style: none 会让部分读屏丢掉列表语义，显式补上
  return (
    <Comp
      ref={ref as Ref<HTMLUListElement>}
      role="list"
      className={cx('ok-list', size !== 'md' && `ok-list--${size}`, className)}
      data-marker={marker}
      data-divided={divided ? '' : undefined}
      {...rest}
    />
  );
});

export interface ListItemProps extends Omit<LiHTMLAttributes<HTMLLIElement>, 'title'> {
  /** 前置内容：图标、头像 */
  leading?: ReactNode;
  /** 后置内容：徽标、时间、操作 */
  trailing?: ReactNode;
  /** 主标题；不传就直接用 children 作为内容 */
  title?: ReactNode;
  /** 标题下的说明 */
  description?: ReactNode;
}

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(function ListItem(
  { leading, trailing, title, description, className, children, ...rest }, ref,
) {
  return (
    <li ref={ref} className={cx('ok-list__item', className)} {...rest}>
      {leading != null && <span className="ok-list__leading">{leading}</span>}
      <div className="ok-list__content">
        {title != null && <span className="ok-list__title">{title}</span>}
        {description != null && <span className="ok-list__desc">{description}</span>}
        {children}
      </div>
      {trailing != null && <span className="ok-list__trailing">{trailing}</span>}
    </li>
  );
});
