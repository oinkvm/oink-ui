import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AspectRatio } from './AspectRatio';
import { Box } from './Box';
import { Center } from './Center';
import { Container } from './Container';
import { Divider } from './Divider';
import { Grid, GridItem } from './Grid';
import { Cluster, Inline } from './Inline';
import { ScrollArea } from './ScrollArea';
import { Spacer } from './Spacer';
import { Stack } from './Stack';
import { Sticky } from './Sticky';

const cssVar = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);

describe('Box', () => {
  it('as、内边距、圆角、表面色阶、描边、高光', () => {
    render(<Box as="article" padding={{ base: 4, md: 6 }} radius={4} surface="card" border highlight data-testid="b" style={{ color: 'red' }} />);
    const el = screen.getByTestId('b');
    expect(el.tagName).toBe('ARTICLE');
    expect(el).toHaveClass('ok-l', 'ok-box');
    expect(el).toHaveAttribute('data-pad');
    expect(cssVar(el, '--ok-l-p')).toBe('var(--ok-s-4)');
    expect(cssVar(el, '--ok-l-p-md')).toBe('var(--ok-s-6)');
    expect(cssVar(el, '--ok-box-r')).toBe('var(--ok-r-4)');
    expect(cssVar(el, '--ok-box-bg')).toBe('var(--ok-card)');
    expect(el).toHaveAttribute('data-surface', 'card');
    expect(el).toHaveAttribute('data-border', 'line');
    expect(el).toHaveAttribute('data-highlight');
    expect(el.style.color).toBe('red');
  });

  it('不传样式属性时不带多余的标记', () => {
    render(<Box data-testid="b" />);
    const el = screen.getByTestId('b');
    expect(el).not.toHaveAttribute('data-pad');
    expect(el).not.toHaveAttribute('data-surface');
    expect(el.getAttribute('style')).toBeNull();
  });
});

