import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reaction } from './Reaction';

describe('Reaction', () => {
  it('是带 aria-pressed 的按钮，名字里有标签和数量', () => {
    render(<Reaction count={128} />);
    const btn = screen.getByRole('button', { name: /Oink 一下/ });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveTextContent('128');
  });
  it('非受控：点击和键盘都能切换，数字跟着变，点亮时放粒子', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Reaction count={128} onChange={onChange} />);
    const btn = screen.getByRole('button');
    // 测试环境里动画立刻结束、粒子随即移除，所以数的是“放出过多少个”
    const append = vi.spyOn(document.body, 'appendChild');
    const particles = () => append.mock.calls.filter(([n]) => (n as Element).classList?.contains('ok-particle')).length;
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(btn.querySelector('.ok-react__count')!.lastElementChild).toHaveTextContent('129');
    expect(particles()).toBe(12);
    await Promise.resolve();
    expect(document.querySelectorAll('.ok-particle').length).toBe(0);
    await user.keyboard(' ');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(btn.querySelector('.ok-react__count')!.lastElementChild).toHaveTextContent('128');
    expect(particles()).toBe(12);
    append.mockRestore();
  });
  it('受控；noBurst 不放粒子', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Reaction pressed={false} onChange={onChange} noBurst />);
    await user.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelectorAll('.ok-particle').length).toBe(0);
  });
});
