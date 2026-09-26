import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../app/App';
import { AppProvider } from '../../app/AppProvider';
import { GREEN_API_BASE_URL } from '../../shared/config/environment';

const checkAccountEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/checkAccount/test-token`;
const sendMessageEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/sendMessage/test-token`;
const receiveNotificationEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/receiveNotification/test-token`;
const deleteNotificationEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/deleteNotification/test-token/:receiptId`;
const server = setupServer(
  http.get(receiveNotificationEndpoint, async () => {
    await delay('infinite');
  }),
  http.delete(deleteNotificationEndpoint, () =>
    HttpResponse.json({ result: true, reason: '' }),
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

async function connect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('ID инстанса'), '1101000001');
  await user.type(screen.getByLabelText('API-токен инстанса'), 'test-token');
  await user.click(screen.getByRole('button', { name: 'Подключиться' }));
}

async function createChat(user: ReturnType<typeof userEvent.setup>) {
  server.use(
    http.post(checkAccountEndpoint, () =>
      HttpResponse.json({
        exist: true,
        chatId: '10000000',
        fromCache: false,
      }),
    ),
  );

  await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
  await user.type(screen.getByLabelText('Номер телефона'), '+7 (999) 123-45-67');
  await user.click(screen.getByRole('button', { name: 'Продолжить' }));
  await screen.findByRole('heading', { name: '+7 999 123-45-67' });
}

describe('creating a chat', () => {
  it('opens a chat returned by CheckAccount', async () => {
    server.use(
      http.post(checkAccountEndpoint, () =>
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
      http.post(checkAccountEndpoint, () =>
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

describe('sending a message', () => {
  it('shows an optimistic message and marks it as sent', async () => {
    server.use(
      http.post(sendMessageEndpoint, async ({ request }) => {
        expect(await request.json()).toEqual({
          chatId: '10000000',
          message: 'Привет',
        });
        await delay(80);
        return HttpResponse.json({ idMessage: '1763115112345' });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    await user.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}');

    expect(
      within(screen.getByLabelText('Сообщения')).getByText('Привет'),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Отправляется')).toBeInTheDocument();
    expect(await screen.findByTitle('Отправлено')).toBeInTheDocument();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('retries a failed message without adding a duplicate', async () => {
    let attempt = 0;
    server.use(
      http.post(sendMessageEndpoint, () => {
        attempt += 1;

        return attempt === 1
          ? HttpResponse.json({ message: 'temporary error' }, { status: 500 })
          : HttpResponse.json({ idMessage: '1763115112345' });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    await user.type(screen.getByLabelText('Сообщение'), 'Повтори{Enter}');
    const retryButton = await screen.findByRole('button', {
      name: 'Не отправлено · Повторить',
    });
    await user.click(retryButton);

    expect(await screen.findByTitle('Отправлено')).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Сообщения')).getAllByText('Повтори'),
    ).toHaveLength(1);
  });
});

describe('receiving messages', () => {
  it('shows an incoming message and deletes its notification', async () => {
    let notificationDelivered = false;
    let deletedReceiptId: string | undefined;

    server.use(
      http.get(receiveNotificationEndpoint, async () => {
        if (notificationDelivered) {
          await delay('infinite');
        }

        await delay(300);
        notificationDelivered = true;
        return HttpResponse.json({
          receiptId: 1234567,
          body: {
            typeWebhook: 'incomingMessageReceived',
            timestamp: 1763115112,
            idMessage: 'incoming-1',
            senderData: { chatId: '10000000' },
            messageData: {
              typeMessage: 'textMessage',
              textMessageData: { textMessage: 'Ответ из MAX' },
            },
          },
        });
      }),
      http.delete(deleteNotificationEndpoint, ({ params }) => {
        deletedReceiptId = String(params.receiptId);
        return HttpResponse.json({ result: true, reason: '' });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    const incomingMessage = await screen.findByRole('article');
    expect(within(incomingMessage).getByText('Ответ из MAX')).toBeInTheDocument();
    await waitFor(() => expect(deletedReceiptId).toBe('1234567'));
  });

  it('does not render duplicate incoming messages', async () => {
    let receiptId = 1;

    server.use(
      http.get(receiveNotificationEndpoint, async () => {
        if (receiptId > 2) {
          await delay('infinite');
        }

        if (receiptId === 1) {
          await delay(300);
        }

        const currentReceiptId = receiptId;
        receiptId += 1;

        return HttpResponse.json({
          receiptId: currentReceiptId,
          body: {
            typeWebhook: 'incomingMessageReceived',
            timestamp: 1763115112,
            idMessage: 'same-message',
            senderData: { chatId: '10000000' },
            messageData: {
              typeMessage: 'textMessage',
              textMessageData: { textMessage: 'Только один раз' },
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    const incomingMessage = await screen.findByRole('article');
    expect(within(incomingMessage).getByText('Только один раз')).toBeInTheDocument();
    await waitFor(() => expect(receiptId).toBe(3));

    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('shows a recovery state for a webhookUrl conflict', async () => {
    server.use(
      http.get(receiveNotificationEndpoint, () =>
        HttpResponse.json(
          {
            reason:
              'Message cannot be received because custom webhook url is set.',
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    expect(await screen.findByText('Восстанавливаем связь…')).toBeInTheDocument();
    expect(
      screen.getByText('Для HTTP API очистите webhookUrl в настройках инстанса.'),
    ).toBeInTheDocument();
  });
});
