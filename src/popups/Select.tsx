import { forwardRef, useContext, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { Icon, cx, useControllable, useEvent, useLocale } from '../core';
// 直接从 fieldContext 导入（它只依赖 react），不经过 inputs 的入口，避免两组互相引用
import { FieldContext, useFieldControl } from '../inputs/fieldContext';
import { Listbox, firstEnabled, flattenOptions, lastEnabled, optionId, optionText, stepEnabled } from './Listbox';
import type { SelectOption, SelectOptions } from './Listbox';
import { Popup } from './Popup';
import { isTypeaheadKey, useTypeahead } from './internal';
import type { Placement } from './usePosition';

type Size = 'sm' | 'md' | 'lg';

interface SharedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 选项；可以混入 { label, options } 分组 */
  options: SelectOptions;
  placeholder?: ReactNode;
  size?: Size;
  /** 撑满容器宽度，文字过长时省略。放在 Field 里默认开，其它地方默认关（宽度随内容，但不会超出父容器） */
  block?: boolean;
  disabled?: boolean;
  /** 必填（aria-required）。放在 Field 里时默认取 Field 的 required */
  required?: boolean;
  /** 标成校验未通过（aria-invalid + 描边） */
  invalid?: boolean;
  /** 配合表单：渲染隐藏 input 提交 name / value */
  name?: string;
  form?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
}

interface BaseProps extends SharedProps {
  multi: boolean;
  selected: string[];
  onPick: (option: SelectOption) => void;
  display: ReactNode;
}

/** Select 与 MultiSelect 的共同骨架：触发框 + 弹出的 listbox，焦点留在触发框上 */
const SelectBase = forwardRef<HTMLDivElement, BaseProps>(function SelectBase(
  {
    multi, selected, onPick, display, options, placeholder: placeholderProp, size = 'md', block: blockProp,
    disabled: disabledProp, required: requiredProp, invalid: invalidProp, name, form,
    open: openProp, defaultOpen = false, onOpenChange, placement = 'bottom-start',
    id, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, 'aria-describedby': ariaDescribedby, ...rest
  },
  ref,
) {
  const placeholderDefault = useLocale().messages.select.placeholder;
  const placeholder = placeholderProp === undefined ? placeholderDefault : placeholderProp;
  // 接入 Field：id、aria-describedby、aria-invalid、required、disabled 没传就用 Field 给的；触发框是 button，label[for] 可以直接关联
  const inField = useContext(FieldContext);
  const field = useFieldControl({
    id, disabled: disabledProp, required: requiredProp, invalid: invalidProp,
    'aria-describedby': ariaDescribedby, 'aria-labelledby': ariaLabelledby, 'aria-label': ariaLabel,
  });
  const { disabled, invalid } = field;
  const block = blockProp ?? !!inField;
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [active, setActive] = useState(-1);
  const [byKey, setByKey] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const auto = useId();
  const listId = `${auto}-list`;
  const flat = useMemo(() => flattenOptions(options), [options]);
  const typeahead = useTypeahead();
  const selectedIndex = flat.findIndex((o) => selected.includes(o.value) && !o.disabled);

  const show = (index: number) => { setActive(index); setByKey(index >= 0); setOpen(true); };
  const close = () => setOpen(false);
  const move = (index: number) => { if (index >= 0) { setActive(index); setByKey(true); } };
  const pick = (o: SelectOption) => {
    onPick(o);
    // 单选：点下立即收起，不等对勾画完
    if (!multi) close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const k = e.key;
    const typing = isTypeaheadKey(e) && (k !== ' ' || typeahead.pending());
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        show(selectedIndex >= 0 ? selectedIndex : k === 'ArrowUp' ? lastEnabled(flat) : firstEnabled(flat));
      } else if (typing) {
        e.preventDefault();
        const hit = typeahead.search(k, flat.map(optionText), selectedIndex);
        show(hit >= 0 && !flat[hit].disabled ? hit : selectedIndex);
      }
      return;
    }
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      if (active < 0 && selectedIndex >= 0) move(selectedIndex);
      else move(k === 'ArrowDown' ? stepEnabled(flat, active, 1) : stepEnabled(flat, active < 0 ? flat.length : active, -1));
    } else if (k === 'Home' || k === 'PageUp') { e.preventDefault(); move(firstEnabled(flat)); }
    else if (k === 'End' || k === 'PageDown') { e.preventDefault(); move(lastEnabled(flat)); }
    else if (typing) {
      e.preventDefault();
      const hit = typeahead.search(k, flat.map(optionText), active);
      if (hit >= 0 && !flat[hit].disabled) move(hit);
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (active >= 0 && flat[active] && !flat[active].disabled) pick(flat[active]);
      else close();
    } else if (k === 'Tab') close();
  };

  return (
    <div {...rest} ref={ref} className={cx('ok-select', block && 'ok-select--block', className)} data-size={size} data-disabled={disabled || undefined}>
      <button
        type="button"
        ref={triggerRef}
        id={field.id}
        data-label-focus=""
        className="ok-select__trigger ok-focusable"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(listId, active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={field.describedBy}
        aria-invalid={invalid || undefined}
        aria-required={field.required || undefined}
        disabled={disabled}
        data-state={open ? 'open' : 'closed'}
        onClick={() => (open ? close() : show(-1))}
        onKeyDown={onKeyDown}
        // 空格已经在按下时处理过，抬起时不再触发一次点击
        onKeyUp={(e) => { if (e.key === ' ') e.preventDefault(); }}
      >
        <span className="ok-select__value" data-placeholder={selected.length ? undefined : ''}>
          {selected.length ? display : placeholder}
        </span>
        <Icon name="chevron-down" />
      </button>
      {name && (multi
        ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} form={form} disabled={disabled} />)
        : <input type="hidden" name={name} value={selected[0] ?? ''} form={form} disabled={disabled} />)}
      <Popup
        open={open}
        anchorRef={triggerRef}
        placement={placement}
        matchWidth="min"
        className="ok-popup--menu"
        onDismiss={close}
      >
        <Listbox
          id={listId}
          entries={options}
          activeIndex={active}
          onActiveChange={(i) => { setActive(i); setByKey(false); }}
          followActive={byKey}
          isSelected={(v) => selected.includes(v)}
          onPick={pick}
          multi={multi}
          lockWidth
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby ?? (ariaLabel ? undefined : inField?.labelId)}
        />
      </Popup>
    </div>
  );
});

