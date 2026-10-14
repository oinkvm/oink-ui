import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** 页面标题 */
  title: ReactNode;
  /** 标题下面的说明 */
  description?: ReactNode;
  /** 面包屑位：显示在标题上方 */
  breadcrumb?: ReactNode;
  /** 操作区：宽屏在标题右侧，放不下时换到标题下面 */
  actions?: ReactNode;
  /** 标题的级别，默认 1 */
  headingLevel?: HeadingLevel;
  /** 标题节点的 id（给 aria-labelledby 用） */
  titleId?: string;
}

/** 页头：面包屑、标题、说明、操作区。children 放在最下面（标签页、筛选条之类） */
export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  { title, description, breadcrumb, actions, headingLevel = 1, titleId, className, children, ...rest },
  ref,
) {
  const Heading = `h${headingLevel}` as 'h1';
  return (
    <header ref={ref} className={cx('ok-page-header', className)} {...rest}>
      {breadcrumb ? <div className="ok-page-header__breadcrumb">{breadcrumb}</div> : null}
      <div className="ok-page-header__row">
        <div className="ok-page-header__text">
          <Heading id={titleId} className="ok-page-header__title">{title}</Heading>
          {description ? <p className="ok-page-header__desc">{description}</p> : null}
        </div>
        {actions ? <div className="ok-page-header__actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
});
