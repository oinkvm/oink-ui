import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx, Icon, useLocale } from '../core';

export type StatTrend = 'up' | 'down' | 'flat';

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  /** 指标名 */
  label: ReactNode;
  /** 数值 */
  value: ReactNode;
  /** 涨跌幅文字，如 “12.5%”“+320” */
  delta?: ReactNode;
  /** 涨 / 跌 / 持平。决定箭头方向 */
  trend?: StatTrend;
  /** 涨是好事（默认，涨绿跌红）还是坏事（如“错误率”，涨红跌绿） */
  positive?: 'up' | 'down';
  /** 补充说明，如“较上周” */
  hint?: ReactNode;
  /** 标签旁的图标 */
  icon?: ReactNode;
  /** card（默认）：带卡片底的指标卡；plain：没有底，放在别的容器里 */
  variant?: 'card' | 'plain';
}

/** 指标卡：标签、数值、涨跌。涨跌除了颜色还有箭头和读屏文字 */
export const Stat = forwardRef<HTMLDivElement, StatProps>(function Stat(
  { label, value, delta, trend, positive = 'up', hint, icon, variant = 'card', className, ...rest }, ref,
) {
  const trendText = useLocale().messages.stat.trend;
  const t: StatTrend | undefined = trend ?? (delta != null ? 'flat' : undefined);
  const mood = !t || t === 'flat' ? 'neutral' : t === positive ? 'good' : 'bad';
  return (
    <div ref={ref} className={cx('ok-stat', variant === 'card' && 'ok-card', className)} {...rest}>
      <div className="ok-stat__label">
        {icon != null && <span className="ok-stat__icon" aria-hidden="true">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="ok-stat__value">{value}</div>
      {(t || hint != null) && (
        <div className="ok-stat__foot">
          {t && (
            <span className="ok-stat__delta" data-trend={t} data-mood={mood}>
              <Icon>{t === 'flat' ? <path d="M4.500 10h11" /> : <path d={t === 'up' ? 'M10 15.500v-11M5.500 9L10 4.500 14.500 9' : 'M10 4.500v11M5.500 11l4.500 4.500 4.500-4.500'} />}</Icon>
              <span className="ok-sr">{trendText[t]}</span>
              {delta}
            </span>
          )}
          {hint != null && <span className="ok-stat__hint">{hint}</span>}
        </div>
      )}
    </div>
  );
});
