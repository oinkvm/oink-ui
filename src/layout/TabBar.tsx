import { createContext, forwardRef, useContext, useRef, useState } from 'react';
import type { CSSProperties, ComponentPropsWithoutRef, ElementType, HTMLAttributes, KeyboardEvent, MouseEvent, ReactElement, ReactNode, Ref } from 'react';
import { cx, useControllable, useIsoLayoutEffect } from '../core';
import { arrowIndex } from './internal';

interface TabBarContextValue { value: string | undefined; select: (value: string) => void }
const TabBarContext = createContext<TabBarContextValue | null>(null);

export interface TabBarProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'defaultValue'> {
  /** 当前项（受控） */
  value?: string;
  /** 初始项（非受控） */
  defaultValue?: string;
  /** 切换时触发，参数是新值 */
  onChange?: (value: string) => void;
  /** 标签栏旁边的主操作位（比如“新建”按钮） */
  action?: ReactNode;
  /** 定位方式：fixed 贴视口底部（默认）；absolute 贴最近的定位祖先（嵌在演示框里用）；static 不定位 */
  position?: 'fixed' | 'absolute' | 'static';
  /**
   * 各项的排法。inline：图标和文字横排；stacked：图标在上、文字在下，各项按内容分配宽度（不小于 44px）。
   * auto（默认）：不到 4 项、或者各项只有图标时横排；带文字且 4 项及以上时上下排——横排在手机宽度下放不下四个带文字的项
   */
  layout?: 'auto' | 'inline' | 'stacked';
  /** 在起始一侧（左）多让出的空间，数字按 px。和页面上别的固定元素并排时用，比如左下角的悬浮按钮 */
  insetStart?: number | string;
  /** 在结束一侧（右）多让出的空间，数字按 px */
  insetEnd?: number | string;
}

const cssLen = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

/**
 * 手机底部标签栏（照 mobile-app.html）：一个放大的分段选择，悬在页面底部，四周留缝并避开安全区。
 * 渲染为 <nav>，当前项带 aria-current="page"；← → / Home / End 在项之间移动焦点。
 * 页面内容底部记得留出位置（约 116px + 安全区）。
 */
const TabBarRoot = forwardRef<HTMLElement, TabBarProps>(function TabBar(
  { value, defaultValue, onChange, action, position = 'fixed', layout = 'auto', insetStart, insetEnd, className, style, children, onKeyDown, ...rest },
  ref,
) {
  const [current, setCurrent] = useControllable<string | undefined>(value, defaultValue, onChange as (v: string | undefined) => void);
  const listRef = useRef<HTMLDivElement | null>(null);
  /** 实际渲染出来的带文字的项数（数 DOM：子节点可能包在 Fragment 或别的组件里） */
  const [count, setCount] = useState(0);

  // 选中块：量出当前项的位置写到 --x / --w，位移交给 CSS 过渡
  const place = () => {
    const list = listRef.current;
    if (!list) return;
    const cur = list.querySelector<HTMLElement>('.ok-tabbar__item[aria-current="page"]');
    if (!cur) { list.removeAttribute('data-ready'); return; }
    list.style.setProperty('--x', cur.offsetLeft + 'px');
    list.style.setProperty('--w', cur.offsetWidth + 'px');
    if (!list.hasAttribute('data-ready')) {
      void list.offsetWidth;   // 第一次直接出现在位置上，不从左边滑过来
      list.setAttribute('data-ready', '');
    }
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  useIsoLayoutEffect(() => {
    // 只有图标的标签栏不需要上下排：没有文字的话当作 0 项
    const n = listRef.current?.querySelector('.ok-tabbar__label') ? listRef.current.querySelectorAll('.ok-tabbar__item').length : 0;
    if (n !== count) setCount(n);
    place();
  });
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => placeRef.current());
    ro.observe(list);
    return () => ro.disconnect();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(e);
    const list = listRef.current;
    if (e.defaultPrevented || !list || e.altKey || e.ctrlKey || e.metaKey) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('.ok-tabbar__item:not([aria-disabled="true"])'));
    const index = items.indexOf(e.target as HTMLElement);
    if (index < 0) return;
    const next = arrowIndex(e.key, index, items.length, 'horizontal');
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  };

  return (
    <TabBarContext.Provider value={{ value: current, select: setCurrent }}>
      <nav
        ref={ref}
        className={cx('ok-tabbar', className)}
        data-position={position}
        data-layout={layout === 'auto' ? (count >= 4 ? 'stacked' : 'inline') : layout}
        style={insetStart !== undefined || insetEnd !== undefined ? ({ '--ok-tabbar-inset-start': cssLen(insetStart), '--ok-tabbar-inset-end': cssLen(insetEnd), ...style } as CSSProperties) : style}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div ref={listRef} className="ok-tabbar__list">
          <span className="ok-tabbar__thumb" aria-hidden="true" />
          {children}
        </div>
        {action ? <div className="ok-tabbar__action">{action}</div> : null}
      </nav>
    </TabBarContext.Provider>
  );
});

