import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';
import type { DisplayTone } from './types';

export interface TimelineEntry {
  key?: string;
  title: ReactNode;
  description?: ReactNode;
  /** 时间文字 */
  time?: ReactNode;
  /** 机器可读的时间，写进 <time dateTime> */
  dateTime?: string;
  /** 节点颜色 */
  tone?: DisplayTone;
  /** 替换圆点的图标 */
  icon?: ReactNode;
}

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
  items: TimelineEntry[];
}

/** 时间线：按时间排列的事件列表（ol） */
export const Timeline = forwardRef<HTMLOListElement, TimelineProps>(function Timeline({ items, className, ...rest }, ref) {
  return (
    <ol ref={ref} className={cx('ok-timeline', className)} {...rest}>
      {items.map((it, i) => (
        <li key={it.key ?? i} className="ok-timeline__item" data-tone={it.tone ?? 'neutral'}>
          <span className="ok-timeline__marker" data-icon={it.icon != null ? '' : undefined} aria-hidden="true">{it.icon}</span>
          <div className="ok-timeline__content">
            <div className="ok-timeline__head">
              <span className="ok-timeline__title">{it.title}</span>
              {it.time != null && <time className="ok-timeline__time" dateTime={it.dateTime}>{it.time}</time>}
            </div>
            {it.description != null && <div className="ok-timeline__desc">{it.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
});
