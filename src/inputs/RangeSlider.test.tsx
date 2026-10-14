import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RangeSlider } from './RangeSlider';

// jsdom 没有 PointerEvent（testing-library 会退化成不带坐标的普通事件），这里用带坐标的 MouseEvent 冒充指针事件
describe('RangeSlider', () => {
  it('是带名称的 group，里面两个各自命名的 slider，取值范围互相约束', () => {
    render(<RangeSlider aria-label="价格" defaultValue={[20, 60]} />);
    expect(screen.getByRole('group', { name: '价格' })).toBeInTheDocument();
    const lo = screen.getByRole('slider', { name: '最小值' });
    const hi = screen.getByRole('slider', { name: '最大值' });
    expect(lo).toHaveAttribute('aria-valuenow', '20');
    expect(lo).toHaveAttribute('aria-valuemax', '60');
    expect(hi).toHaveAttribute('aria-valuenow', '60');
    expect(hi).toHaveAttribute('aria-valuemin', '20');
  });

  it('键盘：两个滑块依次可 Tab 到，方向键移动，不能越过对方', async () => {
    const onChange = vi.fn();
    render(<RangeSlider aria-label="价格" defaultValue={[58, 60]} minDistance={1} onChange={onChange} />);
    const lo = screen.getByRole('slider', { name: '最小值' });
    const hi = screen.getByRole('slider', { name: '最大值' });
    await userEvent.tab();
    expect(lo).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(lo).toHaveAttribute('aria-valuenow', '59');
    expect(onChange).toHaveBeenLastCalledWith([59, 60]);
    await userEvent.keyboard('{Home}');
    expect(lo).toHaveAttribute('aria-valuenow', '0');
    await userEvent.tab();
    expect(hi).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith([0, 100]);
    await userEvent.keyboard('{PageDown}');
    expect(hi).toHaveAttribute('aria-valuenow', '90');
  });

  it('点在轨道上：移动离得近的那个滑块', () => {
    const onChange = vi.fn();
    render(<RangeSlider aria-label="价格" defaultValue={[20, 60]} onChange={onChange} />);
    const root = screen.getByRole('group');
    root.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 32, right: 200, bottom: 32, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent(root, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 160 }));
    expect(onChange).toHaveBeenLastCalledWith([20, 80]);
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
    fireEvent(root, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 20 }));
    expect(onChange).toHaveBeenLastCalledWith([10, 80]);
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<RangeSlider aria-label="价格" value={[20, 60]} onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith([21, 60]);
    expect(screen.getByRole('slider', { name: '最小值' })).toHaveAttribute('aria-valuenow', '20');
  });

  it('拖动状态：onActiveChange 在按下 / 松手时触发，根节点和被拖的滑块带 data-active', () => {
    const onActiveChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<RangeSlider aria-label="价格" defaultValue={[20, 60]} onActiveChange={onActiveChange} onChangeEnd={onChangeEnd} />);
    const root = screen.getByRole('group');
    root.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 32, right: 200, bottom: 32, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent(root, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 160 }));
    expect(onActiveChange).toHaveBeenLastCalledWith(true);
    expect(root).toHaveAttribute('data-active');
    expect(screen.getByRole('slider', { name: '最大值' }).closest('[data-index]')).toHaveAttribute('data-active');
    expect(screen.getByRole('slider', { name: '最小值' }).closest('[data-index]')).not.toHaveAttribute('data-active');
    fireEvent(document, new MouseEvent('pointermove', { bubbles: true, buttons: 1, clientX: 180 }));
    expect(root).toHaveAttribute('data-tracking');
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    expect(onActiveChange).toHaveBeenCalledTimes(2);
    expect(onChangeEnd).toHaveBeenCalledWith([20, 90]);
    expect(root).not.toHaveAttribute('data-active');
  });
});
