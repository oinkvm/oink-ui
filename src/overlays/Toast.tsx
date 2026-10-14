import { forwardRef, useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, Portal, animate, cx, ease, mergeRefs, playFlip, speed, useBreakpoint, useEvent, useIsoLayoutEffect, useLocale } from '../core';

export type ToastTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface ToastAction {
  label: ReactNode;
  onClick?: () => void;
  /** 点了操作之后是否关掉这条通知，默认关 */
  dismiss?: boolean;
}

export interface ToastOptions {
  /**
   * 自己指定 id：同一个 id 再次调用会原地更新，而不是新增一条。
   * 更新是整体替换：title / description / tone / icon / action / duration 这次没传的就回到默认，
   * 不会沿用上一条的（比如上一条的“撤销”按钮不会留下来）。closable / live / onDismiss 没传时沿用上一条的
   */
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** 自定义图标，替换掉默认的描线图标；传 false 不要图标 */
  icon?: ReactNode;
  /** 多少毫秒后自动消失；0 表示一直留着。不传则用 <Toaster duration> */
  duration?: number;
  /** 操作按钮（比如“撤销”） */
  action?: ToastAction;
  /** 带一个关闭按钮。默认只有不会自动消失的通知才带 */
  closable?: boolean;
  /** 读屏播报的方式。默认 danger 用 assertive（立刻打断），其余 polite */
  live?: 'polite' | 'assertive';
  /** 这条通知消失之后 */
  onDismiss?: () => void;
}

interface ToastRecord extends ToastOptions { id: string; leaving: boolean; createdAt: number; /** 每次原地更新加一，用来重新计时 */ rev: number }

