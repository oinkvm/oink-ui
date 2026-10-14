import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Code, CodeBlock } from './Code';

describe('Code', () => {
  it('行内代码', () => {
    render(<Code>--ok-accent</Code>);
    const el = screen.getByText('--ok-accent');
    expect(el.tagName).toBe('CODE');
    expect(el).toHaveClass('ok-code');
  });
});

describe('CodeBlock', () => {
  const code = 'npm i oink-ui\nimport "oink-ui/styles.css";';
  it('pre > code，滚动区域可聚焦并带名字，显示语言', () => {
    render(<CodeBlock code={code} language="bash" />);
    const region = screen.getByRole('group', { name: 'bash' });
    expect(region.tagName).toBe('PRE');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('ok-scroll');
    expect(region.querySelector('code')).toHaveClass('language-bash');
    expect(region.querySelector('code')!.textContent).toBe(code);
    expect(screen.getByText('bash')).toHaveClass('ok-codeblock__lang');
  });
  it('复制按钮：写入剪贴板，并用 aria-live 播报“已复制”', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<CodeBlock onCopy={onCopy}>{code}</CodeBlock>);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('');
    const btn = screen.getByRole('button', { name: '复制代码' });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('已复制')).toBe(live);
    expect(await navigator.clipboard.readText()).toBe(code);
    expect(onCopy).toHaveBeenCalledWith(code);
    expect(btn).toHaveAttribute('data-state', 'copied');
  });
  it('copyable={false} 不显示按钮', () => {
    render(<CodeBlock code={code} copyable={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
