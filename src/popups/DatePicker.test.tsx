import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../inputs/Field';
import { formatISODate } from './Calendar';
import { DatePicker, DateRangePicker } from './DatePicker';

const TODAY = new Date(2026, 9, 13);
const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;

describe('DatePicker', () => {
  it('点按钮弹出日历对话框，焦点落在当前日期；选一天后填进输入框并收起', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker today={TODAY} onChange={onChange} aria-label="日期" name="due" />);
    const input = screen.getByRole('textbox', { name: '日期' });
    const button = screen.getByRole('button', { name: '打开日历' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(await screen.findByRole('dialog', { name: '选择日期' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: '2026年10月' })).toBeInTheDocument();
    await waitFor(() => expect(day('2026-10-13')).toHaveFocus());

    await user.keyboard('{ArrowRight}{Enter}');
    expect(formatISODate(onChange.mock.calls[0][0])).toBe('2026-10-14');
    expect(input).toHaveValue('2026-10-14');
    expect(document.querySelector('input[name="due"]')).toHaveValue('2026-10-14');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('可以直接输入：合法日期在失焦 / 回车时生效，不合法的退回原值', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker today={TODAY} defaultValue={new Date(2026, 0, 5)} onChange={onChange} aria-label="日期" max={new Date(2026, 11, 31)} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('2026-01-05');
    await user.clear(input);
    await user.type(input, '2026/3/9{Enter}');
    expect(formatISODate(onChange.mock.calls[0][0])).toBe('2026-03-09');
    expect(input).toHaveValue('2026-03-09');

    await user.clear(input);
    await user.type(input, '2027-01-01');   // 超过 max
    await user.tab();
    expect(input).toHaveValue('2026-03-09');
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.clear(input);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('点输入框也会打开日历，焦点留在输入框；打字时能确定别的月份就翻过去，定不下来的不动', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker today={TODAY} defaultValue={new Date(2026, 9, 8)} onChange={onChange} aria-label="日期" />);
    const input = screen.getByRole('textbox', { name: '日期' });
    await user.click(input);
    expect(day('2026-10-08')).toHaveAttribute('data-selected');
    expect(await screen.findByRole('dialog', { name: '选择日期' })).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('grid', { name: '2026年10月' })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '2027-3');
    expect(screen.getByRole('grid', { name: '2027年3月' })).toBeInTheDocument();
    // 2026-1 可能是 1、10、11、12 月：还定不下来，停在上一个能确定的月份
    await user.clear(input);
    await user.type(input, '2026-1');
    expect(screen.getByRole('grid', { name: '2027年3月' })).toBeInTheDocument();
    await user.type(input, '2');
    expect(screen.getByRole('grid', { name: '2026年12月' })).toBeInTheDocument();
    // 打出合法日期：日历里先选中它（预览），但还没落定成 value
    await user.type(input, '-25');
    expect(screen.getByRole('grid', { name: '2026年12月' })).toBeInTheDocument();
    expect(day('2026-12-25')).toHaveAttribute('data-selected');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveFocus();

    // Esc 只收起日历，焦点不动；回车落定日期
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(input).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('2026-12-25');
    expect(formatISODate(onChange.mock.calls[0][0])).toBe('2026-12-25');
  });

  it('从输入框打开后按 ↓ 进日历，选好一天回到输入框', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker today={TODAY} onChange={onChange} aria-label="日期" />);
    const input = screen.getByRole('textbox', { name: '日期' });
    await user.click(input);
    await screen.findByRole('dialog');
    await user.keyboard('{ArrowDown}');
    expect(day('2026-10-13')).toHaveFocus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(formatISODate(onChange.mock.calls[0][0])).toBe('2026-10-14');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(input).toHaveFocus();
  });

  it('Esc 关闭日历并把焦点还给按钮', async () => {
    const user = userEvent.setup();
    render(<DatePicker today={TODAY} aria-label="日期" />);
    const button = screen.getByRole('button', { name: '打开日历' });
    await user.click(button);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('放进 Field 直接可用：标签、描述、aria-invalid、required、disabled', () => {
    const { rerender } = render(<Field label="截止日期" hint="不晚于月底" error="必填" required><DatePicker today={TODAY} /></Field>);
    const input = screen.getByRole('textbox', { name: /截止日期/ });
    expect(input).toBe(screen.getByLabelText(/截止日期/));
    expect(input).toHaveAccessibleDescription('不晚于月底 必填');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input.parentElement).toHaveAttribute('data-invalid');

    rerender(<Field label="截止日期" disabled><DatePicker today={TODAY} /></Field>);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: '打开日历' })).toBeDisabled();
  });
});

