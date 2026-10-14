import { createContext, forwardRef, useContext, useId, useRef } from 'react';
import type { ComponentPropsWithoutRef, ElementType, HTMLAttributes, MouseEvent, ReactElement, ReactNode, Ref } from 'react';
import { cx, mergeRefs, useIsoLayoutEffect } from '../core';

/** 导航是否折叠成只剩图标。AppShell.Sidebar 收成窄条时会自动提供 true */
export const NavCollapsedContext = createContext(false);

export interface NavProps extends HTMLAttributes<HTMLElement> {
  /** 折叠：只显示图标，文字改由 title / aria-label 提供。不传时跟随所在的 AppShell.Sidebar */
  collapsed?: boolean;
}

/**
 * 导航列表（照原型 .ok-nav）：当前项下面有一块随 aria-current 滑动的指示块。
 * 渲染为 <nav>，记得给 aria-label（页面上有多个导航时用来区分）。
 */
export const Nav = forwardRef<HTMLElement, NavProps>(function Nav({ collapsed, className, children, ...rest }, ref) {
  const inherited = useContext(NavCollapsedContext);
  const isCollapsed = collapsed ?? inherited;
  const navRef = useRef<HTMLElement | null>(null);

  // 指示块：量出当前项的位置，写到 --y / --h 上，位移交给 CSS 过渡
  useIsoLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const cur = nav.querySelector<HTMLElement>('.ok-nav__item[aria-current]:not([aria-current="false"])');
      if (!cur) { nav.removeAttribute('data-ready'); return; }
      nav.style.setProperty('--y', cur.offsetTop + 'px');
      nav.style.setProperty('--h', cur.offsetHeight + 'px');
      if (!nav.hasAttribute('data-ready')) {
        void nav.offsetWidth;   // 第一次直接出现在位置上，不从顶部滑过来
        nav.setAttribute('data-ready', '');
      }
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(nav);
    // 当前项可能在不重渲染 Nav 的情况下变化（比如路由库的链接组件自己改 aria-current）
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(place) : null;
    mo?.observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current'] });
    return () => { ro?.disconnect(); mo?.disconnect(); };
  }, []);

  return (
    <NavCollapsedContext.Provider value={isCollapsed}>
      <nav ref={mergeRefs(ref, navRef)} className={cx('ok-nav', className)} data-collapsed={isCollapsed ? '' : undefined} {...rest}>
        <span className="ok-nav__pill" aria-hidden="true" />
        {children}
      </nav>
    </NavCollapsedContext.Provider>
  );
});

export interface NavGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 分组标题；折叠时收成一条细线，但仍然是这组的无障碍名称 */
  label?: ReactNode;
}

/** 导航分组：一个小标题 + 一组 NavItem */
export const NavGroup = forwardRef<HTMLDivElement, NavGroupProps>(function NavGroup({ label, className, children, ...rest }, ref) {
  const id = useId();
  const hasLabel = label !== undefined && label !== null && label !== false;
  return (
    <div ref={ref} role="group" aria-labelledby={hasLabel ? id : undefined} className={cx('ok-nav__group', className)} {...rest}>
      {hasLabel ? <div id={id} className="ok-nav__group-label"><span>{label}</span></div> : null}
      {children}
    </div>
  );
});

interface NavItemOwnProps {
  /** 当前页：加 aria-current="page"，指示块滑到这一项 */
  current?: boolean;
  /** 前面的图标 */
  icon?: ReactNode;
  /** 后面的徽标位（数量、状态点…）；折叠时缩成一个小圆点 */
  badge?: ReactNode;
  /** 二级项：缩进、矮一档 */
  sub?: boolean;
  /** 折叠时的 title / aria-label。children 是纯文字时可以不传 */
  label?: string;
  disabled?: boolean;
  href?: string;
  title?: string;
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * as：自定义渲染的元素 / 组件（比如路由库的 Link）。不传时：有 href 是 <a>，否则是 <button>。
 * 其余属性跟着 as 走：<NavItem as={Link} to="/settings"> 里的 to 有类型检查，不会报“不认识的属性”。
 */
export type NavItemProps<E extends ElementType = 'a'> = NavItemOwnProps & { as?: E } & Omit<ComponentPropsWithoutRef<E>, keyof NavItemOwnProps | 'as' | 'type'>;

type NavItemImplProps = NavItemOwnProps & { as?: ElementType };

/** 导航项 */
export const NavItem = forwardRef<HTMLElement, NavItemImplProps>(function NavItem(
  { as, current, icon, badge, sub, label, disabled, href, className, children, onClick, title, ...rest },
  ref,
) {
  const collapsed = useContext(NavCollapsedContext);
  const Tag: ElementType = as ?? (href !== undefined ? 'a' : 'button');
  const text = label ?? (typeof children === 'string' || typeof children === 'number' ? String(children) : undefined);
  const hasBadge = badge !== undefined && badge !== null && badge !== false;
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (disabled) { e.preventDefault(); return; }
    onClick?.(e);
  };
  // 只在有值时才传：自定义组件（路由库的 Link）自己算 href，不能被一个 undefined 盖掉
  const native = {
    ...(href !== undefined && !disabled ? { href } : null),
    ...(Tag === 'button' ? { type: 'button' as const, ...(disabled ? { disabled: true } : null) } : null),
  };
  return (
    <Tag
      ref={ref}
      className={cx('ok-nav__item ok-focusable', sub && 'ok-nav__item--sub', className)}
      {...native}
      aria-current={current ? 'page' : undefined}
      aria-disabled={disabled ? true : undefined}
      aria-label={collapsed ? text : undefined}
      title={title ?? (collapsed ? text : undefined)}
      data-has-badge={hasBadge ? '' : undefined}
      onClick={handleClick}
      {...rest}
    >
      {icon ? <span className="ok-nav__icon" aria-hidden="true">{icon}</span> : null}
      <span className="ok-nav__label">{children}</span>
      {hasBadge ? <span className="ok-nav__badge">{badge}</span> : null}
    </Tag>
  );
}) as unknown as <E extends ElementType = 'a'>(props: NavItemProps<E> & { ref?: Ref<HTMLElement> }) => ReactElement | null;
