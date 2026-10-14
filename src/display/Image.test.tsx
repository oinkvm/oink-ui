import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Image } from './Image';

describe('Image', () => {
  it('alt 落在 img 上；加载中是骨架，加载完标记 loaded；ref 指向外框', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Image ref={ref} src="/a.png" alt="一只小猪" ratio={16 / 9} data-testid="img" />);
    const img = screen.getByRole('img', { name: '一只小猪' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('data-testid', 'img');   // 原生属性透传到 img
    const frame = ref.current!;
    expect(frame).toHaveClass('ok-image');
    expect(frame).toHaveAttribute('data-status', 'loading');
    expect(frame).toHaveAttribute('data-placeholder', 'skeleton');
    expect(frame).toHaveAttribute('data-radius', '3');
    expect(frame.style.aspectRatio).not.toBe('');
    fireEvent.load(img);
    expect(frame).toHaveAttribute('data-status', 'loaded');
  });

  it('alt="" 时是纯装饰', () => {
    const { container } = render(<Image src="/a.png" alt="" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('加载失败时回退：默认是图标色块，外框用 alt 当名字；换 src 后重新加载', () => {
    const onError = vi.fn();
    const { container, rerender } = render(<Image src="/broken.png" alt="封面" onError={onError} />);
    fireEvent.error(container.querySelector('img')!);
    expect(onError).toHaveBeenCalledTimes(1);
    const frame = container.querySelector('.ok-image')!;
    expect(frame).toHaveAttribute('data-status', 'error');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.ok-image__fallback .ok-icon')).not.toBeNull();
    expect(screen.getByRole('img', { name: '封面' })).toBe(frame);

    rerender(<Image src="/ok.png" alt="封面" />);
    expect(frame).toHaveAttribute('data-status', 'loading');
    expect(container.querySelector('img')).toHaveAttribute('src', '/ok.png');
  });

  it('自定义 fallback；没有 src 也没有 children 时同样显示回退', () => {
    render(<Image alt="头图" fallback={<span>暂无图片</span>} />);
    expect(screen.getByText('暂无图片')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '头图' })).toHaveAttribute('data-status', 'empty');
  });

  it('没有 src 时 children 就是图，由 alt 起名字', () => {
    render(
      <Image alt="渐变插画" ratio="4 / 3" fit="contain" radius="full">
        <svg viewBox="0 0 10 10" data-testid="art"><rect width="10" height="10" /></svg>
      </Image>,
    );
    const frame = screen.getByRole('img', { name: '渐变插画' });
    expect(frame).toHaveAttribute('data-status', 'content');
    expect(frame).toHaveAttribute('data-fit', 'contain');
    expect(frame).toHaveAttribute('data-radius', 'full');
    expect(frame).toContainElement(screen.getByTestId('art'));
    expect(frame.querySelector('.ok-image__fallback')).toBeNull();
  });

  it('有 src 时 children 叠在图片上；placeholder="none"、loading 可改', () => {
    const { container } = render(<Image src="/a.png" alt="商品" placeholder="none" loading="eager"><span>新品</span></Image>);
    expect(screen.getByText('新品').parentElement).toHaveClass('ok-image__overlay');
    expect(container.querySelector('.ok-image')).toHaveAttribute('data-placeholder', 'none');
    expect(screen.getByRole('img', { name: '商品' })).toHaveAttribute('loading', 'eager');
  });
});
