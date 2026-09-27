import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../app/App';
import { AppProvider } from '../../app/AppProvider';
import { GREEN_API_BASE_URL } from '../../shared/config/environment';

const checkAccountEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/checkAccount/test-token`;
const getAvatarEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/getAvatar/test-token`;
const getChatsEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/getChats/test-token`;
const getChatHistoryEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/getChatHistory/test-token`;
const getSettingsEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/getSettings/test-token`;
const sendMessageEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/sendMessage/test-token`;
const receiveNotificationEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/receiveNotification/test-token`;
const deleteNotificationEndpoint = `${GREEN_API_BASE_URL}/waInstance1101000001/deleteNotification/test-token/:receiptId`;
const server = setupServer(
  http.get(getSettingsEndpoint, () =>
    HttpResponse.json({ incomingWebhook: 'yes', webhookUrl: '' }),
  ),
  http.get(getChatsEndpoint, () => HttpResponse.json([])),
  http.post(getAvatarEndpoint, () => HttpResponse.json({ urlAvatar: '' })),
  http.post(getChatHistoryEndpoint, () => HttpResponse.json([])),
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
  await screen.findByRole('heading', { name: 'Чаты' });
}

async function createChat(
  user: ReturnType<typeof userEvent.setup>,
  mockCheckAccount = true,
) {
  if (mockCheckAccount) {
    server.use(
      http.post(checkAccountEndpoint, () =>
        HttpResponse.json({
          exist: true,
          chatId: '10000000',
          fromCache: false,
        }),
      ),
    );
  }

  await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
  await user.type(screen.getByLabelText('Номер телефона'), '+7 (999) 123-45-67');
  await user.click(screen.getByRole('button', { name: 'Продолжить' }));
  await screen.findByRole('heading', { name: '+7 999 123-45-67' });
}

function incomingTextNotification({
  chatId = '10000000',
  idMessage = 'incoming-1',
  text = 'Ответ из MAX',
}: {
  chatId?: string;
  idMessage?: string;
  text?: string;
} = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1763115112,
    idMessage,
    senderData: { chatId },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: text },
    },
  };
}

describe('messenger integration', () => {
  it('restores the active chat from the URL after a page reload', async () => {
    const urlTestIdInstance = '1101000099';
    const urlTestToken = 'url-test-token';
    const urlTestInstancePath = `${GREEN_API_BASE_URL}/waInstance${urlTestIdInstance}`;

    server.use(
      http.get(`${urlTestInstancePath}/getSettings/${urlTestToken}`, () =>
        HttpResponse.json({ incomingWebhook: 'yes', webhookUrl: '' }),
      ),
      http.get(`${urlTestInstancePath}/getChats/${urlTestToken}`, () =>
        HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна',
            type: 'user',
            phoneNumber: 79991234567,
          },
        ]),
      ),
      http.post(`${urlTestInstancePath}/getAvatar/${urlTestToken}`, () =>
        HttpResponse.json({ urlAvatar: '' }),
      ),
      http.post(`${urlTestInstancePath}/getChatHistory/${urlTestToken}`, () =>
        HttpResponse.json([]),
      ),
      http.get(
        `${urlTestInstancePath}/receiveNotification/${urlTestToken}`,
        async () => {
          await delay('infinite');
        },
      ),
    );
    const user = userEvent.setup();
    const firstRender = renderApp();

    await user.type(screen.getByLabelText('ID инстанса'), urlTestIdInstance);
    await user.type(screen.getByLabelText('API-токен инстанса'), urlTestToken);
    await user.click(screen.getByRole('button', { name: 'Подключиться' }));
    await screen.findByRole('heading', { name: 'Чаты' });
    await user.click(await screen.findByRole('button', { name: /Анна/ }));

    expect(window.location.search).toBe('?chatId=10000000');
    expect(screen.getByRole('heading', { name: 'Анна' })).toBeInTheDocument();

    firstRender.unmount();
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Анна' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Анна/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('loads personal chats and the selected chat history', async () => {
    server.use(
      http.get(getChatsEndpoint, () =>
        HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна',
            type: 'user',
            phoneNumber: 79991234567,
          },
          {
            chatId: '-10000000',
            name: 'Рабочая группа',
            type: 'group',
            phoneNumber: 0,
          },
        ]),
      ),
      http.post(getAvatarEndpoint, () =>
        HttpResponse.json({ urlAvatar: 'https://i.oneme.ru/avatar.jpg' }),
      ),
      http.post(getChatHistoryEndpoint, async ({ request }) => {
        const body = await request.json();

        expect(body).toEqual(expect.objectContaining({ chatId: '10000000' }));

        const messages = [
          {
            type: 'incoming',
            idMessage: 'history-2',
            timestamp: 1763115120,
            typeMessage: 'textMessage',
            chatId: '10000000',
            textMessage: 'Новое сообщение',
          },
          {
            type: 'outgoing',
            idMessage: 'history-1',
            timestamp: 1763115110,
            statusMessage: 'sent',
            typeMessage: 'textMessage',
            chatId: '10000000',
            textMessage: 'Старое сообщение',
          },
        ];

        return HttpResponse.json(
          (body as { count?: number }).count === 1 ? messages.slice(0, 1) : messages,
        );
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    const chat = await screen.findByRole('button', { name: /Анна/ });
    expect(screen.queryByText('Рабочая группа')).not.toBeInTheDocument();
    expect(await within(chat).findByText('Новое сообщение')).toBeInTheDocument();
    await waitFor(() =>
      expect(chat.querySelector('img')).toHaveAttribute(
        'src',
        'https://i.oneme.ru/avatar.jpg',
      ),
    );

    await user.click(chat);

    await waitFor(() =>
      expect(
        screen.getByLabelText('Переписка').querySelector('header img'),
      ).toHaveAttribute('src', 'https://i.oneme.ru/avatar.jpg'),
    );

    const messages = await screen.findByLabelText('Сообщения', {}, { timeout: 2_500 });
    const articles = within(messages).getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent('Старое сообщение');
    expect(articles[1]).toHaveTextContent('Новое сообщение');
  });

  it('shows a skeleton while the chat preview is loading', async () => {
    server.use(
      http.get(getChatsEndpoint, () =>
        HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна',
            type: 'user',
            phoneNumber: 79991234567,
          },
        ]),
      ),
      http.post(getChatHistoryEndpoint, async () => {
        await delay('infinite');
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    const chat = await screen.findByRole('button', { name: /Анна/ });

    expect(
      within(chat).getByLabelText('Загружается последнее сообщение'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Загружаем сообщение…')).not.toBeInTheDocument();
  });

  it('filters loaded chats by name, phone number and message preview', async () => {
    server.use(
      http.get(getChatsEndpoint, () =>
        HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна Иванова',
            type: 'user',
            phoneNumber: 79991234567,
          },
          {
            chatId: '10000001',
            name: 'Сергей',
            type: 'user',
            phoneNumber: 79876543210,
          },
        ]),
      ),
      http.post(getChatHistoryEndpoint, async ({ request }) => {
        const body = (await request.json()) as { chatId: string };
        const textMessage =
          body.chatId === '10000000' ? 'Покажи договор' : 'Созвонимся завтра';

        return HttpResponse.json([
          {
            type: 'incoming',
            idMessage: `history-${body.chatId}`,
            timestamp: 1763115120,
            typeMessage: 'textMessage',
            chatId: body.chatId,
            textMessage,
          },
        ]);
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    const search = screen.getByRole('searchbox', { name: 'Найти чат' });
    const annaChat = await screen.findByRole('button', { name: /Анна Иванова/ });
    await within(annaChat).findByText('Покажи договор', {}, { timeout: 3_000 });

    await user.type(search, 'анна');

    expect(screen.getByRole('button', { name: /Анна Иванова/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Сергей/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    await user.type(search, '8 (987) 654-32-10');

    expect(
      screen.queryByRole('button', { name: /Анна Иванова/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сергей/ })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '+7 999 123');

    expect(screen.getByRole('button', { name: /Анна Иванова/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Сергей/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'ДОГОВОР');

    expect(screen.getByRole('button', { name: /Анна Иванова/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Сергей/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'несуществующий чат');

    expect(screen.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
    expect(screen.getByRole('button', { name: /Анна Иванова/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сергей/ })).toBeInTheDocument();
  });

  it('loads older messages on demand', async () => {
    const history = Array.from({ length: 101 }, (_, index) => {
      const messageNumber = 101 - index;

      return {
        type: messageNumber % 2 === 0 ? 'outgoing' : 'incoming',
        idMessage: `history-${messageNumber}`,
        timestamp: 1_700_000_000 + messageNumber,
        statusMessage: 'sent',
        typeMessage: 'textMessage',
        chatId: '10000000',
        textMessage: `Сообщение ${messageNumber}`,
      };
    });

    server.use(
      http.post(checkAccountEndpoint, () =>
        HttpResponse.json({
          exist: true,
          chatId: '10000000',
          fromCache: false,
        }),
      ),
      http.post(getChatHistoryEndpoint, async ({ request }) => {
        const body = (await request.json()) as { count: number };
        return HttpResponse.json(history.slice(0, body.count));
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    await createChat(user, false);

    const loadMoreButton = await screen.findByRole(
      'button',
      { name: 'Загрузить еще сообщения' },
      { timeout: 3_000 },
    );
    expect(screen.queryByText('Сообщение 1')).not.toBeInTheDocument();

    await user.click(loadMoreButton);

    expect(
      await screen.findByText('Сообщение 1', {}, { timeout: 3_000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Загрузить еще сообщения' }),
    ).not.toBeInTheDocument();
  });

  it('shows only navigation available in the MVP', async () => {
    const user = userEvent.setup();
    renderApp();

    await connect(user);

    expect(screen.queryByRole('button', { name: /Контакты/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Чаты' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  });

  it('completes settings, chat, send, receive and delete flow', async () => {
    const order: string[] = [];
    let notificationDelivered = false;
    let releaseNotification: (() => void) | undefined;
    const messageSent = new Promise<void>((resolve) => {
      releaseNotification = resolve;
    });

    server.use(
      http.get(getSettingsEndpoint, () => {
        order.push('get-settings');
        return HttpResponse.json({ incomingWebhook: 'yes', webhookUrl: '' });
      }),
      http.post(checkAccountEndpoint, () => {
        order.push('check-account');
        return HttpResponse.json({
          exist: true,
          chatId: '10000000',
          fromCache: false,
        });
      }),
      http.post(sendMessageEndpoint, async ({ request }) => {
        order.push('send-message');
        expect(await request.json()).toEqual({
          chatId: '10000000',
          message: 'Привет',
        });
        releaseNotification?.();
        return HttpResponse.json({ idMessage: 'outgoing-1' });
      }),
      http.get(receiveNotificationEndpoint, async () => {
        if (notificationDelivered) {
          await delay('infinite');
        }

        await messageSent;
        notificationDelivered = true;
        order.push('receive-notification');
        return HttpResponse.json({
          receiptId: 101,
          body: incomingTextNotification(),
        });
      }),
      http.delete(deleteNotificationEndpoint, ({ params }) => {
        order.push(`delete-notification-${String(params.receiptId)}`);
        return HttpResponse.json({ result: true, reason: '' });
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    await createChat(user, false);
    await user.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}');

    const messageList = screen.getByLabelText('Сообщения');
    expect(await within(messageList).findByText('Ответ из MAX')).toBeInTheDocument();
    expect(within(messageList).getAllByTitle('Отправлено')).toHaveLength(1);
    await waitFor(() =>
      expect(order).toEqual([
        'get-settings',
        'check-account',
        'send-message',
        'receive-notification',
        'delete-notification-101',
      ]),
    );
    expect(within(messageList).getByText('Привет')).toBeInTheDocument();
  });

  it('deletes an unsupported notification without rendering it', async () => {
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
          receiptId: 202,
          body: {
            typeWebhook: 'stateInstanceChanged',
            stateInstance: 'authorized',
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

    await waitFor(() => expect(deletedReceiptId).toBe('202'));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('deletes a message from another chat without rendering it', async () => {
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
          receiptId: 303,
          body: incomingTextNotification({
            chatId: '20000000',
            idMessage: 'foreign-message',
            text: 'Чужой чат',
          }),
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

    await waitFor(() => expect(deletedReceiptId).toBe('303'));
    expect(screen.queryByText('Чужой чат')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows an unread count for a new message and clears it on open', async () => {
    let releaseNotification: (() => void) | undefined;
    let notificationDelivered = false;
    const chatsLoaded = new Promise<void>((resolve) => {
      releaseNotification = resolve;
    });

    server.use(
      http.get(getChatsEndpoint, () =>
        HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна',
            type: 'user',
            phoneNumber: 79991234567,
          },
          {
            chatId: '20000000',
            name: 'Сергей',
            type: 'user',
            phoneNumber: 79876543210,
            unreadCount: 3,
          },
        ]),
      ),
      http.get(receiveNotificationEndpoint, async () => {
        if (notificationDelivered) {
          await delay('infinite');
        }

        await chatsLoaded;
        notificationDelivered = true;
        return HttpResponse.json({
          receiptId: 404,
          body: incomingTextNotification({
            chatId: '20000000',
            idMessage: 'unread-message',
            text: 'Новое сообщение',
          }),
        });
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    const chat = await screen.findByRole('button', { name: /Сергей/ });

    expect(within(chat).getByLabelText('Непрочитанных сообщений: 3')).toHaveTextContent(
      '3',
    );

    releaseNotification?.();

    expect(
      await within(chat).findByLabelText('Непрочитанных сообщений: 4'),
    ).toHaveTextContent('4');

    await user.click(chat);

    expect(
      within(chat).queryByLabelText(/Непрочитанных сообщений:/),
    ).not.toBeInTheDocument();
  });

  it('aborts the active ReceiveNotification request on disconnect', async () => {
    let requestStarted = false;
    let requestAborted = false;

    server.use(
      http.get(receiveNotificationEndpoint, async ({ request }) => {
        requestStarted = true;
        await new Promise<void>((resolve) => {
          request.signal.addEventListener(
            'abort',
            () => {
              requestAborted = true;
              resolve();
            },
            { once: true },
          );
        });
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const user = userEvent.setup();
    renderApp();

    await connect(user);
    await waitFor(() => expect(requestStarted).toBe(true));
    await user.click(screen.getAllByRole('button', { name: 'Выйти' })[0]);

    expect(
      await screen.findByRole('heading', { name: 'Подключите GREEN-API' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(requestAborted).toBe(true));
  });
});

describe('creating a chat', () => {
  it('traps focus in the dialog and returns it to the trigger', async () => {
    const user = userEvent.setup();
    renderApp();
    await connect(user);

    const trigger = screen.getAllByRole('button', { name: 'Новый чат' })[0];
    await user.click(trigger);

    const phoneInput = screen.getByLabelText('Номер телефона');
    expect(phoneInput).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

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
    expect(
      await screen.findByText('Начните переписку', {}, { timeout: 2_500 }),
    ).toBeInTheDocument();
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

  it('updates an outgoing message when a read status notification arrives', async () => {
    let releaseStatus: (() => void) | undefined;
    let statusDelivered = false;
    const messageSent = new Promise<void>((resolve) => {
      releaseStatus = resolve;
    });

    server.use(
      http.post(sendMessageEndpoint, () => {
        releaseStatus?.();
        return HttpResponse.json({ idMessage: 'outgoing-read' });
      }),
      http.get(receiveNotificationEndpoint, async () => {
        if (statusDelivered) {
          await delay('infinite');
        }

        await messageSent;
        await delay(100);
        statusDelivered = true;
        return HttpResponse.json({
          receiptId: 202,
          body: {
            typeWebhook: 'outgoingMessageStatus',
            chatId: '10000000',
            timestamp: 1763115112,
            idMessage: 'outgoing-read',
            status: 'read',
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    await user.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}');

    expect(await screen.findByTitle('Прочитано')).toBeInTheDocument();
    expect(screen.queryByTitle('Отправлено')).not.toBeInTheDocument();
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
          body: incomingTextNotification(),
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
    expect(within(incomingMessage).queryByTitle('Отправлено')).not.toBeInTheDocument();
    expect(
      within(incomingMessage).queryByRole('button', { name: /повторить/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(deletedReceiptId).toBe('1234567'));
  });

  it('shows an incoming media message as an external link', async () => {
    let notificationDelivered = false;

    server.use(
      http.get(receiveNotificationEndpoint, async () => {
        if (notificationDelivered) {
          await delay('infinite');
        }

        await delay(300);
        notificationDelivered = true;
        return HttpResponse.json({
          receiptId: 1234568,
          body: {
            typeWebhook: 'incomingMessageReceived',
            timestamp: 1763115112,
            idMessage: 'incoming-image',
            senderData: { chatId: '10000000' },
            messageData: {
              typeMessage: 'imageMessage',
              fileMessageData: {
                downloadUrl: 'https://media.example.com/image.webp',
                caption: 'Фотография',
              },
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await connect(user);
    await createChat(user);

    const mediaLink = await screen.findByRole('link', {
      name: 'Открыть медиафайл',
    });
    expect(mediaLink).toHaveAttribute('href', 'https://media.example.com/image.webp');
    expect(
      within(mediaLink.closest('article')!).getByText('Фотография'),
    ).toBeInTheDocument();
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
          body: incomingTextNotification({
            idMessage: 'same-message',
            text: 'Только один раз',
          }),
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
            reason: 'Message cannot be received because custom webhook url is set.',
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
