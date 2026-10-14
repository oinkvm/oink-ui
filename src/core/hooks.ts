import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MutableRefObject, Ref, RefCallback } from 'react';
import { canUseDOM } from './utils';
import { speed } from './motion';

export const useIsoLayoutEffect = canUseDOM ? useLayoutEffect : useEffect;

/** 引用恒定、内部永远是最新闭包的回调 */
export function useEvent<T extends (...args: never[]) => unknown>(fn: T | undefined): T {
  const ref = useRef(fn);
  useIsoLayoutEffect(() => { ref.current = fn; });
  return useCallback(((...args: never[]) => ref.current?.(...args)) as T, []);
}

/**
 * 受控 / 非受控二合一：传了 value 就受控，否则用 defaultValue 自己管。
 * setter 引用恒定，支持函数写法；同一批次里连续 set(c => c + 1) 会逐次累加（基于最新值，而不是渲染时的值）。
 * onChange 在 setter 里同步调用一次，不放进 setState 的 updater（StrictMode 下 updater 会跑两遍）。
 */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : inner;
  const emit = useEvent(onChange);
  /** 最近一次渲染出来的值 */
  const rendered = useRef(current);
  const isControlled = useRef(controlled);
  /** 本批次里已经 set 过、但还没渲染出来的值 */
  const pending = useRef<{ value: T } | null>(null);
  useIsoLayoutEffect(() => {
    rendered.current = current;
    isControlled.current = controlled;
    pending.current = null;
  });
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const base = pending.current ? pending.current.value : rendered.current;
      const fn = typeof next === 'function' ? (next as (p: T) => T) : null;
      const v = fn ? fn(base) : (next as T);
      if (Object.is(v, base)) return;
      const mark = { value: v };
      pending.current = mark;
      // 受控而外面没有接受这次变化时不会重新渲染：这一批结束后把“待定值”作废，下次仍从真实的值算起
      Promise.resolve().then(() => { if (pending.current === mark) pending.current = null; });
      if (!isControlled.current) setInner(fn ? (prev) => fn(prev) : () => v);
      emit(v);
    },
    [emit],
  );
  return [current, set] as const;
}

export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    });
  };
}

/** 媒体查询。服务端渲染时返回 fallback */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!canUseDOM) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => fallback);
}

