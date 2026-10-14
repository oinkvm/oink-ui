import { render, screen } from '@testing-library/react';
import { Surface } from './Surface';

describe('Surface', () => {
  it('渲染成 .ok-panel，支持 as 和 size', () => {
    render(<Surface as="section" aria-label="设置" size="sm">内容</Surface>);
    const el = screen.getByRole('region', { name: '设置' });
    expect(el).toHaveClass('ok-panel', 'ok-panel--sm');
    expect(el).toHaveTextContent('内容');
  });
});
