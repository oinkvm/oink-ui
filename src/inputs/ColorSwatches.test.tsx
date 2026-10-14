import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorSwatches } from './ColorSwatches';

const colors = [
  { value: 'pink', color: '#FF6B8E', label: '粉' },
  { value: 'orange', color: '#FF7A2F', label: '橙' },
  { value: 'blue', color: '#2E7BFF', label: '蓝' },
];

describe('ColorSwatches', () => {
  it('是 radiogroup，每个色块有名字，颜色写在 --c 上', () => {
    render(<ColorSwatches aria-label="强调色" colors={colors} defaultValue="pink" size="sm" />);
    expect(screen.getByRole('radiogroup', { name: '强调色' })).toHaveClass('ok-swatches', 'ok-swatches--sm');
    const pink = screen.getByRole('radio', { name: '粉' });
    expect(pink).toHaveAttribute('aria-checked', 'true');
    expect(pink.style.getPropertyValue('--c')).toBe('#FF6B8E');
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('非受控：点击与方向键都能选', async () => {
    const onChange = vi.fn();
    render(<ColorSwatches aria-label="强调色" colors={colors} defaultValue="pink" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '橙' }));
    expect(onChange).toHaveBeenLastCalledWith('orange');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '蓝' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: '蓝' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('pink');
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<ColorSwatches aria-label="强调色" colors={colors} value="pink" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '蓝' }));
    expect(onChange).toHaveBeenCalledWith('blue');
    expect(screen.getByRole('radio', { name: '粉' })).toHaveAttribute('aria-checked', 'true');
  });
});
