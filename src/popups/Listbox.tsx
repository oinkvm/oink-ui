import { forwardRef, useEffect, useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx, mergeRefs, useIsoLayoutEffect } from '../core';
import type { IconName } from '../core';
import { CheckMark, renderIcon, useHeld, useHighlight } from './internal';
import { usePopupOpen } from './Popup';
import type { MenuTone } from './internal';

/** Select / MultiSelect / Combobox 共用的选项数据 */
export interface SelectOption {
  value: string;
  label: ReactNode;
  /** 筛选和首字母跳转用的纯文字；label 不是字符串时请提供 */
  textValue?: string;
  disabled?: boolean;
  icon?: IconName | ReactNode;
  tone?: MenuTone;
  /** 右侧的辅助文字 */
  meta?: ReactNode;
}
export interface SelectOptionGroup { label: string; options: SelectOption[] }
export type SelectOptions = Array<SelectOption | SelectOptionGroup>;

export const isGroup = (entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup => 'options' in entry;
export const flattenOptions = (entries: SelectOptions): SelectOption[] => entries.flatMap((e) => (isGroup(e) ? e.options : [e]));
export const optionText = (o: SelectOption): string => o.textValue ?? (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : o.value);

/** 从 from 出发按方向找下一个可用项，首尾相接；找不到返回 -1 */
export function stepEnabled(flat: SelectOption[], from: number, dir: 1 | -1): number {
  const n = flat.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + dir * k) % n) + n) % n;
    if (!flat[i].disabled) return i;
  }
  return -1;
}
export const firstEnabled = (flat: SelectOption[]) => stepEnabled(flat, -1, 1);
export const lastEnabled = (flat: SelectOption[]) => stepEnabled(flat, flat.length, -1);

export interface ListboxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  id: string;
  entries: SelectOptions;
  /** 当前高亮项在拍平后列表里的下标，-1 为没有 */
  activeIndex: number;
  onActiveChange: (index: number) => void;
  isSelected: (value: string) => boolean;
  onPick: (option: SelectOption) => void;
  multi?: boolean;
  /** 打开前按“全部加粗”量一次宽度并锁住，切换选中时不变宽 */
  lockWidth?: boolean;
  /** 高亮变化是键盘引起的：把高亮项滚进可视区 */
  followActive?: boolean;
}

export const optionId = (listId: string, index: number) => `${listId}-opt-${index}`;

/** 内部使用：role="listbox" 的选项列表，焦点留在触发元素上，用 aria-activedescendant 指向高亮项 */
export const Listbox = forwardRef<HTMLDivElement, ListboxProps>(function Listbox(
  { id, entries, activeIndex, onActiveChange, isSelected, onPick, multi, lockWidth, followActive, className, ...rest },
  ref,
) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { hlRef, moveTo } = useHighlight();
  // 浮层退场期间（单选点下后立即收起）保持点选前的选中样子：勾号不在新项上描线，加粗也不跳
  const closing = !usePopupOpen();
  const live = flattenOptions(entries).filter((o) => isSelected(o.value)).map((o) => o.value);
  const shownSet = new Set(JSON.parse(useHeld(JSON.stringify(live), closing)) as string[]);

  useIsoLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (lockWidth) {
      el.style.minWidth = '';
      el.setAttribute('data-measuring', '');
      const w = Math.ceil(el.getBoundingClientRect().width);
      el.removeAttribute('data-measuring');
      if (w > 0) el.style.minWidth = w + 'px';
    }
    el.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    // 只在挂载（每次打开）时做一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const item = activeIndex >= 0 ? elRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`) ?? null : null;
    moveTo(item);
    if (item && followActive) item.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, followActive, moveTo, entries]);

  let index = -1;
  const renderOption = (o: SelectOption) => {
    index += 1;
    const i = index;
    const selected = shownSet.has(o.value);
    const toned = o.tone && o.tone !== 'neutral' ? o.tone : undefined;
    return (
      <div
        key={o.value}
        role="option"
        id={optionId(id, i)}
        className={cx('ok-menu__item', toned && `ok-menu__item--${toned}`)}
        data-index={i}
        data-value={o.value}
        data-icon={o.icon != null && o.icon !== false ? '' : undefined}
        data-tone={toned}
        data-active={i === activeIndex || undefined}
        aria-selected={selected}
        aria-disabled={o.disabled || undefined}
        // 指到禁用项：高亮淡出，不停在上一项（键盘导航仍然跳过禁用项）
        onPointerMove={() => { const next = o.disabled ? -1 : i; if (next !== activeIndex) onActiveChange(next); }}
        onClick={() => { if (!o.disabled) onPick(o); }}
      >
        {renderIcon(o.icon)}
        <span className="ok-menu__label">{o.label}</span>
        {o.meta != null && <span className="ok-menu__meta">{o.meta}</span>}
        <CheckMark />
      </div>
    );
  };

  return (
    <div
      role="listbox"
      aria-multiselectable={multi || undefined}
      tabIndex={-1}
      {...rest}
      id={id}
      ref={mergeRefs(ref, elRef)}
      className={cx('ok-menu ok-scroll', className)}
      // 单选点下就收起，对勾描线永远看不到：直接显示，不播放
      data-check={multi ? undefined : 'instant'}
      // 焦点始终留在触发元素 / 输入框上
      onMouseDown={(e) => e.preventDefault()}
      onPointerLeave={() => onActiveChange(-1)}
    >
      <span className="ok-menu__hl" ref={hlRef} aria-hidden="true" />
      {entries.map((entry, g) =>
        isGroup(entry) ? (
          <div role="group" aria-labelledby={`${id}-group-${g}`} key={`group-${g}`}>
            <div className="ok-menu__heading" id={`${id}-group-${g}`} role="presentation">{entry.label}</div>
            {entry.options.map(renderOption)}
          </div>
        ) : renderOption(entry),
      )}
    </div>
  );
});
