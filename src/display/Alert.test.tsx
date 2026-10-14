import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from './Alert';

describe('Alert', () => {
  it('普通提示是 role="status"，warning / danger 是 role="alert"', () => {
    render(<><Alert tone="success" title="已同步。">所有设备保持一致。</Alert><Alert tone="danger">保存失败</Alert></>);
    const status = screen.getByRole('status');
    expect(status).toHaveClass('ok-alert', 'ok-alert--success');
    expect(status).toHaveTextContent('已同步。所有设备保持一致。');
    expect(status.querySelector('.ok-icon')).not.toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败');
  });
  it('icon={false} 不显示图标；没有 closable 就没有关闭按钮', () => {
    render(<Alert icon={false}>内容</Alert>);
    expect(screen.getByRole('status').querySelector('.ok-icon')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('可关闭（非受控）：先折叠，过渡结束后卸载', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Alert closable onClose={onClose}>主题色现在可以自选了。</Alert>);
    const wrap = screen.getByRole('status').parentElement!;
    expect(wrap).toHaveClass('ok-collapse');
    expect(wrap).toHaveAttribute('data-state', 'open');
    const close = screen.getByRole('button', { name: '关闭' });
    close.focus();
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(wrap).toHaveAttribute('data-state', 'closed');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 2000 });
  });
  it('受控：open 由外部决定', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Alert closable open onOpenChange={onOpenChange}>内容</Alert>);
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('status').parentElement).toHaveAttribute('data-state', 'open');
    rerender(<Alert closable open={false} onOpenChange={onOpenChange}>内容</Alert>);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 2000 });
  });
});
