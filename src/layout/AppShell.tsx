import { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { BREAKPOINTS, Icon, chain, cx, mergeRefs, useBreakpoint, useControllable, useIsoLayoutEffect, useLocale } from '../core';
import type { Breakpoint } from '../core';
import { FloatingCard } from '../overlays/FloatingCard';
import type { FloatingCardProps } from '../overlays/FloatingCard';
import { NavCollapsedContext } from './Nav';
import { spacePx, spaceVar } from './responsive';
import type { Space } from './responsive';

/* ------------------------------------------------------------------ 上下文 */

export interface AppShellState {
  /** 侧栏当前是不是抽屉形态（窄屏，或 collapsed 强制） */
  sidebarCollapsed: boolean;
  /** 辅助栏当前是不是抽屉形态 */
  asideCollapsed: boolean;
  /** 侧栏抽屉是否打开（只在抽屉形态下有意义） */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  /** 抽屉形态：开 / 关抽屉；停靠形态：展开 / 收成图标窄条 */
  toggleSidebar: () => void;
  /** 停靠的侧栏是否收成图标窄条 */
  rail: boolean;
  setRail: (rail: boolean) => void;
  toggleRail: () => void;
  /** 辅助栏是否显示：抽屉形态下是抽屉开没开，停靠形态下是那一栏在不在 */
  asideOpen: boolean;
  setAsideOpen: (open: boolean) => void;
  toggleAside: () => void;
  /** 是否嵌在容器里（contained） */
  contained: boolean;
  /** <main> 的 id，跳转链接指向它 */
  mainId: string;
}

interface AppShellInternal extends AppShellState {
  root: HTMLElement | null;
  floatGap: number | undefined;
}

const AppShellContext = createContext<AppShellInternal | null>(null);

function useShell(part: string): AppShellInternal {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error(`${part} 必须放在 <AppShell> 里面`);
  return ctx;
}

/** 读取 / 控制所在的 AppShell：toggleSidebar、sidebarOpen、rail … */
export function useAppShell(): AppShellState {
  const { root: _root, floatGap: _gap, ...state } = useShell('useAppShell()');
  return state;
}

/* ------------------------------------------------------------------ 根 */

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  /** 嵌在一个固定高度的容器里：高度取 100%（而不是 100dvh），窄屏判断按自身宽度（@container），抽屉也只盖住这个容器 */
  contained?: boolean;
  /** 侧栏 / 辅助栏是否收成悬浮卡片抽屉。'auto'（默认）按断点判断；true / false 强制 */
  collapsed?: 'auto' | boolean;
  /** collapsed="auto" 时，宽度小于该断点侧栏变抽屉。默认 md */
  collapseBelow?: Breakpoint;
  /** collapsed="auto" 时，宽度小于该断点辅助栏变抽屉。默认 lg */
  asideCollapseBelow?: Breakpoint;
  /** 侧栏抽屉的开关（受控 / 非受控） */
  sidebarOpen?: boolean;
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  /**
   * 辅助栏的显示 / 隐藏（受控 / 非受控），两种形态共用：抽屉形态下是抽屉的开关，停靠形态下是那一栏在不在。
   * 不传 defaultAsideOpen 时：停靠默认显示，抽屉默认关闭；在两种形态之间切换时回到各自的默认
   * （受控时，变成抽屉形态的那一刻如果还开着，会通过 onAsideOpenChange(false) 请求关掉，免得窗口一变窄就弹出模态抽屉）。
   */
  asideOpen?: boolean;
  defaultAsideOpen?: boolean;
  onAsideOpenChange?: (open: boolean) => void;
  /** 停靠的侧栏收成图标窄条（受控 / 非受控） */
  rail?: boolean;
  defaultRail?: boolean;
  onRailChange?: (rail: boolean) => void;
  /** 卡片之间、卡片到边缘的缝（间距档位）。默认 12px，窄屏 8px，和 FloatingCard 一致 */
  gap?: Space;
  /** 跳转链接的文字，默认“跳到主要内容” */
  skipLinkLabel?: string;
  /** <main> 的 id；不传自动生成 */
  mainId?: string;
}

/**
 * 应用骨架。侧栏和辅助栏是和页面边缘留缝的圆角卡片：宽屏停靠在两侧、占据布局空间，
 * 窄屏时同一份内容改由 FloatingCard 从对应一侧滑入。整体占满一屏，各区各自滚动。
 * 各部件（Header / Sidebar / Main / Aside / Footer）要作为 AppShell 的直接子节点。
 */
