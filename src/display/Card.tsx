import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx, Icon } from '../core';
import type { DisplaySize } from './types';
import { Image } from './Image';
import type { ImageProps } from './Image';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** 静态卡片渲染成什么元素，默认 div。传了 href 或 interactive 时忽略 */
  as?: ElementType;
  /** 圆角与内边距：sm 20/16、md 24/20（原型）、lg 32/24 */
  size?: DisplaySize;
  /** 整卡是链接：根节点渲染成 <a> */
  href?: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  rel?: string;
  /** 整卡是按钮：根节点渲染成 <button type="button">（里面只能放短语内容；内容里有标题、别的按钮时改用 CardLink） */
  interactive?: boolean;
  /** interactive 时禁用 */
  disabled?: boolean;
  /** 末尾的前进箭头，悬停时变深 */
  chevron?: boolean;
}

/** 卡片。可点击变体：悬停只加深描边和箭头颜色，按下回缩到 .985 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { as = 'div', size = 'md', href, target, rel, interactive, disabled, chevron, className, children, ...rest }, ref,
) {
  const isLink = href !== undefined;
  const isButton = !isLink && !!interactive;
  const Comp = (isLink ? 'a' : isButton ? 'button' : as) as ElementType;
  const Main = (isButton ? 'span' : 'div') as ElementType;
  const extra = isLink ? { href, target, rel } : isButton ? { type: 'button', disabled } : null;
  return (
    <Comp
      ref={ref}
      className={cx('ok-card', size !== 'md' && `ok-card--${size}`, (isLink || isButton) && 'ok-card--interactive ok-focusable', chevron && 'ok-card--chev', className)}
      {...extra}
      {...rest}
    >
      {chevron ? (
        <>
          <Main className="ok-card__main">{children}</Main>
          <Icon name="chevron-right" className="ok-card__chev" />
        </>
      ) : children}
    </Comp>
  );
});

export interface CardLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** 不传 href 时渲染成 <button type="button"> */
  href?: string;
}

/** 覆盖链接：放在卡片标题里，点击区域铺满整张卡片；卡片里其它链接、按钮仍可单独点击 */
export const CardLink = forwardRef<HTMLElement, CardLinkProps>(function CardLink({ href, className, ...rest }, ref) {
  const Comp = (href !== undefined ? 'a' : 'button') as ElementType;
  const extra = href !== undefined ? { href } : { type: 'button' };
  return <Comp ref={ref} className={cx('ok-card__link', className)} {...extra} {...rest} />;
});

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** 标题用什么元素，默认 h3 */
  titleAs?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div';
  /** 标题元素的 id，方便外层用 aria-labelledby 指过来（<section aria-labelledby={id}>） */
  titleId?: string;
  /** 右侧操作区 */
  actions?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { title, description, titleAs: Title = 'h3', titleId, actions, className, children, ...rest }, ref,
) {
  return (
    <div ref={ref} className={cx('ok-card__header', className)} {...rest}>
      <div className="ok-card__heading">
        {title != null && <Title id={titleId} className="ok-card__title">{title}</Title>}
        {description != null && <p className="ok-card__desc">{description}</p>}
        {children}
      </div>
      {actions != null && <div className="ok-card__actions">{actions}</div>}
    </div>
  );
});

export type CardBodyProps = HTMLAttributes<HTMLDivElement>;
export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(function CardBody({ className, ...rest }, ref) {
  return <div ref={ref} className={cx('ok-card__body', className)} {...rest} />;
});

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** 操作按钮的对齐，默认 start */
  align?: 'start' | 'end' | 'between';
}
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter({ align = 'start', className, ...rest }, ref) {
  return <div ref={ref} className={cx('ok-card__footer', className)} data-align={align} {...rest} />;
});

export interface CardMediaProps extends Omit<ImageProps, 'radius'> {
  /** 宽高比，默认 16 / 9。position="start" 且卡片够宽时不用比例，改为占满卡片高度 */
  ratio?: number | string;
  /**
   * top（默认）：放在卡片第一个子元素时贴满卡片顶部，上两个角跟卡片圆角；
   * start：卡片宽于 520px 时贴在左侧、占满卡片高度，左两个角跟卡片圆角；窄了自动回到顶部
   */
  position?: 'top' | 'start';
}

/**
 * 卡片主图。作为 Card 的第一个子元素时贴边铺满（不受卡片内边距影响），被卡片圆角裁切；
 * 卡片的描边和顶部高光仍然画在图片之上。其余属性同 Image。
 */
export const CardMedia = forwardRef<HTMLSpanElement, CardMediaProps>(function CardMedia(
  { ratio = 16 / 9, position = 'top', className, ...rest }, ref,
) {
  return (
    <Image
      ref={ref}
      ratio={ratio}
      radius={0}
      className={cx('ok-card__media', position === 'start' && 'ok-card__media--start', className)}
      {...rest}
    />
  );
});
