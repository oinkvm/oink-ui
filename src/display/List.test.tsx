import { render, screen, within } from '@testing-library/react';
import { List, ListItem } from './List';

describe('List', () => {
  it('渲染列表语义和条目的前后置内容', () => {
    render(
      <List divided aria-label="成员">
        <ListItem title="小朱" description="设计负责人" leading={<span>头像</span>} trailing="刚刚" />
        <ListItem>林一</ListItem>
      </List>,
    );
    const list = screen.getByRole('list', { name: '成员' });
    expect(list.tagName).toBe('UL');
    expect(list).toHaveAttribute('data-divided');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('小朱')).toHaveClass('ok-list__title');
    expect(within(items[0]).getByText('刚刚')).toHaveClass('ok-list__trailing');
  });
  it('marker="number" 默认用 ol', () => {
    render(<List marker="number"><ListItem>第一</ListItem></List>);
    expect(screen.getByRole('list').tagName).toBe('OL');
  });
});
