import { render, screen, within } from '@testing-library/react';
import { Page } from './Page';
import { PageHeader } from './PageHeader';
import { Section } from './Section';

describe('Page', () => {
  it('是一个限宽的容器，gap 落成变量', () => {
    render(<Page size="md" gap={6} padded={false} data-testid="p">内容</Page>);
    const el = screen.getByTestId('p');
    expect(el).toHaveClass('ok-container', 'ok-page');
    expect(el).toHaveAttribute('data-size', 'md');
    expect(el).toHaveAttribute('data-padded', 'false');
    expect(el.style.getPropertyValue('--ok-l-gap')).toBe('var(--ok-s-6)');
  });
});

describe('PageHeader', () => {
  it('渲染标题、说明、面包屑位和操作区', () => {
    render(
      <PageHeader
        title="成员"
        description="管理团队里的人"
        breadcrumb={<nav aria-label="面包屑">设置 / 成员</nav>}
        actions={<button type="button" className="ok-btn">邀请</button>}
      >
        <p>筛选条</p>
      </PageHeader>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '成员' })).toBeInTheDocument();
    expect(screen.getByText('管理团队里的人')).toHaveClass('ok-page-header__desc');
    expect(screen.getByRole('navigation', { name: '面包屑' })).toBeInTheDocument();
    const actions = document.querySelector('.ok-page-header__actions') as HTMLElement;
    expect(within(actions).getByRole('button', { name: '邀请' })).toBeInTheDocument();
    expect(screen.getByText('筛选条')).toBeInTheDocument();
  });

  it('headingLevel 和 titleId 可以改；没有的部分不渲染', () => {
    render(<PageHeader title="概览" headingLevel={2} titleId="t" />);
    expect(screen.getByRole('heading', { level: 2, name: '概览' })).toHaveAttribute('id', 't');
    expect(document.querySelector('.ok-page-header__actions')).toBeNull();
    expect(document.querySelector('.ok-page-header__breadcrumb')).toBeNull();
  });
});

describe('Section', () => {
  it('有标题时自动用标题命名（aria-labelledby）', () => {
    render(<Section title="通知" description="选择接收方式" actions={<button type="button">编辑</button>}><p>正文</p></Section>);
    const region = screen.getByRole('region', { name: '通知' });
    expect(within(region).getByRole('heading', { level: 2, name: '通知' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(within(region).getByText('正文')).toBeInTheDocument();
  });

  it('没有标题时不加 aria-labelledby；传了 aria-label 就用它', () => {
    const { rerender } = render(<Section data-testid="s">正文</Section>);
    expect(screen.getByTestId('s')).not.toHaveAttribute('aria-labelledby');
    rerender(<Section title="标题" aria-label="另一个名字" headingLevel={3} data-testid="s" />);
    expect(screen.getByTestId('s')).not.toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('region', { name: '另一个名字' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });
});
