import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useEscape } from '../core';
import { Dialog } from '../overlays/Dialog';
import { Tooltip } from './Tooltip';

// jsdom 没有完整的 PointerEvent，fireEvent 传的 pointerType 会被丢掉：手工造一个带 pointerType 的事件
// （React 的 onPointerEnter / Leave 由 pointerover / pointerout 合成）
function firePointer(target: Element, type: string, init: { pointerType?: string; clientX?: number; clientY?: number } = {}) {
  const { pointerType = 'mouse', ...mouse } = init;
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...mouse });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return fireEvent(target, event);
}

describe('Tooltip', () => {
  it('悬停后出现 role="tooltip"，目标用 aria-describedby 指向它；Esc 隐藏', async () => {
    const user = userEvent.setup();
    render(<Tooltip content="编辑" shortcut="⌘E" delay={0}><button aria-label="编辑按钮">E</button></Tooltip>);
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-describedby');

    await user.hover(button);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('编辑');
    expect(tip.querySelector('kbd')).toHaveTextContent('⌘E');
    expect(button).toHaveAttribute('aria-describedby', tip.id);
    await waitFor(() => expect(tip).toHaveAttribute('data-state', 'open'));

    await user.keyboard('{Escape}');
    expect(tip).toHaveAttribute('data-state', 'closed');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull(), { timeout: 1500 });
  });

  it('“文字|快捷键”写法会拆出快捷键提示位', async () => {
    const user = userEvent.setup();
    render(<Tooltip content="创建副本|⌘D" delay={0}><button>复制</button></Tooltip>);
    await user.hover(screen.getByRole('button'));
    const tip = await screen.findByRole('tooltip');
    expect(tip.firstChild?.textContent).toBe('创建副本');
    expect(tip.querySelector('kbd')).toHaveTextContent('⌘D');
  });

  it('键盘聚焦也能触发，失焦后收起', async () => {
    const user = userEvent.setup();
    render(<><Tooltip content="下载" delay={0}><button>下载按钮</button></Tooltip><button>别处</button></>);
    await user.tab();
    expect(screen.getByRole('button', { name: '下载按钮' })).toHaveFocus();
    const tip = await screen.findByRole('tooltip');
    await user.tab();
    expect(tip).toHaveAttribute('data-state', 'closed');
  });

  it('首次要等延迟；紧接着移到相邻目标则跳过延迟', async () => {
    // 等上一个用例留下的“刚收起”窗口过去
    await new Promise((r) => setTimeout(r, 350));
    vi.useFakeTimers();
    try {
      render(
        <>
          <Tooltip content="甲提示"><button>甲</button></Tooltip>
          <Tooltip content="乙提示"><button>乙</button></Tooltip>
        </>,
      );
      const [a, b] = screen.getAllByRole('button');
      firePointer(a, 'pointerover');
      await act(async () => { vi.advanceTimersByTime(200); });
      expect(screen.queryByRole('tooltip')).toBeNull();
      await act(async () => { vi.advanceTimersByTime(300); });
      expect(screen.getByRole('tooltip')).toHaveTextContent('甲提示');

      firePointer(a, 'pointerout');
      firePointer(b, 'pointerover');
      await act(async () => { vi.advanceTimersByTime(20); });
      const tips = screen.getAllByRole('tooltip').filter((t) => !t.hasAttribute('data-instant'));
      expect(tips).toHaveLength(1);
      expect(tips[0]).toHaveTextContent('乙提示');
    } finally {
      vi.useRealTimers();
    }
  });

  it('触屏指针不触发', async () => {
    render(<Tooltip content="提示" delay={0}><button>目标</button></Tooltip>);
    firePointer(screen.getByRole('button'), 'pointerover', { pointerType: 'touch' });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('在对话框里：提示可见时按一次 Esc 只关提示，再按一次才关对话框', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    // 用 core 的 useEscape 模拟一个开着的对话框（Dialog 等浮层走的就是这个栈）
    function FakeDialog() {
      const [open, setOpen] = useState(true);
      useEscape(open, () => { onClose(); setOpen(false); });
      if (!open) return null;
      return (
        <div role="dialog" aria-label="设置">
          <Tooltip content="保存" delay={0}><button>存</button></Tooltip>
        </div>
      );
    }
    render(<FakeDialog />);
    await user.hover(screen.getByRole('button', { name: '存' }));
    const tip = await screen.findByRole('tooltip');
    await waitFor(() => expect(tip).toHaveAttribute('data-state', 'open'));

    await user.keyboard('{Escape}');
    expect(tip).toHaveAttribute('data-state', 'closed');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('提示没显示时，Esc 照常交给下面的浮层', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    function Layer() {
      useEscape(true, onClose);
      return <Tooltip content="保存" delay={0}><button>存</button></Tooltip>;
    }
    render(<Layer />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('真的 Dialog 里：第一次 Esc 只收起提示，对话框还在；第二次才关对话框', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog defaultOpen title="设置" onOpenChange={onOpenChange}>
        <Tooltip content="保存" delay={0}><button>存</button></Tooltip>
      </Dialog>,
    );
    const dialog = await screen.findByRole('dialog', { name: '设置' });
    await user.hover(screen.getByRole('button', { name: '存' }));
    const tip = await screen.findByRole('tooltip');
    await waitFor(() => expect(tip).toHaveAttribute('data-state', 'open'));

    await user.keyboard('{Escape}');
    expect(tip).toHaveAttribute('data-state', 'closed');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