/** 断点（min-width）。和 CSS 里的 --ok-bp-* 注释保持一致 */
export const BREAKPOINTS = { sm: 520, md: 768, lg: 1024, xl: 1280 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

/** 视口是否不小于某个断点 */
export function useBreakpoint(bp: Breakpoint, fallback = true): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[bp]}px)`, fallback);
}

export type PresenceState = 'open' | 'closed';

/**
 * 进退场：open 变 false 后先把状态切到 closed，等退场过渡结束再卸载。
 * 用法：if (!mounted) return null; <div ref={ref} data-state={state} />，CSS 里按 [data-state] 写过渡。
 */
export function usePresence(open: boolean, exitMs = 400) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<PresenceState>('closed');
  const ref = useRef<HTMLElement | null>(null);

  useIsoLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      // 过渡要有起点：节点必须先以 closed 的样式被浏览器算过一次，再切到 open。
      // 节点常常还不在：Portal 在 effect 里才拿到容器，这一刻 ref 还是空的，要等它下一次提交才挂上。
      // 如果不等就切 open，节点第一次出现时已经是 open，进场动画就没了。
      // 所以逐帧等节点出现，强制算一次样式（closed 成为过渡起点），然后再切 open。
      let id = 0;
      let frames = 0;
      const go = () => {
        const node = ref.current;
        if (!node && frames++ < 10) { id = requestAnimationFrame(go); return; }
        void node?.offsetWidth;
        setState('open');
      };
      go();
      // 后台标签页里 rAF 不跑：兜底，节点在就照常有起点
      const fallback = setTimeout(() => { cancelAnimationFrame(id); go(); }, 100);
      return () => { cancelAnimationFrame(id); clearTimeout(fallback); };
    }
    setState('closed');
    const node = ref.current;
    let done = false;
    const finish = () => { if (!done) { done = true; setMounted(false); } };
    const onEnd = (e: Event) => { if (e.target === node) finish(); };
    node?.addEventListener('transitionend', onEnd);
    // 兜底时长跟着全局倍率走：减弱动效（--ok-ms: 0）时立即卸载，慢放时也不会在过渡播完前被截断
    const timer = setTimeout(finish, exitMs * speed());
    return () => { node?.removeEventListener('transitionend', onEnd); clearTimeout(timer); };
  }, [open, mounted, exitMs]);

  return { mounted, state: open ? state : ('closed' as PresenceState), ref };
}

let lockCount = 0;
let lockRestore: (() => void) | null = null;

/** 锁住页面滚动（模态浮层打开时）。支持嵌套 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || !canUseDOM) return;
    if (lockCount++ === 0) {
      const root = document.documentElement;
      const prevOverflow = root.style.overflow;
      const prevPad = root.style.paddingRight;
      const bar = window.innerWidth - root.clientWidth;
      root.style.overflow = 'hidden';
      if (bar > 0) root.style.paddingRight = bar + 'px';
      lockRestore = () => { root.style.overflow = prevOverflow; root.style.paddingRight = prevPad; };
    }
    return () => {
      if (--lockCount === 0) { lockRestore?.(); lockRestore = null; }
    };
  }, [active]);
}

/** Esc 关闭。只有最上层的浮层响应 */
const escStack: Array<() => void> = [];
export function useEscape(active: boolean, onEscape: () => void) {
  const cb = useEvent(onEscape);
  useEffect(() => {
    if (!active || !canUseDOM) return;
    escStack.push(cb);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (escStack[escStack.length - 1] !== cb) return;
      e.preventDefault();
      cb();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = escStack.lastIndexOf(cb);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [active, cb]);
}

/** 点在若干元素之外时触发 */
export function useOutsidePress(active: boolean, refs: Array<{ current: HTMLElement | null }>, onOutside: (e: PointerEvent) => void) {
  const cb = useEvent(onOutside);
  const list = useRef(refs);
  list.current = refs;
  useEffect(() => {
    if (!active || !canUseDOM) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (list.current.some((r) => r.current && r.current.contains(t))) return;
      cb(e);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active, cb]);
}

interface InertRecord { count: number; inert: boolean; ariaHidden: string | null; viaInert: boolean }
const inertRecords = new Map<Element, InertRecord>();
/** 这些顶层节点不算“背景”：本库的浮层层（FloatingCard、Popup、Toaster 都带 data-ok-layer）、提示，以及不渲染的标签 */
const INERT_SKIP = '[data-ok-layer], .ok-popup, .ok-toasts, .ok-tooltip, [role="tooltip"], [data-ok-confirmer], [aria-live], script, style, link, template, noscript';

/**
 * 模态浮层打开期间，把 body 下除浮层之外的顶层节点对读屏和键盘隐藏（inert；不支持时退回 aria-hidden），关闭时恢复原值。
 * 按节点计数，嵌套多层模态、乱序关闭都能正确恢复。之后才挂到 body 下的浮层（模态里打开的 Select / Menu / Tooltip / Toast）不受影响。
 * layerRef 指向浮层自己（或它里面的任意节点）：包含它的那个顶层节点不会被隐藏。
 */
export function useInertOthers(active: boolean, layerRef: { current: Element | null }) {
  useEffect(() => {
    if (!active || !canUseDOM) return;
    const layer = layerRef.current;
    const supportsInert = 'inert' in HTMLElement.prototype;
    const touched: Element[] = [];
    Array.from(document.body.children).forEach((el) => {
      if (el.matches(INERT_SKIP) || (layer && el.contains(layer))) return;
      let rec = inertRecords.get(el);
      if (!rec) {
        rec = { count: 0, inert: el.hasAttribute('inert'), ariaHidden: el.getAttribute('aria-hidden'), viaInert: supportsInert };
        inertRecords.set(el, rec);
        if (supportsInert) el.setAttribute('inert', '');
        else el.setAttribute('aria-hidden', 'true');
      }
      rec.count++;
      touched.push(el);
    });
    return () => {
      touched.forEach((el) => {
        const rec = inertRecords.get(el);
        if (!rec || --rec.count > 0) return;
        inertRecords.delete(el);
        if (rec.viaInert) { if (!rec.inert) el.removeAttribute('inert'); }
        else if (rec.ariaHidden === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', rec.ariaHidden);
      });
    };
  }, [active, layerRef]);
}
