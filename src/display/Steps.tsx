import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx, Icon, useLocale } from '../core';

export interface StepItem {
  title: ReactNode;
  description?: ReactNode;
  /** 替换圆圈里的序号 */
  icon?: ReactNode;
}

export interface StepsProps extends HTMLAttributes<HTMLOListElement> {
  items: StepItem[];
  /** 当前步骤的下标（从 0 开始）；等于 items.length 表示全部完成 */
  current?: number;
  /** horizontal（默认，窄屏自动改成纵向）或 vertical */
  orientation?: 'horizontal' | 'vertical';
  /** 当前步骤出错 */
  status?: 'default' | 'error';
  /** 步骤条的名字，默认“步骤” */
  label?: string;
}

/** 步骤条：ol，当前步骤 aria-current="step"；状态除了颜色还有对勾 / 序号和读屏文字 */
export const Steps = forwardRef<HTMLOListElement, StepsProps>(function Steps(
  { items, current = 0, orientation = 'horizontal', status = 'default', label: labelProp, className, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.steps.label;
  return (
    <ol ref={ref} aria-label={label} className={cx('ok-steps', className)} data-orientation={orientation} {...rest}>
      {items.map((it, i) => {
        const state = i < current ? 'complete' : i === current ? 'current' : 'upcoming';
        const error = state === 'current' && status === 'error';
        return (
          <li key={i} className="ok-steps__item" data-state={state} data-error={error ? '' : undefined} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="ok-steps__marker" aria-hidden="true">
              {state === 'complete' ? <Icon name="check" /> : error ? <Icon name="x" /> : it.icon ?? i + 1}
            </span>
            <span className="ok-steps__text">
              <span className="ok-steps__title">
                <span className="ok-sr">{t.steps.prefix(i + 1, error ? t.steps.error : t.steps.state[state])}</span>
                {it.title}
              </span>
              {it.description != null && <span className="ok-steps__desc">{it.description}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
});
