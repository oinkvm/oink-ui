export type ClassValue = string | number | false | null | undefined | ClassValue[] | { [k: string]: unknown };

/** 拼接类名：支持字符串、数组、{ 类名: 条件 } */
export function cx(...args: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v && v !== 0) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') for (const k in v) if (v[k]) out.push(k);
  };
  args.forEach(walk);
  return out.join(' ');
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const canUseDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** 容器内可以用 Tab 到达的元素，按文档顺序 */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => {
    if (n.closest('[inert], [aria-hidden="true"]')) return false;
    const cs = getComputedStyle(n);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  });
}

/** 把多个事件处理函数串起来；前一个调用了 preventDefault 就不再往下走 */
export function chain<E extends { defaultPrevented?: boolean }>(...fns: Array<((e: E) => void) | undefined>) {
  return (e: E) => {
    for (const fn of fns) {
      fn?.(e);
      if (e.defaultPrevented) break;
    }
  };
}
