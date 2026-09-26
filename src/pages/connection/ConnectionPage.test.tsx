import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../app/App';
import { AppProvider } from '../../app/AppProvider';

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  );
}

describe('ConnectionPage', () => {
  it('validates required credentials', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Подключиться' }));

    expect(screen.getByText('Введите ID инстанса')).toBeInTheDocument();
    expect(screen.getByText('Введите API-токен инстанса')).toBeInTheDocument();
  });

  it('masks and reveals the token', async () => {
    const user = userEvent.setup();
    renderApp();
    const tokenInput = screen.getByLabelText('API-токен инстанса');

    expect(tokenInput).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Показать токен' }));
    expect(tokenInput).toHaveAttribute('type', 'text');
  });

  it('opens the messenger shell after valid local input', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('ID инстанса'), '1101000001');
    await user.type(screen.getByLabelText('API-токен инстанса'), 'test-token');
    await user.click(screen.getByRole('button', { name: 'Подключиться' }));

    expect(screen.getByRole('heading', { name: 'Чаты' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('test-token')).not.toBeInTheDocument();
  });
});
