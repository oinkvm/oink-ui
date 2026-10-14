import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, CardBody, CardFooter, CardHeader, CardLink, CardMedia } from './Card';

describe('Card', () => {
  it('静态卡片是普通容器，分区各就各位', () => {
    render(
      <Card data-testid="card">
        <CardHeader title="品牌设计组" description="5 位成员" actions={<button type="button">更多</button>} />
        <CardBody>正文</CardBody>
        <CardFooter align="end"><button type="button">确定</button></CardFooter>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveClass('ok-card');
    expect(card).not.toHaveClass('ok-card--interactive');
    expect(screen.getByRole('heading', { level: 3, name: '品牌设计组' })).toBeInTheDocument();
    expect(screen.getByText('5 位成员')).toHaveClass('ok-card__desc');
    expect(screen.getByText('正文')).toHaveClass('ok-card__body');
    expect(screen.getByRole('button', { name: '确定' }).parentElement).toHaveAttribute('data-align', 'end');
  });
  it('传 href 时整卡是真的链接', () => {
    render(<Card href="/team" chevron>品牌设计组</Card>);
    const link = screen.getByRole('link', { name: '品牌设计组' });
    expect(link).toHaveAttribute('href', '/team');
    expect(link).toHaveClass('ok-card--interactive', 'ok-focusable');
    expect(link.querySelector('.ok-card__chev')).not.toBeNull();
  });
  it('interactive 时整卡是真的按钮，键盘可以触发，禁用后不响应', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Card interactive onClick={onClick}>打开</Card>);
    const btn = screen.getByRole('button', { name: '打开' });
    expect(btn).toHaveAttribute('type', 'button');
    await user.tab();
    expect(btn).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Card interactive disabled onClick={onClick}>打开</Card>);
    await user.click(screen.getByRole('button', { name: '打开' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('CardLink 是覆盖链接，卡片里别的按钮照常可用', async () => {
    const user = userEvent.setup();
    const onMore = vi.fn();
    render(
      <Card>
        <CardHeader title={<CardLink href="/p/1">标志系统</CardLink>} actions={<button type="button" onClick={onMore}>更多</button>} />
      </Card>,
    );
    expect(screen.getByRole('link', { name: '标志系统' })).toHaveClass('ok-card__link');
    await user.click(screen.getByRole('button', { name: '更多' }));
    expect(onMore).toHaveBeenCalled();
  });

  it('CardHeader 的 titleId 落在标题上，外层可以用 aria-labelledby 指过来', () => {
    render(
      <Card as="section" aria-labelledby="team-title">
        <CardHeader title="品牌设计组" titleId="team-title" titleAs="h2" />
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 2, name: '品牌设计组' })).toHaveAttribute('id', 'team-title');
    expect(screen.getByRole('region', { name: '品牌设计组' })).toHaveClass('ok-card');
  });
});

describe('CardMedia', () => {
  it('作为第一个子元素放主图：默认 16:9、直角交给卡片裁切，alt 落在 img 上', () => {
    render(
      <Card data-testid="card">
        <CardMedia src="/cover.png" alt="新品耳机" />
        <CardHeader title="降噪耳机" />
      </Card>,
    );
    const card = screen.getByTestId('card');
    const media = card.firstElementChild as HTMLElement;
    expect(media).toHaveClass('ok-image', 'ok-card__media');
    expect(media).not.toHaveClass('ok-card__media--start');
    expect(media).toHaveAttribute('data-radius', '0');
    expect(media.style.aspectRatio).not.toBe('');
    expect(screen.getByRole('img', { name: '新品耳机' }).tagName).toBe('IMG');
  });

  it('position="start"、children 当图、失败回退', () => {
    render(
      <Card href="#/x" data-testid="card">
        <CardMedia position="start" alt="插画" ratio={1}><svg data-testid="art" /></CardMedia>
        <CardHeader title="横向卡片" />
      </Card>,
    );
    const media = screen.getByRole('img', { name: '插画' });
    expect(media).toHaveClass('ok-card__media--start');
    expect(media).toContainElement(screen.getByTestId('art'));
    // 整卡链接仍然是链接
    expect(screen.getByRole('link')).toHaveClass('ok-card--interactive');
  });

  it('加载失败显示自定义回退', () => {
    const { container } = render(<Card><CardMedia src="/broken.png" alt="封面" fallback="无图" /></Card>);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('img', { name: '封面' })).toHaveTextContent('无图');
  });
});
