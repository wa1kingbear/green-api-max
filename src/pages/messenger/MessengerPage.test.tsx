import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../app/App';
import { AppProvider } from '../../app/AppProvider';
import { GREEN_API_BASE_URL } from '../../shared/config/environment';

const endpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/checkAccount/test-token`;
const server = setupServer();

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

async function connect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('ID инстанса'), '1101000001');
  await user.type(screen.getByLabelText('API-токен инстанса'), 'test-token');
  await user.click(screen.getByRole('button', { name: 'Подключиться' }));
}

describe('creating a chat', () => {
  it('opens a chat returned by CheckAccount', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({
          exist: true,
          chatId: '10000000',
          fromCache: false,
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);

    await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
    await user.type(screen.getByLabelText('Номер телефона'), '+7 (999) 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(
      await screen.findByRole('heading', { name: '+7 999 123-45-67' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Начните переписку')).toBeInTheDocument();
  });

  it('shows an error when the MAX account does not exist', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({ exist: false, chatId: '', fromCache: false }),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);

    await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
    await user.type(screen.getByLabelText('Номер телефона'), '+7 999 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(
      await screen.findByText('Пользователь MAX с таким номером не найден.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
