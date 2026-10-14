import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { Confirmer, confirm } from './confirm';

describe('confirm()', () => {
  it('挂了 <Confirmer /> 时由它渲染：点确认得到 true', async () => {
    render(<Confirmer />);
    let result: Promise<boolean> | undefined;
    act(() => { result = confirm({ title: '发布？', description: '发布后所有人可见。', confirmText: '发布' }); });
    const dialog = await screen.findByRole('alertdialog', { name: '发布？' });
    expect(dialog).toHaveAccessibleDescription('发布后所有人可见。');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '发布' })));
    fireEvent.click(screen.getByRole('button', { name: '发布' }));
    await expect(result).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), { timeout: 1500 });
    expect(document.querySelector('[data-ok-confirmer]')).toBeNull();
  });

  it('取消和 Esc 都得到 false；danger 时默认焦点在“取消”上', async () => {
    render(<Confirmer />);
    let first: Promise<boolean> | undefined;
    act(() => { first = confirm({ title: '删除？', tone: 'danger', confirmText: '删除' }); });
    await screen.findByRole('alertdialog', { name: '删除？' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' })));
    expect(screen.getByRole('button', { name: '删除' })).toHaveClass('ok-btn--danger');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await expect(first).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), { timeout: 1500 });

    let second: Promise<boolean> | undefined;
    act(() => { second = confirm('退出登录？'); });
    await screen.findByRole('alertdialog', { name: '退出登录？' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(second).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), { timeout: 1500 });
  });

  it('没挂 <Confirmer /> 时自动在 body 下建一个独立的 root', async () => {
    let result: Promise<boolean> | undefined;
    act(() => { result = confirm('继续？'); });
    const dialog = await screen.findByRole('alertdialog', { name: '继续？' });
    expect(document.querySelector('[data-ok-confirmer]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await expect(result).resolves.toBe(true);
    await waitFor(() => expect(dialog.isConnected).toBe(false), { timeout: 1500 });
  });

  it('确认后触发按钮已被移除：焦点回退到最近的可聚焦祖先，没有就落到 <main>', async () => {
    function List({ focusableRow }: { focusableRow: boolean }) {
      const [items, setItems] = useState(['甲', '乙']);
      return (
        <main data-testid="main">
          <Confirmer />
          <ul>
            {items.map((it) => (
              <li key={it}>
                <div tabIndex={focusableRow ? -1 : undefined} data-testid="list">
                  <button type="button" onClick={async () => { if (await confirm({ title: `删除${it}？`, tone: 'danger', confirmText: '删除' })) setItems((l) => l.filter((x) => x !== it)); }}>
                    删除{it}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </main>
      );
    }
    const run = async () => {
      const trigger = screen.getByRole('button', { name: '删除甲' });
      trigger.focus();
      fireEvent.click(trigger);
      await screen.findByRole('alertdialog', { name: '删除甲？' });
      fireEvent.click(screen.getByRole('button', { name: '删除' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), { timeout: 1500 });
      expect(trigger.isConnected).toBe(false);
    };

    const first = render(<List focusableRow={false} />);
    await run();
    expect(screen.getByTestId('main')).toHaveFocus();
    expect(screen.getByTestId('main')).toHaveAttribute('tabindex', '-1');
    first.unmount();

    // 祖先里有仍在文档中的可聚焦元素时优先用它——这里整行都没了，所以还是 main；换成外层容器可聚焦的情况
    function Wrapped() {
      const [show, setShow] = useState(true);
      return (
        <main>
          <Confirmer />
          <section tabIndex={-1} data-testid="section">
            {show && <button type="button" onClick={async () => { if (await confirm('移除？')) setShow(false); }}>移除</button>}
          </section>
        </main>
      );
    }
    render(<Wrapped />);
    const trigger = screen.getByRole('button', { name: '移除' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('alertdialog', { name: '移除？' });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), { timeout: 1500 });
    expect(screen.getByTestId('section')).toHaveFocus();
  });
});
