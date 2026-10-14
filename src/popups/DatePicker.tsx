import { forwardRef, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Icon, cx, mergeRefs, useControllable, useLocale } from '../core';
import { FieldContext, useFieldControl } from '../inputs/fieldContext';
import { Calendar, RangeCalendar, formatISODate, isSameDay, parseISODate, startOfDay } from './Calendar';
import type { DateRange, WeekStart } from './Calendar';
import { Popover } from './Popover';
import type { Placement } from './usePosition';

/**
 * 输入到一半时，文字能不能确定一个月份：完整日期按 parse 解析；只写了年和月（2026-11、2026/3、2026.07.）时也算。
 * 月份只有一位且是 1 或 0 时还定不下来（可能是 1、10、11、12），要等下一个字或分隔符
 */
function monthOfText(text: string, parse: (t: string) => Date | null): Date | null {
  const full = parse(text);
  if (full) return new Date(full.getFullYear(), full.getMonth(), 1);
  const m = /^\s*(\d{4})\s*[-/.年]\s*(\d{1,2})\s*([-/.月])?\s*$/.exec(text);
  if (!m) return null;
  const [, y, mo, sep] = m;
  if (mo.length === 1 && !sep && (mo === '0' || mo === '1')) return null;
  const month = Number(mo);
  return month >= 1 && month <= 12 ? new Date(Number(y), month - 1, 1) : null;
}
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const CalendarIcon = () => (
  <Icon><rect x="3.500" y="4.500" width="13" height="12" rx="2.500" /><path d="M3.500 8.500h13M7 3v3M13 3v3" /></Icon>
);

interface PickerSharedProps {
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  weekStartsOn?: WeekStart;
  locale?: string;
  today?: Date;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** 日期 → 显示的文字。默认 2026-10-13 */
  format?: (date: Date) => string;
}

/* ---------------------------------------------------------------------------
   DatePicker：输入框 + 弹出日历
   --------------------------------------------------------------------------- */
export interface DatePickerProps
  extends PickerSharedProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'min' | 'max'> {
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  /** 输入的文字 → 日期；不合法返回 null。默认接受 2026-10-13 / 2026/10/13 / 2026.10.13 */
  parse?: (text: string) => Date | null;
}

/**
 * 日期选择：可以直接输入，也可以点右侧按钮从日历里选。
 * 点输入框也会打开日历，焦点留在输入框里继续打字；打字时只要能确定一个别的月份，日历就翻到那个月；
 * 打出一个合法、可选的完整日期时，日历里直接选中它（预览，回车或失焦才落定成 value）。
 * 从按钮或 Alt + ↓ 打开时焦点进日历；从输入框打开时按 ↓ 进日历，Esc 收起日历、焦点不动。
 * ref、className、style 落在外层 .ok-input 上，其余原生属性落在 <input> 上；name 通过隐藏 input 以 yyyy-MM-dd 提交。
 * 放在 Field 里会自动接上 id、aria-describedby、aria-invalid、required、disabled。
 */
