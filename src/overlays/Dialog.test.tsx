import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Dialog } from './Dialog';

function Demo(props: Partial<React.ComponentProps<typeof Dialog>>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="删除项目？"
        description="文件会移入废纸篓。"
        actions={<><button type="button" onClick={() => setOpen(false)}>取消</button><button type="button">删除</button></>}
        {...props}
      />
    </>
  );
}

describe('Dialog', () => {
  it('居中的模态对话框：有名称和说明，焦点移入，Tab 在里面循环，Esc 关闭并归还焦点', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByText('打开');
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '删除项目？' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('文件会移入废纸篓。');
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'center');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByText('取消'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByText('删除'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByText('取消'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
    expect(document.activeElement).toBe(trigger);
  });

  it('role 可以是 alertdialog；size 预设换成宽度；图标带状态色', async () => {
    render(<Demo role="alertdialog" size="lg" icon={<svg />} tone="danger" />);
    fireEvent.click(screen.getByText('打开'));
    const dialog = await screen.findByRole('alertdialog', { name: '删除项目？' });
    expect(dialog.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('560px');
    expect(dialog.querySelector('.ok-dialog__icon')).toHaveClass('ok-dialog__icon--danger');
  });

  it('非受控：defaultOpen 打开，点遮罩关闭；dismissible=false 时点遮罩和 Esc 都不关', async () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<Dialog defaultOpen title="提示" onOpenChange={onOpenChange} />);
    await screen.findByRole('dialog', { name: '提示' });
    fireEvent.click(document.querySelector('.ok-float__scrim') as Element);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
    unmount();

    render(<Dialog defaultOpen title="必须回答" dismissible={false} />);
    await screen.findByRole('dialog', { name: '必须回答' });
    fireEvent.click(document.querySelector('.ok-float__scrim') as Element);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '必须回答' })).toBeInTheDocument();
  });

  it('手机宽度下也不变形态：仍是居中、从触发点放大的对话框（测试环境的 matchMedia 恒为不匹配，即窄屏）', async () => {
    render(<Demo closable />);
    fireEvent.click(screen.getByText('打开'));
    const dialog = await screen.findByRole('dialog', { name: '删除项目？' });
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'center');
    expect(dialog.parentElement).toHaveAttribute('data-zoom');
    expect(dialog).not.toHaveAttribute('data-draggable');
    expect(dialog.querySelector('.ok-float__grip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('as="form"：内容包在表单里，输入框里回车提交；提交按钮不用 form={id}', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => new FormData(e.currentTarget).get('name'));
    render(
      <Dialog
        defaultOpen
        as="form"
        onSubmit={onSubmit}
        title="重命名"
        actions={<><button type="button">取消</button><button type="submit">保存</button></>}
      >
        <input name="name" aria-label="名称" />
      </Dialog>,
    );
    const dialog = await screen.findByRole('dialog', { name: '重命名' });
    const form = dialog.querySelector('form')!;
    expect(form).toContainElement(screen.getByLabelText('名称'));
    expect(form).toContainElement(screen.getByRole('button', { name: '保存' }));
    expect(form).toContainElement(screen.getByRole('heading', { name: '重命名' }));
    await user.type(screen.getByLabelText('名称'), '季度报告{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.results[0].value).toBe('季度报告');
    expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    // “取消”是普通按钮，不提交
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('默认不渲染 form；内容区是独立的滚动容器，操作区在它外面', async () => {
    render(<Demo>很长的内容</Demo>);
    fireEvent.click(screen.getByText('打开'));
    const dialog = await screen.findByRole('dialog', { name: '删除项目？' });
    expect(dialog.querySelector('form')).toBeNull();
    const body = dialog.querySelector('.ok-dialog__body')!;
    expect(body).toHaveClass('ok-scroll');
    expect(body).toHaveTextContent('很长的内容');
    expect(body.contains(screen.getByText('删除'))).toBe(false);
  });
});
