import { forwardRef, useRef, useState } from 'react';
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { cx, Icon, useIsoLayoutEffect, useLocale } from '../core';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  /** 路径，最后一项是当前页 */
  items: BreadcrumbItem[];
  /** 导航的名字，默认“面包屑” */
  label?: string;
  /** 超过这个数量时任何宽度下都折叠中间项。默认只在窄屏（< 520px）折叠 */
  maxItems?: number;
  /** 分隔符，默认右箭头 */
  separator?: ReactNode;
}

/** 面包屑：nav + ol，最后一项 aria-current="page"；窄屏只留首尾，中间折成一个可展开的“…” */
export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  { items, label: labelProp, maxItems, separator, className, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.breadcrumb.label;
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const justExpanded = useRef(false);
  const last = items.length - 1;
  const canCollapse = items.length > 2;
  const always = maxItems != null && items.length > maxItems;
  const sep = <span className="ok-breadcrumb__sep" aria-hidden="true">{separator ?? <Icon name="chevron-right" />}</span>;

  // 展开后“…”按钮消失，把焦点交给第一个露出来的中间项
  useIsoLayoutEffect(() => {
    if (!expanded || !justExpanded.current) return;
    justExpanded.current = false;
    listRef.current?.querySelector<HTMLElement>('[data-middle] a, [data-middle] button')?.focus();
  }, [expanded]);

  return (
    <nav ref={ref} aria-label={label} className={cx('ok-breadcrumb', className)} data-collapse={!canCollapse || expanded ? undefined : always ? 'always' : 'narrow'} {...rest}>
      <ol ref={listRef} className="ok-breadcrumb__list">
        {items.map((it, i) => {
          const current = i === last;
          const body = current
            ? <span className="ok-breadcrumb__current" aria-current="page">{it.label}</span>
            : it.href !== undefined
              ? <a className="ok-breadcrumb__link ok-focusable" href={it.href} onClick={it.onClick}>{it.label}</a>
              : it.onClick
                ? <button type="button" className="ok-breadcrumb__link ok-focusable" onClick={it.onClick}>{it.label}</button>
                : <span className="ok-breadcrumb__text">{it.label}</span>;
          return [
            <li key={i} className="ok-breadcrumb__item" data-middle={i > 0 && i < last ? '' : undefined}>
              {i > 0 && sep}
              {body}
            </li>,
            i === 0 && canCollapse && !expanded ? (
              <li key="more" className="ok-breadcrumb__item ok-breadcrumb__more">
                {sep}
                <button
                  type="button"
                  className="ok-breadcrumb__link ok-focusable"
                  aria-label={t.breadcrumb.expand(items.length - 2)}
                  aria-expanded={false}
                  onClick={() => { justExpanded.current = true; setExpanded(true); }}
                >
                  <Icon name="more" />
                </button>
              </li>
            ) : null,
          ];
        })}
      </ol>
    </nav>
  );
});
