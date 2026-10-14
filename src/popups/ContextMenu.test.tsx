import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from './ContextMenu';
import { MenuItem } from './Menu';

// jsdom 没有完整的 PointerEvent，fireEvent 传的 pointerType 会被丢掉：手工造一个带 pointerType 的事件
// （React 的 onPointerEnter / Leave 由 pointerover / pointerout 合成）
function firePointer(target: Element, type: string, init: { pointerType?: string; clientX?: number; clientY?: number } = {}) {
  const { pointerType = 'mouse', ...mouse } = init;
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...mouse });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return fireEvent(target, event);
}

const setup = (onSelect = vi.fn()) => {
  render(
    <ContextMenu aria-label="文件操作" menu={<><MenuItem onSelect={() => onSelect('open')}>Open</MenuItem><MenuItem tone="danger">Delete</MenuItem></>}>
      <div data-testid="area">文件</div>
    </ContextMenu>,
  );
  return { area: screen.getByTestId('area'), onSelect };
};

describe('ContextMenu', () => {
  it('右键打开 role="menu"，阻止系统菜单；键盘可操作，Esc 关闭', async () => {
    const user = userEvent.setup();
    const { area, onSelect } = setup();
    expect(screen.queryByRole('menu')).toBeNull();
    const notPrevented = fireEvent.contextMenu(area, { clientX: 120, clientY: 80 });
    expect(notPrevented).toBe(false);
    const menu = await screen.findByRole('menu', { name: '文件操作' });
    await waitFor(() => expect(menu).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('open');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull(), { timeout: 1500 });

    fireEvent.contextMenu(area, { clientX: 10, clientY: 10 });
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    expect(area).toHaveAttribute('data-state', 'closed');
  });

  it('点外面关闭', async () => {
    const user = userEvent.setup();
    const { area } = setup();
    fireEvent.contextMenu(area, { clientX: 50, clientY: 50 });
    await screen.findByRole('menu');
    expect(area).toHaveAttribute('data-state', 'open');
    await user.click(document.body);
    expect(area).toHaveAttribute('data-state', 'closed');
  });

  it('触屏长按打开；中途移动则取消', async () => {
    vi.useFakeTimers();
    try {
      const { area } = setup();
      firePointer(area, 'pointerdown', { pointerType: 'touch', clientX: 40, clientY: 40 });
      firePointer(area, 'pointermove', { pointerType: 'touch', clientX: 90, clientY: 40 });
      await act(async () => { vi.advanceTimersByTime(600); });
      expect(area).toHaveAttribute('data-state', 'closed');

      firePointer(area, 'pointerdown', { pointerType: 'touch', clientX: 40, clientY: 40 });
      await act(async () => { vi.advanceTimersByTime(600); });
      expect(area).toHaveAttribute('data-state', 'open');
    } finally {
      vi.useRealTimers();
    }
  });
});