describe('Stack', () => {
  it('gap / align / justify 落成变量', () => {
    render(<Stack gap={{ base: 2, lg: 6 }} align="center" justify="between" data-testid="s"><i /><i /></Stack>);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('ok-stack');
    expect(cssVar(el, '--ok-l-gap')).toBe('var(--ok-s-2)');
    expect(cssVar(el, '--ok-l-gap-lg')).toBe('var(--ok-s-6)');
    expect(cssVar(el, '--ok-l-align')).toBe('center');
    expect(cssVar(el, '--ok-l-justify')).toBe('space-between');
  });

  it('divider 在子项之间插入分隔线', () => {
    render(<Stack divider><p>一</p><p>二</p><p>三</p>{null}</Stack>);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('divider 可以是自定义节点', () => {
    render(<Stack divider={<hr data-testid="d" />}><p>一</p><p>二</p></Stack>);
    expect(screen.getAllByTestId('d')).toHaveLength(1);
  });
});

describe('Inline / Cluster', () => {
  it('默认换行，wrap={false} 时标记不换行', () => {
    const { rerender } = render(<Inline gap={3} rowGap={1} data-testid="i" />);
    const el = screen.getByTestId('i');
    expect(el).toHaveClass('ok-inline');
    expect(el).not.toHaveAttribute('data-nowrap');
    expect(cssVar(el, '--ok-l-gap')).toBe('var(--ok-s-3)');
    expect(cssVar(el, '--ok-l-rgap')).toBe('var(--ok-s-1)');
    rerender(<Inline wrap={false} data-testid="i" />);
    expect(screen.getByTestId('i')).toHaveAttribute('data-nowrap');
  });

  it('Cluster 是 Inline 的别名', () => {
    expect(Cluster).toBe(Inline);
    render(<Cluster as="ul" data-testid="c"><li>甲</li></Cluster>);
    expect(screen.getByTestId('c').tagName).toBe('UL');
  });
});

describe('Grid', () => {
  it('columns 支持数字和响应式', () => {
    const { rerender } = render(<Grid columns={3} data-testid="g" />);
    expect(cssVar(screen.getByTestId('g'), '--ok-l-cols')).toBe('3');
    rerender(<Grid columns={{ base: 1, sm: 2, lg: 4 }} gap={6} data-testid="g" />);
    const el = screen.getByTestId('g');
    expect(cssVar(el, '--ok-l-cols')).toBe('1');
    expect(cssVar(el, '--ok-l-cols-sm')).toBe('2');
    expect(cssVar(el, '--ok-l-cols-md')).toBe('2');
    expect(cssVar(el, '--ok-l-cols-lg')).toBe('4');
    expect(cssVar(el, '--ok-l-gap')).toBe('var(--ok-s-6)');
  });

  it('minItemWidth 改为自动填充，忽略 columns', () => {
    render(<Grid columns={3} minItemWidth={220} data-testid="g" />);
    const el = screen.getByTestId('g');
    expect(el).toHaveAttribute('data-auto');
    expect(cssVar(el, '--ok-grid-min')).toBe('220px');
    expect(cssVar(el, '--ok-l-cols')).toBe('');
  });

  it('GridItem 的 span 支持响应式和 full', () => {
    render(<Grid columns={4}><GridItem span={{ base: 'full', md: 2 }} rowSpan={2} data-testid="it" /></Grid>);
    const el = screen.getByTestId('it');
    expect(cssVar(el, '--ok-l-span')).toBe('1 / -1');
    expect(cssVar(el, '--ok-l-span-sm')).toBe('1 / -1');
    expect(cssVar(el, '--ok-l-span-md')).toBe('span 2');
    expect(el.style.gridRow).toBe('span 2');
  });
});

describe('Container', () => {
  it('默认 lg、带左右留白并居中；可以关掉', () => {
    const { rerender } = render(<Container data-testid="c" />);
    const el = screen.getByTestId('c');
    expect(el).toHaveClass('ok-container');
    expect(el).toHaveAttribute('data-size', 'lg');
    expect(el).not.toHaveAttribute('data-gutter');
    rerender(<Container as="section" size="sm" gutter={false} center={false} data-testid="c" />);
    const next = screen.getByTestId('c');
    expect(next.tagName).toBe('SECTION');
    expect(next).toHaveAttribute('data-size', 'sm');
    expect(next).toHaveAttribute('data-gutter', 'false');
    expect(next).toHaveAttribute('data-center', 'false');
  });
});

describe('Center', () => {
  it('标出居中的方向和行内模式', () => {
    render(<Center axis="horizontal" inline padding={2} data-testid="c">内容</Center>);
    const el = screen.getByTestId('c');
    expect(el).toHaveClass('ok-center');
    expect(el).toHaveAttribute('data-axis', 'horizontal');
    expect(el).toHaveAttribute('data-inline');
    expect(cssVar(el, '--ok-l-p')).toBe('var(--ok-s-2)');
  });
});

describe('Spacer', () => {
  it('对读屏隐藏；size 给固定大小', () => {
    const { rerender } = render(<Spacer data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.getAttribute('style')).toBeNull();
    rerender(<Spacer size={4} data-testid="s" />);
    expect(screen.getByTestId('s').style.flex).toContain('var(--ok-s-4)');
  });
});

describe('Divider', () => {
  it('横向是 role="separator"；纵向带 aria-orientation', () => {
    const { rerender } = render(<Divider />);
    const hr = screen.getByRole('separator');
    expect(hr).toHaveClass('ok-divider');
    expect(hr).not.toHaveAttribute('aria-orientation');
    rerender(<Divider orientation="vertical" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('带文字时文字就是它的名称', () => {
    render(<Divider labelAlign="start">或者</Divider>);
    const el = screen.getByRole('separator', { name: '或者' });
    expect(el).toHaveClass('ok-divider--label');
    expect(el).toHaveAttribute('data-label-align', 'start');
    expect(el).toHaveTextContent('或者');
  });

  it('decorative 时不暴露给读屏', () => {
    render(<Divider decorative data-testid="d" />);
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.getByTestId('d')).toHaveAttribute('role', 'none');
  });
});

describe('AspectRatio', () => {
  it('把比例写进 aspect-ratio', () => {
    const { rerender } = render(<AspectRatio data-testid="a"><img alt="封面" src="x.png" /></AspectRatio>);
    const el = screen.getByTestId('a');
    expect(el).toHaveClass('ok-aspect');
    expect(el.style.aspectRatio).toContain('1.77');
    expect(screen.getByRole('img', { name: '封面' })).toBeInTheDocument();
    rerender(<AspectRatio ratio="4 / 3" data-testid="a" />);
    expect(screen.getByTestId('a').style.aspectRatio).toBe('4 / 3');
  });
});

describe('Sticky', () => {
  it('按 edge 和 offset 设置吸附位置', () => {
    const { rerender } = render(<Sticky data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveClass('ok-sticky');
    expect(screen.getByTestId('s').style.top).toBe('0px');
    rerender(<Sticky as="header" edge="bottom" offset={4} data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el.tagName).toBe('HEADER');
    expect(el.style.bottom).toBe('var(--ok-s-4)');
    expect(el.style.top).toBe('');
  });

  it('offset 可以是 CSS 长度字符串（顶栏高度 + 16 这类表达式）', () => {
    const { rerender } = render(<Sticky offset="calc(var(--header-h) + 16px)" data-testid="s" />);
    expect(screen.getByTestId('s').style.top).toBe('calc(var(--header-h) + 16px)');
    rerender(<Sticky edge="bottom" offset="24px" data-testid="s" />);
    expect(screen.getByTestId('s').style.bottom).toBe('24px');
    // style 仍然可以覆盖
    rerender(<Sticky offset="24px" style={{ top: 8 }} data-testid="s" />);
    expect(screen.getByTestId('s').style.top).toBe('8px');
  });
});

describe('ScrollArea', () => {
  it('有标签时是带名字的区域，键盘可以聚焦', async () => {
    render(<><button>前</button><ScrollArea label="更新日志" direction="both"><p>很长的内容</p></ScrollArea></>);
    const area = screen.getByRole('region', { name: '更新日志' });
    expect(area).toHaveClass('ok-scroll', 'ok-scroll-area');
    expect(area).toHaveAttribute('data-direction', 'both');
    expect(area).toHaveAttribute('tabindex', '0');
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(area).toHaveFocus();
  });

  it('默认纵向；focusable={false} 时不进 Tab 序列', () => {
    render(<ScrollArea focusable={false} data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('data-direction', 'vertical');
    expect(el).not.toHaveAttribute('tabindex');
    expect(el).toHaveAttribute('role', 'group');
  });
});
