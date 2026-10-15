import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented } from './Segmented';

const options = [{ value: 'day', label: '日' }, { value: 'week', label: '周' }, { value: 'month', label: '月', disabled: true }, { value: 'year', label: '年' }];

describe('Segmented', () => {
  it('是 radiogroup，默认选中第一项，只有选中项在 Tab 序列里', () => {
    render(<Segmented aria-label="范围" options={options} />);
    const group = screen.getByRole('radiogroup', { name: '范围' });
    expect(group).toHaveClass('ok-seg');
    expect(group.querySelector('.ok-seg__thumb')).not.toBeNull();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('非受控：点击选中并回调', async () => {
    const onChange = vi.fn();
    render(<Segmented aria-label="范围" options={options} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '周' }));
    expect(screen.getByRole('radio', { name: '周' })).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledWith('week');
  });

  it('方向键移动焦点并选中，跳过禁用项，首尾循环；Home / End 到两端', async () => {
    const onChange = vi.fn();
    render(<Segmented aria-label="范围" options={options} defaultValue="week" onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: '周' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '年' })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith('year');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '日' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('year');
    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('day');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '年' })).toHaveAttribute('aria-checked', 'true');
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<Segmented aria-label="范围" options={options} value="day" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '年' }));
    expect(onChange).toHaveBeenCalledWith('year');
    expect(screen.getByRole('radio', { name: '日' })).toHaveAttribute('aria-checked', 'true');
  });

  it('放不下时横向滚动：选中项被带进可视区（只动自己的 scrollLeft），滑块按内容坐标摆放', async () => {
    // jsdom 不做布局：给每一项假定 100px 宽，轨道内边距 3px，容器只有 250px 宽
    const proto = HTMLElement.prototype;
    const saved = ['offsetLeft', 'offsetWidth', 'clientWidth', 'scrollWidth'].map((k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
    const index = (el: HTMLElement) => Array.from(el.parentElement!.querySelectorAll('[role="radio"]')).indexOf(el);
    const isItem = (el: HTMLElement) => el.getAttribute('role') === 'radio';
    Object.defineProperty(proto, 'offsetLeft', { configurable: true, get(this: HTMLElement) { return isItem(this) ? 3 + index(this) * 100 : 0; } });
    Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isItem(this) ? 100 : 0; } });
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.getAttribute('role') === 'radiogroup' ? 250 : 0; } });
    Object.defineProperty(proto, 'scrollWidth', { configurable: true, get(this: HTMLElement) { return this.getAttribute('role') === 'radiogroup' ? 606 : 0; } });
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const many = ['一', '二', '三', '四', '五', '六'].map((label, i) => ({ value: `v${i}`, label }));
      const { rerender } = render(<Segmented aria-label="分页" options={many} value="v0" />);
      const group = screen.getByRole('radiogroup');
      expect(group.scrollLeft).toBe(0);

      // 选到右边看不见的一项：右缘（含内边距）贴到可视区右边
      rerender(<Segmented aria-label="分页" options={many} value="v4" />);
      expect(group.scrollLeft).toBe(3 + 4 * 100 + 100 + 3 - 250);
      // 滑块位置用的是内容坐标（offsetLeft），不随滚动量变化
      expect(group.style.getPropertyValue('--x')).toBe('403px');
      expect(group.style.getPropertyValue('--w')).toBe('100px');

      // 已经在可视区里的：不动
      rerender(<Segmented aria-label="分页" options={many} value="v3" />);
      expect(group.scrollLeft).toBe(256);
      // 选回左边看不见的一项：左缘（含内边距）贴到可视区左边
      rerender(<Segmented aria-label="分页" options={many} value="v1" />);
      expect(group.scrollLeft).toBe(100);
      expect(group.style.getPropertyValue('--x')).toBe('103px');
      // 不用 scrollIntoView，免得连页面也跟着滚
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      scrollIntoView.mockRestore();
      for (const [k, d] of saved) { if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k]; }
    }
  });

  it('放得下时不碰 scrollLeft', () => {
    const { rerender } = render(<Segmented aria-label="周期" options={options} value="day" />);
    const group = screen.getByRole('radiogroup');
    rerender(<Segmented aria-label="周期" options={options} value="year" />);
    expect(group.scrollLeft).toBe(0);
  });

  describe('滑块落位回弹', () => {
    const had = 'animate' in Element.prototype;
    let thumbAnims: Keyframe[][] = [];
    beforeEach(() => {
      thumbAnims = [];
      const stub = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
        if (this.classList.contains('ok-seg__thumb')) thumbAnims.push(keyframes as Keyframe[]);
        return { cancel() {}, finished: Promise.resolve() } as unknown as Animation;
      };
      if (had) vi.spyOn(Element.prototype, 'animate').mockImplementation(stub);
      else (Element.prototype as unknown as { animate: typeof stub }).animate = stub;
    });
    afterEach(() => {
      vi.restoreAllMocks();
      if (!had) delete (Element.prototype as unknown as { animate?: unknown }).animate;
    });

    it('StrictMode 下挂载不回弹（effect 跑两遍也一样），之后切换选中项才回弹', async () => {
      render(<StrictMode><Segmented aria-label="范围" options={options} defaultValue="week" /></StrictMode>);
      expect(thumbAnims).toHaveLength(0);
      await userEvent.click(screen.getByRole('radio', { name: '年' }));
      expect(thumbAnims).toHaveLength(1);
      // 点已经选中的那一项：值没变，不回弹
      await userEvent.click(screen.getByRole('radio', { name: '年' }));
      expect(thumbAnims).toHaveLength(1);
    });

    it('受控：值不变的重新渲染不回弹，值变了才回弹', () => {
      const { rerender } = render(<StrictMode><Segmented aria-label="范围" options={options} value="day" /></StrictMode>);
      rerender(<StrictMode><Segmented aria-label="范围" options={options} value="day" /></StrictMode>);
      expect(thumbAnims).toHaveLength(0);
      rerender(<StrictMode><Segmented aria-label="范围" options={options} value="week" /></StrictMode>);
      expect(thumbAnims).toHaveLength(1);
    });
  });
});
