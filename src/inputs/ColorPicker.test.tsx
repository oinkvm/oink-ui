import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from './ColorPicker';
import { Field } from './Field';

/** jsdom 不排版：给二维滑块一个 200 × 100 的盒子 */
function box(node: HTMLElement, left = 0, top = 0, width = 200, height = 100) {
  node.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
}
const area = () => screen.getByRole('slider', { name: '饱和度与亮度' });
const hue = () => screen.getByRole('slider', { name: '色相' });
const hex = () => screen.getByRole('textbox', { name: '十六进制色值' });

// jsdom 没有 PointerEvent（testing-library 会退化成不带坐标的普通事件），这里用带坐标的 MouseEvent 冒充指针事件
describe('ColorPicker', () => {
  it('是一组控件：二维滑块、色相条（原生 range）、十六进制输入框；默认值 #ff6b8e', () => {
    render(<ColorPicker />);
    expect(screen.getByRole('group', { name: '颜色' })).toHaveClass('ok-color-picker');
    const a = area();
    expect(a).toHaveAttribute('aria-roledescription', '二维滑块');
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 58%，亮度 100%');
    expect(a).toHaveAttribute('tabindex', '0');
    expect(hue()).toHaveAttribute('type', 'range');
    expect(hue()).toHaveValue('346');
    expect(hue()).toHaveAttribute('aria-valuetext', '346°');
    expect(hex()).toHaveValue('#ff6b8e');
    // 没有 EyeDropper 的环境不渲染取色按钮
    expect(screen.queryByRole('button', { name: '从屏幕取色' })).toBeNull();
  });

  it('二维滑块的键盘：←/→ 饱和度、↑/↓ 亮度，Shift 一步 10%，PageUp / PageDown、Home / End；每次按键都算一次操作结束', async () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ColorPicker defaultValue="#cc3333" onChange={onChange} onChangeEnd={onChangeEnd} />);
    const a = area();
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 75%，亮度 80%');
    await userEvent.tab();
    expect(a).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 76%，亮度 80%');
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 76%，亮度 70%');
    await userEvent.keyboard('{PageUp}{PageUp}{PageUp}{PageUp}');
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 76%，亮度 100%');
    await userEvent.keyboard('{Home}');
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 0%，亮度 100%');
    expect(onChange).toHaveBeenLastCalledWith('#ffffff');
    await userEvent.keyboard('{End}{ArrowLeft}');
    expect(a).toHaveAttribute('aria-valuetext', '饱和度 99%，亮度 100%');
    expect(onChangeEnd).toHaveBeenCalledTimes(9);
    expect(onChangeEnd).toHaveBeenLastCalledWith(onChange.mock.lastCall![0]);
    expect(onChange.mock.lastCall![0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('饱和度或亮度到 0 时色相不丢：拉回来还是原来的色相', async () => {
    const onChange = vi.fn();
    render(<ColorPicker defaultValue="#3366cc" onChange={onChange} />);
    expect(hue()).toHaveValue('220');
    await userEvent.tab();
    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('#cccccc');
    expect(hue()).toHaveValue('220');
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('#0044cc');
    for (let i = 0; i < 10; i++) await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith('#000000');
    expect(hue()).toHaveValue('220');
    await userEvent.keyboard('{PageUp}');
    expect(area()).toHaveAttribute('aria-valuetext', '饱和度 100%，亮度 10%');
    expect(onChange).toHaveBeenLastCalledWith('#00091a');
  });

  it('指针拖动：按下即取色，拖动中连续 onChange，松开才 onChangeEnd', () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ColorPicker defaultValue="#ff0000" onChange={onChange} onChangeEnd={onChangeEnd} />);
    const a = area();
    box(a);
    fireEvent(a, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 50 }));
    expect(a).toHaveFocus();
    expect(a).toHaveAttribute('data-active');
    expect(onChange).toHaveBeenLastCalledWith('#804040');   // 饱和度 50%，亮度 50%
    fireEvent(document, new MouseEvent('pointermove', { bubbles: true, buttons: 1, clientX: 300, clientY: -20 }));
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');   // 超出边界时夹在两端
    expect(onChangeEnd).not.toHaveBeenCalled();
    fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
    expect(a).not.toHaveAttribute('data-active');
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd).toHaveBeenLastCalledWith('#ff0000');
  });

  it('色相条：拖动（input）只触发 onChange，原生 change（松手 / 按键）才算一次操作结束', () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ColorPicker defaultValue="#ff0000" onChange={onChange} onChangeEnd={onChangeEnd} />);
    fireEvent.input(hue(), { target: { value: '120' } });
    expect(onChange).toHaveBeenLastCalledWith('#00ff00');
    expect(hue()).toHaveAttribute('aria-valuetext', '120°');
    expect(onChangeEnd).not.toHaveBeenCalled();
    fireEvent.change(hue(), { target: { value: '240' } });
    expect(onChange).toHaveBeenLastCalledWith('#0000ff');
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd).toHaveBeenLastCalledWith('#0000ff');
  });

  it('十六进制输入：回车或失焦时提交（接受 #rgb、大写、省略 #），不合法就恢复；Esc 放弃编辑', async () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ColorPicker defaultValue="#ff6b8e" onChange={onChange} onChangeEnd={onChangeEnd} />);
    const input = hex();
    await userEvent.clear(input);
    await userEvent.type(input, '#0A0');
    expect(onChange).not.toHaveBeenCalled();   // 打字过程中不改颜色
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('#00aa00');
    expect(onChangeEnd).toHaveBeenLastCalledWith('#00aa00');
    expect(input).toHaveValue('#00aa00');
    expect(hue()).toHaveValue('120');

    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    await userEvent.tab();   // 失焦
    expect(input).toHaveValue('#00aa00');
    expect(onChange).toHaveBeenCalledTimes(1);

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '336699');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith('#336699');
    expect(onChangeEnd).toHaveBeenCalledTimes(2);

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '#123456{Escape}');
    expect(input).toHaveValue('#336699');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('受控：不改 props 就不变；外面改了值，面板跟着变；大写的值规范成小写', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ColorPicker value="#FF0000" onChange={onChange} />);
    expect(hex()).toHaveValue('#ff0000');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('#fc0000');
    expect(area()).toHaveAttribute('aria-valuetext', '饱和度 100%，亮度 100%');
    expect(hex()).toHaveValue('#ff0000');
    rerender(<ColorPicker value="#0000ff" onChange={onChange} />);
    expect(hue()).toHaveValue('240');
    expect(hex()).toHaveValue('#0000ff');
  });

  it('受控：父组件接受变化时，拖到灰色也保留色相', async () => {
    function Demo() {
      const [c, setC] = useState('#ff8000');
      return <><ColorPicker value={c} onChange={setC} /><output>{c}</output></>;
    }
    render(<Demo />);
    expect(hue()).toHaveValue('30');
    await userEvent.tab();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('status')).toHaveTextContent('#ffffff');
    expect(hue()).toHaveValue('30');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('status')).toHaveTextContent('#ff8000');
  });

  it('预设色板：点一下就选中，触发 onChange 与 onChangeEnd；当前色在色板里时标为选中', async () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ColorPicker defaultValue="#ff6b8e" swatches={['#FF6B8E', '#4c8dff']} onChange={onChange} onChangeEnd={onChangeEnd} />);
    expect(screen.getByRole('radiogroup', { name: '预设颜色' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '#ff6b8e' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: '#4c8dff' }));
    expect(onChange).toHaveBeenLastCalledWith('#4c8dff');
    expect(onChangeEnd).toHaveBeenLastCalledWith('#4c8dff');
    expect(screen.getByRole('radio', { name: '#4c8dff' })).toHaveAttribute('aria-checked', 'true');
    expect(hex()).toHaveValue('#4c8dff');
  });

  it('禁用：二维滑块不可聚焦、不响应；色相条、输入框、色板都禁用', async () => {
    const onChange = vi.fn();
    render(<ColorPicker disabled swatches={['#4c8dff']} onChange={onChange} />);
    const a = area();
    expect(screen.getByRole('group', { name: '颜色' })).toHaveAttribute('data-disabled');
    expect(a).toHaveAttribute('tabindex', '-1');
    expect(a).toHaveAttribute('aria-disabled', 'true');
    expect(hue()).toBeDisabled();
    expect(hex()).toBeDisabled();
    expect(screen.getByRole('radio')).toBeDisabled();
    box(a);
    fireEvent(a, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('放进 Field：整组用 Field 的标签命名，里面的输入框不抢 Field 的 id', () => {
    render(<Field label="主题色" hint="用于按钮和链接"><ColorPicker /></Field>);
    const group = screen.getByRole('group', { name: '主题色' });
    expect(group).not.toHaveAttribute('aria-label');
    expect(group).toHaveAccessibleDescription('用于按钮和链接');
    expect(hex()).not.toHaveAttribute('id', group.id);
    expect(hex()).not.toHaveAttribute('aria-describedby');
  });

  it('有 EyeDropper 时显示取色按钮，取到的颜色当作一次完整操作', async () => {
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#123ABC' });
    (window as unknown as { EyeDropper: unknown }).EyeDropper = class { open = open; };
    try {
      const onChangeEnd = vi.fn();
      render(<ColorPicker onChangeEnd={onChangeEnd} />);
      await userEvent.click(screen.getByRole('button', { name: '从屏幕取色' }));
      expect(open).toHaveBeenCalled();
      expect(onChangeEnd).toHaveBeenLastCalledWith('#123abc');
      expect(hex()).toHaveValue('#123abc');
    } finally {
      delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
    }
  });

  it('ref 和其余属性落在根节点上', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<ColorPicker ref={ref} aria-label="强调色" className="extra" data-x="1" />);
    expect(ref.current).toBe(screen.getByRole('group', { name: '强调色' }));
    expect(ref.current).toHaveClass('ok-color-picker', 'extra');
    expect(ref.current).toHaveAttribute('data-x', '1');
  });
});
