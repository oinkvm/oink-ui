import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('非受控：输入后回调新值；ref 落在 input 上', async () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="昵称" defaultValue="小" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '昵称' });
    expect(ref.current).toBe(input);
    await userEvent.type(input, '猪');
    expect(input).toHaveValue('小猪');
    expect(onChange).toHaveBeenLastCalledWith('小猪');
  });

  it('受控：值由外部决定', async () => {
    function Demo() {
      const [v, setV] = useState('');
      return <Input aria-label="大写" value={v} onChange={(s) => setV(s.toUpperCase())} />;
    }
    render(<Demo />);
    const input = screen.getByRole('textbox', { name: '大写' });
    await userEvent.type(input, 'ab');
    expect(input).toHaveValue('AB');
  });

  it('可清除：有内容时清除按钮可用，点击后清空并把焦点还给输入框', async () => {
    const onChange = vi.fn();
    render(<Input aria-label="搜索" clearable defaultValue="abc" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '搜索' });
    const clear = screen.getByRole('button', { name: '清除' });
    expect(input.parentElement).toHaveAttribute('data-has-value');
    await userEvent.click(clear);
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input).toHaveFocus();
    expect(clear).toBeDisabled();
    expect(input.parentElement).not.toHaveAttribute('data-has-value');
  });

  it('密码：显隐按钮切换 type，并用 aria-pressed 表达', async () => {
    render(<Input aria-label="密码" type="password" defaultValue="oink" />);
    const input = screen.getByLabelText('密码');
    const toggle = screen.getByRole('button', { name: '显示密码' });
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('invalid、前后缀、尺寸、禁用', () => {
    render(<Input aria-label="金额" invalid prefix="¥" suffix="元" size="lg" pill disabled />);
    const input = screen.getByRole('textbox', { name: '金额' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeDisabled();
    const root = input.parentElement!;
    expect(root).toHaveClass('ok-input', 'ok-input--lg', 'ok-input--pill');
    expect(root).toHaveAttribute('data-invalid');
    expect(root).toHaveTextContent('¥元');
  });
});
