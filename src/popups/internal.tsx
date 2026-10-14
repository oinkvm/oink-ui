import { cloneElement, isValidElement, useCallback, useEffect, useRef, version } from 'react';
import type { ReactElement, ReactNode, Ref } from 'react';
import { Icon, ICONS, chain, cx, mergeRefs, useIsoLayoutEffect } from '../core';
import type { IconName } from '../core';

/** 菜单项的状态色。neutral 即默认 */
export type MenuTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type AnyProps = Record<string, unknown>;

/** 给使用者传进来的触发元素补上 ref、属性和事件（使用者自己的事件先执行，preventDefault 可以拦下我们的） */
export function cloneWithProps(element: ReactElement, props: AnyProps, ref?: Ref<unknown>): ReactElement {
  const own = element.props as AnyProps;
  const merged: AnyProps = { ...props };
  for (const key in props) {
    const ours = props[key];
    const theirs = own[key];
    if (/^on[A-Z]/.test(key) && typeof theirs === 'function' && typeof ours === 'function') {
      merged[key] = chain(theirs as (e: { defaultPrevented?: boolean }) => void, ours as (e: { defaultPrevented?: boolean }) => void);
    } else if (key === 'className') merged[key] = cx(theirs as string, ours as string);
    else if (key === 'style') merged[key] = { ...(ours as object), ...(theirs as object) };
    else if (ours === undefined && theirs !== undefined) merged[key] = theirs;
  }
  // React 19 把 ref 放进了 props；18 及以前在元素上
  const theirRef = (parseInt(version, 10) >= 19 ? own.ref : (element as unknown as { ref?: Ref<unknown> }).ref) as Ref<unknown> | undefined;
  if (ref) merged.ref = theirRef ? mergeRefs(theirRef, ref) : ref;
  return cloneElement(element, merged);
}

/** 图标位：传内置图标名或任意节点 */
export function renderIcon(icon: IconName | ReactNode | undefined): ReactNode {
  if (icon == null || icon === false) return null;
  if (typeof icon === 'string' && icon in ICONS) return <Icon name={icon as IconName} />;
  return isValidElement(icon) ? icon : null;
}

/** 选中对勾：路径长度归一，选中时由样式画出来 */
export function CheckMark() {
  return (
    <svg className="ok-menu__check" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.6 8.4l2.9 2.9 5.900-6.400" pathLength={1} />
    </svg>
  );
}

/**
 * 共享高亮块：一块浅灰底在各项之间滑动。
 * 把 hlRef 挂到列表容器里的 <span class="ok-menu__hl">，调用 moveTo(项) 移过去，moveTo(null) 淡出。
 */
export function useHighlight() {
  const hlRef = useRef<HTMLSpanElement | null>(null);
  const shown = useRef(false);
  const moveTo = useCallback((item: HTMLElement | null) => {
    const hl = hlRef.current;
    const list = hl?.parentElement;
    if (!hl || !list) return;
    // 禁用项不高亮：淡出，而不是停在上一项
    if (!item || item.getAttribute('aria-disabled') === 'true') {
      shown.current = false;
      list.removeAttribute('data-hl');
      return;
    }
    // 刚出现时直接落在目标上，只淡入、不从上一个位置滑过来
    const fresh = !shown.current;
    if (fresh) hl.style.transition = 'none';
    hl.dataset.tone = item.dataset.tone || '';
    hl.style.setProperty('--y', item.offsetTop + 'px');
    hl.style.height = item.offsetHeight + 'px';
    if (fresh) { void hl.offsetWidth; hl.style.transition = ''; }
    shown.current = true;
    list.setAttribute('data-hl', '');
  }, []);
  return { hlRef, moveTo };
}

/**
 * hold 为 true 时返回最近一次 hold 为 false 时提交的值。
 * 用在浮层退场期间：点选后菜单立即收起，正在退场的列表保持点选前的样子（勾号、加粗都不动）。
 */
export function useHeld<T>(value: T, hold: boolean): T {
  const last = useRef(value);
  useIsoLayoutEffect(() => { if (!hold) last.current = value; });
  return hold ? last.current : value;
}

/** 点到 a、b、c 三角形内（含边） */
function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const s = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = s(p, a, b);
  const d2 = s(p, b, c);
  const d3 = s(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
export interface Point { x: number; y: number }

/**
 * 子菜单的“安全三角”：以指针上一个位置为顶点、子菜单靠近父菜单的那条边为底的三角形。
 * 指针这一步落在三角形里，说明正朝子菜单移动（斜着穿过别的项），子菜单应该保持；否则立即让位。
 * 底边上下各放宽几像素，贴着子菜单首尾项移动也算。
 */
export function towardSubmenu(prev: Point, cur: Point, sub: DOMRect): boolean {
  if (prev.x === cur.x && prev.y === cur.y) return false;
  const right = sub.left >= prev.x;
  const x = right ? sub.left : sub.right;
  // 指针已经越过子菜单的近边（在子菜单的另一侧）不算
  if (right ? cur.x > sub.right : cur.x < sub.left) return false;
  const pad = 4;
  return inTriangle(cur, prev, { x, y: sub.top - pad }, { x, y: sub.bottom + pad });
}

export const isTypeaheadKey =(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/**
 * 首字母跳转：连续输入在 500ms 内累加成前缀；反复按同一个字母则在匹配项之间轮转。
 * 返回匹配项的下标，没有则 -1。
 */
export function useTypeahead() {
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const search = useCallback((key: string, texts: string[], current: number): number => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { buffer.current = ''; }, 500);
    buffer.current += key.toLowerCase();
    const b = buffer.current;
    const repeated = b.length > 1 && b.split('').every((c) => c === b[0]);
    const query = repeated ? b[0] : b;
    const n = texts.length;
    const start = repeated || b.length === 1 ? current + 1 : Math.max(current, 0);
    for (let k = 0; k < n; k++) {
      const i = (((start + k) % n) + n) % n;
      if (texts[i].trim().toLowerCase().startsWith(query)) return i;
    }
    return -1;
  }, []);
  /** 正在输入前缀时，空格算作字符而不是“确认” */
  const pending = useCallback(() => buffer.current.length > 0, []);
  return { search, pending };
}
