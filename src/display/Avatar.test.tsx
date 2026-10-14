import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Avatar, AvatarGroup, initialsOf } from './Avatar';

describe('Avatar', () => {
  it('首字母规则', () => {
    expect(initialsOf('小朱')).toBe('小');
    expect(initialsOf('ada lovelace')).toBe('AL');
    expect(initialsOf('Oink')).toBe('O');
    expect(initialsOf('  ')).toBe('');
  });
  it('没有图片时显示首字母，整体是一张带名字的图', () => {
    render(<Avatar name="林一" size="lg" color="#FFBE3B" />);
    const el = screen.getByRole('img', { name: '林一' });
    expect(el).toHaveClass('ok-avatar');
    expect(el).toHaveTextContent('林');
    expect(el.style.getPropertyValue('--size')).toBe('48px');
    expect(el.style.getPropertyValue('--c')).toBe('#FFBE3B');
    expect(el.querySelector('img')).toBeNull();
  });
  it('图片加载失败回退到首字母；换了 src 会重新尝试', () => {
    const { rerender } = render(<Avatar name="陈默" src="/a.png" />);
    const el = screen.getByRole('img', { name: '陈默' });
    const img = el.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/a.png');
    fireEvent.error(img);
    expect(el.querySelector('img')).toBeNull();
    expect(el).toHaveTextContent('陈');
    rerender(<Avatar name="陈默" src="/b.png" />);
    expect(el.querySelector('img')).toHaveAttribute('src', '/b.png');
  });
  it('decorative：保留取色和首字母，但对读屏隐藏', () => {
    const { container, rerender } = render(<Avatar name="林一" color="auto" />);
    const named = container.querySelector('.ok-avatar') as HTMLElement;
    const color = named.style.getPropertyValue('--c');
    expect(color).not.toBe('');
    expect(named).toHaveAttribute('role', 'img');
    rerender(<Avatar name="林一" color="auto" decorative status="online" />);
    const el = container.querySelector('.ok-avatar') as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).not.toHaveAttribute('role');
    expect(el).not.toHaveAttribute('aria-label');
    expect(el).toHaveTextContent('林');
    expect(el.style.getPropertyValue('--c')).toBe(color);
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('状态点：读屏文字并入名字', () => {
    render(<Avatar name="小朱" status="busy" />);
    const el = screen.getByRole('img', { name: '小朱，忙碌' });
    expect(el.querySelector('.ok-avatar__status')).toHaveAttribute('data-status', 'busy');
  });
});

describe('AvatarGroup', () => {
  it('超过 max 的折成 “+N”，尺寸传给里面的头像；“+N” 是按钮，聚焦时浮出全部成员', async () => {
    render(
      <AvatarGroup max={2} total={7} size="sm" label="项目成员">
        <Avatar name="小朱" /><Avatar name="林一" /><Avatar name="陈默" />
      </AvatarGroup>,
    );
    const group = screen.getByRole('group', { name: '项目成员' });
    expect(group).toHaveClass('ok-avatars');
    const imgs = within(group).getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].style.getPropertyValue('--size')).toBe('28px');
    const more = within(group).getByRole('button', { name: /还有 5 人/ });
    expect(more).toHaveTextContent('+5');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    act(() => { more.focus(); });
    await waitFor(() => expect(more).toHaveAttribute('aria-expanded', 'true'));
    const panel = await screen.findByRole('group', { name: '项目成员（共 7 人）' });
    expect(Array.from(panel.querySelectorAll('.ok-avatars__name'), (n) => n.textContent)).toEqual(['小朱', '林一', '陈默']);
    expect(panel).toHaveTextContent('另有 4 人');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(more).toHaveAttribute('aria-expanded', 'false'));
  });

  it('没有名字可列时，“+N” 仍是静态头像', () => {
    render(<AvatarGroup max={1} label="组"><Avatar /><Avatar /></AvatarGroup>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
