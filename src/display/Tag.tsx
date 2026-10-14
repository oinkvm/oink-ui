import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx, Icon, useLocale } from '../core';
import type { DisplaySize, DisplayTone } from './types';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: DisplayTone;
  size?: Exclude<DisplaySize, 'lg'>;
  /** 文字前的图标 */
  icon?: ReactNode;
  /** 传了就出现移除按钮 */
  onRemove?: () => void;
  /** 移除按钮的 aria-label，默认“移除” + 标签文字 */
  removeLabel?: string;
}

/** 标签：给内容分类用的小方角标记（徽标表示状态，标签表示归类）。需要可切换的筛选项请用 inputs 组的 Chip */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { tone = 'neutral', size = 'md', icon, onRemove, removeLabel, className, children, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  return (
    <span ref={ref} className={cx('ok-tag', size === 'sm' && 'ok-tag--sm', className)} data-tone={tone} {...rest}>
      {icon != null && <span className="ok-tag__icon" aria-hidden="true">{icon}</span>}
      <span className="ok-tag__label">{children}</span>
      {onRemove && (
        <button type="button" className="ok-tag__remove ok-focusable" aria-label={removeLabel ?? t.tag.remove(text)} onClick={onRemove}>
          <Icon name="x" />
        </button>
      )}
    </span>
  );
});
