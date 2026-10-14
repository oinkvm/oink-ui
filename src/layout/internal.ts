/** 布局组内部共用的小工具（不从 index 导出） */

const ITEM = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

/** 容器里可以用方向键走到的元素，按文档顺序（包含 tabindex="-1" 的） */
export function rovingItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ITEM)).filter(
    (n) => !(n as HTMLButtonElement).disabled && n.getAttribute('aria-hidden') !== 'true' && !n.closest('[hidden], [inert]'),
  );
}

/** 正在输入文字的地方：方向键要留给光标 */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file', 'color'].includes(type);
}

/** 方向键 / Home / End 对应的下一个下标；不是导航键时返回 null */
export function arrowIndex(key: string, index: number, count: number, orientation: 'horizontal' | 'vertical', loop = true): number | null {
  if (count === 0) return null;
  const prev = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
  const next = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === next) return index + 1 < count ? index + 1 : loop ? 0 : index;
  if (key === prev) return index > 0 ? index - 1 : loop ? count - 1 : index;
  return null;
}
