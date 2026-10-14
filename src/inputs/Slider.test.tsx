import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Slider } from './Slider';

/** jsdom 不排版：给滑块一个 200px 宽的盒子，滑块本身按 0 宽算 */
function box(node: HTMLElement, left = 0, width = 200) {
  node.getBoundingClientRect = () => ({ left, width, top: 0, height: 32, right: left + width, bottom: 32, x: left, y: 0, toJSON() {} }) as DOMRect;
}

// jsdom 没有 PointerEvent（testing-library 会退化成不带坐标的普通事件），这里用带坐标的 MouseEvent 冒充指针事件
describe('Slider', () => {
  it('是 slider，带全套 aria，--v 是 0–1 的比例', () => {
    render(<Slider aria-label="音量" defaultValue={25} format={(v) => `${v}%`} />);
    const s = screen.getByRole('slider', { name: '音量' });
    expect(s).toHaveAttribute('aria-valuemin', '0');
    expect(s).toHaveAttribute('aria-valuemax', '100');
    expect(s).toHaveAttribute('aria-valuenow', '25');
    expect(s).toHaveAttribute('aria-valuetext', '25%');
    expect(s).toHaveAttribute('aria-orientation', 'horizontal');
    expect(s).toHaveAttribute('tabindex', '0');
    expect(s.style.getPropertyValue('--v')).toBe('0.25');
    expect(s.querySelector('.ok-slider__bubble')).toHaveTextContent('25%');
  });

  it('键盘：方向键一步，PageUp / PageDown 十分之一，Home / End 到两端', async () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<Slider aria-label="音量" defaultValue={50} step={5} onChange={onChange} onChangeEnd={onChangeEnd} />);
    const s = screen.getByRole('slider');
    await userEvent.tab();
    expect(s).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(s).toHaveAttribute('aria-valuenow', '55');
    await userEvent.keyboard('{ArrowUp}');
    expect(s).toHaveAttribute('aria-valuenow', '60');
    await userEvent.keyboard('{ArrowLeft}{ArrowDown}');
    expect(s).toHaveAttribute('aria-valuenow', '50');
    await userEvent.keyboard('{PageUp}');
    expect(s).toHaveAttribute('aria-valuenow', '60');
    await userEvent.keyboard('{PageDown}{PageDown}');
    expect(s).toHaveAttribute('aria-valuenow', '40');
    await userEvent.keyboard('{End}');
    expect(s).toHaveAttribute('aria-valuenow', '100');
    await userEvent.keyboard('{ArrowRight}');
    expect(s).toHaveAttribute('aria-valuenow', '100');
    await userEvent.keyboard('{Home}');
    expect(s).toHaveAttribute('aria-valuenow', '0');
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(onChangeEnd).toHaveBeenLastCalledWith(0);
  });

  it('step="any" 无极：指针落在哪就是哪，不吸附；键盘一步是范围的 1%', async () => {
    const onChange = vi.fn();
    render(<Slider aria-label="间距" min={4} max={32} step="any" defaultValue={16} onChange={onChange} />);
    const s = screen.getByRole('slider');
    box(s);
    fireEvent(s, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 37 }));
    expect(onChange).toHaveBeenLastCalledWith(9.18);   // 4 + 37/200 × 28
    expect(s).toHaveAttribute('data-active');
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
    expect(s).not.toHaveAttribute('data-active');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(9.46);
    expect(s).toHaveAttribute('aria-valuetext', '9');   // 无极滑块默认显示取整
  });

  it('有步长时指针位置吸附到最近一档；刻度只在不超过 12 档时画', () => {
    const onChange = vi.fn();
    render(<Slider aria-label="字号" min={0} max={4} step={1} defaultValue={2} ticks onChange={onChange} />);
    const s = screen.getByRole('slider');
    expect(s.querySelectorAll('.ok-slider__ticks i')).toHaveLength(5);
    box(s);
    fireEvent(s, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 140 }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
  });

  it('受控：不改 props 就不变；禁用时不可聚焦也不响应', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Slider aria-label="音量" value={10} onChange={onChange} />);
    const s = screen.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(11);
    expect(s).toHaveAttribute('aria-valuenow', '10');
    onChange.mockClear();
    rerender(<Slider aria-label="音量" value={10} onChange={onChange} disabled />);
    expect(s).toHaveAttribute('aria-disabled', 'true');
    expect(s).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(s, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('拖动状态：onActiveChange 在按下 / 松手时触发（先于 onChangeEnd），根节点带 data-active / data-tracking；键盘不触发', async () => {
    const log: string[] = [];
    render(<Slider aria-label="音量" defaultValue={50} onActiveChange={(a) => log.push(`active:${a}`)} onChangeEnd={(v) => log.push(`end:${v}`)} />);
    const s = screen.getByRole('slider');
    box(s);
    fireEvent(s, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    expect(log).toEqual(['active:true']);
    expect(s).toHaveAttribute('data-active');
    expect(s).not.toHaveAttribute('data-tracking');
    fireEvent(document, new MouseEvent('pointermove', { bubbles: true, buttons: 1, clientX: 140 }));
    expect(s).toHaveAttribute('data-tracking');
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
    expect(log).toEqual(['active:true', 'active:false', 'end:70']);
    expect(s).not.toHaveAttribute('data-active');
    expect(s).not.toHaveAttribute('data-tracking');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(log).toEqual(['active:true', 'active:false', 'end:70', 'end:71']);
  });
});
