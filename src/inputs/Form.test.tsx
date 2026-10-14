import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, FormActions } from './Form';
import { Field } from './Field';
import { Input } from './Input';
import { Button } from './Button';

describe('Form', () => {
  it('提交时回调 FormData，Enter 也能提交', async () => {
    const onSubmit = vi.fn();
    render(
      <Form aria-label="订阅" onSubmit={(data) => onSubmit(Object.fromEntries(data))}>
        <Field label="邮箱"><Input name="email" /></Field>
        <FormActions align="end"><Button type="submit" variant="primary">订阅</Button></FormActions>
      </Form>,
    );
    expect(screen.getByRole('form', { name: '订阅' })).toHaveClass('ok-form');
    await userEvent.type(screen.getByRole('textbox', { name: '邮箱' }), 'a@oink.app{Enter}');
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@oink.app' });
    await userEvent.click(screen.getByRole('button', { name: '订阅' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
