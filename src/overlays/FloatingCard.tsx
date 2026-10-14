import { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent as ReactFocusEvent, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { FocusScope, Icon, Portal, captureFocusTrail, clamp, cx, floatMotion, mergeRefs, restoreFocusTo, useEscape, useEvent, useInertOthers, useIsoLayoutEffect, useMediaQuery, usePresence, useScrollLock, useLocale } from '../core';
import type { FocusTrail } from '../core';
import { captureOrigin, trackPointerDown } from './origin';
import type { FloatOrigin, FloatPoint } from './origin';

export type FloatPlacement = 'center' | 'left' | 'right' | 'top' | 'bottom';

/** 尺寸预设。各个封装（Dialog / Drawer / Sheet / Panel）各有一张 sm / md / lg 对照表 */
export type FloatSize = 'sm' | 'md' | 'lg';

/** 把 'sm' | 'md' | 'lg' 换成对照表里的值；数字和其它字符串原样返回 */
export function resolveFloatSize(size: FloatSize | number | string | undefined, table: Record<FloatSize, number | string>): number | string | undefined {
  if (size === 'sm' || size === 'md' || size === 'lg') return table[size];
  return size;
}

export interface FloatingCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 卡片停靠的位置。center 居中；其余贴着对应的边，但始终和视口边缘留一圈间隙 */
  placement?: FloatPlacement;
  /**
   * 模态：带遮罩、锁滚动、圈住焦点，并在打开期间把背景（body 下除浮层之外的顶层节点）对读屏和键盘隐藏（inert）。
   * 非模态时页面其余部分照常可用
   */
  modal?: boolean;
  /**
   * 打开时把焦点移进卡片，关闭时还给触发元素。模态恒为 true；非模态默认 false（不打断用户正在做的事）。
   * 非模态卡片渲染在 body 末尾，键盘用户要 Tab 过整页才能进来，Esc 也只在焦点在卡片里时才生效——
   * 所以凡是“用户主动点开、接下来就要在里面操作”的面板（筛选、检查器、写信窗口）都应该打开它；
   * 只是跟着页面状态出现、不需要立刻操作的面板保持关闭。
   */
  autoFocus?: boolean;
  /** 允许 Esc 和点遮罩关闭 */
  dismissible?: boolean;
  /** 主轴尺寸：left / right / center 是宽度，top / bottom 是高度。数字按 px；'auto' 按内容 */
  size?: number | string;
  /** 卡片到视口边缘的间隙（px），默认 12，窄屏 8 */
  gap?: number;
  /** 贴边时是否在另一个方向上撑满（默认撑满）；false 则按内容大小并居中 */
  stretch?: boolean;
  /**
   * 贴边且不撑满（stretch={false}）时，卡片在交叉轴上的位置：start / center（默认）/ end。
   * 上下贴边时是水平方向（end = 右下角 / 右上角的悬浮卡片），左右贴边时是垂直方向。
   * 这种形态下的宽度默认最多 560，需要别的宽度直接给卡片 style.width
   */
  align?: 'start' | 'center' | 'end';
  role?: 'dialog' | 'alertdialog' | 'complementary' | 'region';
  'aria-label'?: string;
  /** 不传时，卡片里的 FloatingHeader 标题会自动接上来 */
  'aria-labelledby'?: string;
  /** 不传时，卡片里的 FloatingHeader 说明会自动接上来 */
  'aria-describedby'?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  /** 渲染到哪个容器；配合 contained 可以把浮层限制在某个区域内（该容器需要 position: relative） */
  container?: HTMLElement | null;
  contained?: boolean;
  /**
   * 拖拽关闭：按住卡片里带 data-ok-drag-handle 的区域（FloatingGrip、FloatingHeader），朝停靠的那一侧拖，
   * 松手时按距离和速度决定关闭还是回弹。只对贴边的卡片有效，需要 dismissible。
   */
  dragToDismiss?: boolean;
  /**
   * 手机宽度（< 520px）下左右停靠的卡片铺满整宽，这时可以在卡片任意位置朝停靠的那一侧滑动关闭
   * （左边停靠的左滑、右边停靠的右滑），竖向滚动不受影响。默认开启，需要 dismissible
   */
  swipeToDismiss?: boolean;
  /**
   * 右上角的关闭按钮。'auto'（默认）：手机宽度下贴边的卡片自动显示，卡片里的 FloatingHeader 已经带关闭按钮时不重复显示；
   * true 总是显示；false 不显示。需要 dismissible
   */
  closeButton?: boolean | 'auto';
  /** 自动关闭按钮的读屏名称，默认“关闭” */
  closeLabel?: string;
  /**
   * 从哪里放大进场（退场缩回同一点）。居中（placement="center"）的卡片默认 'trigger'：
   * 点按打开时从指针处、键盘打开时从焦点元素中心、快捷键打开（没有触发元素）时从屏幕中心。
   * 'center' 固定从屏幕中心；{ x, y } 指定视口坐标。贴边的卡片默认从停靠的一侧滑入，显式传了才改成放大
   */
  origin?: FloatOrigin;
  /** 退场动画结束、节点卸载后 */
  onExited?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface FloatingCardContextValue {
  titleId: string;
  descriptionId: string;
  /** 结构件登记自己渲染了标题 / 说明，卡片据此接上 aria-labelledby / aria-describedby */
  setTitled: (on: boolean) => void;
  setDescribed: (on: boolean) => void;
  /** 请求关闭（调用 onOpenChange(false)） */
  close: () => void;
  dismissible: boolean;
  modal: boolean;
  placement: FloatPlacement;
  draggable: boolean;
  /** FloatingHeader 登记自己带了关闭按钮，卡片就不再显示自动关闭按钮 */
  setHeaderClose: (on: boolean) => void;
}

const FloatingCardContext = createContext<FloatingCardContextValue | null>(null);

/** 卡片内部的结构件用它拿标题 id、关闭方法等；不在 FloatingCard 里时返回 null */
export function useFloatingCard(): FloatingCardContextValue | null {
  return useContext(FloatingCardContext);
}

/** 模态期间隐藏背景。open 一变 false 就恢复（不等退场动画），这样卸载时焦点才还得回去 */
function InertBackground({ active, layerRef }: { active: boolean; layerRef: RefObject<HTMLDivElement | null> }) {
  useInertOthers(active, layerRef);
  return null;
}

const px = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);

