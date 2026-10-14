import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
  it('是真的 input[type=checkbox] role="switch"，结构与原型一致', () => {
    render(<Switch aria-label="开机启动" defaultChecked />);
    const sw = screen.getByRole('switch', { name: '开机启动' });
    expect(sw.tagName).toBe('INPUT');
    expect(sw).toHaveAttribute('type', 'checkbox');
    expect(sw).toBeChecked();
    expect(sw.parentElement).toHaveClass('ok-switch');
    expect(sw.nextElementSibling).toHaveClass('ok-switch__track');
    expect(sw.nextElementSibling!.firstElementChild).toHaveClass('ok-switch__thumb');
  });

  it('非受控：点击和空格都能切换；可见文字就是名称', async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>自动保存</Switch>);
    const sw = screen.getByRole('switch', { name: '自动保存' });
    await userEvent.click(sw);
    expect(sw).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(' ');
    expect(sw).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('受控：不改 props 就不变；禁用用原生 disabled', async () => {
    const onChange = vi.fn();
    render(<><Switch aria-label="受控" checked onChange={onChange} /><Switch aria-label="禁用" disabled /></>);
    const sw = screen.getByRole('switch', { name: '受控' });
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(sw).toBeChecked();
    const off = screen.getByRole('switch', { name: '禁用' });
    expect(off).toBeDisabled();
    await userEvent.click(off);
    expect(off).not.toBeChecked();
  });

  it('labelPosition：默认文字在开关后面；start 时文字在前、开关在后，名称和点击行为不变', async () => {
    const { rerender } = render(<Switch>自动更新</Switch>);
    const sw = screen.getByRole('switch', { name: '自动更新' });
    const root = sw.parentElement!;
    expect(root).toHaveAttribute('data-label-position', 'end');
    expect(Array.from(root.children).map((n) => n.className || n.tagName)).toEqual(['INPUT', 'ok-switch__track', 'ok-switch__label']);

    rerender(<Switch labelPosition="start">自动更新</Switch>);
    expect(root).toHaveAttribute('data-label-position', 'start');
    expect(Array.from(root.children).map((n) => n.className || n.tagName)).toEqual(['ok-switch__label', 'INPUT', 'ok-switch__track']);
    // 样式里的 input + .ok-switch__track 仍然成立
    expect(sw.nextElementSibling).toHaveClass('ok-switch__track');
    expect(screen.getByRole('switch', { name: '自动更新' })).toBe(sw);
    await userEvent.click(screen.getByText('自动更新'));
    expect(sw).toBeChecked();
  });
});