export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    value, defaultValue = null, onChange, parse = parseISODate, format = formatISODate,
    min, max, isDateDisabled, weekStartsOn, locale, today, size = 'md', invalid: invalidProp, name, form, disabled: disabledProp, required: requiredProp, readOnly,
    open: openProp, defaultOpen = false, onOpenChange, placement = 'bottom-start',
    className, style, placeholder: placeholderProp, id, onBlur, onKeyDown, 'aria-describedby': describedByProp, ...rest
  },
  ref,
) {
  const { messages: t } = useLocale();
  const placeholder = placeholderProp ?? t.datePicker.placeholder;
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp });
  const { disabled, invalid } = field;
  const [date, setDate] = useControllable<Date | null>(value, defaultValue, onChange);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [text, setText] = useState(date ? format(date) : '');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popId = `${useId()}-calendar`;
  /** 从输入框打开的：焦点留在输入框，日历不抢焦点 */
  const [fromInput, setFromInput] = useState(false);
  /** 日历显示的月份。打开时从已选日期（或今天）开始，打字时跟着文字翻 */
  const [month, setMonth] = useState<Date>(() => startOfDay(date ?? today ?? new Date()));
  useEffect(() => {
    if (!open) return;
    const typedMonth = monthOfText(text, parse);
    setMonth(startOfDay(typedMonth ?? date ?? today ?? new Date()));
    // 只在打开的那一刻定起点
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (!open) setFromInput(false); }, [open]);
  const openFromInput = () => {
    if (open || disabled || readOnly) return;
    setFromInput(true);
    setOpen(true);
  };
  const onTextChange = (next: string) => {
    setText(next);
    const m = monthOfText(next, parse);
    if (m && !sameMonth(m, month)) setMonth(m);
  };

  // 日期从外部或日历里变了：输入框跟着换
  const key = date ? formatISODate(date) : '';
  useEffect(() => { setText(date ? format(date) : ''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);

  const allowed = (d: Date) =>
    !(min && d < startOfDay(min)) && !(max && d > startOfDay(max)) && !isDateDisabled?.(d);
  /**
   * 日历里显示为选中的：输入框里是合法、可选的完整日期就选中它（预览）；输入框还是已选值的原样就是已选值；
   * 正在改、还没打完或不合法时不选中任何一天（不跳回已选值，免得日历又翻回它那个月）
   */
  const shownDate = (() => {
    if (text.trim() === '') return null;
    const p = parse(text);
    if (p && allowed(p)) return p;
    return date && text === format(date) ? date : null;
  })();

  /** 把输入框里的文字落成日期；不合法或不可选就退回原值 */
  const commitText = () => {
    if (text.trim() === '') { if (date) setDate(null); return; }
    const parsed = parse(text);
    if (parsed && allowed(parsed)) {
      if (!isSameDay(parsed, date)) setDate(parsed);
      else setText(format(parsed));
    } else setText(date ? format(date) : '');
  };

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      className={cx('ok-input ok-datepicker', size === 'lg' && 'ok-input--lg', className)}
      style={style}
      data-size={size}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        {...rest}
        id={field.id}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={field.required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={field.describedBy}
        ref={inputRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onClick={openFromInput}
        onBlur={(e) => {
          onBlur?.(e);
          commitText();
          // 焦点离开了输入框、按钮和日历：收起
          const to = e.relatedTarget as Node | null;
          if (open && fromInput && !(to && (rootRef.current?.contains(to) || document.getElementById(popId)?.contains(to)))) setOpen(false);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Enter') { commitText(); if (open && fromInput) setOpen(false); }
          else if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); }
          else if (e.key === 'ArrowDown' && e.altKey && !disabled && !readOnly) { e.preventDefault(); setFromInput(false); setOpen(true); }
          else if (e.key === 'ArrowDown' && open) {
            // 从输入框打开的：↓ 把焦点交给日历
            e.preventDefault();
            document.getElementById(popId)?.querySelector<HTMLElement>('.ok-calendar__day[tabindex="0"]')?.focus();
          }
        }}
      />
      {name && <input type="hidden" name={name} form={form} value={key} disabled={disabled} />}
      <Popover
        id={popId}
        open={open}
        onOpenChange={(o) => { if (o) setFromInput(false); setOpen(o); }}
        autoFocus={!fromInput}
        anchorRef={rootRef}
        placement={placement}
        aria-label={t.datePicker.dialog}
        className="ok-popover--calendar"
        trigger={
          <button type="button" className="ok-datepicker__btn ok-focusable" aria-label={t.datePicker.open} disabled={disabled || readOnly}>
            <CalendarIcon />
          </button>
        }
      >
        {({ close }) => (
          <Calendar
            autoFocus={!fromInput}
            value={shownDate}
            month={month}
            onMonthChange={setMonth}
            onChange={(d) => { setDate(d); if (fromInput) { setOpen(false); inputRef.current?.focus(); } else close(); }}
            min={min} max={max} isDateDisabled={isDateDisabled} weekStartsOn={weekStartsOn} locale={locale} today={today}
          />
        )}
      </Popover>
    </div>
  );
});

/* ---------------------------------------------------------------------------
   DateRangePicker：一个按钮显示起止日期，弹出日历选一段
   --------------------------------------------------------------------------- */
export interface DateRangePickerProps
  extends PickerSharedProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'defaultValue' | 'onChange'> {
  value?: DateRange;
  defaultValue?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: ReactNode;
  /** 必填（aria-required）。放在 Field 里时默认取 Field 的 required */
  required?: boolean;
  /** 隐藏 input 的 name：起 / 止各一个，以 yyyy-MM-dd 提交 */
  startName?: string;
  endName?: string;
  form?: string;
  /** 起止之间的连接符。默认 “ – ” */
  separator?: string;
}

