import { Component, createContext, forwardRef, useContext, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode, Ref, RefObject } from 'react';
import { Icon, animate, cx, ease, mergeRefs, playFlip, useControllable, useLocale } from '../core';
import { FieldContext, useFieldControl } from './fieldContext';
import { CHECK_D } from './internal';

interface ChipGroupContextValue { value: string[]; toggle: (v: string) => void; selectable: boolean; disabled: boolean }
const ChipGroupContext = createContext<ChipGroupContextValue | null>(null);

export interface ChipProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** 在 ChipGroup 里标识这一项 */
  value?: string;
  /** 是否选中（受控）。传了 selected / defaultSelected / onChange 任意一个，或放在可选的 ChipGroup 里，就渲染成可选中的按钮 */
  selected?: boolean;
  defaultSelected?: boolean;
  /** 第一个参数是新的选中状态 */
  onChange?: (selected: boolean) => void;
  /** 传了就显示移除按钮；点击后先播退场动画再调用 */
  onRemove?: () => void;
  /** 移除按钮的可读名称，默认「移除」 */
  removeLabel?: string;
  /** 文字前的图标 */
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * 标签。两种形态：
 * · 可选中 —— <button aria-pressed>，选中时描出对勾
 * · 可移除 —— <span> 里带一个移除按钮
 */
export const Chip = forwardRef<HTMLElement, ChipProps>(function Chip(
  { value, selected, defaultSelected, onChange, onRemove, removeLabel: removeLabelProp, icon, disabled: disabledProp, className, children, onClick, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const removeLabel = removeLabelProp ?? t.common.remove;
  const group = useContext(ChipGroupContext);
  const inGroup = !!group && group.selectable && value !== undefined;
  const selectable = inGroup || selected !== undefined || defaultSelected !== undefined || (onChange !== undefined && !onRemove);
  const [own, setOwn] = useControllable(selected, defaultSelected ?? false, onChange);
  const on = inGroup ? group.value.includes(value) : own;
  const disabled = disabledProp ?? group?.disabled ?? false;
  const inner = useRef<HTMLElement>(null);
  // 正在播退场：ChipGroup 的补位动画跳过它，免得覆盖缩小淡出
  const [removing, setRemoving] = useState(false);
  const cls = cx('ok-chip', className);
  const lead = icon != null && <span className="ok-chip__lead">{icon}</span>;

  if (selectable && !onRemove) {
    return (
      <button
        ref={mergeRefs(ref as Ref<HTMLButtonElement>, inner as Ref<HTMLButtonElement>)}
        type="button"
        className={cx(cls, 'ok-focusable')}
        aria-pressed={on}
        disabled={disabled}
        data-value={value}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          if (inGroup) { group.toggle(value); onChange?.(!on); } else setOwn(!on);
        }}
        {...rest}
      >
        <span className="ok-chip__check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d={CHECK_D} pathLength={1} /></svg></span>
        {lead}
        <span className="ok-chip__text">{children}</span>
      </button>
    );
  }

  const remove = () => {
    setRemoving(true);
    // 先缩小淡出，再交给外面真正删掉（外层 ChipGroup 会让其余标签滑过去补位）
    const anim = animate(inner.current, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.5)' }], { duration: 140, easing: ease.in, fill: 'forwards' });
    const done = () => onRemove?.();
    if (anim?.finished) anim.finished.then(done, done);
    else done();
  };

  return (
    <span ref={mergeRefs(ref as Ref<HTMLSpanElement>, inner as Ref<HTMLSpanElement>)} className={cls} data-value={value} data-removing={removing || undefined} aria-disabled={disabled || undefined} onClick={onClick} {...rest}>
      {lead}
      <span className="ok-chip__text">{children}</span>
      {onRemove && (
        <button type="button" className="ok-chip__remove ok-focusable" aria-label={typeof children === 'string' ? `${removeLabel} ${children}` : removeLabel} disabled={disabled} onClick={remove}>
          <Icon name="x" />
        </button>
      )}
    </span>
  );
});

export interface ChipGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 选中项的 value 列表。传了 value / defaultValue / onChange 任意一个，组内带 value 的 Chip 就变成可选中 */
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** 是否可多选，默认是；false 时选中一个会取消其它 */
  multiple?: boolean;
  disabled?: boolean;
}

const EMPTY: string[] = [];

/** 补位动画的标记：用来找到、取消上一段还在播的补位 */
const FLIP_ID = 'ok-chips-flip';

interface ChipFlipProps { root: RefObject<HTMLDivElement>; children: ReactNode }
interface ChipFlipSnapshot { node: HTMLDivElement; count: number; rects: Map<Element, DOMRect> }

/**
 * 标签增删时的 FLIP。用类组件是为了 getSnapshotBeforeUpdate：React 在改 DOM 之前的那一刻调用它，
 * 「首帧」就在这时现量（同一时刻的滚动位置；上一段补位还在播时量到的是它当前的视觉位置）；
 * DOM 改完后先取消上一段补位，再量「末帧」。两次都用 getBoundingClientRect，坐标系一致。
 * 不缓存上一次渲染的坐标——页面在两次渲染之间滚动过，缓存的视口坐标就错了。
 */
class ChipFlip extends Component<ChipFlipProps> {
  getSnapshotBeforeUpdate(): ChipFlipSnapshot | null {
    const node = this.props.root.current;
    if (!node) return null;
    const items = Array.from(node.children);
    return { node, count: items.length, rects: new Map(items.map((n) => [n, n.getBoundingClientRect()])) };
  }

  componentDidUpdate(_: ChipFlipProps, __: unknown, snap: ChipFlipSnapshot | null) {
    // 父节点的合并 ref 在这一刻可能还没重新挂上，用量首帧时拿到的节点
    if (!snap || !snap.node.isConnected) return;
    const node = snap.node;
    const items = Array.from(node.children);
    if (items.length === snap.count) return;
    // 上一段补位还没播完：先取消，末帧才是真正的布局位置；首帧已经按它当时的视觉位置量过了
    items.forEach((n) => n.getAnimations?.().forEach((a) => { if (a.id === FLIP_ID) a.cancel(); }));
    const first = new Map<Element, DOMRect>();
    snap.rects.forEach((r, n) => { if (!(n as HTMLElement).dataset?.removing) first.set(n, r); });
    playFlip(first, { id: FLIP_ID });
  }

  render() { return this.props.children; }
}

/** 标签组：自动换行。组内标签增删时，其余标签用 FLIP 滑到新位置 */
export const ChipGroup = forwardRef<HTMLDivElement, ChipGroupProps>(function ChipGroup(
  { value, defaultValue, onChange, multiple = true, disabled: disabledProp, className, children, id, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const selectable = value !== undefined || defaultValue !== undefined || onChange !== undefined;
  const [current, setCurrent] = useControllable(value, defaultValue ?? EMPTY, onChange);
  const toggle = (v: string) => {
    if (current.includes(v)) setCurrent(current.filter((x) => x !== v));
    else setCurrent(multiple ? [...current, v] : [v]);
  };

  const root = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={mergeRefs(ref, root)}
      id={field.id}
      role="group"
      className={cx('ok-chips', className)}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      {...rest}
    >
      <FieldContext.Provider value={null}>
        <ChipGroupContext.Provider value={{ value: current, toggle, selectable, disabled: field.disabled }}>
          <ChipFlip root={root}>{children}</ChipFlip>
        </ChipGroupContext.Provider>
      </FieldContext.Provider>
    </div>
  );
});