const AppShellRoot = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  {
    contained = false, collapsed = 'auto', collapseBelow = 'md', asideCollapseBelow = 'lg',
    sidebarOpen: sidebarOpenProp, defaultSidebarOpen = false, onSidebarOpenChange,
    asideOpen: asideOpenProp, defaultAsideOpen, onAsideOpenChange,
    rail: railProp, defaultRail = false, onRailChange,
    gap, skipLinkLabel: skipLinkLabelProp, mainId: mainIdProp, className, style, children, ...rest
  },
  ref,
) {
  const skipLinkLabelDefault = useLocale().messages.appShell.skipLink;
  const skipLinkLabel = skipLinkLabelProp ?? skipLinkLabelDefault;
  const autoId = useId();
  const mainId = mainIdProp ?? `ok-main-${autoId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useControllable(sidebarOpenProp, defaultSidebarOpen, onSidebarOpenChange);
  const [rail, setRail] = useControllable(railProp, defaultRail, onRailChange);

  // 宽度从哪来：普通模式看视口（媒体查询），contained 模式量自己
  const viewportSidebar = useBreakpoint(collapseBelow);
  const viewportAside = useBreakpoint(asideCollapseBelow);
  const [ownWidth, setOwnWidth] = useState<number | null>(null);
  useIsoLayoutEffect(() => {
    if (!root || !contained) { setOwnWidth(null); return; }
    const measure = () => {
      const w = root.getBoundingClientRect().width;
      setOwnWidth(w > 0 ? w : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [root, contained]);

  const atLeast = (bp: Breakpoint, viewport: boolean) => (contained ? ownWidth === null || ownWidth >= BREAKPOINTS[bp] : viewport);
  const sidebarCollapsed = collapsed === 'auto' ? !atLeast(collapseBelow, viewportSidebar) : collapsed;
  const asideCollapsed = collapsed === 'auto' ? !atLeast(asideCollapseBelow, viewportAside) : collapsed;

  // 辅助栏：停靠默认显示，抽屉默认关闭
  const [asideStored, setAsideOpen] = useControllable(asideOpenProp, defaultAsideOpen ?? !asideCollapsed, onAsideOpenChange);
  const asideControlled = asideOpenProp !== undefined;
  /** 存着的开合状态属于哪种形态。形态刚变、状态还没跟上的那一次渲染里直接按新形态的默认值算，免得模态抽屉闪一下 */
  const asideForm = useRef(asideCollapsed);
  const asideOpen = asideForm.current === asideCollapsed
    ? asideStored
    : asideCollapsed ? false : asideControlled ? asideStored : defaultAsideOpen ?? true;

  // 回到停靠形态时把抽屉状态收掉，免得下次变窄时自己弹出来
  useEffect(() => { if (!sidebarCollapsed && sidebarOpen) setSidebarOpen(false); }, [sidebarCollapsed, sidebarOpen, setSidebarOpen]);
  // 辅助栏在两种形态之间切换：变成抽屉时关上（不让模态抽屉自己弹出来），回到停靠时恢复默认（显示）
  useEffect(() => {
    if (asideForm.current === asideCollapsed) return;
    asideForm.current = asideCollapsed;
    if (asideCollapsed) setAsideOpen(false);
    else if (!asideControlled) setAsideOpen(defaultAsideOpen ?? true);
  }, [asideCollapsed, asideControlled, defaultAsideOpen, setAsideOpen]);

  const ctx = useMemo<AppShellInternal>(() => ({
    sidebarCollapsed, asideCollapsed, sidebarOpen, setSidebarOpen,
    openSidebar: () => setSidebarOpen(true),
    closeSidebar: () => setSidebarOpen(false),
    toggleSidebar: () => (sidebarCollapsed ? setSidebarOpen((v) => !v) : setRail((v) => !v)),
    rail, setRail, toggleRail: () => setRail((v) => !v),
    asideOpen, setAsideOpen, toggleAside: () => setAsideOpen((v) => !v),
    contained, mainId, root, floatGap: gap !== undefined ? spacePx(gap) : undefined,
  }), [sidebarCollapsed, asideCollapsed, sidebarOpen, setSidebarOpen, rail, setRail, asideOpen, setAsideOpen, contained, mainId, root, gap]);

  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(mainId);
    if (!main) return;
    // 自己把焦点送过去：不改地址栏的 hash，嵌在演示容器里也不会带着整页滚动
    e.preventDefault();
    main.focus();
  };

  return (
    <AppShellContext.Provider value={ctx}>
      <div
        ref={mergeRefs(ref, setRoot)}
        className={cx('ok-shell', className)}
        data-contained={contained ? '' : undefined}
        data-collapsed={String(collapsed)}
        data-collapse-below={collapseBelow}
        data-aside-collapse-below={asideCollapseBelow}
        style={gap !== undefined ? ({ '--ok-shell-gap': spaceVar(gap), ...style } as CSSProperties) : style}
        {...rest}
      >
        <a className="ok-skip-link ok-focusable" href={`#${mainId}`} onClick={skip}>{skipLinkLabel}</a>
        {children}
      </div>
    </AppShellContext.Provider>
  );
});

