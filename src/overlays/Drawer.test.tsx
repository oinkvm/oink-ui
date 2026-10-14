import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Drawer } from './Drawer';
import { FloatingBody, FloatingHeader } from './FloatingParts';

function Demo(props: Partial<React.ComponentProps<typeof Drawer>>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开</button>
      <Drawer open={open} onOpenChange={setOpen} {...props}>
        <FloatingHeader title="设置" />
        <FloatingBody><input aria-label="名称" /></FloatingBody>
      </Drawer>
    </>
  );
}

describe('Drawer', () => {
  it('默认从右侧滑入的模态抽屉：名称来自标题，Esc 关闭并归还焦点', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByText('打开');
    await user.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: '设置' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveClass('ok-drawer');
    expect(drawer.parentElement).toHaveAttribute('data-placement', 'right');
    expect(drawer.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('360px');
    expect(document.querySelector('.ok-float__scrim')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
    expect(document.activeElement).toBe(trigger);
  });

  it.each([
    ['left', 'sm', '280px'],
    ['top', 'sm', '240px'],
    ['bottom', 'lg', '520px'],
    ['right', 420, '420px'],
    ['left', '50%', '50%'],
  ] as const)('placement=%s size=%s → %s', async (placement, size, expected) => {
    render(<Drawer defaultOpen placement={placement} size={size} aria-label="抽屉" />);
    const drawer = await screen.findByRole('dialog', { name: '抽屉' });
    expect(drawer.parentElement).toHaveAttribute('data-placement', placement);
    expect(drawer.parentElement?.style.getPropertyValue('--ok-float-size')).toBe(expected);
  });

  it('非受控：点关闭按钮自己关掉', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <FloatingHeader title="详情" />
      </Drawer>,
    );
    await user.click(await screen.findByRole('button', { name: '关闭' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });
});
