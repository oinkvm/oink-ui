import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { FloatingCard } from './FloatingCard';
import { FloatingHeader } from './FloatingParts';

/** 让 (max-width: 519.98px) 命中，模拟手机宽度 */
function mockNarrow(narrow: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: narrow && query.includes('max-width: 519.98px'), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

function Demo({ placement = 'left' as const, header = false, closeButton }: { placement?: 'left' | 'right' | 'bottom'; header?: boolean; closeButton?: boolean | 'auto' }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
      <FloatingCard open={open} onOpenChange={setOpen} placement={placement} aria-label="抽屉" closeButton={closeButton}>
        {header ? <FloatingHeader title="标题" /> : <p>内容</p>}
      </FloatingCard>
    </>
  );
}

describe('手机宽度下的抽屉：右上角关闭按钮', () => {
  it('手机宽度下自动显示，点了关闭', async () => {
    const restore = mockNarrow(true);
    render(<Demo />);
    const btn = await screen.findByRole('button', { name: '关闭' });
    expect(btn).toHaveClass('ok-float__close--auto');
    fireEvent.click(btn);
    expect(screen.getByTestId('state')).toHaveTextContent('closed');
    restore();
  });

  it('宽屏不显示；closeButton 强制显示', () => {
    const restore = mockNarrow(false);
    const { unmount } = render(<Demo />);
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull();
    unmount();
    render(<Demo closeButton />);
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    restore();
  });

  it('FloatingHeader 已经带关闭按钮时不重复', async () => {
    const restore = mockNarrow(true);
    render(<Demo header />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(1));
    expect(screen.getByRole('button', { name: '关闭' })).not.toHaveClass('ok-float__close--auto');
    restore();
  });
});

describe('手机宽度下的抽屉：朝停靠侧滑动关闭', () => {
  const swipe = (el: Element, dx: number, dy = 0) => {
    // jsdom 没有 PointerEvent：用带坐标的 MouseEvent 冒名，再补上 pointerId / pointerType
    const ev = (type: string, x: number, y: number) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      Object.assign(e, { pointerId: 1, pointerType: 'touch' });
      return e;
    };
    el.dispatchEvent(ev('pointerdown', 200, 200));
    for (let i = 1; i <= 6; i++) document.dispatchEvent(ev('pointermove', 200 + (dx * i) / 6, 200 + (dy * i) / 6));
    document.dispatchEvent(ev('pointerup', 200 + dx, 200 + dy));
  };

  it('左边停靠的卡片：左滑关闭；竖着滑（滚动）不关', async () => {
    const restore = mockNarrow(true);
    render(<Demo />);
    const card = screen.getByRole('dialog', { name: '抽屉' });
    expect(card).toHaveAttribute('data-swipe');
    // 进场完成（data-state="open"）后才接受手势
    await waitFor(() => expect(card.parentElement).toHaveAttribute('data-state', 'open'));
    swipe(screen.getByText('内容'), 0, -220);
    expect(screen.getByTestId('state')).toHaveTextContent('open');
    swipe(screen.getByText('内容'), 220, 0);
    expect(screen.getByTestId('state')).toHaveTextContent('open');
    swipe(screen.getByText('内容'), -220, 0);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
    restore();
  });

  it('宽屏不开启任意位置滑动', () => {
    const restore = mockNarrow(false);
    render(<Demo />);
    expect(screen.getByRole('dialog', { name: '抽屉' })).not.toHaveAttribute('data-swipe');
    restore();
  });
});
