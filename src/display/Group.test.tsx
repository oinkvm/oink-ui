import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Group, Row } from './Group';
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync } from 'node:fs';

// jsdom 算不出 flex 布局，样式只能对着源码断言（真实效果另在浏览器里看）
const CSS: string = readFileSync(decodeURIComponent(new URL(import.meta.url).pathname).replace(/[^/]+$/, '') + 'group.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** 找到包含某个选择器的规则体（选择器列表里任意一项相等即可） */
function body(selector: string): string {
  const re = /([^{}]+)\{([^}]*)\}/g;
  const hits: string[] = [];
  for (const m of CSS.matchAll(re)) {
    const sels = m[1].split(/,(?![^()]*\))/).map((x) => x.trim().replace(/\s+/g, ' '));
    if (sels.includes(selector)) hits.push(m[2].replace(/\s+/g, ' ').trim());
  }
  return hits.join(' ');
}

describe('Group / Row', () => {
  it('分组里放行：标题、说明、右侧控件', () => {
    render(
      <Group compact role="group" aria-label="通用">
        <Row label="自动更新" description="在后台下载并安装新版本"><input type="checkbox" aria-label="自动更新" /></Row>
        <Row stack label="亮度">滑块</Row>
      </Group>,
    );
    const group = screen.getByRole('group', { name: '通用' });
    expect(group).toHaveClass('ok-group', 'ok-group--compact');
    expect(group.querySelectorAll('.ok-row')).toHaveLength(2);
    expect(screen.getByText('在后台下载并安装新版本')).toHaveClass('ok-row__desc');
    expect(screen.getByRole('checkbox', { name: '自动更新' })).toBeInTheDocument();
    expect(screen.getByText('亮度').closest('.ok-row')).toHaveClass('ok-row--stack');
  });
  it('可点击行：href 渲染成链接，interactive 渲染成按钮，都带箭头', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Group>
        <Row href="/notify" label="通知" description="横幅、声音、角标" />
        <Row interactive label="语言" onClick={onClick}>简体中文</Row>
      </Group>,
    );
    const link = screen.getByRole('link', { name: /通知/ });
    expect(link).toHaveAttribute('href', '/notify');
    expect(link).toHaveClass('ok-row--link', 'ok-focusable');
    expect(link.querySelector('.ok-row__chev')).not.toBeNull();
    const btn = screen.getByRole('button', { name: /语言/ });
    expect(btn).toHaveTextContent('简体中文');
    btn.focus();
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('controlWidth="fill"：右侧包进 .ok-row__control，行带 ok-row--fill；可点击行不包', () => {
    const { container } = render(
      <Group>
        <Row label="文字大小" controlWidth="fill"><span data-testid="ctl">滑块</span></Row>
        <Row label="开关"><input type="checkbox" aria-label="开关" /></Row>
        <Row interactive label="语言" controlWidth="fill">简体中文</Row>
      </Group>,
    );
    const row = screen.getByText('文字大小').closest('.ok-row')!;
    expect(row).toHaveClass('ok-row--fill');
    expect(screen.getByTestId('ctl').parentElement).toHaveClass('ok-row__control');
    // 默认 auto：不加包裹，DOM 结构和以前一样
    expect(screen.getByRole('checkbox').parentElement).toHaveClass('ok-row');
    expect(container.querySelectorAll('.ok-row__control')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /语言/ })).not.toHaveClass('ok-row--fill');
  });

  it('controlWidth 为数值 / 长度：固定宽度写进 --_cw', () => {
    render(<><Row label="甲" controlWidth={200}>x</Row><Row label="乙" controlWidth="12rem">y</Row></>);
    const a = screen.getByText('甲').closest('.ok-row')!;
    expect(a).toHaveClass('ok-row--fixed');
    expect((a.querySelector('.ok-row__control') as HTMLElement).style.getPropertyValue('--_cw')).toBe('200px');
    expect((screen.getByText('乙').closest('.ok-row')!.querySelector('.ok-row__control') as HTMLElement).style.getPropertyValue('--_cw')).toBe('12rem');
  });

  it('stack="auto"：带 ok-row--wrap（窄时自动换行成上下排），不是固定的 stack', () => {
    render(<Row label="亮度" stack="auto" controlWidth="fill">滑块</Row>);
    const row = screen.getByText('亮度').closest('.ok-row')!;
    expect(row).toHaveClass('ok-row--wrap', 'ok-row--fill');
    expect(row).not.toHaveClass('ok-row--stack');
  });

  it('样式：标题区能收缩换行；宽控件吃剩余宽度且至少占一半；滑块自动识别；可换行变体', () => {
    expect(body('.ok-row__text')).toMatch(/min-width: 0/);
    expect(body('.ok-row__text')).toMatch(/overflow-wrap: anywhere/);
    // 宽控件行：标题区不再 flex-grow
    expect(body('.ok-row--fill > .ok-row__text')).toMatch(/flex: 0 1 auto/);
    expect(body('.ok-row:not(.ok-row--stack):has(> .ok-slider) > .ok-row__text')).toMatch(/flex: 0 1 auto/);
    // 控件区吃掉剩余宽度，最小宽度有保底
    for (const sel of ['.ok-row--fill > .ok-row__control', '.ok-row:not(.ok-row--stack) > .ok-slider']) {
      expect(body(sel), sel).toMatch(/flex: 1 1 0/);
      expect(body(sel), sel).toMatch(/min-width: var\(--ok-row-control-min, 50%\)/);
    }
    expect(body('.ok-row--fixed > .ok-row__control')).toMatch(/flex: 0 1 var\(--_cw\)/);
    expect(body('.ok-row.ok-row--wrap')).toMatch(/flex-wrap: wrap/);
    expect(body('.ok-row.ok-row--wrap > :is(.ok-row__control, .ok-slider)')).toMatch(/flex: 1 1 var\(--ok-row-wrap-at, 12rem\)/);
  });
});