/* 模块级的小仓库：toast() 往里放，<Toaster /> 订阅并渲染。还没挂 Toaster 时先攒着 */
let records: ToastRecord[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function add(input: ToastOptions | string, tone?: ToastTone): string {
  const base: ToastOptions = typeof input === 'string' ? { title: input } : input;
  const options: ToastOptions = tone ? { ...base, tone } : base;
  const id = options.id ?? 'ok-toast-' + ++seq;
  const exists = records.some((r) => r.id === id && !r.leaving);
  records = exists
    ? records.map((r) => (r.id === id && !r.leaving ? {
      ...options, id, leaving: false, createdAt: r.createdAt, rev: r.rev + 1,
      closable: options.closable ?? r.closable, live: options.live ?? r.live, onDismiss: options.onDismiss ?? r.onDismiss,
    } : r))
    : [{ ...options, id, leaving: false, createdAt: Date.now(), rev: 0 }, ...records];
  emit();
  return id;
}
/** 让一条通知开始退场；不传 id 则全部 */
function dismiss(id?: string) {
  let changed = false;
  records = records.map((r) => {
    if (r.leaving || (id != null && r.id !== id)) return r;
    changed = true;
    return { ...r, leaving: true };
  });
  if (changed) emit();
}
function remove(id: string) {
  const rec = records.find((r) => r.id === id);
  if (!rec) return;
  records = records.filter((r) => r.id !== id);
  emit();
  rec.onDismiss?.();
}

export interface ToastApi {
  /** toast('文本') 或 toast({ title, description, tone, duration, action })；返回这条通知的 id */
  (options: ToastOptions | string): string;
  success: (options: ToastOptions | string) => string;
  warning: (options: ToastOptions | string) => string;
  danger: (options: ToastOptions | string) => string;
  /** danger 的别名 */
  error: (options: ToastOptions | string) => string;
  info: (options: ToastOptions | string) => string;
  /** 关掉某一条；不传 id 则全部关掉 */
  dismiss: (id?: string) => void;
}

/** 命令式通知。页面里需要挂一个 <Toaster /> 来显示 */
export const toast: ToastApi = Object.assign((options: ToastOptions | string) => add(options), {
  success: (options: ToastOptions | string) => add(options, 'success'),
  warning: (options: ToastOptions | string) => add(options, 'warning'),
  danger: (options: ToastOptions | string) => add(options, 'danger'),
  error: (options: ToastOptions | string) => add(options, 'danger'),
  info: (options: ToastOptions | string) => add(options, 'info'),
  dismiss,
});

/* 原型里的描线图标：每一笔 pathLength = 1，进场时依次画出来 */
const TOAST_ICON: Record<'default' | 'success' | 'warning' | 'danger' | 'info', ReactNode> = {
  success: <path pathLength={1} d="M5 10.5l3.2 3.2L15 6.5" />,
  danger: <><path pathLength={1} d="M6 6l8 8" /><path pathLength={1} d="M14 6l-8 8" /></>,
  warning: <><path pathLength={1} d="M10 5v6" /><path pathLength={1} d="M10 14.5v.1" /></>,
  info: <><path pathLength={1} d="M10 9v5.5" /><path pathLength={1} d="M10 5.8v.1" /></>,
  default: <path pathLength={1} d="M4 4.5c0 6.500 4.500 11 9 11 2.800 0 4.500-2 4.500-4.200S15.700 7.500 13.500 7.500c-2 0-3.400 1.400-3.600 3.200" />,
};

/* --------------------------------------------------------------------------
   单条通知
   -------------------------------------------------------------------------- */
interface ToastItemProps {
  record: ToastRecord;
  position: ToastPosition;
  defaultDuration: number;
  pauseOnHover: boolean;
  closeLabel: string;
  register: (id: string, node: HTMLDivElement | null) => void;
}

function ToastItem({ record, position, defaultDuration, pauseOnHover, closeLabel, register }: ToastItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const hovering = useRef(false);
  const focused = useRef(false);
  const duration = record.duration ?? defaultDuration;
  const remain = useRef(duration);
  const { id, leaving } = record;
  const top = position.startsWith('top');

  // 进场：从屏幕边缘那一侧落进来，带一点回弹
  useIsoLayoutEffect(() => {
    animate(ref.current, [{ opacity: 0, transform: `translateY(${top ? -32 : 32}px) scale(.84)` }, { opacity: 1, transform: 'none' }], { spring: 'bouncy' });
    // 只在挂载时播一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 内容原地更新（同一个 id 再次 toast）时重新计时
  useEffect(() => { remain.current = duration; }, [duration, record.rev]);

  // 自动消失；暂停时把剩余时间记下来，恢复后接着走（至少再留 800ms，来得及看一眼）
  useEffect(() => {
    if (leaving || paused || duration <= 0) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(id), remain.current);
    return () => {
      clearTimeout(timer);
      remain.current = Math.max(800, remain.current - (Date.now() - started));
    };
  }, [leaving, paused, duration, id, record.rev]);

  // 退场：朝停靠的那一侧滑走，结束后才真的移除，其余通知再补位
  useEffect(() => {
    if (!leaving) return;
    const x = position.endsWith('right') ? 56 : position.endsWith('left') ? -56 : 0;
    const y = x ? 0 : top ? -24 : 24;
    const anim = animate(ref.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate(${x}px, ${y}px) scale(.92)` }], { duration: 170, easing: ease.in, fill: 'forwards' });
    let done = false;
    const finish = () => { if (!done) { done = true; remove(id); } };
    if (anim?.finished) anim.finished.then(finish, finish);
    // 兜底：动画被取消或环境不支持时也要能移除
    const timer = setTimeout(finish, 170 * speed() + 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, id]);

  const sync = () => setPaused(hovering.current || focused.current);
  const tone = record.tone && record.tone !== 'neutral' && record.tone !== 'accent' ? record.tone : 'default';
  const live = record.live ?? (record.tone === 'danger' ? 'assertive' : 'polite');
  const closable = record.closable ?? duration <= 0;
  const action = record.action;
  const hasDescription = record.description != null && record.description !== false;

  return (
    <div
      ref={mergeRefs(ref, (node: HTMLDivElement | null) => register(id, node))}
      className={cx('ok-toast', 'ok-toast--' + tone)}
      role={live === 'assertive' ? 'alert' : 'status'}
      aria-live={live}
      aria-atomic="true"
      data-leaving={leaving ? '' : undefined}
      onClick={() => dismiss(id)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(id); } }}
      onPointerEnter={pauseOnHover ? () => { hovering.current = true; sync(); } : undefined}
      onPointerLeave={pauseOnHover ? () => { hovering.current = false; sync(); } : undefined}
      onFocus={() => { focused.current = true; sync(); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { focused.current = false; sync(); } }}
    >
      {record.icon !== false && (
        <span className="ok-toast__icon" aria-hidden="true">
          {record.icon ?? <svg className="ok-toast__glyph" viewBox="0 0 20 20">{TOAST_ICON[tone]}</svg>}
        </span>
      )}
      <div className="ok-toast__body">
        <div className="ok-toast__title">{record.title}</div>
        {hasDescription && <div className="ok-toast__desc">{record.description}</div>}
      </div>
      {action && (
        <button
          type="button"
          className="ok-btn ok-btn--sm ok-focusable ok-toast__action"
          onClick={(e) => {
            e.stopPropagation();
            action.onClick?.();
            if (action.dismiss !== false) dismiss(id);
          }}
        >
          {action.label}
        </button>
      )}
      {closable && (
        <button
          type="button"
          className="ok-btn ok-btn--ghost ok-btn--icon ok-btn--sm ok-focusable ok-toast__close"
          aria-label={closeLabel}
          onClick={(e) => { e.stopPropagation(); dismiss(id); }}
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Toaster 容器
   -------------------------------------------------------------------------- */
export interface ToasterProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 停靠位置。不传时宽屏 top-right，窄屏（< 520px）bottom-center——手机上顶部是顶栏和列表标题栏，通知挡在那里会抢点按。
   * 传一个值则所有宽度都用它（窄屏另由 mobilePosition 覆盖）；也可以按断点写：{ base: 'bottom-center', md: 'top-right' }。
   * 窄屏一律横向撑满，只分上下。底部有标签栏时用 CSS 变量 --ok-toast-bottom 把通知抬到它上面
   */
  position?: ToastPosition | ResponsiveToastPosition;
  /** 窄屏（< 520px）下的位置，优先于 position 的单值写法 */
  mobilePosition?: ToastPosition;
  /** 同时最多显示几条，超出时最旧的先退场。默认 4 */
  max?: number;
  /** 默认的自动消失时间（ms），默认 4200；0 表示不自动消失 */
  duration?: number;
  /** 指针停在通知上时暂停计时，默认开。键盘焦点在通知里时总是暂停 */
  pauseOnHover?: boolean;
  /** 到视口边缘的距离（px），默认 20，窄屏 12 */
  offset?: number;
  /** 这块区域的读屏名称 */
  label?: string;
  /** 关闭按钮的读屏名称 */
  closeLabel?: string;
  /** 渲染到哪个容器，默认 body */
  container?: HTMLElement | null;
}

export interface ResponsiveToastPosition { base?: ToastPosition; sm?: ToastPosition; md?: ToastPosition; lg?: ToastPosition; xl?: ToastPosition }

/** 通知的出口：在应用根部挂一个。新通知落在靠边的一头，其余的用 FLIP 让位 */
export const Toaster = forwardRef<HTMLDivElement, ToasterProps>(function Toaster(
  { position: positionProp, mobilePosition, max = 4, duration = 4200, pauseOnHover = true, offset, label: labelProp, closeLabel: closeLabelProp, container, className, style, ...rest },
  ref,
) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.toast.label;
  const closeLabel = closeLabelProp ?? t.common.close;
  const sm = useBreakpoint('sm');
  const md = useBreakpoint('md');
  const lg = useBreakpoint('lg');
  const xl = useBreakpoint('xl');
  let position: ToastPosition;
  if (typeof positionProp === 'object' && positionProp !== null) {
    const p = positionProp;
    position = (xl ? p.xl : undefined) ?? (lg ? p.lg : undefined) ?? (md ? p.md : undefined) ?? (sm ? p.sm : undefined) ?? p.base ?? (sm ? 'top-right' : 'bottom-center');
  } else position = (sm ? positionProp : mobilePosition ?? positionProp) ?? (sm ? 'top-right' : 'bottom-center');
  const [items, setItems] = useState<ToastRecord[]>(() => records);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const before = useRef<Map<Element, DOMRect> | null>(null);

  const register = useEvent((id: string, node: HTMLDivElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  });

  useEffect(() => {
    const onChange = () => {
      // FLIP 的第一步：仓库变了、React 还没重新渲染之前，记下每条通知现在的位置
      const first = new Map<Element, DOMRect>();
      nodes.current.forEach((node) => first.set(node, node.getBoundingClientRect()));
      before.current = first;
      setItems(records);
    };
    listeners.add(onChange);
    // 挂载之前攒下的通知
    if (records.length) setItems(records);
    return () => { listeners.delete(onChange); };
  }, []);

  // FLIP 的第二步：渲染完成后，从旧位置弹到新位置
  useIsoLayoutEffect(() => {
    if (before.current) { playFlip(before.current); before.current = null; }
  }, [items]);

  // 超出上限：最旧的先走
  useEffect(() => {
    const live = items.filter((r) => !r.leaving);
    if (max > 0 && live.length > max) live.slice(max).forEach((r) => dismiss(r.id));
  }, [items, max]);

  const vars = offset != null ? { ...style, '--ok-toast-offset': offset + 'px' } : style;

  return (
    <Portal container={container}>
      <div
        ref={ref}
        className={cx('ok-toasts', className)}
        role="region"
        aria-label={label}
        data-position={position}
        data-ok-layer=""
        style={vars}
        {...rest}
      >
        {items.map((record) => (
          <ToastItem key={record.id} record={record} position={position} defaultDuration={duration} pauseOnHover={pauseOnHover} closeLabel={closeLabel} register={register} />
        ))}
      </div>
    </Portal>
  );
});