interface TabBarItemOwnProps {
  /** 这一项的值 */
  value: string;
  /** 图标 */
  icon?: ReactNode;
  /** 徽标位（未读数之类） */
  badge?: ReactNode;
  /** 只显示图标时的无障碍名称（没有 children 时必填） */
  label?: string;
  disabled?: boolean;
  href?: string;
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * as：自定义渲染的元素 / 组件（比如路由库的 Link）。不传时：有 href 是 <a>，否则是 <button>。
 * 其余属性跟着 as 走：<TabBar.Item as={Link} to="/inbox" value="inbox"> 里的 to 有类型检查。
 */
export type TabBarItemProps<E extends ElementType = 'a'> = TabBarItemOwnProps & { as?: E } & Omit<ComponentPropsWithoutRef<E>, keyof TabBarItemOwnProps | 'as' | 'type'>;

type TabBarItemImplProps = TabBarItemOwnProps & { as?: ElementType };

/** 标签栏里的一项 */
export const TabBarItem = forwardRef<HTMLElement, TabBarItemImplProps>(function TabBarItem(
  { value, as, icon, badge, label, disabled, href, className, children, onClick, ...rest },
  ref,
) {
  const ctx = useContext(TabBarContext);
  const Tag: ElementType = as ?? (href !== undefined ? 'a' : 'button');
  const active = ctx?.value === value;
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (disabled) { e.preventDefault(); return; }
    onClick?.(e);
    if (!e.defaultPrevented) ctx?.select(value);
  };
  const hasText = children !== undefined && children !== null && children !== false;
  // 只在有值时才传：自定义组件（路由库的 Link）自己算 href，不能被一个 undefined 盖掉
  const native = {
    ...(href !== undefined && !disabled ? { href } : null),
    ...(Tag === 'button' ? { type: 'button' as const, ...(disabled ? { disabled: true } : null) } : null),
  };
  return (
    <Tag
      ref={ref}
      className={cx('ok-tabbar__item ok-focusable', className)}
      {...native}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled ? true : undefined}
      aria-label={hasText ? undefined : label}
      data-value={value}
      onClick={handleClick}
      {...rest}
    >
      {icon ? <span className="ok-tabbar__icon" aria-hidden="true">{icon}</span> : null}
      {hasText ? <span className="ok-tabbar__label">{children}</span> : null}
      {badge !== undefined && badge !== null && badge !== false ? <span className="ok-tabbar__badge">{badge}</span> : null}
    </Tag>
  );
}) as unknown as <E extends ElementType = 'a'>(props: TabBarItemProps<E> & { ref?: Ref<HTMLElement> }) => ReactElement | null;

export const TabBar = Object.assign(TabBarRoot, { Item: TabBarItem });