/* ---------------------------------------------------------------------------
   Select：单选
   --------------------------------------------------------------------------- */
export interface SelectProps extends SharedProps {
  /** 选中的值；null 表示没选 */
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string, option: SelectOption) => void;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select({ value, defaultValue = null, onChange, ...rest }, ref) {
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue);
  const emit = useEvent(onChange);
  const option = useMemo(() => flattenOptions(rest.options).find((o) => o.value === current), [rest.options, current]);
  return (
    <SelectBase
      {...rest}
      ref={ref}
      multi={false}
      selected={current == null ? [] : [current]}
      // 框里的文字直接换，不做替换动画
      display={option ? option.label : current}
      onPick={(o) => {
        if (o.value === current) return;
        setCurrent(o.value);
        emit(o.value, o);
      }}
    />
  );
});

/* ---------------------------------------------------------------------------
   MultiSelect：多选，选中后不收起
   --------------------------------------------------------------------------- */
export interface MultiSelectProps extends SharedProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** 触发框里怎么显示：逐个小标签，或“已选 N 项”。默认 chips */
  display?: 'chips' | 'count';
  /** chips 模式最多显示几个，其余折成 +N。默认 2 */
  maxChips?: number;
  /** 自定义触发框里的内容 */
  renderValue?: (selected: SelectOption[]) => ReactNode;
}

const EMPTY: string[] = [];

export const MultiSelect = forwardRef<HTMLDivElement, MultiSelectProps>(function MultiSelect(
  { value, defaultValue = EMPTY, onChange, display = 'chips', maxChips = 2, renderValue, ...rest },
  ref,
) {
  const { messages: t } = useLocale();
  const [current, setCurrent] = useControllable<string[]>(value, defaultValue, onChange);
  const chosen = useMemo(() => {
    const flat = flattenOptions(rest.options);
    return current.map((v) => flat.find((o) => o.value === v)).filter(Boolean) as SelectOption[];
  }, [rest.options, current]);

  let shown: ReactNode;
  if (renderValue) shown = renderValue(chosen);
  else if (display === 'count') shown = t.select.count(current.length);
  else {
    shown = (
      <span className="ok-select__chips">
        {chosen.slice(0, maxChips).map((o) => <span className="ok-select__chip" key={o.value}>{o.label}</span>)}
        {chosen.length > maxChips && <span className="ok-select__chip ok-select__chip--more">+{chosen.length - maxChips}</span>}
      </span>
    );
  }

  return (
    <SelectBase
      {...rest}
      ref={ref}
      multi
      selected={current}
      display={shown}
      onPick={(o) => setCurrent(current.includes(o.value) ? current.filter((v) => v !== o.value) : [...current, o.value])}
    />
  );
});
