import { render } from '@testing-library/react';
import { Icon } from './Icon';
import { ICONS } from './icons';
import type { IconName } from './icons';

const EXISTING = ['search', 'check', 'x', 'plus', 'minus', 'chevron-right', 'chevron-down', 'sun', 'moon', 'monitor', 'copy', 'play', 'replay', 'info', 'alert', 'bell', 'trash', 'more', 'download', 'upload', 'edit', 'share', 'mail', 'sparkle', 'shuffle', 'sliders'];
const ADDED = ['home', 'user', 'users', 'settings', 'heart', 'star', 'cart', 'bag', 'grid', 'list', 'filter', 'calendar', 'clock', 'inbox', 'send', 'archive', 'reply', 'forward', 'paperclip', 'folder', 'file', 'image', 'link', 'external', 'eye', 'eye-off', 'lock', 'tag', 'bookmark', 'chevron-left', 'chevron-up', 'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'refresh', 'menu', 'close', 'check-circle', 'x-circle', 'help', 'globe', 'phone', 'credit-card', 'truck', 'chart', 'trending-up', 'trending-down', 'layout', 'sidebar', 'command', 'zap'];

describe('内置图标', () => {
  it('原有的名字都还在，补充的常用图标齐全', () => {
    for (const name of [...EXISTING, ...ADDED]) expect(ICONS, name).toHaveProperty(name);
  });

  it('close 是 x 的别名', () => {
    expect(ICONS.close).toBe(ICONS.x);
  });

  it('每个图标都是能解析的 SVG 片段，坐标落在 20×20 的画布里', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');
      expect(svg.children.length, name).toBeGreaterThan(0);
      for (const el of Array.from(svg.children)) {
        expect(['path', 'circle', 'rect'], name).toContain(el.tagName.toLowerCase());
        if (el.tagName.toLowerCase() === 'path') expect(el.getAttribute('d'), name).toMatch(/^M[\d.\s,a-zA-Z-]+$/);
      }
      unmount();
    }
  });
});
