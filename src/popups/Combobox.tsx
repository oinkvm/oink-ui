import { guardImeEnter } from '../core/ime';
import { forwardRef, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, InputHTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react';
import { Icon, cx, mergeRefs, useControllable, useEvent, useLocale } from '../core';
import type { IconName } from '../core';
import { FieldContext, useFieldControl } from '../inputs/fieldContext';
import { Listbox, firstEnabled, flattenOptions, isGroup, lastEnabled, optionId, optionText, stepEnabled } from './Listbox';
import type { SelectOption, SelectOptions } from './Listbox';
import { Popup } from './Popup';
import { renderIcon } from './internal';
import type { Placement } from './usePosition';

export interface ComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'size'> {
  options: SelectOptions;
  /** 选中项的 value；null 表示没选。freeSolo 时就是输入框里的文字 */
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null, option?: SelectOption) => void;
  /** 输入框里的文字（受控）。异步搜索时监听 onInputChange 去请求数据 */
  inputValue?: string;
  defaultInputValue?: string;
  onInputChange?: (text: string) => void;
  /** 自定义筛选；传 false 表示不在本地筛选（选项由外部按输入异步给出） */
  filter?: ((option: SelectOption, query: string) => boolean) | false;
  /** 正在加载选项 */
  loading?: boolean;
  loadingText?: ReactNode;
  /** 没有匹配项时显示的内容；传 null 则直接不弹出 */
  emptyText?: ReactNode;
  /** 允许任意输入：值就是输入的文字，选项只是建议 */
  freeSolo?: boolean;
  /** 有内容时显示清除按钮 */
  clearable?: boolean;
  /** 输入框前面的图标 */
  icon?: IconName | ReactNode;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** 外框（.ok-input）的 ref；组件自己的 ref 指向里面的 <input> */
  rootRef?: Ref<HTMLDivElement>;
  /** 外框的类名与样式；className / style 也是给外框的（和 Input 一致） */
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

const defaultFilter = (o: SelectOption, q: string) => optionText(o).toLowerCase().includes(q.trim().toLowerCase());

/**
 * 可输入筛选的选择器（WAI-ARIA combobox，列表自动补全）。
 * 和 Input 一样：ref 和其余原生属性落在里面的 <input> 上；className / style 落在外框上，外框的 ref 用 rootRef。
 * 放在 Field 里会自动接上 id、aria-describedby、aria-invalid、required、disabled。
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    options, value, defaultValue = null, onChange, inputValue, defaultInputValue, onInputChange,
    filter = defaultFilter, loading = false, loadingText: loadingTextProp, emptyText: emptyTextProp,
    freeSolo = false, clearable = false, icon, size = 'md', invalid: invalidProp, name, form, disabled: disabledProp, required: requiredProp,
    open: openProp, defaultOpen = false, onOpenChange, placement = 'bottom-start',
    className, style, rootRef: rootRefProp, rootClassName, rootStyle, id, onKeyDown, onBlur, onClick, 'aria-describedby': describedByProp, ...rest
  },
  ref,
) {
  const { messages: t } = useLocale();
  const loadingText = loadingTextProp === undefined ? t.combobox.loading : loadingTextProp;
  const emptyText = emptyTextProp === undefined ? t.combobox.empty : emptyTextProp;
  const inField = useContext(FieldContext);
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp });
  const { disabled, invalid } = field;
  const all = useMemo(() => flattenOptions(options), [options]);
  const labelOf = (v: string | null) => {
    if (v == null) return '';
    const o = all.find((x) => x.value === v);
    return o ? optionText(o) : freeSolo ? v : '';
  };
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue);
  const emit = useEvent(onChange);
  const [text, setText] = useControllable<string>(
    inputValue ?? (freeSolo && value != null ? value : undefined),
    defaultInputValue ?? labelOf(defaultValue),
    onInputChange,
  );
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [active, setActive] = useState(-1);
  const [byKey, setByKey] = useState(false);
  /** 打开之后有没有改过文字：没改过就显示全部选项 */
  const [dirty, setDirty] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const auto = useId();
  const listId = `${auto}-list`;

  const filterBy = (query: string, on: boolean): SelectOptions => {
    if (!filter || !on || !query.trim()) return options;
    return options
      .map((e) => (isGroup(e) ? { ...e, options: e.options.filter((o) => filter(o, query)) } : e))
      .filter((e) => (isGroup(e) ? e.options.length > 0 : filter(e, query)));
  };
  const entries = filterBy(text, dirty);
  const flat = flattenOptions(entries);

  const commit = (next: string | null, option?: SelectOption) => {
    if (next === current) return;
    setCurrent(next);
    emit(next, option);
  };
  const show = (index: number, key: boolean) => { setActive(index); setByKey(key); setOpen(true); };
  const close = () => { setOpen(false); setActive(-1); setDirty(false); };
  const pick = (o: SelectOption) => {
    setText(optionText(o));
    commit(freeSolo ? optionText(o) : o.value, o);
    close();
  };
  const selectedIndex = flat.findIndex((o) => o.value === current && !o.disabled);

  // 输入之后选项变了（本地筛选，或异步结果回来）：高亮落到第一项，回车就能选中
  const signature = flat.map((o) => (o.disabled ? `${o.value}\u0001` : o.value)).join('\u0000');
  useEffect(() => {
    if (!open || !dirty || loading) return;
    setActive(firstEnabled(flat));
    setByKey(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, loading]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      if (!open) show(selectedIndex >= 0 ? selectedIndex : k === 'ArrowDown' ? firstEnabled(flat) : lastEnabled(flat), true);
      else {
        setByKey(true);
        setActive(k === 'ArrowDown' ? stepEnabled(flat, active, 1) : stepEnabled(flat, active < 0 ? flat.length : active, -1));
      }
    } else if (k === 'Enter') {
      if (open && active >= 0 && flat[active] && !flat[active].disabled) { e.preventDefault(); pick(flat[active]); }
      else if (open) close();
    } else if (k === 'Tab' && open) close();
  };

  const hasBody = loading || flat.length > 0 || emptyText != null;
  const expanded = open && hasBody && !disabled;

  return (
    <div
      ref={mergeRefs(rootRefProp, rootRef)}
      className={cx('ok-input ok-combobox', size === 'lg' && 'ok-input--lg', text && clearable && 'has-value', rootClassName, className)}
      style={{ ...rootStyle, ...style }}
      data-size={size}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}
    >
      {icon != null && <span className="ok-input__icon ok-combobox__icon">{renderIcon(icon)}</span>}
      <input
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        {...rest}
        onKeyDownCapture={event => { if (!guardImeEnter(event)) rest.onKeyDownCapture?.(event); }}
        ref={mergeRefs(ref, inputRef)}
        id={field.id}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && active >= 0 ? optionId(listId, active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={field.describedBy}
        aria-busy={loading || undefined}
        disabled={disabled}
        required={field.required || undefined}
        name={freeSolo ? name : undefined}
        form={freeSolo ? form : undefined}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          setDirty(true);
          if (freeSolo) commit(next);
          else if (next === '' && current != null) commit(null);
          show(firstEnabled(flattenOptions(filterBy(next, true))), true);
        }}
        onClick={(e) => { onClick?.(e); if (!open) show(-1, false); }}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          onBlur?.(e);
          if (open) close();
          // 没选就离开：文字回到当前选中项
          if (!freeSolo && text !== labelOf(current)) setText(labelOf(current));
        }}
      />
      {clearable && (
        <button
          type="button"
          className="ok-input__clear"
          aria-label={t.common.clear}
          tabIndex={-1}
          disabled={disabled || !text}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setText('');
            commit(freeSolo ? '' : null);
            inputRef.current?.focus();
          }}
        >
          <Icon name="x" />
        </button>
      )}
      {name && !freeSolo && <input type="hidden" name={name} form={form} value={current ?? ''} disabled={disabled} />}
      <Popup
        open={expanded}
        anchorRef={rootRef}
        placement={placement}
        matchWidth="min"
        className="ok-popup--menu"
        onDismiss={close}
        // 点在列表的空白处时输入框不失焦
        onMouseDown={(e) => e.preventDefault()}
      >
        {loading && <div className="ok-menu__empty" role="status">{loadingText}</div>}
        {!loading && flat.length === 0 && <div className="ok-menu__empty" role="status">{emptyText}</div>}
        <Listbox
          id={listId}
          entries={entries}
          hidden={flat.length === 0}
          activeIndex={active}
          onActiveChange={(i) => { setActive(i); setByKey(false); }}
          followActive={byKey}
          isSelected={(v) => !freeSolo && v === current}
          onPick={pick}
          aria-label={rest['aria-label'] ?? t.combobox.listbox}
          aria-labelledby={rest['aria-labelledby'] ?? (rest['aria-label'] ? undefined : inField?.labelId)}
        />
      </Popup>
    </div>
  );
});

export type AutocompleteProps = Omit<ComboboxProps, 'freeSolo'>;

/** 自动补全输入框：可以任意输入，选项只是建议（Combobox 的 freeSolo 形态） */
export const Autocomplete = forwardRef<HTMLInputElement, AutocompleteProps>(function Autocomplete(props, ref) {
  return <Combobox {...props} ref={ref} freeSolo />;
});
