import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { Toaster, toast } from './Toast';

afterEach(async () => {
  act(() => { toast.dismiss(); });
  await waitFor(() => expect(document.querySelectorAll('.ok-toast').length).toBe(0));
});

describe('Toast', () => {
  it('toast() 在 <Toaster /> 里显示一条 status；点一下关闭', async () => {
    render(<Toaster />);
    // 测试环境的 matchMedia 恒为不匹配，即窄屏：默认停在底部
    expect(screen.getByRole('region', { name: '通知' })).toHaveAttribute('data-position', 'bottom-center');
    act(() => { toast({ title: '已保存', description: '所有更改都同步了' }); });
    const item = await screen.findByRole('status');
    expect(item).toHaveTextContent('已保存');
    expect(item).toHaveTextContent('所有更改都同步了');
    expect(item).toHaveAttribute('aria-live', 'polite');
    expect(item).toHaveClass('ok-toast', 'ok-toast--default');
    fireEvent.click(item);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('toast.success / danger 带状态色；danger 用 assertive 的 alert', async () => {
    render(<Toaster />);
    act(() => { toast.success('成功了'); toast.danger('出错了'); });
    expect(await screen.findByRole('status')).toHaveClass('ok-toast--success');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('ok-toast--danger');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    // 新的在前
    const all = Array.from(document.querySelectorAll('.ok-toast'));
    expect(all[0]).toBe(alert);
  });

  it('到时间自动消失；悬停时暂停，离开后继续', async () => {
    vi.useFakeTimers();
    try {
      render(<Toaster duration={1000} />);
      act(() => { toast('一会儿就走'); });
      const item = screen.getByRole('status');
      act(() => { vi.advanceTimersByTime(600); });
      fireEvent.pointerEnter(item);
      act(() => { vi.advanceTimersByTime(5000); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      fireEvent.pointerLeave(item);
      act(() => { vi.advanceTimersByTime(700); });
      expect(screen.getByRole('status')).not.toHaveAttribute('data-leaving');
      act(() => { vi.advanceTimersByTime(200); });
      expect(screen.getByRole('status')).toHaveAttribute('data-leaving');
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('duration: 0 不自动消失，并带一个关闭按钮', async () => {
    vi.useFakeTimers();
    try {
      render(<Toaster duration={1000} />);
      act(() => { toast({ title: '需要处理', duration: 0 }); });
      act(() => { vi.advanceTimersByTime(60000); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '关闭' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('操作按钮：触发回调并关闭这条通知', async () => {
    const undo = vi.fn();
    const onDismiss = vi.fn();
    render(<Toaster />);
    act(() => { toast({ title: '已删除', action: { label: '撤销', onClick: undo }, onDismiss }); });
    fireEvent.click(await screen.findByRole('button', { name: '撤销' }));
    expect(undo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('超过 max 时最旧的先退场；同一个 id 原地更新；toast.dismiss(id) 关掉指定的一条', async () => {
    render(<Toaster max={2} position="bottom-left" />);
    expect(screen.getByRole('region', { name: '通知' })).toHaveAttribute('data-position', 'bottom-left');
    let second = '';
    act(() => { toast('第一条'); second = toast('第二条'); toast({ id: 'fixed', title: '第三条' }); });
    await waitFor(() => expect(screen.queryByText('第一条')).toBeNull());
    expect(screen.getByText('第二条')).toBeInTheDocument();
    act(() => { toast({ id: 'fixed', title: '第三条（更新）' }); });
    expect(screen.getByText('第三条（更新）')).toBeInTheDocument();
    expect(document.querySelectorAll('.ok-toast').length).toBe(2);
    act(() => { toast.dismiss(second); });
    await waitFor(() => expect(screen.queryByText('第二条')).toBeNull());
    expect(screen.getByText('第三条（更新）')).toBeInTheDocument();
  });

  it('通知位置变化时用 FLIP 补位：旧位置在重新渲染之前量好', async () => {
    render(<Toaster />);
    act(() => { toast('甲'); });
    const first = await screen.findByText('甲');
    const node = first.closest('.ok-toast') as HTMLElement;
    let top = 0;
    node.getBoundingClientRect = () => ({ left: 0, top, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON() {} }) as DOMRect;
    const spy = vi.spyOn(node, 'animate');
    spy.mockClear();
    // 新通知插到前面：旧的那条量到的位置从 0 变成 60
    act(() => { toast('乙'); top = 60; });
    await screen.findByText('乙');
    const flipped = spy.mock.calls.some(([frames]) => Array.isArray(frames) && String((frames[0] as Keyframe).transform).includes('translate(0px, -60px)'));
    expect(flipped).toBe(true);
  });

  it('同 id 更新是整体替换：没传 action 时上一条的“撤销”按钮不会留下来，tone / description 回到默认', async () => {
    render(<Toaster />);
    const onDismiss = vi.fn();
    act(() => { toast.success({ id: 'job', title: '已删除', description: '3 个文件', action: { label: '撤销' }, duration: 0, onDismiss }); });
    expect(await screen.findByRole('button', { name: '撤销' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    act(() => { toast({ id: 'job', title: '已撤销' }); });
    const item = screen.getByText('已撤销').closest('.ok-toast') as HTMLElement;
    expect(document.querySelectorAll('.ok-toast')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull();
    expect(item).not.toHaveTextContent('3 个文件');
    expect(item).toHaveClass('ok-toast--default');
    // duration 回到 Toaster 的默认值，不再是“一直留着”，所以关闭按钮也没了
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull();
    // onDismiss 没传时沿用上一条的
    act(() => { toast.dismiss('job'); });
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('同 id 更新后重新计时', async () => {
    vi.useFakeTimers();
    try {
      render(<Toaster duration={1000} />);
      act(() => { toast({ id: 'same', title: '保存中' }); });
      act(() => { vi.advanceTimersByTime(800); });
      act(() => { toast({ id: 'same', title: '保存中' }); });
      act(() => { vi.advanceTimersByTime(800); });
      expect(screen.getByRole('status')).not.toHaveAttribute('data-leaving');
      act(() => { vi.advanceTimersByTime(300); });
      expect(screen.getByRole('status')).toHaveAttribute('data-leaving');
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    } finally {
      vi.useRealTimers();
    }
  });

  describe('文字可以选中复制', () => {
    afterEach(() => { clearSelection(); });
    /** 像浏览器那样选中一段文字，并发出 selectionchange */
    function select(node: Node) {
      act(() => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      });
    }
    function clearSelection() {
      act(() => { document.getSelection()?.removeAllRanges(); document.dispatchEvent(new Event('selectionchange')); });
    }
    /** jsdom 没有 PointerEvent：用 MouseEvent 补上 pointerType */
    function pointer(type: 'pointerdown' | 'pointerup', node: Element, pointerType = 'mouse') {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      fireEvent(node, event);
    }
    /** 一次完整的点击：按下、松开、click */
    function press(node: Element, pointerType = 'mouse') {
      pointer('pointerdown', node, pointerType);
      pointer('pointerup', node, pointerType);
      fireEvent.click(node);
    }
    function show(options: Parameters<typeof toast>[0], duration?: number) {
      render(<Toaster duration={duration} />);
      act(() => { toast(options); });
      const item = document.querySelector<HTMLElement>('.ok-toast')!;
      return { item, title: item.querySelector<HTMLElement>('.ok-toast__title')!, desc: item.querySelector<HTMLElement>('.ok-toast__desc')!, icon: item.querySelector<HTMLElement>('.ok-toast__icon')! };
    }
    const open = () => document.querySelector('.ok-toast:not([data-leaving])');

    it('点文字、双击、三击、从文字拖选到通知别处，都不关闭', () => {
      const { item, title, desc } = show({ title: '无法应用布局', description: '甲已离线', duration: 0 });
      press(title);
      press(desc); press(desc); fireEvent.dblClick(desc);
      press(title); press(title); press(title);
      // 从标题拖到通知的留白处松开：click 落在两者共同的祖先，也就是通知本身
      pointer('pointerdown', title);
      select(title);
      pointer('pointerup', item);
      fireEvent.click(item);
      expect(open()).not.toBeNull();
    });

    it('通知里有选区时点它不关闭（浏览器按下时就清掉了选区也一样）；没有选区时点留白照常关闭', () => {
      const { icon, title } = show({ title: '无法应用布局', duration: 0 });
      select(title);
      pointer('pointerdown', icon);
      clearSelection();
      pointer('pointerup', icon);
      fireEvent.click(icon);
      expect(open()).not.toBeNull();
      press(icon);
      expect(open()).toBeNull();
    });

    it('页面禁选时浏览器不清旧选区：带着选区点一下留着，再点一下关闭；在通知外按下就恢复计时', () => {
      vi.useFakeTimers();
      try {
        const { icon, title } = show('无法应用布局', 1000);
        select(title);
        // 选区一直在（Chromium 在禁选的地方按下不清选区）
        press(icon);
        expect(open()).not.toBeNull();
        press(icon);
        expect(open()).toBeNull();
        act(() => { toast('配对失败'); });
        const next = document.querySelector<HTMLElement>('.ok-toast:not([data-leaving])')!;
        select(next.querySelector('.ok-toast__title')!);
        act(() => { vi.advanceTimersByTime(5000); });
        expect(open()).not.toBeNull();
        pointer('pointerdown', document.body);
        pointer('pointerup', document.body);
        act(() => { vi.advanceTimersByTime(1100); });
        expect(open()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('操作按钮和关闭按钮照常工作，有选区时也一样', () => {
      const undo = vi.fn();
      const { item, title } = show({ title: '已删除', action: { label: '撤销', onClick: undo } });
      select(title);
      press(within(item).getByRole('button', { name: '撤销' }));
      expect(undo).toHaveBeenCalledTimes(1);
      expect(open()).toBeNull();
      act(() => { toast({ title: '配对失败', duration: 0 }); });
      const next = document.querySelector<HTMLElement>('.ok-toast:not([data-leaving])')!;
      select(next.querySelector('.ok-toast__title')!);
      press(within(next).getByRole('button', { name: '关闭' }));
      expect(open()).toBeNull();
    });

    it('按着文字或通知里有选区时暂停计时；松开、选区清掉之后按悬停规则接着走', () => {
      vi.useFakeTimers();
      try {
        const { item, title } = show('无法应用布局', 1000);
        pointer('pointerdown', title);
        act(() => { vi.advanceTimersByTime(5000); });
        expect(open()).not.toBeNull();
        // 拖选到通知外面松开：指针已经离开，选区还在，继续暂停
        select(title);
        fireEvent.pointerLeave(item);
        pointer('pointerup', document.body);
        act(() => { vi.advanceTimersByTime(5000); });
        expect(open()).not.toBeNull();
        // 暂停不靠焦点
        expect(document.activeElement).toBe(document.body);
        clearSelection();
        act(() => { vi.advanceTimersByTime(700); });
        expect(open()).not.toBeNull();
        act(() => { vi.advanceTimersByTime(400); });
        expect(open()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('选区清掉时指针还停在通知上：继续按悬停暂停', () => {
      vi.useFakeTimers();
      try {
        const { item, title } = show('无法应用布局', 1000);
        fireEvent.pointerEnter(item);
        pointer('pointerdown', title);
        select(title);
        pointer('pointerup', title);
        clearSelection();
        act(() => { vi.advanceTimersByTime(5000); });
        expect(open()).not.toBeNull();
        fireEvent.pointerLeave(item);
        act(() => { vi.advanceTimersByTime(1100); });
        expect(open()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('触屏上点一下文字仍然关闭', () => {
      const { title } = show({ title: '已保存', duration: 0 });
      press(title, 'touch');
      expect(open()).toBeNull();
    });
  });

  describe('位置', () => {
    const original = window.matchMedia;
    /** 假装视口有这么宽 */
    const viewport = (width: number) => {
      window.matchMedia = ((query: string) => {
        const min = /min-width:\s*(\d+)px/.exec(query);
        return { matches: min ? width >= Number(min[1]) : false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
      }) as unknown as typeof window.matchMedia;
    };
    afterEach(() => { window.matchMedia = original; });
    const pos = () => screen.getByRole('region', { name: '通知' }).getAttribute('data-position');

    it('默认：宽屏 top-right，窄屏 bottom-center', () => {
      viewport(1200);
      const wide = render(<Toaster />);
      expect(pos()).toBe('top-right');
      wide.unmount();
      viewport(375);
      render(<Toaster />);
      expect(pos()).toBe('bottom-center');
    });

    it('单值写法到处生效；mobilePosition 只管窄屏', () => {
      viewport(375);
      const a = render(<Toaster position="top-left" />);
      expect(pos()).toBe('top-left');
      a.rerender(<Toaster position="top-left" mobilePosition="bottom-center" />);
      expect(pos()).toBe('bottom-center');
      a.unmount();
      viewport(1200);
      render(<Toaster position="top-left" mobilePosition="bottom-center" />);
      expect(pos()).toBe('top-left');
    });

    it('响应式写法按断点向上补齐', () => {
      viewport(800);
      const a = render(<Toaster position={{ base: 'bottom-center', md: 'bottom-right', xl: 'top-right' }} />);
      expect(pos()).toBe('bottom-right');
      a.unmount();
      viewport(375);
      const b = render(<Toaster position={{ base: 'top-center', md: 'bottom-right' }} />);
      expect(pos()).toBe('top-center');
      b.unmount();
      viewport(1400);
      render(<Toaster position={{ base: 'bottom-center', md: 'bottom-right', xl: 'top-right' }} />);
      expect(pos()).toBe('top-right');
    });
  });
});
