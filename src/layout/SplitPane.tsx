import { Children, forwardRef, useId, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { BREAKPOINTS, clamp, cx, mergeRefs, useControllable, useIsoLayoutEffect, useLocale } from '../core';
import type { Breakpoint } from '../core';

export interface SplitPaneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 分栏方向：horizontal 左右（默认），vertical 上下 */
  orientation?: 'horizontal' | 'vertical';
  /** 第一栏占的百分比（受控），0–100 */
  value?: number;
  /** 初始百分比（非受控），默认 50；双击分隔条回到这个值 */
  defaultValue?: number;
  /** 大小变化时触发，参数是新的百分比 */
  onChange?: (value: number) => void;
  /** 第一栏最小 / 最大百分比，默认 20 / 80 */
  min?: number;
  max?: number;
  /** 方向键每次调整的百分比，默认 2（按住 Shift 为 10） */
  step?: number;
  /** 自身宽度小于该断点时改为上下堆叠（不可拖拽）。默认 md；false 关闭 */
  stackBelow?: Breakpoint | false;
  /** 强制堆叠 / 不堆叠，忽略 stackBelow */
  stacked?: boolean;
  /** 分隔条的无障碍名称，默认“调整分栏大小” */
  separatorLabel?: string;
  /** 正好两个子节点：第一栏和第二栏 */
  children: ReactNode;
}

/**
 * 可拖拽分栏。分隔条是 role="separator" 的可聚焦元素：拖动、方向键、Home / End 调整，双击复位。
 * 自身变窄（按容器宽度，不是视口）时自动改成上下堆叠。
 */
export const SplitPane = forwardRef<HTMLDivElement, SplitPaneProps>(function SplitPane(
  {
    orientation = 'horizontal', value, defaultValue = 50, onChange, min = 20, max = 80, step = 2,
    stackBelow = 'md', stacked, separatorLabel: separatorLabelProp, className, style, children, ...rest
  },
  ref,
) {
  const { messages: t } = useLocale();
  const separatorLabel = separatorLabelProp ?? t.splitPane.separator;
  const [size, setSize] = useControllable(value, defaultValue, onChange);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [measuredStacked, setMeasuredStacked] = useState(false);
  const paneId = useId();
  const [first, second] = Children.toArray(children);
  const current = clamp(size, min, max);
  const horizontal = orientation === 'horizontal';
  // 上下分栏本来就是堆叠的，不需要再判断
  const stackBp = horizontal ? stackBelow : false;

  // 堆叠的样式由 @container 决定（不闪）；这里再量一次，只是为了把分隔条的语义和键盘行为对上
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || stacked !== undefined || stackBp === false) { setMeasuredStacked(false); return; }
    const limit = BREAKPOINTS[stackBp];
    const measure = () => {
      const w = root.getBoundingClientRect().width;
      setMeasuredStacked(w > 0 && w < limit);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [stacked, stackBp]);
  const isStacked = stacked ?? measuredStacked;

  const commit = (next: number) => setSize(clamp(Math.round(next * 10) / 10, min, max));

  const fromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const total = horizontal ? rect.width : rect.height;
    if (total <= 0) return;
    let ratio = horizontal ? (e.clientX - rect.left) / total : (e.clientY - rect.top) / total;
    if (horizontal && getComputedStyle(track).direction === 'rtl') ratio = 1 - ratio;
    commit(ratio * 100);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isStacked || e.button !== 0) return;
    e.preventDefault();   // 不选中文字
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    setIsDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragging.current) fromPointer(e); };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isStacked) return;
    const delta = e.shiftKey ? 10 : step;
    const dec = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const inc = horizontal ? 'ArrowRight' : 'ArrowDown';
    let next: number | null = null;
    if (e.key === dec) next = current - delta;
    else if (e.key === inc) next = current + delta;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'Enter') next = defaultValue;
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };

  const interactive = !isStacked;
  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      className={cx('ok-split', className)}
      data-orientation={orientation}
      data-stack-below={stacked === undefined && stackBp ? stackBp : undefined}
      data-stacked={stacked !== undefined ? String(stacked) : measuredStacked ? 'true' : undefined}
      data-dragging={isDragging ? '' : undefined}
      style={{ '--ok-split-size': current, ...style } as CSSProperties}
      {...rest}
    >
      <div ref={trackRef} className="ok-split__track">
        <div id={paneId} className="ok-split__pane ok-split__pane--first">{first}</div>
        <div
          role="separator"
          className="ok-split__sep ok-focusable"
          tabIndex={interactive ? 0 : undefined}
          aria-orientation={isStacked ? 'horizontal' : horizontal ? 'vertical' : 'horizontal'}
          aria-label={interactive ? separatorLabel : undefined}
          aria-controls={interactive ? paneId : undefined}
          aria-valuenow={interactive ? Math.round(current) : undefined}
          aria-valuemin={interactive ? min : undefined}
          aria-valuemax={interactive ? max : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={interactive ? () => commit(defaultValue) : undefined}
          onKeyDown={onKeyDown}
        />
        <div className="ok-split__pane ok-split__pane--second">{second}</div>
      </div>
    </div>
  );
});
