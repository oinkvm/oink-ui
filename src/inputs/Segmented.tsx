import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ForwardedRef, HTMLAttributes, ReactNode, Ref } from 'react';
import { animate, cx, ease, mergeRefs, useControllable, useIsoLayoutEffect } from '../core';
import { useFieldControl } from './fieldContext';
import { rovingTarget } from './internal';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** 图标（放在文字前） */
  icon?: ReactNode;
  disabled?: boolean;
  /** 只有图标没有文字时的可读名称 */
  'aria-label'?: string;
}

export interface SegmentedProps<T extends string = string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  options: Array<SegmentedOption<T>>;
  value?: T;
  /** 默认选中第一个可用项 */
  defaultValue?: T;
  onChange?: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  /** 撑满一行，各项等宽 */
  block?: boolean;
  disabled?: boolean;
}

function SegmentedInner<T extends string>(
  {
    options, value, defaultValue, onChange, size = 'md', block, disabled: disabledProp, className, id,
    'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, onKeyDown, ...rest
  }: SegmentedProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const first = options.find((o) => !o.disabled)?.value ?? options[0]?.value;
  const [current, setCurrent] = useControllable<T>(value, (defaultValue ?? first) as T, onChange);
  const root = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  /** 滑块上一次摆在哪个值上（还没摆过是 null）：值真的变了才回弹 */
  const placed = useRef<T | null>(null);

  /** 把共享滑块摆到选中项上：位置走 transform（--x），宽度走 --w，过渡在 CSS 里 */
  const place = () => {
    const node = root.current;
    const cur = node?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!node || !cur) return;
    node.style.setProperty('--x', cur.offsetLeft + 'px');
    node.style.setProperty('--w', cur.offsetWidth + 'px');
  };

  /**
   * 放不下时整条横向滚动（浏览器原生滚动）：把选中项带进可视区。
   * 只动这条控件自己的 scrollLeft，不用 scrollIntoView，免得连页面也跟着滚。
   * 滑块是滚动内容的一部分（绝对定位在滚动容器里），滚动时自然跟着走，不需要另外补偿。
   */
  const reveal = () => {
    const node = root.current;
    const cur = node?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!node || !cur || node.scrollWidth <= node.clientWidth) return;
    const pad = 3;   // 轨道内边距
    const left = cur.offsetLeft - pad;
    const right = cur.offsetLeft + cur.offsetWidth + pad;
    if (left < node.scrollLeft) node.scrollLeft = left;
    else if (right > node.scrollLeft + node.clientWidth) node.scrollLeft = right - node.clientWidth;
  };

  useIsoLayoutEffect(() => {
    place();
    reveal();
    // 滑块在途中被轻轻压扁，落位时回弹。首次摆放不做；
    // 比较的是值而不是“挂没挂过”：StrictMode 开发模式会把 effect 跑两遍，第二遍值没变，不能误当成切换
    if (placed.current !== null && placed.current !== current) animate(thumb.current, { scale: ['1 1', '1.05 .86', '1 1'] }, { duration: 340, easing: ease.out });
    placed.current = current;
  }, [current]);

  // 选项文字或尺寸变了也要重摆
  useIsoLayoutEffect(place);

  // 容器尺寸变化时重新摆放，期间关掉过渡，免得滑块“追”过去
  useEffect(() => {
    const node = root.current;
    if (!node || typeof ResizeObserver === 'undefined') { setReady(true); return; }
    let raf = 0;
    const ro = new ResizeObserver(() => {
      setReady(false);
      place();
      reveal();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setReady(true)); });
    });
    ro.observe(node);
    raf = requestAnimationFrame(() => setReady(true));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div
      ref={mergeRefs(ref, root)}
      id={field.id}
      role="radiogroup"
      className={cx('ok-seg', size !== 'md' && `ok-seg--${size}`, block && 'ok-seg--block', className)}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      aria-disabled={field.disabled || undefined}
      data-ready={ready ? '' : undefined}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const next = rovingTarget(e, '[role="radio"]');
        if (!next) return;
        next.focus();
        const v = next.dataset.value as T | undefined;
        if (v !== undefined) setCurrent(v);
      }}
      {...rest}
    >
      <span className="ok-seg__thumb" ref={thumb} aria-hidden="true" />
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            className="ok-seg__item ok-focusable"
            aria-checked={on}
            aria-label={o['aria-label']}
            tabIndex={on ? 0 : -1}
            disabled={field.disabled || o.disabled}
            data-value={o.value}
            onClick={() => setCurrent(o.value)}
          >
            {o.icon}
            {o.label != null && o.label !== '' && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 分段控件：radiogroup 语义。共享滑块跟随选中项滑动；方向键移动并选中，Home / End 到两端 */
export const Segmented = forwardRef(SegmentedInner) as <T extends string = string>(
  props: SegmentedProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReturnType<typeof SegmentedInner>;
