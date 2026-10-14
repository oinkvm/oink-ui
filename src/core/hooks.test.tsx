import { StrictMode, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useControllable, useInertOthers, usePresence } from './hooks';
import { Portal } from './Portal';

function Counter({ value, onChange }: { value?: number; onChange?: (v: number) => void }) {
  const [count, setCount] = useControllable(value, 0, onChange);
  return (
    <>
      <output data-testid="n">{count}</output>
      <button type="button" onClick={() => { setCount((c) => c + 1); setCount((c) => c + 1); setCount((c) => c + 1); }}>加三次</button>
      <button type="button" onClick={() => setCount(5)}>设为 5</button>
    </>
  );
}

describe('useControllable', () => {
  it('非受控：同一批次连续的函数式 set 逐次累加，onChange 每次拿到最新值', async () => {
    const onChange = vi.fn();
    render(<Counter onChange={onChange} />);
    await userEvent.setup().click(screen.getByText('加三次'));
    expect(screen.getByTestId('n')).toHaveTextContent('3');
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it('StrictMode 下 onChange 也只触发一次', async () => {
    const onChange = vi.fn();
    render(<StrictMode><Counter onChange={onChange} /></StrictMode>);
    await userEvent.setup().click(screen.getByText('设为 5'));
    expect(screen.getByTestId('n')).toHaveTextContent('5');
    expect(onChange).toHaveBeenCalledTimes(1);
    // 值没变不再触发
    await userEvent.setup().click(screen.getByText('设为 5'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('受控：连续 set 基于最新值计算；外面不接受时下一次仍从真实的值算起', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Counter value={0} onChange={onChange} />);
    await user.click(screen.getByText('加三次'));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(screen.getByTestId('n')).toHaveTextContent('0');
    // 外面没有更新 value：再点一次还是 1、2、3，而不是接着 4、5、6
    onChange.mockClear();
    await user.click(screen.getByText('加三次'));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    rerender(<Counter value={3} onChange={onChange} />);
    onChange.mockClear();
    await user.click(screen.getByText('加三次'));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([4, 5, 6]);
  });
});

function Layer({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useInertOthers(active, ref);
  return <div ref={ref} />;
}

describe('useInertOthers', () => {
  const add = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    const node = el.firstElementChild as HTMLElement;
    document.body.appendChild(node);
    return node;
  };
  const hidden = (el: Element) => el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true';

  it('隐藏背景、放过浮层，嵌套时按计数恢复原值', () => {
    const app = add('<div id="app"></div>');
    const already = add('<div aria-hidden="true" inert></div>');
    const toasts = add('<div class="ok-toasts" data-ok-layer=""></div>');
    const popup = add('<div class="ok-popup"></div>');
    try {
      const a = render(<Layer active />);
      expect(hidden(app)).toBe(true);
      expect(hidden(toasts)).toBe(false);
      expect(hidden(popup)).toBe(false);
      // 自己所在的顶层节点不隐藏
      expect(hidden(a.container)).toBe(false);

      const b = render(<Layer active />);
      // 先关外层，背景仍然隐藏
      a.rerender(<Layer active={false} />);
      expect(hidden(app)).toBe(true);
      act(() => { b.unmount(); });
      expect(hidden(app)).toBe(false);
      expect(app.hasAttribute('aria-hidden')).toBe(false);
      // 原本就隐藏的节点保持原样
      expect(already.getAttribute('aria-hidden')).toBe('true');
      expect(already.hasAttribute('inert')).toBe(true);
      a.unmount();
    } finally {
      [app, already, toasts, popup].forEach((n) => n.remove());
    }
  });

  it('支持 inert 的环境用 inert，不动 aria-hidden', () => {
    const app = add('<div></div>');
    Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true, get() { return this.hasAttribute('inert'); }, set(v: boolean) { this.toggleAttribute('inert', v); } });
    try {
      const a = render(<Layer active />);
      expect(app.hasAttribute('inert')).toBe(true);
      expect(app.hasAttribute('aria-hidden')).toBe(false);
      a.unmount();
      expect(app.hasAttribute('inert')).toBe(false);
    } finally {
      delete (HTMLElement.prototype as unknown as { inert?: boolean }).inert;
      app.remove();
    }
  });
});

describe('usePresence', () => {
  /**
   * 浏览器里 Portal 拿到容器后的那次渲染，常常排在下一帧（rAF）之后才提交——节点比“下一帧”来得晚。
   * jsdom 里 React 的调度比 rAF 快，复现不出这个顺序，所以用 Late 把节点的挂载人为推迟 40ms（晚于一帧）。
   */
  function Late({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);
    useEffect(() => { const t = setTimeout(() => setReady(true), 40); return () => clearTimeout(t); }, []);
    return ready ? <>{children}</> : null;
  }
  /** 和 FloatingCard / Popup 一样：内容在 Portal 里，Portal 首帧在 effect 里才拿到容器 */
  function Box({ late = false }: { late?: boolean }) {
    const [open, setOpen] = useState(false);
    const { mounted, state, ref } = usePresence(open, 300);
    const node = <div data-testid="box" ref={ref as RefObject<HTMLDivElement>} data-state={state} />;
    return (
      <>
        <button type="button" onClick={() => setOpen((o) => !o)}>开关</button>
        {mounted && <Portal>{late ? <Late>{node}</Late> : node}</Portal>}
      </>
    );
  }

  /** 记下 box 第一次出现在 DOM 里时的 data-state */
  function watchInsert() {
    const seen: string[] = [];
    const mo = new MutationObserver((recs) => {
      for (const r of recs) r.addedNodes.forEach((n) => {
        const el = n instanceof HTMLElement ? (n.matches('[data-testid="box"]') ? n : n.querySelector('[data-testid="box"]')) : null;
        if (el) seen.push(el.getAttribute('data-state') ?? '');
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return { seen, stop: () => mo.disconnect() };
  }

  for (const [strict, late] of [[false, false], [true, false], [false, true], [true, true]]) {
    it(`进场：节点先以 closed 出现在 DOM 里（过渡有起点），之后才切到 open${strict ? '（StrictMode）' : ''}${late ? '（节点晚于下一帧才挂上）' : ''}`, async () => {
      render(strict ? <StrictMode><Box late={late} /></StrictMode> : <Box late={late} />);
      const w = watchInsert();
      fireEvent.click(screen.getByText('开关'));
      await waitFor(() => expect(screen.getByTestId('box')).toHaveAttribute('data-state', 'open'));
      w.stop();
      expect(w.seen).toEqual(['closed']);
    });
  }

  it('退场：先切到 closed，过一会儿再卸载；退场中重新打开会回到 open', async () => {
    render(<Box />);
    fireEvent.click(screen.getByText('开关'));
    await waitFor(() => expect(screen.getByTestId('box')).toHaveAttribute('data-state', 'open'));
    fireEvent.click(screen.getByText('开关'));
    expect(screen.getByTestId('box')).toHaveAttribute('data-state', 'closed');
    fireEvent.click(screen.getByText('开关'));
    await waitFor(() => expect(screen.getByTestId('box')).toHaveAttribute('data-state', 'open'));
    fireEvent.click(screen.getByText('开关'));
    await waitFor(() => expect(screen.queryByTestId('box')).toBeNull(), { timeout: 1000 });
  });
});
