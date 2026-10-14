import { render, screen, within } from '@testing-library/react';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('按顺序渲染事件，时间用 <time>', () => {
    render(
      <Timeline
        aria-label="活动"
        items={[
          { title: '小朱更新了「标志系统」', time: '今天 14:02', dateTime: '2026-10-13T14:02', tone: 'accent' },
          { title: '你评论了「动效对照表」', description: '看起来不错', time: '昨天 18:40' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: '活动' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('data-tone', 'accent');
    expect(within(items[0]).getByText('今天 14:02')).toHaveAttribute('datetime', '2026-10-13T14:02');
    expect(items[1]).toHaveTextContent('看起来不错');
  });
});
