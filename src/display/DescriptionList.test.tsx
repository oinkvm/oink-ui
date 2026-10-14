import { render, screen } from '@testing-library/react';
import { DescriptionItem, DescriptionList } from './DescriptionList';

describe('DescriptionList', () => {
  it('用 dl / dt / dd 输出键值对', () => {
    render(<DescriptionList items={[{ term: '订单号', description: 'OK-1024' }, { term: '状态', description: '已发货' }]} />);
    const terms = screen.getAllByRole('term');
    const defs = screen.getAllByRole('definition');
    expect(terms.map((t) => t.textContent)).toEqual(['订单号', '状态']);
    expect(defs.map((d) => d.textContent)).toEqual(['OK-1024', '已发货']);
    expect(terms[0].closest('dl')).toHaveAttribute('data-layout', 'auto');
  });
  it('也可以用 DescriptionItem 写 children，并指定布局', () => {
    render(<DescriptionList layout="stacked" divided><DescriptionItem term="邮箱">a@oink.dev</DescriptionItem></DescriptionList>);
    const dl = screen.getByRole('term').closest('dl')!;
    expect(dl).toHaveAttribute('data-layout', 'stacked');
    expect(dl).toHaveAttribute('data-divided');
    expect(screen.getByRole('definition')).toHaveTextContent('a@oink.dev');
  });
});
