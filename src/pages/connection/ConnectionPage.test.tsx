import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../app/App';
import { AppProvider } from '../../app/AppProvider';
import { GREEN_API_BASE_URL } from '../../shared/config/environment';

const getSettingsEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/getSettings/test-token`;
const server = setupServer(
  http.get(getSettingsEndpoint, () =>
    HttpResponse.json({ incomingWebhook: 'yes', webhookUrl: '' }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

    expect(await screen.findByRole('heading', { name: 'Чаты' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('test-token')).not.toBeInTheDocument();
  });

  it('explains how to enable incoming notifications', async () => {
    server.use(
      http.get(getSettingsEndpoint, () =>
        HttpResponse.json({ incomingWebhook: 'no', webhookUrl: '' }),
      ),
    );
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('ID инстанса'), '1101000001');
    await user.type(screen.getByLabelText('API-токен инстанса'), 'test-token');
    await user.click(screen.getByRole('button', { name: 'Подключиться' }));

    expect(
      await screen.findByText(
        'Включите «Получать уведомления о входящих сообщениях и файлах» в настройках инстанса GREEN-API.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Чаты' })).not.toBeInTheDocument();
  });

  it('explains that webhookUrl must be empty for HTTP polling', async () => {
    server.use(
      http.get(getSettingsEndpoint, () =>
        HttpResponse.json({
          incomingWebhook: 'yes',
          webhookUrl: 'https://example.test/webhook',
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('ID инстанса'), '1101000001');
    await user.type(screen.getByLabelText('API-токен инстанса'), 'test-token');
    await user.click(screen.getByRole('button', { name: 'Подключиться' }));

    expect(
      await screen.findByText(
        'Для HTTP API очистите webhookUrl в настройках инстанса.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Чаты' })).not.toBeInTheDocument();
  });
});
