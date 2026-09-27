import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MessageComposer } from './MessageComposer';

describe('MessageComposer', () => {
  it('does not send an empty message', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);

    expect(screen.getByRole('button', { name: 'Отправить сообщение' })).toBeDisabled();
    await user.type(screen.getByLabelText('Сообщение'), '   ');
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('sends with Enter and clears the textarea', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByLabelText('Сообщение');

    await user.type(textarea, 'Привет{Enter}');

    expect(onSend).toHaveBeenCalledWith('Привет');
    expect(textarea).toHaveValue('');
  });

  it('adds a line break with Shift+Enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByLabelText('Сообщение');

    await user.type(textarea, 'Первая{Shift>}{Enter}{/Shift}Вторая');

    expect(textarea).toHaveValue('Первая\nВторая');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('limits the message to 4000 characters', async () => {
    const user = userEvent.setup();
    render(<MessageComposer onSend={vi.fn()} />);
    const textarea = screen.getByLabelText('Сообщение');

    await user.click(textarea);
    await user.paste('а'.repeat(4001));

    expect(textarea).toHaveValue('а'.repeat(4000));
    expect(screen.getByText('4000/4000')).toBeInTheDocument();
  });
});
