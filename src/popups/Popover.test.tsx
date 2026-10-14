import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Popover } from './Popover';

describe('Popover', () => {
  it('点击触发：带 aria-haspopup / aria-expanded / aria-controls，焦点移入；Esc 关闭并归还焦点', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>筛选</button>} aria-label="筛选条件">
        <button>应用</button>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: '筛选' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '筛选条件' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(dialog).not.toHaveAttribute('aria-modal');
    await waitFor(() => expect(screen.getByRole('button', { name: '应用' })).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('点外面关闭；点浮层里面不关', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover trigger={<button>打开</button>}><p>内容</p></Popover>
        <button>别处</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: '打开' });
    await user.click(trigger);
    await user.click(await screen.findByText('内容'));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: '别处' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('受控：open 由外部决定，children 函数能拿到 close', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Demo() {
      const [open, setOpen] = useState(true);
      return (
        <Popover open={open} onOpenChange={(v) => { onOpenChange(v); setOpen(v); }} trigger={<button>触发</button>}>
          {({ close }) => <button onClick={close}>完成</button>}
        </Popover>
      );
    }
    render(<Demo />);
    await user.click(await screen.findByRole('button', { name: '完成' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: '触发' })).toHaveFocus();
  });

  it('Tab 走到最后一个元素之后离开浮层并关闭', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>打开</button>}>
        <button>一</button>
        <button>二</button>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: '打开' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: '一' })).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: '二' })).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
