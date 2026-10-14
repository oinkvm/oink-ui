import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('对读屏隐藏，支持宽高和圆形', () => {
    const { container } = render(<><Skeleton width="46%" /><Skeleton variant="circle" width={48} /></>);
    const [line, circle] = Array.from(container.querySelectorAll<HTMLElement>('.ok-skel'));
    expect(line).toHaveAttribute('aria-hidden', 'true');
    expect(line.style.width).toBe('46%');
    expect(circle).toHaveClass('ok-skel--circle');
    expect(circle.style.width).toBe('48px');
    expect(circle.style.height).toBe('48px');
  });
  it('lines 渲染多行，最后一行短一些', () => {
    const { container } = render(<Skeleton lines={3} />);
    const lines = container.querySelectorAll<HTMLElement>('.ok-skel-lines > .ok-skel');
    expect(lines).toHaveLength(3);
    expect(lines[2].style.width).toBe('70%');
  });
});
