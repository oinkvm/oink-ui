import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Calendar, RangeCalendar, formatISODate, parseISODate } from './Calendar';

const TODAY = new Date(2026, 9, 13);   // 2026-10-13 周二
const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;

describe('Calendar', () => {
  it('grid 语义：标题、7 列星期、今天标记、选中项', () => {
    render(<Calendar today={TODAY} defaultValue={new Date(2026, 9, 20)} />);
    const grid = screen.getByRole('grid', { name: '2026年10月' });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid).getAllByRole('columnheader')[0]).toHaveTextContent('星期一');
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(42);
    expect(day('2026-10-13')).toHaveAttribute('aria-current', 'date');
    expect(day('2026-10-20').closest('td')).toHaveAttribute('aria-selected', 'true');
    expect(day('2026-10-20')).toHaveAttribute('tabindex', '0');
    expect(day('2026-10-13')).toHaveAttribute('tabindex', '-1');
  });

  it('weekStartsOn=0 时从周日开始', () => {
    render(<Calendar today={TODAY} weekStartsOn={0} />);
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('星期日');
    expect(document.querySelector('tbody [data-date]')).toHaveAttribute('data-date', '2026-09-27');
  });

  it('键盘：方向键按天 / 按周移动，Home / End 到周首尾，PageUp / PageDown 换月', async () => {
    const user = userEvent.setup();
    render(<Calendar today={TODAY} />);
    act(() => day('2026-10-13').focus());
    await user.keyboard('{ArrowRight}');
    expect(day('2026-10-14')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(day('2026-10-21')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(day('2026-10-13')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(day('2026-10-12')).toHaveFocus();
    await user.keyboard('{End}');
    expect(day('2026-10-18')).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('grid', { name: '2026年11月' })).toBeInTheDocument();
    expect(day('2026-11-18')).toHaveFocus();
    await user.keyboard('{PageUp}{PageUp}');
    expect(screen.getByRole('grid', { name: '2026年9月' })).toBeInTheDocument();
    expect(day('2026-09-18')).toHaveFocus();
  });

  it('跨月移动会翻页；Enter 选中并回调', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Calendar today={TODAY} defaultValue={new Date(2026, 9, 31)} onChange={onChange} />);
    act(() => day('2026-10-31').focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('grid', { name: '2026年11月' })).toBeInTheDocument();
    expect(day('2026-11-01')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(formatISODate(onChange.mock.calls[0][0])).toBe('2026-11-01');
    expect(day('2026-11-01').closest('td')).toHaveAttribute('aria-selected', 'true');
  });

  it('min / max / isDateDisabled：禁用的日期标 aria-disabled 且点不动，键盘移动被夹在范围内', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Calendar
        today={TODAY} onChange={onChange} min={new Date(2026, 9, 10)} max={new Date(2026, 9, 20)}
        isDateDisabled={(d) => d.getDay() === 0}
      />,
    );
    expect(day('2026-10-09')).toHaveAttribute('aria-disabled', 'true');
    expect(day('2026-10-18')).toHaveAttribute('aria-disabled', 'true');   // 周日
    await user.click(day('2026-10-09'));
    await user.click(day('2026-10-18'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '上个月' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled();

    act(() => day('2026-10-13').focus());
    await user.keyboard('{PageDown}');
    expect(day('2026-10-20')).toHaveFocus();
    await user.click(day('2026-10-15'));
    expect(formatISODate(onChange.mock.calls[0][0])).toBe('2026-10-15');
  });

  it('上个月 / 下个月按钮翻页；受控 value', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Calendar today={TODAY} value={new Date(2026, 9, 5)} />);
    await user.click(screen.getByRole('button', { name: '下个月' }));
    expect(screen.getByRole('grid', { name: '2026年11月' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '上个月' }));
    await user.click(day('2026-10-08'));
    expect(day('2026-10-05').closest('td')).toHaveAttribute('aria-selected', 'true');   // 受控：外部没更新就不变
    rerender(<Calendar today={TODAY} value={new Date(2026, 9, 8)} />);
    expect(day('2026-10-08').closest('td')).toHaveAttribute('aria-selected', 'true');
  });

  it('parseISODate 只接受真实存在的日期', () => {
    expect(formatISODate(parseISODate('2026/2/3')!)).toBe('2026-02-03');
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(parseISODate('明天')).toBeNull();
  });
});

describe('RangeCalendar', () => {
  it('第一次点定起点，第二次点定终点；点在起点之前则对调', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeCalendar today={TODAY} onChange={onChange} />);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
    await user.click(day('2026-10-15'));
    expect(onChange.mock.calls[0][0]).toMatchObject({ end: null });
    await user.click(day('2026-10-12'));
    const range = onChange.mock.calls[1][0];
    expect([formatISODate(range.start), formatISODate(range.end)]).toEqual(['2026-10-12', '2026-10-15']);
    expect(day('2026-10-12').closest('td')).toHaveAttribute('data-range', 'start');
    expect(day('2026-10-13').closest('td')).toHaveAttribute('data-range', 'in');
    expect(day('2026-10-13').closest('td')).toHaveAttribute('aria-selected', 'true');
    expect(day('2026-10-15').closest('td')).toHaveAttribute('data-range', 'end');
  });

  it('键盘选范围：定了起点后预览跟随键盘焦点；指针移上去则跟指针，移开后回到焦点', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeCalendar today={TODAY} defaultMonth={TODAY} onChange={onChange} />);
    const part = (iso: string) => day(iso).closest('td')!.getAttribute('data-range');
    act(() => day('2026-10-13').focus());
    await user.keyboard('{Enter}');
    expect(part('2026-10-13')).toBe('single');

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(day('2026-10-16')).toHaveFocus();
    expect([part('2026-10-13'), part('2026-10-14'), part('2026-10-15'), part('2026-10-16'), part('2026-10-17')]).toEqual(['start', 'in', 'in', 'end', null]);
    // 往回走到起点之前：预览对调
    await user.keyboard('{ArrowUp}');
    expect(day('2026-10-09')).toHaveFocus();
    expect([part('2026-10-09'), part('2026-10-11'), part('2026-10-13'), part('2026-10-16')]).toEqual(['start', 'in', 'end', null]);

    // 指针悬停优先；移出日历后回到键盘焦点所在的那天
    await user.hover(day('2026-10-20'));
    expect([part('2026-10-13'), part('2026-10-20'), part('2026-10-09')]).toEqual(['start', 'end', null]);
    await user.unhover(day('2026-10-20'));
    await user.hover(document.body);
    expect([part('2026-10-09'), part('2026-10-13')]).toEqual(['start', 'end']);

    await user.keyboard('{Enter}');
    const range = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect([formatISODate(range.start), formatISODate(range.end)]).toEqual(['2026-10-09', '2026-10-13']);
  });
});
