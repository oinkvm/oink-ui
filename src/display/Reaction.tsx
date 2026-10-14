import { forwardRef, useRef } from 'react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { animate, chain, cx, ease, mergeRefs, speed, useControllable, useLocale } from '../core';
import { Roll } from './Roll';

export interface ReactionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onChange?: (pressed: boolean) => void;
  /** 别人点的数量（不含自己）。显示的数字 = count + 自己是否点了。不传就不显示数字 */
  count?: number;
  /** 按钮的名字（给读屏），默认 “Oink 一下” */
  label?: string;
  /** 自定义图标（24×24），默认猪鼻子 */
  icon?: ReactNode;
  /** 点亮时不放粒子 */
  noBurst?: boolean;
}

/** 粒子迸发（品牌微交互）：一圈小圆点从中心飞出、落下、消失。减弱动效时不放 */
export function burst(x: number, y: number, options: { source?: Element; count?: number; distance?: number; colors?: string[] } = {}) {
  if (typeof document === 'undefined' || speed() === 0) return;
  const count = options.count ?? 12;
  const cs = getComputedStyle(options.source ?? document.documentElement);
  const colors = options.colors ?? [
    cs.getPropertyValue('--ok-accent').trim() || '#FF6B8E',
    cs.getPropertyValue('--ok-accent-tint-2').trim() || '#FFC4D2',
    cs.getPropertyValue('--ok-text').trim() || '#1B1C22',
  ];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'ok-particle';
    p.setAttribute('aria-hidden', 'true');
    const size = 4 + Math.random() * 6;
    const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = (options.distance ?? 46) * (0.6 + Math.random() * 0.7);
    p.style.cssText = `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;background:${colors[i % colors.length]}`;
    document.body.appendChild(p);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;
    const drop = () => p.remove();
    const an = animate(p, [
      { transform: `translate(${x}px,${y}px) scale(0)`, opacity: 1 },
      { transform: `translate(${x + dx * 0.8}px,${y + dy * 0.8}px) scale(1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${x + dx}px,${y + dy + 14}px) scale(0)`, opacity: 0 },
    ], { duration: 620 + Math.random() * 260, easing: ease.out, fill: 'forwards' });
    if (an) an.finished.then(drop, drop);
    else drop();
  }
}

const SNOUT = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />
    <ellipse className="nostril" cx="9" cy="12" rx="1.2" ry="1.9" />
    <ellipse className="nostril" cx="15" cy="12" rx="1.2" ry="1.9" />
  </svg>
);

/** 点赞按钮：aria-pressed 的开关按钮；点亮时图标弹一下、放一圈粒子，数字滚动 */
export const Reaction = forwardRef<HTMLButtonElement, ReactionProps>(function Reaction(
  { pressed: pressedProp, defaultPressed = false, onChange, count, label: labelProp, icon, noBurst, className, onClick, children, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.reaction.label;
  const [pressed, setPressed] = useControllable(pressedProp, defaultPressed, onChange);
  const node = useRef<HTMLButtonElement>(null);
  const handle = (_e: MouseEvent<HTMLButtonElement>) => {
    const on = !pressed;
    setPressed(on);
    if (on && !noBurst) {
      const r = node.current?.querySelector('.ok-react__icon')?.getBoundingClientRect();
      if (r) burst(r.left + r.width / 2, r.top + r.height / 2, { source: node.current ?? undefined });
    }
  };
  return (
    <button ref={mergeRefs(ref, node)} type="button" className={cx('ok-react ok-focusable', className)} aria-pressed={pressed} data-icon-only={count == null && children == null ? '' : undefined} onClick={chain(onClick, handle)} {...rest}>
      <span className="ok-react__icon">{icon ?? SNOUT}</span>
      <span className="ok-sr">{label}</span>
      {children}
      {count != null && <Roll className="ok-react__count" value={count + (pressed ? 1 : 0)} />}
    </button>
  );
});