/* ------------------------------------------------------------------ 顶栏 / 底栏 */

export interface AppShellBarProps extends HTMLAttributes<HTMLElement> {
  /** plain（默认）直接坐在画布上；card 和侧栏一样是一张卡片 */
  variant?: 'plain' | 'card';
}

/** 顶栏：<header>（banner 地标）。横向排列，放品牌、SidebarTrigger、全局操作 */
const Header = forwardRef<HTMLElement, AppShellBarProps>(function AppShellHeader({ variant = 'plain', className, ...rest }, ref) {
  useShell('<AppShell.Header>');
  return <header ref={ref} className={cx('ok-shell__header', className)} data-variant={variant} {...rest} />;
});

/** 底栏：<footer>（contentinfo 地标） */
const Footer = forwardRef<HTMLElement, AppShellBarProps>(function AppShellFooter({ variant = 'plain', className, ...rest }, ref) {
  useShell('<AppShell.Footer>');
  return <footer ref={ref} className={cx('ok-shell__footer', className)} data-variant={variant} {...rest} />;
});

/* ------------------------------------------------------------------ 侧栏 / 辅助栏 */

export interface AppShellPanelProps extends HTMLAttributes<HTMLElement> {
  /** 无障碍名称。侧栏默认“侧栏”，辅助栏默认“辅助栏” */
  label?: string;
  /** 停靠时的宽度（数字按 px）。侧栏默认 260，辅助栏默认 320 */
  width?: number | string;
  /** 抽屉形态下的宽度（数字按 px）。默认 300 / 360，且不会超过可用宽度 */
  drawerWidth?: number | string;
  /** 卡片内边距（间距档位），默认 5（20px：外圆角 32 − 导航项圆角 12） */
  padding?: Space;
  /** 抽屉形态下，点了里面的导航项 / 链接后自动关上。默认 true */
  closeOnNavigate?: boolean;
  children?: ReactNode;
}

/** 抽屉形态下把其余原生属性交给 FloatingCard：role 除外（抽屉必须是 dialog） */
function drawerRest(rest: HTMLAttributes<HTMLElement>): Partial<FloatingCardProps> {
  const { role: _role, ...other } = rest;
  return other as Partial<FloatingCardProps>;
}

const cssSize = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

function panelStyle(name: 'sidebar' | 'aside', width: number | string | undefined, padding: Space | undefined, style: CSSProperties | undefined) {
  return {
    ...(width !== undefined ? { [`--ok-shell-${name}-w`]: cssSize(width) } : null),
    ...(padding !== undefined ? { '--ok-shell-card-pad': spaceVar(padding) } : null),
    ...style,
  } as CSSProperties;
}

/**
 * 侧栏：停靠时是 <aside> 卡片；抽屉形态下同一份 children 渲染进 FloatingCard（左侧滑入，模态）。
 * className / style / ref 和其余原生属性（id、data-*、aria-*、事件）在两种形态下都落在那张卡片上；
 * 只有 role 例外：抽屉形态下卡片必须是 dialog。
 */
const Sidebar = forwardRef<HTMLElement, AppShellPanelProps>(function AppShellSidebar(
  { label: labelProp, width, drawerWidth = 300, padding, closeOnNavigate = true, className, style, children, ...rest },
  ref,
) {
  const labelDefault = useLocale().messages.appShell.sidebar;
  const label = labelProp ?? labelDefault;
  const shell = useShell('<AppShell.Sidebar>');
  const vars = panelStyle('sidebar', width, padding, style);
  if (shell.sidebarCollapsed) {
    return (
      <FloatingCard
        {...drawerRest(rest)}
        ref={ref as Ref<HTMLDivElement>}
        open={shell.sidebarOpen}
        onOpenChange={shell.setSidebarOpen}
        placement="left"
        modal
        size={drawerWidth}
        gap={shell.floatGap}
        container={shell.contained ? shell.root : undefined}
        contained={shell.contained}
        aria-label={label}
        className={cx('ok-shell-card ok-shell__drawer ok-scroll', className)}
        style={vars}
      >
        <NavCollapsedContext.Provider value={false}>
          <div className="ok-shell__drawer-body" onClick={closeOnNavigate ? (e) => closeOnLink(e, shell.setSidebarOpen) : undefined}>
            {children}
          </div>
        </NavCollapsedContext.Provider>
      </FloatingCard>
    );
  }
  return (
    <aside
      ref={ref}
      aria-label={label}
      className={cx('ok-shell__sidebar ok-shell-card ok-scroll', className)}
      data-rail={shell.rail ? '' : undefined}
      style={vars}
      {...rest}
    >
      <NavCollapsedContext.Provider value={shell.rail}>{children}</NavCollapsedContext.Provider>
    </aside>
  );
});