const EMPTY_RANGE: DateRange = { start: null, end: null };

/**
 * 日期范围选择：第一次点定起点，第二次点定终点后收起。
 * ref 和其余原生属性落在触发按钮上。不支持键盘直接输入日期。
 * · 只有选完整一段才会触发 onChange；选到一半就关掉弹层，回到上一次完整的范围。
 * · 按钮另有名称（aria-label、aria-labelledby、<label for>、Field 的标签）时，名称会盖掉按钮里的日期文字，
 *   这时用 aria-describedby 指向显示值，读屏仍然读得到已选范围。
 * · 放在 Field 里会自动接上 id、aria-describedby、aria-invalid、required（aria-required）、disabled。
 */
export const DateRangePicker = forwardRef<HTMLButtonElement, DateRangePickerProps>(function DateRangePicker(
  {
    value, defaultValue = EMPTY_RANGE, onChange, placeholder: placeholderProp, startName, endName, form, separator = ' – ',
    format = formatISODate, min, max, isDateDisabled, weekStartsOn, locale, today, size = 'md', invalid: invalidProp, disabled: disabledProp, required: requiredProp,
    open: openProp, defaultOpen = false, onOpenChange, placement = 'bottom-start', className, id,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, 'aria-describedby': describedByProp, ...rest
  },
  ref,
) {
  const { messages: t } = useLocale();
  const placeholder = placeholderProp === undefined ? t.datePicker.rangePlaceholder : placeholderProp;
  const inField = useContext(FieldContext);
  const field = useFieldControl({
    id, disabled: disabledProp, required: requiredProp, invalid: invalidProp,
    'aria-describedby': describedByProp, 'aria-labelledby': ariaLabelledby, 'aria-label': ariaLabel,
  });
  const { disabled, invalid } = field;
  const [range, setRange] = useControllable<DateRange>(value, defaultValue, onChange);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  /** 弹层里正在选、还没选完的那一段；选完才写回 range，弹层关掉就丢弃 */
  const [draft, setDraft] = useState<DateRange | null>(null);
  useEffect(() => { if (!open) setDraft(null); }, [open]);
  const { start, end } = range;
  const shown = (open && draft) || range;
  const label = shown.start ? `${format(shown.start)}${separator}${shown.end ? format(shown.end) : '…'}` : null;

  // 名称来自别处时，按钮里的文字不再进入可访问名称：把显示值挂到描述上
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const valueId = `${useId()}-value`;
  const [hasLabelEl, setHasLabelEl] = useState(false);
  useEffect(() => { setHasLabelEl(!!buttonRef.current?.labels?.length); });
  const namedElsewhere = !!ariaLabel || !!ariaLabelledby || !!inField?.labelId || hasLabelEl;
  const describedBy = [namedElsewhere && valueId, field.describedBy].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement={placement}
        aria-label={t.datePicker.rangeDialog}
        className="ok-popover--calendar"
        trigger={
          <button
            type="button"
            {...rest}
            ref={mergeRefs(ref, buttonRef)}
            id={field.id}
            className={cx('ok-input ok-daterange ok-focusable', size === 'lg' && 'ok-input--lg', className)}
            data-size={size}
            data-label-focus=""
            data-invalid={invalid || undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={field.required || undefined}
            disabled={disabled}
          >
            <span className="ok-daterange__value" id={valueId} data-placeholder={label ? undefined : ''}>{label ?? placeholder}</span>
            <CalendarIcon />
          </button>
        }
      >
        {({ close }) => (
          <RangeCalendar
            autoFocus
            value={draft ?? range}
            onChange={(next) => {
              if (next.start && next.end) { setDraft(null); setRange(next); close(); }
              else setDraft(next);
            }}
            min={min} max={max} isDateDisabled={isDateDisabled} weekStartsOn={weekStartsOn} locale={locale} today={today}
          />
        )}
      </Popover>
      {startName && <input type="hidden" name={startName} form={form} value={start ? formatISODate(start) : ''} disabled={disabled} />}
      {endName && <input type="hidden" name={endName} form={form} value={end ? formatISODate(end) : ''} disabled={disabled} />}
    </>
  );
});
