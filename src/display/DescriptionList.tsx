import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';

export interface DescriptionListEntry {
  key?: string;
  term: ReactNode;
  description: ReactNode;
}

export interface DescriptionListProps extends HTMLAttributes<HTMLDListElement> {
  /** 键值对；也可以不传，直接在 children 里写 DescriptionItem */
  items?: DescriptionListEntry[];
  /** auto（默认）：窄屏纵向堆叠，520px 起左右两列；stacked 总是堆叠；inline 总是两列 */
  layout?: 'auto' | 'stacked' | 'inline';
  /** 条目之间加发丝线 */
  divided?: boolean;
}

export const DescriptionList = forwardRef<HTMLDListElement, DescriptionListProps>(function DescriptionList(
  { items, layout = 'auto', divided, className, children, ...rest }, ref,
) {
  return (
    <dl ref={ref} className={cx('ok-dl', className)} data-layout={layout} data-divided={divided ? '' : undefined} {...rest}>
      {items?.map((it, i) => <DescriptionItem key={it.key ?? i} term={it.term}>{it.description}</DescriptionItem>)}
      {children}
    </dl>
  );
});

export interface DescriptionItemProps extends HTMLAttributes<HTMLDivElement> {
  term: ReactNode;
  children?: ReactNode;
}

export const DescriptionItem = forwardRef<HTMLDivElement, DescriptionItemProps>(function DescriptionItem({ term, className, children, ...rest }, ref) {
  return (
    <div ref={ref} className={cx('ok-dl__item', className)} {...rest}>
      <dt className="ok-dl__term">{term}</dt>
      <dd className="ok-dl__desc">{children}</dd>
    </div>
  );
});
