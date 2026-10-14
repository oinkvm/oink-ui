import { forwardRef, useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, cx, useIsoLayoutEffect, useLocale } from '../core';
import { useFloatingCard } from './FloatingCard';

/* --------------------------------------------------------------------------
   FloatingGrip 抓手
   -------------------------------------------------------------------------- */
export interface FloatingGripProps extends HTMLAttributes<HTMLDivElement> {}

/** 抓手：卡片顶上的一条小横杠，同时是拖拽关闭的把手。纯装饰，对读屏隐藏（关闭靠 Esc 和关闭按钮） */
export const FloatingGrip = forwardRef<HTMLDivElement, FloatingGripProps>(function FloatingGrip({ className, ...rest }, ref) {
  return (
    <div ref={ref} className={cx('ok-float__grip', className)} aria-hidden="true" data-ok-drag-handle="" {...rest}>
      <span />
    </div>
  );
});

/* --------------------------------------------------------------------------
   FloatingHeader 头部
   -------------------------------------------------------------------------- */
export interface FloatingHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 标题。会自动成为卡片的 aria-labelledby */
  title?: ReactNode;
  /** 标题下面的一行说明。会自动成为卡片的 aria-describedby */
  description?: ReactNode;
  /** 标题左边的图标位 */
  icon?: ReactNode;
  /** 标题的层级，默认 h2 */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** 是否带关闭按钮。默认跟随卡片的 dismissible */
  closable?: boolean;
  /** 关闭按钮的读屏名称 */
  closeLabel?: string;
  /** 点关闭按钮时；不传则请求卡片关闭 */
  onClose?: () => void;
  /** 放在关闭按钮前面的额外操作 */
  children?: ReactNode;
}

/** 头部：标题 + 说明 + 关闭按钮。在可拖拽的卡片里同时是拖拽把手 */
export const FloatingHeader = forwardRef<HTMLDivElement, FloatingHeaderProps>(function FloatingHeader(
  { title, description, icon, level = 2, closable, closeLabel: closeLabelProp, onClose, className, children, ...rest },
  ref,
) {
  const closeLabelDefault = useLocale().messages.common.close;
  const closeLabel = closeLabelProp ?? closeLabelDefault;
  const card = useFloatingCard();
  const ownId = useId();
  const titleId = card?.titleId ?? ownId + 'title';
  const descriptionId = card?.descriptionId ?? ownId + 'desc';
  const hasTitle = title != null && title !== false;
  const hasDescription = description != null && description !== false;
  const setTitled = card?.setTitled;
  const setDescribed = card?.setDescribed;

  useIsoLayoutEffect(() => {
    if (!hasTitle || !setTitled) return;
    setTitled(true);
    return () => setTitled(false);
  }, [hasTitle, setTitled]);
  useIsoLayoutEffect(() => {
    if (!hasDescription || !setDescribed) return;
    setDescribed(true);
    return () => setDescribed(false);
  }, [hasDescription, setDescribed]);

  const Heading = ('h' + level) as 'h2';
  const showClose = closable ?? card?.dismissible ?? true;
  // 告诉卡片“头部已经有关闭按钮了”，手机上就不再叠一个自动的
  const setHeaderClose = card?.setHeaderClose;
  useIsoLayoutEffect(() => {
    if (!showClose || !setHeaderClose) return;
    setHeaderClose(true);
    return () => setHeaderClose(false);
  }, [showClose, setHeaderClose]);

  return (
    <div ref={ref} className={cx('ok-float__header', className)} data-ok-drag-handle={card?.draggable ? '' : undefined} {...rest}>
      {icon != null && icon !== false && <span className="ok-float__icon">{icon}</span>}
      <div className="ok-float__heading">
        {hasTitle && <Heading id={titleId} className="ok-float__title">{title}</Heading>}
        {hasDescription && <p id={descriptionId} className="ok-float__desc">{description}</p>}
      </div>
      {children}
      {showClose && (
        <button
          type="button"
          className="ok-btn ok-btn--ghost ok-btn--icon ok-btn--sm ok-focusable ok-float__close"
          aria-label={closeLabel}
          onClick={onClose ?? card?.close}
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  );
});

/* --------------------------------------------------------------------------
   FloatingBody 内容区
   -------------------------------------------------------------------------- */
export interface FloatingBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** 是否带内边距（默认带）。内容自己通栏（列表、表格）时关掉 */
  padded?: boolean;
}

/** 内容区：占满头尾之间的空间，内容超出时原生滚动（.ok-scroll 只换滚动条外观） */
export const FloatingBody = forwardRef<HTMLDivElement, FloatingBodyProps>(function FloatingBody({ padded = true, className, ...rest }, ref) {
  return <div ref={ref} className={cx('ok-float__body ok-scroll', !padded && 'ok-float__body--flush', className)} {...rest} />;
});

/* --------------------------------------------------------------------------
   FloatingFooter 操作区
   -------------------------------------------------------------------------- */
export interface FloatingFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** 按钮的排法：end 靠右（默认）、start 靠左、between 两端、stretch 等分撑满 */
  align?: 'start' | 'end' | 'between' | 'stretch';
}

/** 操作区：一排按钮 */
export const FloatingFooter = forwardRef<HTMLDivElement, FloatingFooterProps>(function FloatingFooter({ align = 'end', className, ...rest }, ref) {
  return <div ref={ref} className={cx('ok-float__footer', className)} data-align={align} {...rest} />;
});
