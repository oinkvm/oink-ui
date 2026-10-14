import { forwardRef, useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon, cx, useControllable, useLocale } from '../core';
import { FloatingCard, resolveFloatSize } from './FloatingCard';
import type { FloatSize, FloatingCardProps } from './FloatingCard';

export type DialogTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface DialogProps extends Omit<FloatingCardProps, 'open' | 'placement' | 'modal' | 'autoFocus' | 'align' | 'size' | 'stretch' | 'contained' | 'role' | 'title' | 'dragToDismiss' | 'onSubmit'> {
  /** 受控的开合；不传则用 defaultOpen 自己管 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 宽度预设：sm 320 / md 400 / lg 560；也可以直接给数字（px）或 CSS 长度 */
  size?: FloatSize | number | string;
  /** 标题左侧的图标位（40×40 的色块） */
  icon?: ReactNode;
  /** 图标色块的状态色，默认 accent */
  tone?: DialogTone;
  title?: ReactNode;
  description?: ReactNode;
  /** 底部操作区：放一到两个按钮，等分撑满 */
  actions?: ReactNode;
  /** start：图标 + 标题靠左（默认）；center：标题与说明居中（无图标的确认框） */
  align?: 'start' | 'center';
  /** 需要用户立刻回应的打断用 alertdialog */
  role?: 'dialog' | 'alertdialog';
  /** 右上角带一个关闭按钮（默认不带，和原型一致） */
  closable?: boolean;
  closeLabel?: string;
  /**
   * 'form'：卡片里的全部内容（标题、children、actions）包在一个 <form> 里。actions 里放 <button type="submit">，
   * 在输入框里按回车就能提交，不用再靠 form={id} 把表单外的按钮关联回来。默认 'div'
   */
  as?: 'div' | 'form';
  /** as="form" 时表单提交的回调。已经替你 preventDefault 了（不会整页刷新）；校验不通过时浏览器不会触发它 */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

const SIZES: Record<FloatSize, number> = { sm: 320, md: 400, lg: 560 };

/** 对话框：居中的悬浮卡片，各种宽度下都从触发点放大进场（没有手机专用形态） */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(function Dialog(
  {
    open: openProp, defaultOpen = false, onOpenChange, size = 'md', icon, tone = 'accent', title, description, actions,
    align = 'start', role = 'dialog', closable = false, closeLabel: closeLabelProp, dismissible = true, as = 'div', onSubmit, origin,
    className, children, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, ...rest
  },
  ref,
) {
  const closeLabelDefault = useLocale().messages.common.close;
  const closeLabel = closeLabelProp ?? closeLabelDefault;
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const uid = useId();
  const hasTitle = title != null && title !== false;
  const hasDescription = description != null && description !== false;
  const hasIcon = icon != null && icon !== false;

  const content = (
    <>
      {(hasTitle || hasIcon || closable) && (
        <div className="ok-dialog__head">
          {hasIcon && <div className={cx('ok-dialog__icon', tone !== 'accent' && 'ok-dialog__icon--' + tone)}>{icon}</div>}
          {hasTitle && <h2 id={uid + 'title'} className="ok-dialog__title">{title}</h2>}
          {closable && (
            <button type="button" className="ok-btn ok-btn--ghost ok-btn--icon ok-btn--sm ok-focusable ok-dialog__close" aria-label={closeLabel} onClick={() => setOpen(false)}>
              <Icon name="x" />
            </button>
          )}
        </div>
      )}
      {hasDescription && <p id={uid + 'desc'} className="ok-dialog__desc">{description}</p>}
      {children != null && children !== false && <div className="ok-dialog__body ok-scroll">{children}</div>}
      {actions != null && actions !== false && <div className="ok-dialog__actions">{actions}</div>}
    </>
  );

  return (
    <FloatingCard
      {...rest}
      ref={ref}
      open={open}
      onOpenChange={setOpen}
      placement="center"
      // 从触发点放大进场（手机上也一样）
      origin={origin}
      size={resolveFloatSize(size, SIZES)}
      role={role}
      dismissible={dismissible}
      className={cx('ok-dialog__panel ok-scroll', align === 'center' && 'ok-dialog__panel--center', className)}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy ?? (hasTitle && !ariaLabel ? uid + 'title' : undefined)}
      aria-describedby={describedBy ?? (hasDescription ? uid + 'desc' : undefined)}
    >
      {as === 'form' ? (
        <form className="ok-dialog__form" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); onSubmit?.(e); }}>{content}</form>
      ) : content}
    </FloatingCard>
  );
});
