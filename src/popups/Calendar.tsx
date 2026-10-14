import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent } from 'react';
import { Icon, cx, mergeRefs, useControllable, useLocale } from '../core';

/* ---------------------------------------------------------------------------
   日期工具（只按本地时区的“天”计算，不带时间）
   --------------------------------------------------------------------------- */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** 加减月份；目标月没有这一天时落在月末（1 月 31 日 + 1 个月 = 2 月 28 / 29 日） */
export function addMonths(d: Date, n: number) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}
export const isSameDay = (a: Date | null | undefined, b: Date | null | undefined) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const pad = (n: number, len = 2) => String(n).padStart(len, '0');
/** 2026-10-13 */
export const formatISODate = (d: Date) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 解析 2026-10-13、2026/10/13、2026.10.13、2026年10月13日；不合法返回 null */
export function parseISODate(text: string): Date | null {
  const m = /^\s*(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?\s*$/.exec(text);
  if (!m) return null;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, da);
  d.setFullYear(y);
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da ? d : null;
}

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface DateRange { start: Date | null; end: Date | null }

interface CalendarSharedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 当前显示的月份（受控，取其中任意一天） */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** 可选的最早 / 最晚日期（含） */
  min?: Date;
  max?: Date;
  /** 返回 true 的日期不可选 */
  isDateDisabled?: (date: Date) => boolean;
  /** 一周从星期几开始：0 = 周日，1 = 周一。默认 1 */
  weekStartsOn?: WeekStart;
  /** 月份标题、星期名和日期读屏文字（Intl）的语言，可以是任意 BCP 47 标签。默认跟 LocaleProvider / OinkProvider 的 locale（没有时 zh-CN） */
  locale?: string;
  /** “今天”是哪天。默认取系统日期 */
  today?: Date;
  /** 挂载时把焦点放到当前日期上 */
  autoFocus?: boolean;
  disabled?: boolean;
}

interface GridProps extends CalendarSharedProps {
  /** 初始聚焦 / 初始月份参照的日期 */
  anchorDate: Date | null;
  isSelected: (date: Date) => boolean;
  rangePart?: (date: Date) => 'start' | 'end' | 'in' | 'single' | undefined;
  onPick: (date: Date) => void;
  onHoverDate?: (date: Date | null) => void;
  /** 键盘焦点落到某一天 */
  onFocusDate?: (date: Date) => void;
  multiselectable?: boolean;
}

