import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Heading, Text } from './Text';

describe('Text', () => {
  it('按 variant 套 .ok-t-*，默认渲染成 span', () => {
    render(<Text variant="caption">说明</Text>);
    const el = screen.getByText('说明');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('ok-text', 'ok-t-caption');
  });
  it('支持 as、tone、truncate、lineClamp，并透传 ref 和原生属性', () => {
    const ref = createRef<HTMLElement>();
    render(<Text ref={ref} as="p" tone="danger" truncate lineClamp={3} id="t" className="x">内容</Text>);
    const el = screen.getByText('内容');
    expect(el.tagName).toBe('P');
    expect(ref.current).toBe(el);
    expect(el).toHaveAttribute('data-tone', 'danger');
    expect(el).toHaveAttribute('data-truncate');
    expect(el).toHaveAttribute('data-clamp');
    expect(el.style.getPropertyValue('--ok-clamp')).toBe('3');
    expect(el).toHaveClass('x');
    expect(el).toHaveAttribute('id', 't');
  });
});

describe('Heading', () => {
  it('level 决定标题元素和默认字号', () => {
    render(<><Heading level={1}>一级</Heading><Heading level={4}>四级</Heading></>);
    expect(screen.getByRole('heading', { level: 1, name: '一级' })).toHaveClass('ok-t-h1');
    expect(screen.getByRole('heading', { level: 4, name: '四级' })).toHaveClass('ok-t-h4');
  });
  it('variant 只改视觉大小，不改语义', () => {
    render(<Heading level={2} variant="h3">标题</Heading>);
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('ok-t-h3');
  });
});
