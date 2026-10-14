import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Sheet } from './Sheet';
import { FloatingBody, FloatingHeader } from './FloatingParts';

/* jsdom 没有 PointerEvent：用同名的 MouseEvent 代替，坐标和时间戳够用了 */
function pointer(target: EventTarget, type: string, clientY: number, at: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, 'timeStamp', { value: at });
  act(() => { target.dispatchEvent(event); });
}

function setup(onOpenChange = vi.fn()) {
  render(
    <Sheet defaultOpen onOpenChange={onOpenChange}>
      <FloatingHeader title="新建待办" />
      <FloatingBody><button type="button">保存</button></FloatingBody>
    </Sheet>,
  );
  return onOpenChange;
}

async function openSheet() {
  const sheet = await screen.findByRole('dialog', { name: '新建待办' });
  await waitFor(() => expect(sheet.parentElement).toHaveAttribute('data-state', 'open'));
  return sheet;
}

describe('Sheet', () => {
  it('底部弹层：模态、带抓手、可拖拽，Esc 关闭', async () => {
    const onOpenChange = setup();
    const sheet = await openSheet();
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet.parentElement).toHaveAttribute('data-placement', 'bottom');
    expect(sheet).toHaveAttribute('data-draggable');
    const grip = sheet.querySelector('.ok-float__grip') as HTMLElement;
    expect(grip).toHaveAttribute('aria-hidden', 'true');
    expect(grip).toHaveAttribute('data-ok-drag-handle');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('按住抓手向下拖：卡片跟手；拖得够远，松手关闭', async () => {
    const onOpenChange = setup();
    const sheet = await openSheet();
    const grip = sheet.querySelector('.ok-float__grip') as HTMLElement;
    pointer(grip, 'pointerdown', 100, 0);
    pointer(document, 'pointermove', 180, 400);
    expect(sheet.style.transform).toBe('translateY(80px)');
    expect(sheet).toHaveAttribute('data-dragging');
    pointer(document, 'pointermove', 300, 800);
    expect(sheet.style.transform).toBe('translateY(200px)');
    pointer(document, 'pointerup', 300, 1200);
    expect(sheet.style.transform).toBe('');
    expect(sheet).not.toHaveAttribute('data-dragging');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('拖得不远、松手前停住：回弹，不关闭', async () => {
    const onOpenChange = setup();
    const sheet = await openSheet();
    const grip = sheet.querySelector('.ok-float__grip') as HTMLElement;
    pointer(grip, 'pointerdown', 100, 0);
    pointer(document, 'pointermove', 140, 300);
    expect(sheet.style.transform).toBe('translateY(40px)');
    pointer(document, 'pointerup', 140, 800);
    expect(sheet.style.transform).toBe('');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '新建待办' })).toBeInTheDocument();
  });

  it('距离短但甩得快：按速度关闭；pointercancel 永远回弹', async () => {
    const onOpenChange = setup();
    const sheet = await openSheet();
    const header = sheet.querySelector('.ok-float__header') as HTMLElement;
    // 头部也是把手
    pointer(header, 'pointerdown', 100, 0);
    pointer(document, 'pointermove', 110, 10);
    pointer(document, 'pointermove', 400, 20);
    pointer(document, 'pointercancel', 400, 25);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');

    pointer(header, 'pointerdown', 100, 1000);
    pointer(document, 'pointermove', 110, 1010);
    pointer(document, 'pointermove', 150, 1030);
    pointer(document, 'pointerup', 150, 1040);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('从内容区或按钮上按下不会发起拖拽；dragToDismiss=false 时没有把手行为', async () => {
    const onOpenChange = setup();
    const sheet = await openSheet();
    pointer(screen.getByText('保存'), 'pointerdown', 100, 0);
    pointer(document, 'pointermove', 400, 100);
    pointer(document, 'pointerup', 400, 200);
    expect(sheet.style.transform).toBe('');
    expect(onOpenChange).not.toHaveBeenCalled();
    pointer(screen.getByRole('button', { name: '关闭' }), 'pointerdown', 100, 0);
    pointer(document, 'pointermove', 400, 100);
    pointer(document, 'pointerup', 400, 200);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('size 预设换成高度', async () => {
    render(<Sheet defaultOpen size="md" grip={false} dragToDismiss={false} aria-label="弹层" />);
    const sheet = await screen.findByRole('dialog', { name: '弹层' });
    expect(sheet.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('60%');
    expect(sheet.querySelector('.ok-float__grip')).toBeNull();
    expect(sheet).not.toHaveAttribute('data-draggable');
  });
});