/**
 * 辅助栏：停靠时是右侧的 <aside> 卡片；抽屉形态下由 FloatingCard 从右侧滑入（模态）。
 * 两种形态都由 asideOpen 控制显示：停靠默认显示，抽屉默认关闭。原生属性的透传规则同侧栏。
 */
const Aside = forwardRef<HTMLElement, AppShellPanelProps>(function AppShellAside(
  { label: labelProp, width, drawerWidth = 360, padding, closeOnNavigate = false, className, style, children, ...rest },
  ref,
) {
  const labelDefault = useLocale().messages.appShell.aside;
  const label = labelProp ?? labelDefault;
  const shell = useShell('<AppShell.Aside>');
  const vars = panelStyle('aside', width, padding, style);
  if (shell.asideCollapsed) {
    return (
      <FloatingCard
        {...drawerRest(rest)}
        ref={ref as Ref<HTMLDivElement>}
        open={shell.asideOpen}
        onOpenChange={shell.setAsideOpen}
        placement="right"
        modal
        size={drawerWidth}
        gap={shell.floatGap}
        container={shell.contained ? shell.root : undefined}
        contained={shell.contained}
        aria-label={label}
        className={cx('ok-shell-card ok-shell__drawer ok-scroll', className)}
        style={vars}
      >
        <div className="ok-shell__drawer-body" onClick={closeOnNavigate ? (e) => closeOnLink(e, shell.setAsideOpen) : undefined}>
          {children}
        </div>
      </FloatingCard>
    );
  }
  if (!shell.asideOpen) return null;
  return (
    <aside ref={ref} aria-label={label} className={cx('ok-shell__aside ok-shell-card ok-scroll', className)} style={vars} {...rest}>
      {children}
    </aside>
  );
});

function closeOnLink(e: MouseEvent<HTMLElement>, setOpen: (open: boolean) => void) {
  const hit = (e.target as HTMLElement).closest?.('a[href], .ok-nav__item');
  if (hit && hit.getAttribute('aria-disabled') !== 'true') setOpen(false);
}

/* ------------------------------------------------------------------ 主区 */

export type AppShellMainProps = HTMLAttributes<HTMLElement>;

/** 主区：<main>，独立滚动。跳转链接“跳到主要内容”把焦点送到这里 */
const Main = forwardRef<HTMLElement, AppShellMainProps>(function AppShellMain({ className, id, tabIndex, ...rest }, ref) {
  const shell = useShell('<AppShell.Main>');
  return <main ref={ref} id={id ?? shell.mainId} tabIndex={tabIndex ?? -1} className={cx('ok-shell__main ok-scroll', className)} {...rest} />;
});

/* ------------------------------------------------------------------ 触发按钮 */

export interface AppShellTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 控制哪一栏，默认 sidebar */
  target?: 'sidebar' | 'aside';
  /** 无障碍名称。默认“切换导航” / “切换辅助栏” */
  label?: string;
  /** 只在抽屉形态下渲染（停靠时不需要开关的话） */
  drawerOnly?: boolean;
}

/**
 * 开关侧栏 / 辅助栏的图标按钮（原型标记 .ok-btn--ghost.ok-btn--icon）。
 * 侧栏：抽屉形态下开关抽屉，停靠时在完整宽度和图标窄条之间切换。
 * 辅助栏：抽屉形态下开关抽屉，停靠时显示 / 隐藏那一栏。
 */
const Trigger = forwardRef<HTMLButtonElement, AppShellTriggerProps>(function AppShellTrigger(
  { target = 'sidebar', label, drawerOnly, className, children, onClick, ...rest },
  ref,
) {
  const { messages: t } = useLocale();
  const shell = useShell('<AppShell.Trigger>');
  const isSidebar = target === 'sidebar';
  const drawer = isSidebar ? shell.sidebarCollapsed : shell.asideCollapsed;
  if (!drawer && drawerOnly) return null;
  const expanded = isSidebar ? (drawer ? shell.sidebarOpen : !shell.rail) : shell.asideOpen;
  return (
    <button
      ref={ref}
      type="button"
      className={cx('ok-btn ok-btn--ghost ok-btn--icon ok-focusable', className)}
      aria-label={label ?? (isSidebar ? t.appShell.toggleSidebar : t.appShell.toggleAside)}
      aria-expanded={expanded}
      aria-haspopup={drawer ? 'dialog' : undefined}
      onClick={chain(onClick, () => (isSidebar ? shell.toggleSidebar() : shell.toggleAside()))}
      {...rest}
    >
      {children ?? <Icon><path d="M3.5 6h13M3.5 10h13M3.5 14h13" /></Icon>}
    </button>
  );
});

export const AppShell = Object.assign(AppShellRoot, { Header, Sidebar, Main, Aside, Footer, Trigger });
