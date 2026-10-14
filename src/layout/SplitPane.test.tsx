import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SplitPane } from './SplitPane';

const sep = () => screen.getByRole('separator');
// jsdom 没有 PointerEvent：用同名的 MouseEvent 代替，clientX / button 都在
const pointer = (type: string, init: MouseEventInit = {}) => fireEvent(sep(), new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }));

describe('SplitPane', () => {
  it('分隔条是带数值的 separator，指向第一栏', () => {
    render(<SplitPane defaultValue={40} min={10} max={90} data-testid="root"><div>左</div><div>右</div></SplitPane>);
    const s = screen.getByRole('separator', { name: '调整分栏大小' });
    expect(s).toHaveAttribute('aria-valuenow', '40');
    expect(s).toHaveAttribute('aria-valuemin', '10');
    expect(s).toHaveAttribute('aria-valuemax', '90');
    expect(s).toHaveAttribute('aria-orientation', 'vertical');
    expect(s).toHaveAttribute('tabindex', '0');
    const first = document.getElementById(s.getAttribute('aria-controls')!);
    expect(first).toHaveTextContent('左');
    expect(screen.getByTestId('root').style.getPropertyValue('--ok-split-size')).toBe('40');
    expect(screen.getByTestId('root')).toHaveAttribute('data-stack-below', 'md');
  });

  it('键盘：方向键按步长调整，Shift 加大，Home / End 到两端，不越界', async () => {
    const onChange = vi.fn();
    render(<SplitPane defaultValue={50} step={5} onChange={onChange}><div>左</div><div>右</div></SplitPane>);
    const user = userEvent.setup();
    await user.tab();
    expect(sep()).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(sep()).toHaveAttribute('aria-valuenow', '55');
    expect(onChange).toHaveBeenLastCalledWith(55);
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(sep()).toHaveAttribute('aria-valuenow', '45');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(sep()).toHaveAttribute('aria-valuenow', '55');
    await user.keyboard('{End}');
    expect(sep()).toHaveAttribute('aria-valuenow', '80');
    await user.keyboard('{ArrowRight}');
    expect(sep()).toHaveAttribute('aria-valuenow', '80');
    await user.keyboard('{Home}');
    expect(sep()).toHaveAttribute('aria-valuenow', '20');
    await user.keyboard('{ArrowUp}');
    expect(sep()).toHaveAttribute('aria-valuenow', '20');
  });

  it('双击（或 Enter）回到初始值', async () => {
    render(<SplitPane defaultValue={30}><div>左</div><div>右</div></SplitPane>);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(sep()).toHaveAttribute('aria-valuenow', '34');
    await user.dblClick(sep());
    expect(sep()).toHaveAttribute('aria-valuenow', '30');
    await user.keyboard('{End}{Enter}');
    expect(sep()).toHaveAttribute('aria-valuenow', '30');
  });

  it('拖动分隔条按指针位置调整', () => {
    render(<SplitPane data-testid="root"><div>左</div><div>右</div></SplitPane>);
    const track = document.querySelector('.ok-split__track') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 100, top: 0, width: 400, height: 200, right: 500, bottom: 200, x: 100, y: 0, toJSON() {} });
    pointer('pointerdown', { clientX: 300 });
    expect(screen.getByTestId('root')).toHaveAttribute('data-dragging');
    pointer('pointermove', { clientX: 200 });
    expect(sep()).toHaveAttribute('aria-valuenow', '25');
    pointer('pointermove', { clientX: 490 });
    expect(sep()).toHaveAttribute('aria-valuenow', '80');
    pointer('pointerup');
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-dragging');
    pointer('pointermove', { clientX: 200 });
    expect(sep()).toHaveAttribute('aria-valuenow', '80');
  });

  it('受控', async () => {
    function Demo() {
      const [v, setV] = useState(60);
      return <><output>{v}</output><SplitPane value={v} onChange={setV} orientation="vertical"><div>上</div><div>下</div></SplitPane></>;
    }
    render(<Demo />);
    expect(sep()).toHaveAttribute('aria-orientation', 'horizontal');
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('status')).toHaveTextContent('62');
    expect(sep()).toHaveAttribute('aria-valuenow', '62');
    await user.keyboard('{ArrowRight}');
    expect(sep()).toHaveAttribute('aria-valuenow', '62');
  });

  it('堆叠时分隔条退成一条普通的线，不可聚焦、不响应键盘', () => {
    render(<SplitPane stacked data-testid="root"><div>上</div><div>下</div></SplitPane>);
    expect(screen.getByTestId('root')).toHaveAttribute('data-stacked', 'true');
    const s = sep();
    expect(s).not.toHaveAttribute('tabindex');
    expect(s).not.toHaveAttribute('aria-valuenow');
    expect(s).toHaveAttribute('aria-orientation', 'horizontal');
    fireEvent.keyDown(s, { key: 'ArrowRight' });
    expect(screen.getByTestId('root').style.getPropertyValue('--ok-split-size')).toBe('50');
  });
});
