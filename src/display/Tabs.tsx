import { forwardRef, useEffect, useId, useRef } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { animate, cx, ease, speed, useControllable, useEvent, useIsoLayoutEffect } from '../core';

export interface TabItem {
  value: string;
  label: ReactNode;
  /** 面板内容 */
  content?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** auto（默认）：方向键移动焦点的同时切换；manual：方向键只移动焦点，Enter / 空格才切换 */
  activation?: 'auto' | 'manual';
  /** 标签列表的名字（aria-label） */
  label?: string;
  /**
   * 所有面板都保持挂载并叠放在一起，高度取最高的那个：切换时高度不变、面板里的状态（输入、滚动位置）保留，
   * 代价是面板高度差很大时矮的那个下面会留一大块空白。默认 false：只渲染当前面板，高度变化用动效平滑过渡
   */
  keepMounted?: boolean;
  /** @deprecated 只渲染当前面板已经是默认行为，不用再传。传了会压过 keepMounted */
  unmountInactive?: boolean;
}

/** 标签页：墨线先伸展覆盖新旧两个标签，再向新标签收拢；面板按方向滑入 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { items, value, defaultValue, onChange, activation = 'auto', label, keepMounted = false, unmountInactive: unmountProp, className, ...rest }, ref,
) {
  const unmountInactive = unmountProp ?? !keepMounted;
  const uid = useId();
  const [current, setCurrent] = useControllable(value, defaultValue ?? items.find((it) => !it.disabled)?.value ?? '', onChange);
  const index = Math.max(0, items.findIndex((it) => it.value === current));
  const listRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const panelsRef = useRef<HTMLDivElement>(null);
  /** 上一次渲染完成时面板区的高度：切换后从它过渡到新高度 */
  const lastHeight = useRef<number | null>(null);
  const prev = useRef(index);

  const place = useEvent(() => {
    const list = listRef.current;
    const tab = tabRefs.current[index];
    if (!list || !tab) return;
    list.style.setProperty('--x', tab.offsetLeft + 'px');
    list.style.setProperty('--w', tab.offsetWidth + 'px');
  });

  useIsoLayoutEffect(() => {
    const from = prev.current;
    prev.current = index;
    place();
    const list = listRef.current;
    const a = tabRefs.current[from];
    const b = tabRefs.current[index];
    if (from === index || !list || !a || !b) return;
    const dir = index > from ? 1 : -1;
    const x0 = a.offsetLeft, w0 = a.offsetWidth, x1 = b.offsetLeft, w1 = b.offsetWidth;
    const l = Math.min(x0, x1), r = Math.max(x0 + w0, x1 + w1);
    animate(inkRef.current, [
      { transform: `translateX(${x0}px)`, width: w0 + 'px' },
      { transform: `translateX(${l}px)`, width: r - l + 'px', offset: 0.42 },
      { transform: `translateX(${x1}px)`, width: w1 + 'px' },
    ], { duration: 420, easing: ease.inOut });
    // 窄屏横向滚动时，把新标签带进可视范围（原生滚动）
    if (list.scrollWidth > list.clientWidth && typeof list.scrollTo === 'function') {
      // 减弱动效（OinkProvider 的 motion 或系统设置，都体现在 --ok-ms 上）时直接跳过去
      const behavior: ScrollBehavior = speed() === 0 ? 'auto' : 'smooth';
      if (x1 < list.scrollLeft) list.scrollTo({ left: x1 - 16, behavior });
      else if (x1 + w1 > list.scrollLeft + list.clientWidth) list.scrollTo({ left: x1 + w1 - list.clientWidth + 16, behavior });
    }
    const out = panelRefs.current[from];
    const inn = panelRefs.current[index];
    if (out && out !== inn) {
      out.dataset.leaving = '';
      const done = () => { delete out.dataset.leaving; };
      const an = animate(out, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-20 * dir}px)` }], { duration: 150, easing: ease.in });
      if (an) an.finished.then(done, done);
      else done();
    }
    if (inn) animate(inn, [{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: 'none' }], { spring: 'spring', delay: unmountInactive ? 0 : 110 });
    // 只渲染当前面板时高度会跟着内容变：从旧高度平滑过渡到新高度（无过冲的 soft 弹簧），过渡期间裁掉溢出
    const panels = panelsRef.current;
    const h0 = lastHeight.current;
    const h1 = panels?.offsetHeight ?? 0;
    if (panels && h0 !== null && Math.abs(h1 - h0) >= 1) {
      animate(panels, [{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { spring: 'soft' });
    }
  }, [index]);

  // 每次渲染后记下面板区的高度（内容自己变高变矮不做动画，只在切换标签时过渡）
  useIsoLayoutEffect(() => { lastHeight.current = panelsRef.current?.offsetHeight ?? null; });

  useEffect(() => {
    place();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => place());
    ro.observe(list);
    tabRefs.current.forEach((t) => t && ro.observe(t));
    return () => ro.disconnect();
  }, [items.length, place]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const focused = tabRefs.current.findIndex((n) => n === document.activeElement);
    const pos = enabled.indexOf(focused >= 0 ? focused : index);
    let next: number;
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    if (activation === 'auto') setCurrent(items[next].value);
  };

  return (
    <div ref={ref} className={cx('ok-tabs', className)} {...rest}>
      <div ref={listRef} className="ok-tabs__list" role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown}>
        {items.map((it, i) => (
          <button
            key={it.value}
            ref={(n) => { tabRefs.current[i] = n; }}
            type="button"
            role="tab"
            id={`${uid}-tab-${i}`}
            className="ok-tabs__tab ok-focusable"
            aria-selected={i === index}
            aria-controls={unmountInactive && i !== index ? undefined : `${uid}-panel-${i}`}
            tabIndex={i === index ? 0 : -1}
            disabled={it.disabled}
            onClick={() => setCurrent(it.value)}
          >
            {it.label}
          </button>
        ))}
        <span ref={inkRef} className="ok-tabs__ink" aria-hidden="true" />
      </div>
      <div ref={panelsRef} className="ok-tabs__panels" data-keep-mounted={unmountInactive ? undefined : ''}>
        {items.map((it, i) => (unmountInactive && i !== index ? null : (
          <div
            key={it.value}
            ref={(n) => { panelRefs.current[i] = n; }}
            role="tabpanel"
            id={`${uid}-panel-${i}`}
            aria-labelledby={`${uid}-tab-${i}`}
            className="ok-tabs__panel"
            data-state={i === index ? 'active' : 'inactive'}
            tabIndex={i === index ? 0 : -1}
          >
            {it.content}
          </div>
        )))}
      </div>
    </div>
  );
});
