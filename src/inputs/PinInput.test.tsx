import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PinInput } from './PinInput';

describe('PinInput', () => {
  it('是带名称的 group，每一格都有位置说明', () => {
    render(<PinInput aria-label="短信验证码" length={4} />);
    expect(screen.getByRole('group', { name: '短信验证码' })).toBeInTheDocument();
    const cells = screen.getAllByRole('textbox');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveAccessibleName('第 1 位，共 4 位');
    expect(cells[0]).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('逐位输入自动跳格，只收数字，输满触发 onComplete', async () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<PinInput length={4} onChange={onChange} onComplete={onComplete} />);
    const cells = screen.getAllByRole('textbox');
    await userEvent.click(cells[0]);
    await userEvent.keyboard('1a2');
    expect(cells[0]).toHaveValue('1');
    expect(cells[1]).toHaveValue('2');
    expect(cells[2]).toHaveFocus();
    await userEvent.keyboard('34');
    expect(onChange).toHaveBeenLastCalledWith('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('退格回退到上一格；方向键移动', async () => {
    render(<PinInput length={4} defaultValue="12" />);
    const cells = screen.getAllByRole('textbox');
    await userEvent.click(cells[2]);
    await userEvent.keyboard('{Backspace}');
    expect(cells[1]).toHaveValue('');
    expect(cells[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(cells[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(cells[1]).toHaveFocus();
  });

  it('整段粘贴会分到各格', async () => {
    const onComplete = vi.fn();
    render(<PinInput length={6} onComplete={onComplete} />);
    const cells = screen.getAllByRole('textbox');
    await userEvent.click(cells[0]);
    await userEvent.paste('12-34 56');
    expect(cells.map((c) => (c as HTMLInputElement).value).join('')).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<PinInput length={4} value="1" onChange={onChange} />);
    const cells = screen.getAllByRole('textbox');
    await userEvent.click(cells[1]);
    await userEvent.keyboard('9');
    expect(onChange).toHaveBeenCalledWith('19');
    expect(cells[1]).toHaveValue('');
  });
});
