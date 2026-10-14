import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('tone 和 variant 对应原型类名', () => {
    render(<><Badge>默认</Badge><Badge tone="success">运行中</Badge><Badge variant="ink">Pro</Badge><Badge tone="danger" variant="solid">失败</Badge></>);
    expect(screen.getByText('默认')).toHaveClass('ok-badge');
    expect(screen.getByText('运行中')).toHaveClass('ok-badge--success');
    expect(screen.getByText('Pro')).toHaveClass('ok-badge--ink');
    expect(screen.getByText('失败')).toHaveClass('ok-badge--danger', 'ok-badge--solid');
  });
  it('状态点对读屏隐藏；ping 加扩散', () => {
    render(<><Badge dot>待审核</Badge><Badge ping tone="success">在线</Badge></>);
    const dot = screen.getByText('待审核').querySelector('.ok-dot')!;
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).not.toHaveClass('ok-dot--live');
    expect(screen.getByText('在线').querySelector('.ok-dot')).toHaveClass('ok-dot--live');
  });
});
