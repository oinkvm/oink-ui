import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { FloatingCard } from './FloatingCard';
import { FloatingBody, FloatingFooter, FloatingHeader } from './FloatingParts';

function Demo({ modal = true }: { modal?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>打开</button>
      <FloatingCard open={open} onOpenChange={setOpen} modal={modal} placement="right" aria-label="详情">
        <button>里面的按钮</button>
      </FloatingCard>
    </>
  );
}

describe('FloatingCard', () => {
  it('打开后是一个带标签的对话框，焦点移入，Esc 关闭并归还焦点', async () => {
    render(<Demo />);
    const trigger = screen.getByText('打开');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '详情' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'right');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
    expect(document.activeElement).toBe(trigger);
  });

  it('非模态时没有遮罩，也不标 aria-modal', async () => {
    render(<Demo modal={false} />);
    fireEvent.click(screen.getByText('打开'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(document.querySelector('.ok-float__scrim')).toBeNull();
  });

  it('非模态 + autoFocus：打开时焦点移进卡片，Esc 立刻可用，关闭后还给触发元素', async () => {
    function Auto() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>筛选</button>
          <FloatingCard open={open} onOpenChange={setOpen} modal={false} autoFocus placement="right" role="complementary" aria-label="筛选条件">
            <input aria-label="关键词" data-autofocus="" />
          </FloatingCard>
        </>
      );
    }
    render(<Auto />);
    const trigger = screen.getByText('筛选');
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('complementary', { name: '筛选条件' });
    await waitFor(() => expect(screen.getByLabelText('关键词')).toHaveFocus());
    // 非模态：背景不隐藏
    expect(trigger.closest('[aria-hidden="true"], [inert]')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull(), { timeout: 1500 });
    expect(trigger).toHaveFocus();
  });

  it('align 和 size="auto" 落成层上的属性；auto 不写死尺寸', async () => {
    render(
      <FloatingCard open modal={false} placement="bottom" stretch={false} align="end" size="auto" aria-label="写信">
        <FloatingHeader title="新邮件" />
        <FloatingBody>正文</FloatingBody>
        <FloatingFooter><button>发送</button></FloatingFooter>
      </FloatingCard>,
    );
    const layer = (await screen.findByRole('dialog', { name: '写信' })).parentElement!;
    expect(layer).toHaveAttribute('data-placement', 'bottom');
    expect(layer).not.toHaveAttribute('data-stretch');
    expect(layer).toHaveAttribute('data-align', 'end');
    expect(layer).toHaveAttribute('data-size', 'auto');
    expect(layer.style.getPropertyValue('--ok-float-size')).toBe('');
  });
});