const CalendarGrid = forwardRef<HTMLDivElement, GridProps>(function CalendarGrid(
  {
    anchorDate, isSelected, rangePart, onPick, onHoverDate, onFocusDate, multiselectable,
    month, defaultMonth, onMonthChange, min, max, isDateDisabled, weekStartsOn = 1, locale: localeProp, today: todayProp,
    autoFocus, disabled, className, 'aria-label': ariaLabel, ...rest
  },
  ref,
) {
  const { locale: ctxLocale, messages: t } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const today = useMemo(() => startOfDay(todayProp ?? new Date()), [todayProp]);
  const minDay = useMemo(() => (min ? startOfDay(min) : null), [min]);
  const maxDay = useMemo(() => (max ? startOfDay(max) : null), [max]);
  const clampDay = (d: Date) => (minDay && d < minDay ? minDay : maxDay && d > maxDay ? maxDay : d);
  const unavailable = (d: Date) => !!disabled || (!!minDay && d < minDay) || (!!maxDay && d > maxDay) || !!isDateDisabled?.(d);

  const initial = clampDay(startOfDay(anchorDate ?? defaultMonth ?? month ?? today));
  const [focused, setFocused] = useState(initial);
  const [visible, setVisible] = useControllable<Date>(month, defaultMonth ?? initial, onMonthChange);
  const monthStart = new Date(visible.getFullYear(), visible.getMonth(), 1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wantFocus = useRef(!!autoFocus);
  const id = useId();

  // 选中的日期从外部变了：跟过去
  const anchorKey = anchorDate ? formatISODate(anchorDate) : '';
  useEffect(() => {
    if (!anchorDate) return;
    const d = startOfDay(anchorDate);
    setFocused(d);
    if (!isSameMonth(d, visible)) setVisible(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // roving tabindex 落在哪一天：聚焦日在当前月就用它，否则用当月 1 号
  const tabStop = isSameMonth(focused, monthStart) ? focused : monthStart;
  const tabKey = formatISODate(tabStop);
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    rootRef.current?.querySelector<HTMLElement>(`[data-date="${tabKey}"]`)?.focus({ preventScroll: true });
  });

  const moveTo = (d: Date) => {
    const next = clampDay(d);
    wantFocus.current = true;
    setFocused(next);
    if (!isSameMonth(next, monthStart)) setVisible(next);
  };
  const shiftMonth = (n: number) => {
    const next = addMonths(monthStart, n);
    setVisible(next);
    setFocused(clampDay(addMonths(tabStop, n)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (!target) return;
    const cur = parseISODate(target.dataset.date!)!;
    const col = (cur.getDay() - weekStartsOn + 7) % 7;
    let next: Date | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = addDays(cur, -1); break;
      case 'ArrowRight': next = addDays(cur, 1); break;
      case 'ArrowUp': next = addDays(cur, -7); break;
      case 'ArrowDown': next = addDays(cur, 7); break;
      case 'Home': next = addDays(cur, -col); break;
      case 'End': next = addDays(cur, 6 - col); break;
      case 'PageUp': next = addMonths(cur, e.shiftKey ? -12 : -1); break;
      case 'PageDown': next = addMonths(cur, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    moveTo(next);
  };

  const fmtTitle = useMemo(() => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }), [locale]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'full' }), [locale]);
  const weekdays = useMemo(() => {
    const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    // 2023-01-01 是周日
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2023, 0, 1 + ((i + weekStartsOn) % 7));
      return { short: narrow.format(d), long: long.format(d) };
    });
  }, [locale, weekStartsOn]);

  const lead = (monthStart.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(monthStart, -lead);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  const prevBlocked = !!minDay && addDays(monthStart, -1) < minDay;
  const nextBlocked = !!maxDay && addMonths(monthStart, 1) > maxDay;

  return (
    <div {...rest} ref={mergeRefs(ref, rootRef)} className={cx('ok-calendar', className)} data-disabled={disabled || undefined}>
      <div className="ok-calendar__head">
        <button
          type="button" className="ok-btn ok-btn--ghost ok-btn--sm ok-btn--icon ok-focusable" aria-label={t.calendar.prevMonth}
          disabled={disabled || prevBlocked} onClick={() => shiftMonth(-1)}
        >
          <Icon><path d="M12.5 4.5L7 10l5.500 5.500" /></Icon>
        </button>
        <div className="ok-calendar__title" id={`${id}-title`} aria-live="polite">{fmtTitle.format(monthStart)}</div>
        <button
          type="button" className="ok-btn ok-btn--ghost ok-btn--sm ok-btn--icon ok-focusable" aria-label={t.calendar.nextMonth}
          disabled={disabled || nextBlocked} onClick={() => shiftMonth(1)}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
      <table
        role="grid"
        className="ok-calendar__grid"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : `${id}-title`}
        aria-multiselectable={multiselectable || undefined}
        onKeyDown={onKeyDown}
        onPointerLeave={() => onHoverDate?.(null)}
      >
        <thead>
          <tr>
            {weekdays.map((w) => <th key={w.long} scope="col" abbr={w.long}><span aria-hidden="true">{w.short}</span><span className="ok-sr">{w.long}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={formatISODate(week[0])}>
              {week.map((day) => {
                const key = formatISODate(day);
                const off = unavailable(day);
                const selected = isSelected(day);
                const part = rangePart?.(day);
                return (
                  <td key={key} role="gridcell" aria-selected={selected} aria-disabled={off || undefined} data-range={part}>
                    <button
                      type="button"
                      className="ok-calendar__day ok-focusable"
                      tabIndex={key === tabKey ? 0 : -1}
                      data-date={key}
                      data-autofocus={autoFocus && key === tabKey ? '' : undefined}
                      data-outside={isSameMonth(day, monthStart) ? undefined : ''}
                      data-today={isSameDay(day, today) ? '' : undefined}
                      data-selected={selected ? '' : undefined}
                      aria-label={fmtDay.format(day) + (isSameDay(day, today) ? t.calendar.todaySuffix : '')}
                      aria-current={isSameDay(day, today) ? 'date' : undefined}
                      aria-pressed={selected}
                      aria-disabled={off || undefined}
                      onFocus={() => { setFocused(day); onFocusDate?.(day); }}
                      onPointerEnter={() => onHoverDate?.(day)}
                      onClick={() => {
                        if (off) return;
                        setFocused(day);
                        if (!isSameMonth(day, monthStart)) { wantFocus.current = true; setVisible(day); }
                        onPick(day);
                      }}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* ---------------------------------------------------------------------------
   Calendar：选一天
   --------------------------------------------------------------------------- */
export interface CalendarProps extends CalendarSharedProps {
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date) => void;
}

export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar({ value, defaultValue = null, onChange, ...rest }, ref) {
  const [current, setCurrent] = useControllable<Date | null>(value, defaultValue, onChange as (d: Date | null) => void);
  return (
    <CalendarGrid
      {...rest}
      ref={ref}
      anchorDate={current}
      isSelected={(d) => isSameDay(d, current)}
      onPick={(d) => setCurrent(d)}
    />
  );
});

/* ---------------------------------------------------------------------------
   RangeCalendar：选一段。第一次点定起点，第二次点定终点（点在起点之前则对调）
   --------------------------------------------------------------------------- */
export interface RangeCalendarProps extends CalendarSharedProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onChange?: (range: DateRange) => void;
}

const EMPTY_RANGE: DateRange = { start: null, end: null };

export const RangeCalendar = forwardRef<HTMLDivElement, RangeCalendarProps>(function RangeCalendar(
  { value, defaultValue = EMPTY_RANGE, onChange, ...rest },
  ref,
) {
  const [range, setRange] = useControllable<DateRange>(value, defaultValue, onChange);
  // 只定了起点时的预览终点：跟着指针，也跟着键盘焦点——谁最后动就听谁的
  const [hover, setHover] = useState<Date | null>(null);
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const { start, end } = range;
  const preview = hover ?? focusDay;
  const tail = end ?? (start && preview ? preview : null);
  const lo = start && tail ? (start <= tail ? start : tail) : start;
  const hi = start && tail ? (start <= tail ? tail : start) : start;
  return (
    <CalendarGrid
      {...rest}
      ref={ref}
      multiselectable
      anchorDate={start}
      isSelected={(d) => isSameDay(d, start) || isSameDay(d, end) || (!!start && !!end && d > start && d < end)}
      rangePart={(d) => {
        if (!lo || !hi) return undefined;
        if (isSameDay(lo, hi)) return isSameDay(d, lo) ? 'single' : undefined;
        if (isSameDay(d, lo)) return 'start';
        if (isSameDay(d, hi)) return 'end';
        return d > lo && d < hi ? 'in' : undefined;
      }}
      onHoverDate={setHover}
      onFocusDate={(d) => { setHover(null); setFocusDay(d); }}
      onPick={(d) => {
        if (!start || end) setRange({ start: d, end: null });
        else setRange(d < start ? { start: d, end: start } : { start, end: d });
      }}
    />
  );
});
