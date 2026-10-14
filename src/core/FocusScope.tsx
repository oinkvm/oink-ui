import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { getFocusable } from './utils';

export interface FocusScopeProps {
  children: ReactNode;
  /** 把 Tab 圈在范围内 */
  trap?: boolean;
  /** 挂载时把焦点移进来 */
  autoFocus?: boolean;
  /** 卸载时把焦点还给之前的元素；那个元素已经不在文档里时，按 restoreFocusTo 的规则找一个落脚点 */
  restoreFocus?: boolean;
  /** 首个聚焦目标；不传则找 [data-autofocus]，再不行就是容器本身 */
  initialFocus?: RefObject<HTMLElement | null>;
  /** 范围容器 */
  scopeRef: RefObject<HTMLElement | null>;
}

/** 焦点的“来处”：元素本身，加上记录当时的祖先链（元素被移除后还能顺着找回去） */
export interface FocusTrail { target: HTMLElement | null; ancestors: HTMLElement[] }

const CAN_FOCUS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]';

/** 记下一个元素和它此刻的祖先链。之后元素即使被移出文档，也能回退到最近的仍存在的祖先 */
export function captureFocusTrail(target: Element | null | undefined): FocusTrail {
  const el = target instanceof HTMLElement && target !== document.body && target !== document.documentElement ? target : null;
  const ancestors: HTMLElement[] = [];
  for (let n = el?.parentElement ?? null; n && n !== document.body && n !== document.documentElement; n = n.parentElement) ancestors.push(n);
  return { target: el, ancestors };
}

/** 被模态浮层盖住的背景（inert，或退回方案的 aria-hidden） */
const blocked = (n: HTMLElement) => !!n.closest('[inert], [aria-hidden="true"]');
const usable = (n: HTMLElement) => n.isConnected && !blocked(n);

/**
 * 把焦点还回去。原目标还在文档里就还给它；不在了（比如确认删除后那一行已经被移除）就依次回退到：
 * 最近的仍存在的可聚焦祖先 → <main>（临时给它 tabindex="-1"）→ body。返回最后拿到焦点的元素（没有动焦点时返回 null）。
 */
export function restoreFocusTo(trail: FocusTrail | null | undefined): HTMLElement | null {
  if (!trail || !trail.target) return null;   // 进来之前焦点就不在任何元素上，没有可还的
  const opts = { preventScroll: true };
  if (trail.target.isConnected) {
    // 原目标还在，但被另一层模态盖着（比如先关了外层、内层还开着）：别去动焦点，它现在属于上面那一层
    if (blocked(trail.target)) return null;
    trail.target.focus(opts);
    return trail.target;
  }
  const ancestor = trail.ancestors.find((n) => usable(n) && n.matches(CAN_FOCUS));
  if (ancestor) { ancestor.focus(opts); return ancestor; }
  const main = document.querySelector<HTMLElement>('main, [role="main"]');
  if (main && usable(main)) {
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus(opts);
    return main;
  }
  (document.activeElement as HTMLElement | null)?.blur?.();
  return document.body;
}

/** 焦点管理：进场聚焦、Tab 循环、退场归还。不渲染额外节点，范围由 scopeRef 指定 */
export function FocusScope({ children, trap = true, autoFocus = true, restoreFocus = true, initialFocus, scopeRef }: FocusScopeProps) {
  const previous = useRef<FocusTrail | null>(null);
  const restore = useRef(restoreFocus);
  restore.current = restoreFocus;

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    // 焦点已经在范围里、而且之前记过来处时保留原来的记录：StrictMode 会把这个 effect 卸载再重跑一遍，
    // 第二遍时焦点已经被第一遍移进来了（背景又是 inert 的，还不回去），不能把“来处”记成范围自己
    if (!previous.current || !scope.contains(document.activeElement)) previous.current = captureFocusTrail(document.activeElement);
    if (autoFocus && !scope.contains(document.activeElement)) {
      const target = initialFocus?.current ?? scope.querySelector<HTMLElement>('[data-autofocus]') ?? scope;
      target.focus({ preventScroll: true });
    }
    return () => {
      if (restore.current) restoreFocusTo(previous.current);
    };
    // 只在挂载 / 卸载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!trap || !scope) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getFocusable(scope);
      if (!list.length) { e.preventDefault(); scope.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === scope)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    const onFocusIn = (e: FocusEvent) => {
      // 焦点跑到范围外（比如点了地址栏再 Tab 回来）时拉回来；嵌套的浮层在自己的 portal 里，放行
      const t = e.target as HTMLElement;
      if (scope.contains(t) || t.closest?.('[data-ok-layer]') !== scope.closest('[data-ok-layer]')) return;
      (getFocusable(scope)[0] ?? scope).focus();
    };
    scope.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => { scope.removeEventListener('keydown', onKey); document.removeEventListener('focusin', onFocusIn); };
  }, [trap, scopeRef]);

  return <>{children}</>;
}
