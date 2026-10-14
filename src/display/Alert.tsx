import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode, RefObject } from 'react';
import { cx, Icon, useControllable, useLocale, usePresence } from '../core';
import type { IconName } from '../core';
import type { DisplayTone } from './types';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: DisplayTone;
  /** 加粗的标题，后面接正文 */
  title?: ReactNode;
  /** 自定义图标；false 不显示。默认按 tone 选 */
  icon?: ReactNode | false;
  /** 右侧的操作（按钮、链接） */
  action?: ReactNode;
  /** 显示关闭按钮 */
  closable?: boolean;
  /** 是否显示（受控）。关闭时高度折叠 + 淡出，结束后卸载 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 点了关闭按钮 */
  onClose?: () => void;
  closeLabel?: string;
}

const ICONS: Record<DisplayTone, IconName> = { neutral: 'info', accent: 'sparkle', info: 'info', success: 'check', warning: 'alert', danger: 'alert' };

/** 提示条。warning / danger 用 role="alert"（立即播报），其余 role="status"；可以传 role 覆盖 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { tone = 'accent', title, icon, action, closable, open: openProp, defaultOpen = true, onOpenChange, onClose, closeLabel: closeLabelProp, className, children, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const closeLabel = closeLabelProp ?? t.common.close;
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const { mounted, ref: presenceRef } = usePresence(open, 700);
  if (!mounted) return null;
  const body = (
    <div
      ref={ref}
      role={tone === 'warning' || tone === 'danger' ? 'alert' : 'status'}
      className={cx('ok-alert', tone !== 'accent' && `ok-alert--${tone}`, className)}
      {...rest}
    >
      {icon !== false && (icon ?? <Icon name={ICONS[tone]} />)}
      <div className="ok-alert__body">
        {title != null && <b className="ok-alert__title">{title}</b>}
        {children}
      </div>
      {action != null && <div className="ok-alert__action">{action}</div>}
      {closable && (
        <button type="button" className="ok-btn ok-btn--sm ok-btn--ghost ok-btn--icon ok-focusable ok-alert__close" aria-label={closeLabel} onClick={() => { onClose?.(); setOpen(false); }}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
  // 关闭：高度用 soft 弹簧折叠 + 淡出（.ok-collapse），过渡结束后卸载。出现时不做入场动画，避免页面加载时跳动
  return (
    <div ref={presenceRef as RefObject<HTMLDivElement>} className="ok-collapse ok-alert-wrap" data-state={open ? 'open' : 'closed'}>
      {body}
    </div>
  );
});