describe('模态时隐藏背景', () => {
  const hidden = (el: Element | null) => !!el && (el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true');

  function Nested() {
    const [outer, setOuter] = useState(false);
    const [inner, setInner] = useState(false);
    return (
      <>
        <button onClick={() => setOuter(true)}>打开外层</button>
        <FloatingCard open={outer} onOpenChange={setOuter} aria-label="外层">
          <button onClick={() => setInner(true)}>打开内层</button>
          <button onClick={() => setOuter(false)}>关外层</button>
        </FloatingCard>
        <FloatingCard open={inner} onOpenChange={setInner} aria-label="内层">
          <button onClick={() => setInner(false)}>关内层</button>
        </FloatingCard>
      </>
    );
  }

  it('打开期间 body 下的其它顶层节点被隐藏，浮层自己、Toaster、之后打开的弹出层不受影响；关闭后恢复原值', async () => {
    const sibling = document.createElement('div');
    sibling.setAttribute('aria-hidden', 'false');
    const toasts = document.createElement('div');
    toasts.className = 'ok-toasts';
    toasts.setAttribute('data-ok-layer', '');
    document.body.append(sibling, toasts);
    try {
      const { container } = render(<Demo />);
      const trigger = screen.getByText('打开');
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: '详情' });
      await waitFor(() => expect(hidden(container)).toBe(true));
      expect(hidden(sibling)).toBe(true);
      expect(hidden(toasts)).toBe(false);
      expect(hidden(dialog.parentElement)).toBe(false);
      // 模态里打开的 Select / Menu：之后才挂到 body 下，照常可用
      const popup = document.createElement('div');
      popup.className = 'ok-popup';
      popup.setAttribute('data-ok-layer', '');
      document.body.appendChild(popup);
      expect(hidden(popup)).toBe(false);
      popup.remove();

      fireEvent.keyDown(document, { key: 'Escape' });
      // 一开始关就恢复，不等退场动画
      await waitFor(() => expect(hidden(container)).toBe(false));
      expect(container.hasAttribute('aria-hidden')).toBe(false);
      expect(sibling.getAttribute('aria-hidden')).toBe('false');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
      expect(trigger).toHaveFocus();
    } finally {
      sibling.remove();
      toasts.remove();
    }
  });

  it('StrictMode（effect 会重跑一遍）下关闭后焦点仍然回到触发元素，背景恢复', async () => {
    Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true, get() { return this.hasAttribute('inert'); }, set(v: boolean) { this.toggleAttribute('inert', v); } });
    try {
      const { container } = render(<StrictMode><Demo /></StrictMode>);
      const trigger = screen.getByText('打开');
      act(() => { trigger.focus(); });
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: '详情' });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
      expect(container.hasAttribute('inert')).toBe(true);
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
      expect(container.hasAttribute('inert')).toBe(false);
      expect(trigger).toHaveFocus();
    } finally {
      delete (HTMLElement.prototype as unknown as { inert?: boolean }).inert;
    }
  });

  it('嵌套：关掉内层背景仍然隐藏，外层也关了才恢复；先关外层同理', async () => {
    const { container } = render(<Nested />);
    fireEvent.click(screen.getByText('打开外层'));
    const outer = await screen.findByRole('dialog', { name: '外层' });
    await waitFor(() => expect(outer.parentElement).toHaveAttribute('data-state', 'open'));
    act(() => { screen.getByText('打开内层').focus(); });
    fireEvent.click(screen.getByText('打开内层'));
    const inner = await screen.findByRole('dialog', { name: '内层' });
    await waitFor(() => expect(inner.contains(document.activeElement)).toBe(true));
    await waitFor(() => expect(inner.parentElement).toHaveAttribute('data-state', 'open'));
    expect(hidden(container)).toBe(true);
    // 外层浮层不算背景
    expect(hidden(screen.getByText('打开内层').closest('[data-ok-layer]'))).toBe(false);

    fireEvent.click(screen.getByText('关内层'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '内层' })).toBeNull(), { timeout: 1500 });
    expect(hidden(container)).toBe(true);
    expect(screen.getByText('打开内层')).toHaveFocus();

    // 再开内层，这次先关外层
    fireEvent.click(screen.getByText('打开内层'));
    const again = await screen.findByRole('dialog', { name: '内层' });
    await waitFor(() => expect(again.parentElement).toHaveAttribute('data-state', 'open'));
    fireEvent.click(screen.getByText('关外层'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '外层' })).toBeNull(), { timeout: 1500 });
    expect(hidden(container)).toBe(true);
    fireEvent.click(screen.getByText('关内层'));
    await waitFor(() => expect(hidden(container)).toBe(false));
    expect(container.hasAttribute('inert')).toBe(false);
    expect(container.hasAttribute('aria-hidden')).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('contained 的模态不隐藏背景（它自己就在页面里面）', async () => {
    function Contained() {
      const [host, setHost] = useState<HTMLDivElement | null>(null);
      return <div ref={setHost}><FloatingCard open container={host} contained aria-label="局部" /></div>;
    }
    const { container } = render(<Contained />);
    await screen.findByRole('dialog', { name: '局部' });
    expect(hidden(container)).toBe(false);
  });
});
