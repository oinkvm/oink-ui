import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('图示 + 标题 + 说明 + 操作', () => {
    render(
      <EmptyState
        icon={<svg data-testid="art" />}
        title="还没有项目"
        description="新建一个项目开始吧。"
        actions={<button type="button">新建项目</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: '还没有项目' })).toBeInTheDocument();
    expect(screen.getByText('新建一个项目开始吧。')).toHaveClass('ok-empty__desc');
    expect(screen.getByTestId('art').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: '新建项目' }).parentElement).toHaveClass('ok-empty__actions');
  });
  it('titleAs 和 size', () => {
    render(<EmptyState title="没有结果" titleAs="h2" size="sm" data-testid="e" />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('e')).toHaveClass('ok-empty', 'ok-empty--sm');
  });
  it('titleAs 支持 h1（整页的空状态）', () => {
    render(<EmptyState title="页面不存在" titleAs="h1" />);
    expect(screen.getByRole('heading', { level: 1, name: '页面不存在' })).toHaveClass('ok-empty__title');
  });
});
