import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rating } from './Rating';

describe('Rating', () => {
  it('是 radiogroup，每颗星是一个带名称的 radio', () => {
    render(<Rating aria-label="满意度" defaultValue={3} />);
    expect(screen.getByRole('radiogroup', { name: '满意度' })).toBeInTheDocument();
    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
    expect(screen.getByRole('radio', { name: '3 星' })).toHaveAttribute('aria-checked', 'true');
    expect(stars.filter((s) => s.hasAttribute('data-on'))).toHaveLength(3);
    expect(stars.map((s) => s.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
  });

  it('非受控：点击评分，再点一次清零；方向键增减，Home / End 到两端', async () => {
    const onChange = vi.fn();
    render(<Rating aria-label="满意度" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '4 星' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(screen.getByRole('radio', { name: '5 星' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    await userEvent.click(screen.getByRole('radio', { name: '5 星' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('受控：不改 props 就不变；只读时是一张带分数的图', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Rating aria-label="满意度" value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '5 星' }));
    expect(onChange).toHaveBeenCalledWith(5);
    expect(screen.getByRole('radio', { name: '2 星' })).toHaveAttribute('aria-checked', 'true');
    rerender(<Rating aria-label="满意度" value={2} readOnly />);
    // 只读时传了 aria-label 就整个用它
    expect(screen.getByRole('img', { name: '满意度' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    // 没传才用默认的“评分：n / max”
    rerender(<Rating value={2} readOnly />);
    expect(screen.getByRole('img', { name: '评分：2 / 5' })).toBeInTheDocument();
    rerender(<Rating value={4.6} max={10} readOnly aria-label="4.6 分，共 128 人评价" />);
    expect(screen.getByRole('img', { name: '4.6 分，共 128 人评价' })).toHaveAttribute('data-readonly');
  });

  it('只读支持小数：4.6 是四颗整星加一颗填了六成的星', () => {
    render(<Rating value={4.6} readOnly />);
    const img = screen.getByRole('img', { name: '评分：4.6 / 5' });
    const stars = Array.from(img.querySelectorAll('.ok-rating__star'));
    expect(stars).toHaveLength(5);
    expect(stars.map((s) => s.hasAttribute('data-on'))).toEqual([true, true, true, true, false]);
    expect(stars.map((s) => s.hasAttribute('data-partial'))).toEqual([false, false, false, false, true]);
    const fill = stars[4].querySelector<SVGElement>('svg.ok-rating__fill')!;
    expect(fill).toHaveAttribute('aria-hidden', 'true');
    // 星形在 20 宽的画布里占 2.9 – 17.1；填六成 = 裁到 2.9 + 0.6 × 14.2 = 11.42，右边裁掉 (20 − 11.42) / 20 = 42.9%
    expect(fill.style.getPropertyValue('--ok-rating-cut')).toBe('42.9%');
    expect(img.querySelectorAll('svg.ok-rating__fill')).toHaveLength(1);
  });

  it('只读的整数、0 和超出范围的值都不出半颗星', () => {
    const { rerender } = render(<Rating value={3} readOnly />);
    const on = () => document.querySelectorAll('.ok-rating__star[data-on]').length;
    expect(on()).toBe(3);
    expect(document.querySelector('.ok-rating__fill')).toBeNull();
    rerender(<Rating value={0} readOnly />);
    expect(on()).toBe(0);
    rerender(<Rating value={7.5} readOnly />);
    expect(on()).toBe(5);
    expect(document.querySelector('.ok-rating__fill')).toBeNull();
    rerender(<Rating value={0.25} readOnly />);
    expect(on()).toBe(0);
    expect(document.querySelectorAll('.ok-rating__fill')).toHaveLength(1);
  });
});
