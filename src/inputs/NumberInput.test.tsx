import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  it('是 spinbutton，带全套 aria-value*', () => {
    render(<NumberInput aria-label="数量" defaultValue={2} min={0} max={5} />);
    const spin = screen.getByRole('spinbutton', { name: '数量' });
    expect(spin).toHaveAttribute('aria-valuenow', '2');
    expect(spin).toHaveAttribute('aria-valuemin', '0');
    expect(spin).toHaveAttribute('aria-valuemax', '5');
    expect(spin).toHaveValue('2');
  });

  it('键盘：上下一步，PageUp / PageDown 一大步，Home / End 到两端，到头不越界', async () => {
    const onChange = vi.fn();
    render(<NumberInput aria-label="数量" defaultValue={50} min={0} max={100} step={5} onChange={onChange} />);
    const spin = screen.getByRole('spinbutton');
    await userEvent.tab();
    expect(spin).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(spin).toHaveValue('55');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(spin).toHaveValue('45');
    await userEvent.keyboard('{PageUp}');
    expect(spin).toHaveValue('95');
    await userEvent.keyboard('{End}');
    expect(spin).toHaveValue('100');
    onChange.mockClear();
    await userEvent.keyboard('{ArrowUp}');
    expect(spin).toHaveValue('100');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Home}');
    expect(spin).toHaveValue('0');
  });

  it('按钮：点一下走一步；到头时按钮标 aria-disabled', async () => {
    render(<NumberInput aria-label="数量" defaultValue={4} min={0} max={5} />);
    const spin = screen.getByRole('spinbutton');
    const inc = screen.getByRole('button', { name: '增加' });
    await userEvent.click(inc);
    expect(spin).toHaveValue('5');
    expect(inc).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(inc);
    expect(spin).toHaveValue('5');
    await userEvent.click(screen.getByRole('button', { name: '减少' }));
    expect(spin).toHaveValue('4');
  });

  it('按住按钮连发，松开停止', () => {
    vi.useFakeTimers();
    try {
      render(<NumberInput aria-label="数量" defaultValue={0} max={100} />);
      const spin = screen.getByRole('spinbutton');
      const inc = screen.getByRole('button', { name: '增加' });
      fireEvent.pointerDown(inc, { button: 0 });
      expect(spin).toHaveValue('1');
      act(() => { vi.advanceTimersByTime(400 + 60 * 3); });
      expect(spin).toHaveValue('4');
      fireEvent.pointerUp(inc);
      fireEvent.click(inc);   // 指针按下之后跟来的 click 不再多走一步
      act(() => { vi.advanceTimersByTime(500); });
      expect(spin).toHaveValue('4');
    } finally {
      vi.useRealTimers();
    }
  });

  it('直接输入：失焦时取整到步长精度并夹在范围内；乱输则还原', async () => {
    const onChange = vi.fn();
    render(<NumberInput aria-label="数量" defaultValue={1} min={0} max={10} onChange={onChange} />);
    const spin = screen.getByRole('spinbutton');
    await userEvent.clear(spin);
    await userEvent.type(spin, '42');
    await userEvent.tab();
    expect(spin).toHaveValue('10');
    expect(onChange).toHaveBeenLastCalledWith(10);
    await userEvent.clear(spin);
    await userEvent.type(spin, 'abc');
    await userEvent.tab();
    expect(spin).toHaveValue('10');
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<NumberInput aria-label="数量" value={3} onChange={onChange} />);
    const spin = screen.getByRole('spinbutton');
    await userEvent.tab();
    expect(spin).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenCalledWith(4);
    expect(spin).toHaveValue('3');
  });
});
