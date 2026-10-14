import { render, screen } from '@testing-library/react';
import { OinkLogo } from './OinkLogo';
// @ts-ignore 仓库没装 @types/node；测试本身跑在 node 里
import { readFileSync } from 'node:fs';

const CSS: string = readFileSync(decodeURIComponent(new URL(import.meta.url).pathname).replace(/[^/]+$/, '') + 'oink-logo.css', 'utf8');

describe('OinkLogo', () => {
  it('默认是一张名为 Oink UI 的图，28px，墨色方块 + 强调色猪鼻子', () => {
    render(<OinkLogo />);
    const logo = screen.getByRole('img', { name: 'Oink UI' });
    expect(logo).toHaveClass('ok-logo');
    expect(logo.style.getPropertyValue('--ok-logo-size')).toBe('28px');
    expect(logo.querySelectorAll('.ok-logo__ink')).toHaveLength(1);
    expect(logo.querySelector('.ok-logo__snout .ok-logo__accent')).not.toBeNull();
    expect(logo.querySelectorAll('.ok-logo__nostril')).toHaveLength(2);
    // 组件库的标志里没有箭头和尾巴（那是使用这套库的产品自己的标志）
    expect(logo.querySelector('.ok-logo__arrow, .ok-logo__tail')).toBeNull();
    expect(logo.querySelector('.ok-logo__word')).toBeNull();
    expect(logo).not.toHaveAttribute('data-animated');
  });

  it('size、wordmark、title、animated', () => {
    render(<OinkLogo size={40} wordmark title="Oink 设计系统" animated />);
    const logo = screen.getByRole('img', { name: 'Oink 设计系统' });
    expect(logo.style.getPropertyValue('--ok-logo-size')).toBe('40px');
    expect(logo.querySelector('.ok-logo__word')).toHaveTextContent('Oink UI');
    expect(logo).toHaveAttribute('data-animated', 'true');
  });

  it('aria-hidden 时不输出名字', () => {
    const { container } = render(<OinkLogo aria-hidden />);
    expect(screen.queryByRole('img')).toBeNull();
    const logo = container.querySelector('.ok-logo')!;
    expect(logo).not.toHaveAttribute('aria-label');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
  });

  it('鼻孔可以单独设色：--ok-logo-nostril，默认跟随 --ok-logo-ink', () => {
    expect(CSS).toMatch(/\.ok-logo__nostril \{ fill: var\(--ok-logo-nostril, var\(--ok-logo-ink, currentColor\)\); \}/);
    expect(CSS).toMatch(/\.ok-logo__ink \{ fill: var\(--ok-logo-ink, currentColor\); \}/);
    // 鼻子：显式的 --ok-logo-accent 优先，其次是主题给的 --ok-logo-snout（对比度不够时换色），最后才是强调色
    expect(CSS).toMatch(/\.ok-logo__accent \{ fill: var\(--ok-logo-accent, var\(--ok-logo-snout, var\(--ok-accent\)\)\); \}/);
  });

  it('mono：单色版，方块在鼻子外让出空隙、鼻孔镂空；两枚单色标志的 mask id 不冲突', () => {
    const { container } = render(<><OinkLogo mono /><OinkLogo mono wordmark /></>);
    const logos = container.querySelectorAll('.ok-logo');
    expect(logos[0]).toHaveClass('ok-logo--mono');
    expect(logos[0]).toHaveAttribute('role', 'img');
    // 鼻孔不再是图形，而是遮罩里的洞
    expect(logos[0].querySelectorAll('.ok-logo__nostril')).toHaveLength(0);
    const ink = logos[0].querySelector('.ok-logo__ink')!;
    const snout = logos[0].querySelector('.ok-logo__accent')!;
    const gap = /url\(#(.+)\)/.exec(ink.getAttribute('mask')!)![1];
    const holes = /url\(#(.+)\)/.exec(snout.getAttribute('mask')!)![1];
    expect(logos[0].querySelector(`mask[id="${gap}"]`)).not.toBeNull();
    expect(logos[0].querySelectorAll(`mask[id="${holes}"] ellipse`)).toHaveLength(2);
    const otherGap = /url\(#(.+)\)/.exec(logos[1].querySelector('.ok-logo__ink')!.getAttribute('mask')!)![1];
    expect(otherGap).not.toBe(gap);
    expect(CSS).toMatch(/\.ok-logo--mono \.ok-logo__ink,\s*\.ok-logo--mono \.ok-logo__accent \{ fill: currentColor; \}/);
  });

  it('默认（非 mono）不带遮罩', () => {
    const { container } = render(<OinkLogo />);
    expect(container.querySelector('mask')).toBeNull();
    expect(container.querySelector('.ok-logo__ink')).not.toHaveAttribute('mask');
  });
});
