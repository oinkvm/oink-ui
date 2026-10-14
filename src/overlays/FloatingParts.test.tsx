import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { FloatingCard } from './FloatingCard';
import { FloatingBody, FloatingFooter, FloatingHeader } from './FloatingParts';

function Demo({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <FloatingCard open={open} onOpenChange={(next) => { setOpen(next); onOpenChange?.(next); }} placement="right">
      <FloatingHeader title="筛选" description="只影响当前视图" />
      <FloatingBody>内容</FloatingBody>
      <FloatingFooter><button type="button">应用</button></FloatingFooter>
    </FloatingCard>
  );
}

describe('FloatingHeader / FloatingBody / FloatingFooter', () => {
  it('标题和说明自动接到卡片的 aria-labelledby / aria-describedby', async () => {
    render(<Demo />);
    const dialog = await screen.findByRole('dialog', { name: '筛选' });
    expect(dialog).toHaveAccessibleDescription('只影响当前视图');
    expect(screen.getByRole('heading', { level: 2, name: '筛选' })).toBeInTheDocument();
  });

  it('内容区是原生滚动容器，操作区按 align 排列', async () => {
    render(<Demo />);
    await screen.findByRole('dialog');
    expect(screen.getByText('内容')).toHaveClass('ok-float__body', 'ok-scroll');
    expect(screen.getByText('应用').parentElement).toHaveAttribute('data-align', 'end');
  });

  it('关闭按钮有读屏名称，点了请求关闭', async () => {
    const onOpenChange = vi.fn();
    render(<Demo onOpenChange={onOpenChange} />);
    fireEvent.click(await screen.findByRole('button', { name: '关闭' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('卡片不可关闭时不显示关闭按钮；显式传了 aria-label 时以它为准', async () => {
    render(
      <FloatingCard open dismissible={false} aria-label="设置">
        <FloatingHeader title="标题" />
      </FloatingCard>,
    );
    const dialog = await screen.findByRole('dialog', { name: '设置' });
    expect(dialog).not.toHaveAttribute('aria-labelledby');
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull();
  });
});

describe('FloatingCard 嵌套与扩展', () => {
  it('嵌套时 Esc 只关最上面那一层', async () => {
    function Nested() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <FloatingCard open={a} onOpenChange={setA} aria-label="外层">
          <button type="button">外层按钮</button>
          <FloatingCard open={b} onOpenChange={setB} aria-label="内层">
            <button type="button">内层按钮</button>
          </FloatingCard>
        </FloatingCard>
      );
    }
    render(<Nested />);
    await screen.findByRole('dialog', { name: '内层' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '内层' })).toBeNull(), { timeout: 1500 });
    expect(screen.getByRole('dialog', { name: '外层' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '外层' })).toBeNull(), { timeout: 1500 });
  });

  it('其余原生属性透传到卡片；onExited 在卸载后调用一次', async () => {
    const onExited = vi.fn();
    const { rerender } = render(<FloatingCard open aria-label="卡片" id="card-1" data-testid="card" onExited={onExited} />);
    expect(await screen.findByTestId('card')).toHaveAttribute('id', 'card-1');
    rerender(<FloatingCard open={false} aria-label="卡片" id="card-1" data-testid="card" onExited={onExited} />);
    await waitFor(() => expect(onExited).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(screen.queryByTestId('card')).toBeNull();
  });
});