/** 起点到卡片之间有没有能横向滚动的元素（表格、横向标签栏…）：有的话横滑留给它滚动 */
function inHorizontalScroller(from: HTMLElement, card: HTMLElement): boolean {
  for (let n: HTMLElement | null = from; n && n !== card; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/** 拖拽把手里的这些元素照常响应点按，不发起拖拽 */
const INTERACTIVE = 'button, a[href], input, select, textarea, label, [role="button"], [contenteditable="true"], [data-ok-no-drag]';
/** 松手时超过这个速度（px/ms）就算“甩出去” */
const FLING = 0.5;

/**
 * 悬浮卡片：所有“浮在页面之上的容器”的共同基座。
 * Dialog、Drawer、Sheet、Panel 都只是它在不同位置、不同尺寸下的用法：
 * 一张圆角卡片，四周留缝，从停靠的那一侧滑入。没有阴影，靠遮罩和描边分层。
 */
export const FloatingCard = forwardRef<HTMLDivElement, FloatingCardProps>(function FloatingCard(
  {
    open, onOpenChange, placement = 'center', modal = true, autoFocus = false, dismissible = true, size, gap, stretch = true, align,
    role = 'dialog', initialFocus, restoreFocus = true, container, contained, dragToDismiss = false, swipeToDismiss = true,
    closeButton = 'auto', closeLabel: closeLabelProp, origin, onExited,
    className, style, children,
    'aria-label': ariaLabel, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy,
    onPointerDown, onFocus, onBlur, ...rest
  },
  ref,
) {
  const closeLabelDefault = useLocale().messages.common.close;
  const closeLabel = closeLabelProp ?? closeLabelDefault;
  // 退场（--ok-float-out-dur）播完时卡片的 transitionend 就会卸载；这里只是兜底，留出一倍余量
  const { mounted, state, ref: presenceRef } = usePresence(open, floatMotion.out * 2);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const titleId = uid + 'title';
  const descriptionId = uid + 'desc';
  const [titled, setTitled] = useState(false);
  const [described, setDescribed] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  /** 非模态：焦点进卡片之前在哪，关闭时还回去 */
  const returnTo = useRef<FocusTrail | null>(null);

  /** 放大进场：居中的卡片默认如此，其它停靠方式显式传了 origin 才是 */
  const zoom = origin !== undefined || placement === 'center';
  /** 这一次打开的触发点（视口坐标）：在焦点移进卡片之前取 */
  const [point, setPoint] = useState<FloatPoint | null>(null);
  useEffect(() => { trackPointerDown(); }, []);
  useIsoLayoutEffect(() => {
    if (open && zoom) setPoint(captureOrigin(origin ?? 'trigger'));
    // 只在打开的那一刻取一次；退场缩回同一点
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /** 卡片节点挂上（或触发点变了）时，把触发点换算成卡片自己坐标系里的 transform-origin */
  const applied = useRef<{ node: HTMLElement; point: FloatPoint } | null>(null);
  const originRef = (node: HTMLDivElement | null) => {
    if (!node || !zoom || !point) return;
    if (applied.current && applied.current.node === node && applied.current.point === point) return;
    applied.current = { node, point };
    const layer = node.offsetParent;
    if (!layer) return;
    // offsetLeft / offsetTop 不受 transform 影响：就是卡片停在居中位置时的左上角（相对浮层这一层）
    const base = layer.getBoundingClientRect();
    node.style.setProperty('--_ox', `${point.x - base.left - node.offsetLeft}px`);
    node.style.setProperty('--_oy', `${point.y - base.top - node.offsetTop}px`);
  };

  const close = useEvent(() => { onOpenChange?.(false); });
  const exited = useEvent(() => { onExited?.(); });

  useScrollLock(mounted && modal && !contained);
  // 非模态时只有焦点在卡片里才登记 Esc，免得抢页面上别处（或下层浮层）的 Esc
  useEscape(open && dismissible && (modal || focusWithin), close);

  const wasMounted = useRef(mounted);
  useEffect(() => {
    if (wasMounted.current && !mounted) { setFocusWithin(false); exited(); }
    wasMounted.current = mounted;
  }, [mounted, exited]);

  // 非模态卡片没有焦点圈：只有关闭时焦点还在卡片里，才把它还给进来之前的元素
  useEffect(() => {
    if (open || modal || !restoreFocus) return;
    const card = cardRef.current;
    if (card && card.contains(document.activeElement)) restoreFocusTo(returnTo.current);
  }, [open, modal, restoreFocus]);

  const draggable = dragToDismiss && dismissible && placement !== 'center';
  const narrow = useMediaQuery('(max-width: 519.98px)');
  const horizontalDock = placement === 'left' || placement === 'right';
  // 手机上铺满整宽的左右卡片：任意位置都能朝停靠侧滑动关闭
  const swipe = swipeToDismiss && dismissible && narrow && horizontalDock && !contained;
  const [headerClose, setHeaderClose] = useState(false);
  const showAutoClose = dismissible && !headerClose
    && (closeButton === true || (closeButton === 'auto' && narrow && placement !== 'center' && !contained));

  const ctx = useMemo<FloatingCardContextValue>(
    () => ({ titleId, descriptionId, setTitled, setDescribed, close, dismissible, modal, placement, draggable, setHeaderClose }),
    [titleId, descriptionId, close, dismissible, modal, placement, draggable],
  );

  if (!mounted) return null;

  const handleFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    onFocus?.(e);
    const card = cardRef.current;
    const from = e.relatedTarget as HTMLElement | null;
    if (!focusWithin && from && card && !card.contains(from)) returnTo.current = captureFocusTrail(from);
    setFocusWithin(true);
  };
  const handleBlur = (e: ReactFocusEvent<HTMLDivElement>) => {
    onBlur?.(e);
    const to = e.relatedTarget as Node | null;
    if (!to || !cardRef.current?.contains(to)) setFocusWithin(false);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    const card = cardRef.current;
    if ((!draggable && !swipe) || !card || e.defaultPrevented || state !== 'open') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    const handle = target.closest?.('[data-ok-drag-handle]');
    // 嵌套浮层的事件会顺着 React 树冒上来：起点必须真的在这张卡片的 DOM 里
    if (!card.contains(target) || target.closest(INTERACTIVE)) return;
    const fromHandle = draggable && !!handle && card.contains(handle);
    // 任意位置滑动只认触摸和触控笔，并且起点不在能横向滚动的区域里（那里的横滑留给滚动）
    const fromSwipe = !fromHandle && swipe && e.pointerType !== 'mouse' && !inHorizontalScroller(target, card);
    if (!fromHandle && !fromSwipe) return;
    const startX = e.clientX;
    const startY = e.clientY;

    const horizontal = placement === 'left' || placement === 'right';
    const sign = placement === 'bottom' || placement === 'right' ? 1 : -1;
    const pointerId = e.pointerId;
    const origin = horizontal ? e.clientX : e.clientY;
    const rect = card.getBoundingClientRect();
    const extent = horizontal ? rect.width : rect.height;
    const scrim = scrimRef.current;
    let dragging = false;
    let dist = 0;
    let velocity = 0;
    let lastT = e.timeStamp;
    let lastD = 0;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const raw = ((horizontal ? ev.clientX : ev.clientY) - origin) * sign;
      if (!dragging) {
        if (fromSwipe) {
          // 方向锁：先看手指往哪走。竖着走就是滚动，放弃；横着走、但朝停靠的反方向，也放弃
          const dx = Math.abs(ev.clientX - startX);
          const dy = Math.abs(ev.clientY - startY);
          if (dx < 8 && dy < 8) return;
          if (dy > dx || raw <= 0) { cleanup(); return; }
        }
        if (Math.abs(raw) < 4) return;
        dragging = true;
        card.style.transition = 'none';
        card.setAttribute('data-dragging', '');
        if (scrim) scrim.style.transition = 'none';
      }
      // 往回拖只给一点点阻尼位移，不让卡片冲出间隙
      dist = raw >= 0 ? raw : Math.max(raw * 0.15, -8);
      const dt = ev.timeStamp - lastT;
      if (dt > 0) { velocity = (dist - lastD) / dt; lastT = ev.timeStamp; lastD = dist; }
      const offset = dist * sign;
      card.style.transform = horizontal ? `translateX(${offset}px)` : `translateY(${offset}px)`;
      if (scrim) scrim.style.opacity = String(1 - clamp(dist / (extent || 320), 0, 1) * 0.7);
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
    const finish = (ev: PointerEvent, cancelled: boolean) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      if (!dragging) return;
      // 手指停住再松开不算甩
      if (ev.timeStamp - lastT > 120) velocity = 0;
      const threshold = extent > 0 ? Math.min(extent * 0.4, 160) : 160;
      const shouldClose = !cancelled && (dist > threshold || (velocity > FLING && dist > 12));
      // 去掉行内样式：过渡从手指松开的位置接着走，回弹用进场的弹簧，关闭用退场的缓动
      card.style.transition = '';
      card.style.transform = '';
      card.removeAttribute('data-dragging');
      if (scrim) scrim.style.transition = '';
      if (shouldClose) {
        close();
        // 遮罩保持拖到的透明度一路淡出；如果外面没有真的关掉，下一帧再恢复
        requestAnimationFrame(() => {
          if (scrim && layerRef.current?.getAttribute('data-state') === 'open') scrim.style.opacity = '';
        });
      } else if (scrim) scrim.style.opacity = '';
    };
    const onUp = (ev: PointerEvent) => finish(ev, false);
    const onCancel = (ev: PointerEvent) => finish(ev, true);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  };

  const autoSize = size === 'auto';
  const vars = { '--ok-float-size': autoSize ? undefined : px(size), '--ok-float-gap': gap != null ? gap + 'px' : undefined } as CSSProperties;

  return (
    <Portal container={container}>
      <div
        ref={layerRef}
        className={cx('ok-float', contained && 'ok-float--contained', modal && 'ok-float--modal')}
        data-ok-layer=""
        data-state={state}
        data-placement={placement}
        data-stretch={stretch ? '' : undefined}
        data-align={align}
        data-size={autoSize ? 'auto' : undefined}
        data-zoom={zoom ? '' : undefined}
        style={vars}
      >
        {modal && <div ref={scrimRef} className="ok-float__scrim" aria-hidden="true" onClick={dismissible ? close : undefined} />}
        <FocusScope scopeRef={cardRef} trap={modal} autoFocus={modal || autoFocus} restoreFocus={restoreFocus && modal} initialFocus={initialFocus}>
          <div
            {...rest}
            ref={mergeRefs(ref, cardRef, presenceRef as RefObject<HTMLDivElement>, originRef)}
            className={cx('ok-float__card', className)}
            style={style}
            role={role}
            aria-modal={modal && (role === 'dialog' || role === 'alertdialog') ? true : undefined}
            aria-label={ariaLabel}
            aria-labelledby={labelledBy ?? (titled && !ariaLabel ? titleId : undefined)}
            aria-describedby={describedBy ?? (described ? descriptionId : undefined)}
            data-draggable={draggable ? '' : undefined}
            data-swipe={swipe ? '' : undefined}
            tabIndex={-1}
            onPointerDown={handlePointerDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            <FloatingCardContext.Provider value={ctx}>{children}</FloatingCardContext.Provider>
            {showAutoClose && (
              <button type="button" className="ok-btn ok-btn--ghost ok-btn--icon ok-btn--sm ok-focusable ok-float__close ok-float__close--auto" aria-label={closeLabel} onClick={close}>
                <Icon name="x" />
              </button>
            )}
          </div>
        </FocusScope>
        {/* 放在 FocusScope 后面：它先记下触发元素、把焦点移进卡片，这里再把背景设为 inert */}
        {modal && !contained && <InertBackground active={open} layerRef={layerRef} />}
      </div>
    </Portal>
  );
});