describe('DateRangePicker', () => {
  it('选完起止两天后收起，按钮上显示这一段，隐藏 input 带上起止值', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker today={TODAY} onChange={onChange} aria-label="时间段" startName="from" endName="to" />);
    const button = screen.getByRole('button', { name: '时间段' });
    expect(button).toHaveTextContent('开始日期 – 结束日期');
    await user.click(button);
    await screen.findByRole('dialog', { name: '选择日期范围' });
    await user.click(day('2026-10-10'));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(day('2026-10-16'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('2026-10-10 – 2026-10-16');
    expect(document.querySelector('input[name="from"]')).toHaveValue('2026-10-10');
    expect(document.querySelector('input[name="to"]')).toHaveValue('2026-10-16');
    // 只有选完整一段才回调
    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0];
    expect([formatISODate(range.start), formatISODate(range.end)]).toEqual(['2026-10-10', '2026-10-16']);
  });

  it('选到一半就关掉弹层：回到上一次完整的范围，不触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateRangePicker
        today={TODAY} onChange={onChange} aria-label="时间段" startName="from" endName="to"
        defaultValue={{ start: new Date(2026, 9, 5), end: new Date(2026, 9, 8) }}
      />,
    );
    const button = screen.getByRole('button', { name: '时间段' });
    await user.click(button);
    await screen.findByRole('dialog');
    await user.click(day('2026-10-20'));
    // 选的过程中按钮上能看到新起点
    expect(button).toHaveTextContent('2026-10-20 – …');
    expect(day('2026-10-20').closest('td')).toHaveAttribute('data-range', 'single');
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('2026-10-05 – 2026-10-08');
    expect(document.querySelector('input[name="from"]')).toHaveValue('2026-10-05');
    expect(document.querySelector('input[name="to"]')).toHaveValue('2026-10-08');
    expect(onChange).not.toHaveBeenCalled();

    // 再打开：日历里还是原来那一段，半截的起点没有留下
    await user.click(button);
    await screen.findByRole('dialog');
    expect(day('2026-10-05').closest('td')).toHaveAttribute('data-range', 'start');
    expect(day('2026-10-08').closest('td')).toHaveAttribute('data-range', 'end');
    expect(day('2026-10-20').closest('td')).not.toHaveAttribute('data-range');
  });

  it('另有名称时（aria-label / label / Field），已选范围进入可访问描述；名称就是按钮文字时不重复', async () => {
    const value = { start: new Date(2026, 9, 10), end: new Date(2026, 9, 16) };
    const { unmount } = render(<DateRangePicker today={TODAY} aria-label="时间段" defaultValue={value} />);
    expect(screen.getByRole('button', { name: '时间段' })).toHaveAccessibleDescription('2026-10-10 – 2026-10-16');
    unmount();

    const plain = render(<DateRangePicker today={TODAY} defaultValue={value} />);
    const bare = screen.getByRole('button', { name: '2026-10-10 – 2026-10-16' });
    expect(bare).not.toHaveAttribute('aria-describedby');
    plain.unmount();

    const labelled = render(<><label htmlFor="r">出差</label><DateRangePicker id="r" today={TODAY} defaultValue={value} /></>);
    await waitFor(() => expect(screen.getByRole('button', { name: '出差' })).toHaveAccessibleDescription('2026-10-10 – 2026-10-16'));
    labelled.unmount();

    render(<Field label="出差日期" hint="含往返" error="必填" required><DateRangePicker today={TODAY} defaultValue={value} /></Field>);
    const button = screen.getByRole('button', { name: /出差日期/ });
    expect(button).toHaveAccessibleDescription('2026-10-10 – 2026-10-16 含往返 必填');
    expect(button).toHaveAttribute('aria-invalid', 'true');
    expect(button).toHaveAttribute('aria-required', 'true');
  });

  it('点 Field 的标签只聚焦按钮，不弹出日历；Field 禁用时跟着禁用', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Field label="出差日期"><DateRangePicker today={TODAY} /></Field>);
    const button = screen.getByRole('button', { name: /出差日期/ });
    // 没选时描述里是占位文字，读屏能知道还没选
    expect(button).toHaveAccessibleDescription('开始日期 – 结束日期');
    await user.click(screen.getByText('出差日期'));
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    rerender(<Field label="出差日期" disabled><DateRangePicker today={TODAY} /></Field>);
    expect(button).toBeDisabled();
  });
});
