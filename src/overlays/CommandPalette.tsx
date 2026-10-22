import { guardImeEnter, isImeComposing } from '../core/ime';
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Icon, cx, useControllable, useIsoLayoutEffect, useLocale } from '../core';
import { useHighlight } from '../popups/internal';
import { FloatingCard } from './FloatingCard';
import type { FloatingCardProps } from './FloatingCard';
import type { FloatOrigin } from './origin';

export interface CommandItem {
  /** 唯一标识 */
  id: string;
  label: string;
  /** 标签下面（右边）的一句说明 */
  description?: string;
  icon?: ReactNode;
  /** 快捷键提示，一个键一项，例如 ['⌘', 'S']。只是展示，绑定由使用者自己做 */
  shortcut?: string[];
  /** 额外的搜索关键词（拼音、英文别名…） */
  keywords?: string[];
  /** 分组标题；相同的归到一组，组的顺序按首次出现 */
  group?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface CommandPaletteProps extends Omit<FloatingCardProps, 'open' | 'placement' | 'modal' | 'size' | 'stretch' | 'contained' | 'role' | 'dragToDismiss' | 'children' | 'onSelect'> {
  /** 受控的开合；不传则用 defaultOpen 自己管。⌘K 之类的快捷键由使用者自己绑 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  items: CommandItem[];
  /** 搜索词，受控 / 非受控皆可。每次打开会清空 */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /** 自定义匹配；传 false 表示不在组件里过滤（结果由外部按 query 异步给出） */
  filter?: false | ((item: CommandItem, query: string) => boolean);
  /** 选中一项时（Enter 或点按）。item.onSelect 也会被调用 */
  onSelect?: (item: CommandItem) => void;
  /** 选中后是否关闭，默认关闭 */
  closeOnSelect?: boolean;
  placeholder?: string;
  /** 没有匹配结果时显示的内容 */
  emptyText?: ReactNode;
  /** 面板和搜索框的读屏名称 */
  label?: string;
  /** 宽度（px 或 CSS 长度），默认 560 */
  width?: number | string;
  /** 列表下面的一行提示（比如按键说明） */
  footer?: ReactNode;
  /**
   * 从哪里放大进场（退场缩回同一点）。默认 'trigger'：点按钮打开时从按钮处，⌘K 之类的快捷键打开时从屏幕中心。
   * 也可以给 'center' 或视口坐标 { x, y }
   */
  origin?: FloatOrigin;
}

/** activeId 的特殊值：指针离开列表或指到禁用项，此刻没有高亮项（Enter 不执行任何一项） */
const NONE = '\u0000none';

const defaultFilter = (item: CommandItem, query: string) => {
  const hay = [item.label, item.description, item.group, ...(item.keywords ?? [])].filter(Boolean).join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
};

/**
 * 命令面板：顶部偏上的悬浮卡片，一个搜索框加分组结果。
 * 焦点始终留在搜索框里（combobox），方向键通过 aria-activedescendant 在结果（listbox）里移动，Enter 执行。
 */
export const CommandPalette = forwardRef<HTMLDivElement, CommandPaletteProps>(function CommandPalette(
  {
    open: openProp, defaultOpen = false, onOpenChange, items, query: queryProp, defaultQuery = '', onQueryChange, filter,
    onSelect, closeOnSelect = true, placeholder: placeholderProp, emptyText: emptyTextProp, label: labelProp, width, footer, origin = 'trigger',
    className, style, ...rest
  },
  ref,
) {
  const { messages: t } = useLocale();
  const placeholder = placeholderProp ?? t.commandPalette.placeholder;
  const emptyText = emptyTextProp === undefined ? t.commandPalette.empty : emptyTextProp;
  const label = labelProp ?? t.commandPalette.label;
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [query, setQuery] = useControllable(queryProp, defaultQuery, onQueryChange);
  /** null：默认落在第一项；NONE：没有高亮项 */
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 列表在 Portal 里，打开后过一拍才挂上：用 state 记节点，挂上之后高亮和滚动才能落位
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const { hlRef, moveTo } = useHighlight();
  const uid = useId();
  const listId = uid + 'list';
  const optionId = (id: string) => uid + 'opt-' + id;

  const groups = useMemo(() => {
    const match = filter === false ? null : filter ?? defaultFilter;
    const q = query.trim();
    const visible = match && q ? items.filter((item) => match(item, q)) : items;
    const out: Array<{ label: string | undefined; items: CommandItem[] }> = [];
    visible.forEach((item) => {
      let group = out.find((g) => g.label === item.group);
      if (!group) { group = { label: item.group, items: [] }; out.push(group); }
      group.items.push(item);
    });
    return out;
  }, [items, query, filter]);

  /** 按显示顺序排好的可选项 */
  const enabled = useMemo(() => groups.flatMap((g) => g.items).filter((item) => !item.disabled), [groups]);
  const active = activeId === NONE ? null : enabled.find((item) => item.id === activeId) ?? enabled[0] ?? null;

  // 每次打开都从空白搜索开始
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) { setQuery(''); setActiveId(null); }
    wasOpen.current = open;
  }, [open, setQuery]);

  // 共享高亮块跟着高亮项走（和 Menu 一样滑动；没有高亮项时淡出）
  useIsoLayoutEffect(() => {
    if (!listEl) return;
    moveTo(active ? listEl.querySelector<HTMLElement>('[data-active]') : null);
  }, [listEl, active, groups, moveTo]);

  // 高亮项始终在可视范围内（滚动本身是原生的）
  useIsoLayoutEffect(() => {
    if (!open || !active || !listEl) return;
    // 回到第一项时一路滚到顶，把分组标题也露出来
    if (active === enabled[0]) listEl.scrollTop = 0;
    else listEl.querySelector<HTMLElement>('[data-active]')?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active?.id, listEl]);

  const select = (item: CommandItem) => {
    if (item.disabled) return;
    item.onSelect?.();
    onSelect?.(item);
    if (closeOnSelect) setOpen(false);
  };

  const move = (step: number | 'first' | 'last') => {
    if (!enabled.length) return;
    let index: number;
    if (step === 'first') index = 0;
    else if (step === 'last') index = enabled.length - 1;
    else if (!active) index = step > 0 ? 0 : enabled.length - 1;
    else index = (enabled.indexOf(active) + step + enabled.length) % enabled.length;
    setActiveId(enabled[index].id);
  };

  /** 翻页：一次跳几项，到头就停，不循环 */
  const jump = (delta: number) => {
    if (!enabled.length) return;
    const from = active ? enabled.indexOf(active) : delta > 0 ? -1 : enabled.length;
    setActiveId(enabled[Math.min(enabled.length - 1, Math.max(0, from + delta))].id);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // 输入法还在组字时，方向键和回车归输入法
    if (guardImeEnter(e) || isImeComposing(e)) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': if (enabled.length) { e.preventDefault(); move('first'); } break;
      case 'End': if (enabled.length) { e.preventDefault(); move('last'); } break;
      case 'PageDown': e.preventDefault(); jump(5); break;
      case 'PageUp': e.preventDefault(); jump(-5); break;
      case 'Enter': if (active) { e.preventDefault(); select(active); } break;
      default:
    }
  };

  const vars = width != null ? { ...style, '--ok-cmdk-width': typeof width === 'number' ? width + 'px' : width } : style;

  return (
    <FloatingCard
      aria-label={label}
      {...rest}
      ref={ref}
      open={open}
      onOpenChange={setOpen}
      placement="top"
      stretch={false}
      origin={origin}
      initialFocus={inputRef}
      className={cx('ok-cmdk', className)}
      style={vars}
    >
      <div className="ok-cmdk__search">
        <Icon name="search" className="ok-cmdk__search-icon" />
        <input
          ref={inputRef}
          className="ok-cmdk__input"
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active ? optionId(active.id) : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveId(null); }}
          onKeyDown={onKeyDown}
        />
        <kbd className="ok-kbd ok-cmdk__esc" aria-hidden="true">Esc</kbd>
      </div>
      <div
        ref={setListEl}
        id={listId}
        className="ok-cmdk__list ok-scroll"
        role="listbox"
        aria-label={label}
        hidden={groups.length === 0}
        onPointerLeave={() => setActiveId(NONE)}
      >
        <span className="ok-cmdk__hl" ref={hlRef} aria-hidden="true" />
        {groups.map((group, gi) => {
          const groupId = uid + 'group-' + gi;
          return (
            <div key={group.label ?? '\u0000' + gi} className="ok-cmdk__group" role="group" aria-labelledby={group.label ? groupId : undefined}>
              {group.label && <div id={groupId} className="ok-cmdk__group-label" role="presentation">{group.label}</div>}
              {group.items.map((item) => {
                const isActive = active?.id === item.id;
                return (
                  <div
                    key={item.id}
                    id={optionId(item.id)}
                    className="ok-cmdk__item"
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={item.disabled || undefined}
                    data-active={isActive ? '' : undefined}
                    // 不让点按把焦点从搜索框带走
                    onMouseDown={(e) => e.preventDefault()}
                    // 指到禁用项：高亮淡出，不停在上一项（键盘导航仍然跳过禁用项）
                    onPointerMove={isActive ? undefined : () => setActiveId(item.disabled ? NONE : item.id)}
                    onClick={() => select(item)}
                  >
                    {item.icon != null && <span className="ok-cmdk__item-icon" aria-hidden="true">{item.icon}</span>}
                    <span className="ok-cmdk__item-text">
                      <span className="ok-cmdk__item-label">{item.label}</span>
                      {item.description && <span className="ok-cmdk__item-desc">{item.description}</span>}
                    </span>
                    {item.shortcut && item.shortcut.length > 0 && (
                      <span className="ok-cmdk__item-keys" aria-hidden="true">
                        {item.shortcut.map((key, ki) => <kbd key={ki} className="ok-kbd">{key}</kbd>)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* 结果数量的变化播报给读屏 */}
      <div className="ok-cmdk__empty" role="status" aria-live="polite" data-empty={enabled.length === 0 && groups.length === 0 ? '' : undefined}>
        {groups.length === 0 ? emptyText : <span className="ok-sr">{t.commandPalette.results(enabled.length)}</span>}
      </div>
      {footer != null && footer !== false && <div className="ok-cmdk__footer">{footer}</div>}
    </FloatingCard>
  );
});
