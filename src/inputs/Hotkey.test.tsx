import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Hotkey } from './Hotkey';
import { Kbd } from './Kbd';

describe('Hotkey', () => {
  it('是带名称的按钮，按键显示成键帽；未设置时显示占位', () => {
    const { rerender } = render(<Hotkey aria-label="全局快捷键" defaultValue="Meta+Shift+K" />);
    const h = screen.getByRole('button', { name: '全局快捷键' });
    expect(Array.from(h.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual(['⌘', '⇧', 'K']);
    expect(h).toHaveAccessibleDescription('当前：Command + Shift + K');
    rerender(<Hotkey aria-label="全局快捷键" value="" />);
    expect(h).toHaveTextContent('点击录制');
  });

  it('Enter 开始录制，修饰键按下即显示，按下主键后提交', async () => {
    const onChange = vi.fn();
    render(<Hotkey aria-label="快捷键" onChange={onChange} />);
    const h = screen.getByRole('button');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(h).toHaveAttribute('data-recording');
    expect(h).toHaveTextContent('按下组合键…');
    fireEvent.keyDown(h, { key: 'Meta', code: 'MetaLeft', metaKey: true });
    expect(h.querySelector('kbd')).toHaveTextContent('⌘');
    fireEvent.keyDown(h, { key: 'k', code: 'KeyK', metaKey: true });
    expect(onChange).toHaveBeenCalledWith('Meta+K', ['Meta', 'K']);
    expect(h).not.toHaveAttribute('data-recording');
    expect(Array.from(h.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual(['⌘', 'K']);
  });

  it('Esc 取消录制并保留原值，且不冒泡给外层', async () => {
    const onChange = vi.fn();
    const outer = vi.fn();
    render(<div onKeyDown={outer}><Hotkey aria-label="快捷键" defaultValue="Control+S" onChange={onChange} /></div>);
    const h = screen.getByRole('button');
    await userEvent.click(h);
    expect(h).toHaveAttribute('data-recording');
    outer.mockClear();
    fireEvent.keyDown(h, { key: 'Escape', code: 'Escape' });
    expect(h).not.toHaveAttribute('data-recording');
    expect(outer).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(Array.from(h.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual(['⌃', 'S']);
  });

  it('失焦取消录制；受控时不改 props 就不变；禁用时不能录制', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<><Hotkey aria-label="快捷键" value="Alt+A" onChange={onChange} /><button>别处</button></>);
    const h = screen.getByRole('button', { name: '快捷键' });
    await userEvent.click(h);
    fireEvent.keyDown(h, { key: 'b', code: 'KeyB' });
    expect(onChange).toHaveBeenCalledWith('B', ['B']);
    expect(Array.from(h.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual(['⌥', 'A']);
    await userEvent.click(h);
    expect(h).toHaveAttribute('data-recording');
    await userEvent.click(screen.getByRole('button', { name: '别处' }));
    expect(h).not.toHaveAttribute('data-recording');
    rerender(<><Hotkey aria-label="快捷键" value="Alt+A" disabled /><button>别处</button></>);
    await userEvent.click(h);
    expect(h).not.toHaveAttribute('data-recording');
    expect(h).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Kbd', () => {
  it('渲染成 kbd；按键名换成符号并带可读名称', () => {
    const { container } = render(<><Kbd>K</Kbd><Kbd k="Meta" /><Kbd k="F5" size="sm" /></>);
    const [plain, meta, f5] = Array.from(container.querySelectorAll('kbd'));
    expect(plain).toHaveClass('ok-kbd');
    expect(plain).toHaveTextContent('K');
    expect(meta).toHaveTextContent('⌘');
    expect(meta.querySelector('abbr')).toHaveAttribute('title', 'Command');
    expect(f5).toHaveTextContent('F5');
    expect(f5).toHaveClass('ok-kbd--sm');
  });
});
