import { forwardRef, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { animate, cx, ease, mergeRefs, useIsoLayoutEffect } from '../core';

export interface RollProps extends HTMLAttributes<HTMLSpanElement> {
  /** 要显示的数字或文本；变化时旧值滚出、新值滚入 */
  value: string | number;
  /** 1 = 新值自下而上，-1 = 自上而下；auto 时数字变大向上、变小向下 */
  direction?: 1 | -1 | 'auto';
}

/** 数字 / 文本滚动替换（原型 Oink.roll） */
export const Roll = forwardRef<HTMLSpanElement, RollProps>(function Roll({ value, direction = 'auto', className, ...rest }, ref) {
  const box = useRef<HTMLSpanElement>(null);
  const cur = useRef<HTMLSpanElement>(null);
  const last = useRef(value);

  useIsoLayoutEffect(() => {
    const prev = last.current;
    if (prev === value) return;
    last.current = value;
    const host = box.current;
    const neu = cur.current;
    if (!host || !neu) return;
    const dir = direction === 'auto' ? (Number(value) < Number(prev) ? -1 : 1) : direction;
    // 旧值用一个临时节点滚出去，动画结束就移除
    const ghost = document.createElement('span');
    ghost.textContent = String(prev);
    ghost.setAttribute('aria-hidden', 'true');
    host.insertBefore(ghost, neu);
    const drop = () => ghost.remove();
    const out = animate(ghost, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-dir * 80}%)`, opacity: 0 }], { duration: 150, easing: ease.in, fill: 'forwards' });
    if (out) out.finished.then(drop, drop);
    else drop();
    animate(neu, [{ transform: `translateY(${dir * 80}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { spring: 'spring' });
  }, [value, direction]);

  return (
    <span ref={mergeRefs(ref, box)} className={cx('ok-roll', className)} {...rest}>
      <span ref={cur}>{value}</span>
    </span>
  );
});
