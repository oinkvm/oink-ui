import { render, screen } from '@testing-library/react';
import { Dots, Spinner } from './Spinner';
import { TailProvider } from '../core';

describe('Spinner', () => {
  it('默认是品牌尾巴，role="status" 带读屏文字', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('加载中');
    expect(el.querySelector('svg.ok-tail')).toHaveAttribute('aria-hidden', 'true');
  });
  it('ring 变体、尺寸和自定义文字', () => {
    render(<Spinner variant="ring" size="lg" label="正在保存" />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('正在保存');
    expect(el.querySelector('.ok-spinner')).not.toBeNull();
    expect(el.style.getPropertyValue('--size')).toBe('40px');
  });
});

describe('Dots', () => {
  it('三个圆点，role="status"', () => {
    render(<Dots label="对方正在输入" />);
    const el = screen.getByRole('status');
    expect(el).toHaveClass('ok-dots');
    expect(el.querySelectorAll('i')).toHaveLength(3);
    expect(el).toHaveTextContent('对方正在输入');
  });
});

describe('Spinner 尾巴替换', () => {
  it('TailProvider 里渲染替换图案，类名仍是 ok-tail', () => {
    render(
      <TailProvider tail={<svg viewBox="0 0 48 48" data-testid="ring"><circle cx="24" cy="24" r="16" pathLength={1} /></svg>}>
        <Spinner />
      </TailProvider>,
    );
    const ring = screen.getByTestId('ring');
    expect(ring).toHaveClass('ok-tail');
    expect(screen.getByRole('status')).toContainElement(ring);
  });
});
