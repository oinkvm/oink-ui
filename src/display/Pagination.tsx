import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { clamp, cx, Icon, useControllable, useLocale } from '../core';
import type { DisplaySize } from './types';

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** 总页数 */
  count: number;
  /** 当前页，从 1 开始 */
  page?: number;
  defaultPage?: number;
  onChange?: (page: number) => void;
  /** 当前页两侧各显示几个页码，默认 1 */
  siblings?: number;
  /** 首尾各固定显示几个页码，默认 1 */
  boundaries?: number;
  /** 导航的名字，默认“分页” */
  label?: string;
  size?: Exclude<DisplaySize, 'lg'>;
  disabled?: boolean;
}

/** 生成页码序列，0 代表省略号 */
export function paginationRange(count: number, page: number, siblings = 1, boundaries = 1): number[] {
  const total = boundaries * 2 + siblings * 2 + 3;
  if (count <= total) return Array.from({ length: count }, (_, i) => i + 1);
  const left = Math.max(page - siblings, boundaries + 2);
  const right = Math.min(page + siblings, count - boundaries - 1);
  const showLeftDots = left > boundaries + 2;
  const showRightDots = right < count - boundaries - 1;
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const head = range(1, boundaries);
  const tail = range(count - boundaries + 1, count);
  if (!showLeftDots && showRightDots) return [...range(1, boundaries + siblings * 2 + 2), 0, ...tail];
  if (showLeftDots && !showRightDots) return [...head, 0, ...range(count - boundaries - siblings * 2 - 1, count)];
  return [...head, 0, ...range(left, right), 0, ...tail];
}

/** 分页：nav 里一组按钮，当前页 aria-current="page"；窄屏简化成 上一页 · 页码 · 下一页 */
export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  { count, page, defaultPage = 1, onChange, siblings = 1, boundaries = 1, label: labelProp, size = 'md', disabled, className, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.pagination.label;
  const total = Math.max(1, Math.floor(count));
  const [raw, setPage] = useControllable(page, defaultPage, onChange);
  const current = clamp(raw, 1, total);
  const go = (p: number) => { if (!disabled) setPage(clamp(p, 1, total)); };
  const pages = paginationRange(total, current, siblings, boundaries);

  return (
    <nav ref={ref} aria-label={label} className={cx('ok-pagination', size === 'sm' && 'ok-pagination--sm', className)} {...rest}>
      <ul className="ok-pagination__list">
        <li>
          <button type="button" className="ok-pagination__btn ok-pagination__btn--nav ok-focusable" aria-label={t.pagination.prev} disabled={disabled || current <= 1} onClick={() => go(current - 1)}>
            <Icon><path d="M12.500 4.500L7 10l5.500 5.500" /></Icon>
          </button>
        </li>
        {pages.map((p, i) => (p === 0 ? (
          <li key={`gap-${i}`} className="ok-pagination__gap" aria-hidden="true">…</li>
        ) : (
          <li key={p} className="ok-pagination__page">
            <button type="button" className="ok-pagination__btn ok-focusable" aria-label={t.pagination.page(p)} aria-current={p === current ? 'page' : undefined} disabled={disabled} onClick={() => go(p)}>
              {p}
            </button>
          </li>
        )))}
        {/* 窄屏时页码按钮全部隐藏，只显示这一项；宽屏下读屏靠 aria-current 就够了 */}
        <li className="ok-pagination__status" aria-hidden="true">{current} / {total}</li>
        <li>
          <button type="button" className="ok-pagination__btn ok-pagination__btn--nav ok-focusable" aria-label={t.pagination.next} disabled={disabled || current >= total} onClick={() => go(current + 1)}>
            <Icon name="chevron-right" />
          </button>
        </li>
      </ul>
      <span className="ok-sr" role="status">{t.pagination.status(current, total)}</span>
    </nav>
  );
});
