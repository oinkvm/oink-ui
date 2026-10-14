import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { Drawer } from './Drawer';
import { CommandPalette } from './CommandPalette';
import { captureOrigin, resolveTriggerPoint } from './origin';

const viewport = { width: 1000, height: 800 };
const rectOf = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

const created: Element[] = [];
function button(rect: DOMRect, text = '打开') {
  const b = document.createElement('button');
  created.push(b);
  b.textContent = text;
  b.getBoundingClientRect = () => rect;
  document.body.appendChild(b);
  return b;
}

afterEach(() => { created.splice(0).forEach((el) => el.remove()); });

describe('触发点', () => {
  it('指针：1 秒内按在触发元素上、焦点也在它身上 → 用指针位置', () => {
    const b = button(rectOf(100, 100, 80, 32));
    const icon = document.createElement('span');
    b.appendChild(icon);
    const p = resolveTriggerPoint({ pointer: { x: 130, y: 110, time: 1000, target: icon }, active: b, now: 1500, viewport });
    expect(p).toEqual({ x: 130, y: 110 });
  });

  it('指针：浏览器没把焦点给按钮（Safari），被点的是可交互元素 → 仍用指针位置', () => {
    const b = button(rectOf(100, 100, 80, 32));
    const p = resolveTriggerPoint({ pointer: { x: 120, y: 105, time: 1000, target: b }, active: document.body, now: 1200, viewport });
    expect(p).toEqual({ x: 120, y: 105 });
  });

  it('键盘：没有近期的指针按下，焦点在页面上一个看得见的按钮上 → 用它的中心', () => {
    const b = button(rectOf(100, 200, 80, 40));
    expect(resolveTriggerPoint({ pointer: null, active: b, now: 5000, viewport })).toEqual({ x: 140, y: 220 });
    // 指针按下太久以前（超过 1 秒）不算
    const other = button(rectOf(600, 600, 20, 20));
    expect(resolveTriggerPoint({ pointer: { x: 610, y: 610, time: 1000, target: other }, active: b, now: 2500, viewport })).toEqual({ x: 140, y: 220 });
    // 指针按在别处、焦点却在另一个元素上（键盘触发）：用焦点元素
    expect(resolveTriggerPoint({ pointer: { x: 610, y: 610, time: 1000, target: other }, active: b, now: 1100, viewport })).toEqual({ x: 140, y: 220 });
  });

  it('没有触发点（快捷键）：焦点在 body、在输入框里、或焦点元素看不见 → 屏幕中心', () => {
    const center = { x: 500, y: 400 };
    expect(resolveTriggerPoint({ pointer: null, active: document.body, now: 0, viewport })).toEqual(center);
    expect(resolveTriggerPoint({ pointer: null, active: null, now: 0, viewport })).toEqual(center);
    const input = document.createElement('input');
    created.push(input);
    input.getBoundingClientRect = () => rectOf(10, 10, 200, 40);
    document.body.appendChild(input);
    expect(resolveTriggerPoint({ pointer: null, active: input, now: 0, viewport })).toEqual(center);
    const hidden = button(rectOf(0, 0, 0, 0));
    expect(resolveTriggerPoint({ pointer: null, active: hidden, now: 0, viewport })).toEqual(center);
    // 点在页面空白处（不是可交互元素），焦点在 body：也是中心
    const blank = document.createElement('div');
    created.push(blank);
    document.body.appendChild(blank);
    expect(resolveTriggerPoint({ pointer: { x: 5, y: 5, time: 0, target: blank }, active: document.body, now: 10, viewport })).toEqual(center);
  });

  it('调用方覆盖：center 固定屏幕中心，{ x, y } 原样使用', () => {
    expect(captureOrigin('center')).toEqual({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    expect(captureOrigin({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });
});

describe('从触发点放大进场', () => {
  function DialogDemo({ origin }: { origin?: 'trigger' | 'center' | { x: number; y: number } }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>打开对话框</button>
        <Dialog open={open} onOpenChange={setOpen} title="标题" origin={origin} />
      </>
    );
  }

  it('Dialog 居中时标 data-zoom，并把触发点换算成卡片坐标系里的 transform-origin（--_ox / --_oy）', async () => {
    render(<DialogDemo origin={{ x: 300, y: 200 }} />);
    // jsdom 没有布局：给卡片一个“居中位置”，看换算对不对
    const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    const offsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
    const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.classList.contains('ok-float__card') ? this.parentElement?.closest('.ok-float') : null; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, get() { return this.classList.contains('ok-float__card') ? 400 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get() { return this.classList.contains('ok-float__card') ? 250 : 0; } });
    try {
      fireEvent.click(screen.getByText('打开对话框'));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.closest('.ok-float')).toHaveAttribute('data-zoom');
      expect(dialog.style.getPropertyValue('--_ox')).toBe('-100px');
      expect(dialog.style.getPropertyValue('--_oy')).toBe('-50px');
    } finally {
      if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
      if (offsetLeft) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', offsetLeft);
      if (offsetTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', offsetTop);
    }
  });

  it('贴边的 Drawer 不放大（仍从停靠的一侧滑入）', async () => {
    render(<Drawer open aria-label="抽屉" />);
    const drawer = await screen.findByRole('dialog', { name: '抽屉' });
    expect(drawer.closest('.ok-float')).not.toHaveAttribute('data-zoom');
  });

  it('CommandPalette 默认从触发点放大进场', async () => {
    render(<CommandPalette open items={[]} />);
    const card = await screen.findByRole('dialog');
    expect(card.closest('.ok-float')).toHaveAttribute('data-zoom');
  });

  it('Dialog 在窄屏上同样从触发点放大，不变成底部弹层', async () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mm(q), matches: false })) as typeof window.matchMedia;
    try {
      render(<Dialog open title="窄屏" />);
      const card = await screen.findByRole('dialog');
      expect(card.closest('.ok-float')).toHaveAttribute('data-placement', 'center');
      expect(card.closest('.ok-float')).toHaveAttribute('data-zoom');
    } finally {
      window.matchMedia = mm;
    }
  });
});
