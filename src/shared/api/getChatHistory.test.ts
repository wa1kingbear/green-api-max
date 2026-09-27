import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { getChatHistory, getChatHistoryPage } from './getChatHistory';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/getChatHistory/test-token`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getChatHistory', () => {
  it('returns supported text messages in chronological order', async () => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        expect(await request.json()).toEqual({ chatId: '10000000', count: 50 });

        return HttpResponse.json([
          {
            type: 'incoming',
            idMessage: 'message-2',
            timestamp: 20,
            chatId: '10000000',
            typeMessage: 'textMessage',
            textMessage: 'Второе',
          },
          {
            type: 'outgoing',
            idMessage: 'message-1',
            timestamp: 10,
            chatId: '10000000',
            typeMessage: 'extendedTextMessage',
            textMessage: 'Первое',
            statusMessage: 'delivered',
          },
          {
            type: 'incoming',
            idMessage: 'image-1',
            timestamp: 15,
            chatId: '10000000',
            typeMessage: 'imageMessage',
            downloadUrl: 'https://media.example.com/image.webp',
            caption: 'Фотография',
          },
        ]);
      }),
    );

    await expect(
      getChatHistory({ apiUrl, credentials, chatId: '10000000', count: 50 }),
    ).resolves.toEqual([
      {
        id: 'message-1',
        chatId: '10000000',
        direction: 'outgoing',
        text: 'Первое',
        timestamp: 10_000,
        status: 'delivered',
      },
      {
        id: 'image-1',
        chatId: '10000000',
        direction: 'incoming',
        text: 'Фотография',
        mediaUrl: 'https://media.example.com/image.webp',
        timestamp: 15_000,
        status: 'sent',
      },
      {
        id: 'message-2',
        chatId: '10000000',
        direction: 'incoming',
        text: 'Второе',
        timestamp: 20_000,
        status: 'sent',
      },
    ]);
  });

  it('preserves a read status for an outgoing message', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json([
          {
            type: 'outgoing',
            idMessage: 'message-read',
            timestamp: 10,
            chatId: '10000000',
            typeMessage: 'textMessage',
            textMessage: 'Прочитанное сообщение',
            statusMessage: 'read',
          },
        ]),
      ),
    );

    await expect(
      getChatHistory({ apiUrl, credentials, chatId: '10000000' }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'message-read', status: 'read' }),
    ]);
  });

  it('ignores media messages without a safe download URL', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json([
          {
            type: 'incoming',
            idMessage: 'image-1',
            timestamp: 15,
            chatId: '10000000',
            typeMessage: 'imageMessage',
            downloadUrl: 'javascript:alert(1)',
          },
        ]),
      ),
    );

    await expect(
      getChatHistory({ apiUrl, credentials, chatId: '10000000' }),
    ).resolves.toEqual([]);
  });

  it('returns a retryable error for a temporary failure', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({ reason: 'temporary error' }, { status: 500 }),
      ),
    );

    await expect(
      getChatHistory({ apiUrl, credentials, chatId: '10000000' }),
    ).rejects.toMatchObject({
      code: 'get-chat-history-failed',
      retryable: true,
      httpStatus: 500,
    });
  });

  it('reports more history based on the unfiltered API response size', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json([
          {
            type: 'incoming',
            idMessage: 'message-1',
            timestamp: 10,
            chatId: '10000000',
            typeMessage: 'textMessage',
            textMessage: 'Текст',
          },
          {
            type: 'incoming',
            idMessage: 'image-1',
            timestamp: 5,
            chatId: '10000000',
            typeMessage: 'imageMessage',
          },
        ]),
      ),
    );

    await expect(
      getChatHistoryPage({
        apiUrl,
        credentials,
        chatId: '10000000',
        count: 2,
      }),
    ).resolves.toMatchObject({
      hasMore: true,
      messages: [{ id: 'message-1' }],
    });
  });

  it('rejects an unexpected response', async () => {
    server.use(http.post(endpoint, () => HttpResponse.json({ messages: [] })));

    await expect(
      getChatHistory({ apiUrl, credentials, chatId: '10000000' }),
    ).rejects.toMatchObject({ code: 'unexpected-response' });
  });

  it('spaces concurrent history requests to respect the API rate limit', async () => {
    const requestStartedAt: number[] = [];

    server.use(
      http.post(endpoint, () => {
        requestStartedAt.push(Date.now());
        return HttpResponse.json([]);
      }),
    );

    await Promise.all([
      getChatHistory({ apiUrl, credentials, chatId: '10000000', count: 1 }),
      getChatHistory({ apiUrl, credentials, chatId: '10000001', count: 1 }),
    ]);

    expect(requestStartedAt).toHaveLength(2);
    expect(requestStartedAt[1]! - requestStartedAt[0]!).toBeGreaterThanOrEqual(1_200);
  });

  it('prioritizes an opened chat over queued background previews', async () => {
    const priorityCredentials = {
      idInstance: '1101000099',
      apiTokenInstance: 'priority-token',
    };
    const priorityEndpoint = `${apiUrl}/waInstance1101000099/getChatHistory/priority-token`;
    const requestOrder: string[] = [];

    server.use(
      http.post(priorityEndpoint, async ({ request }) => {
        const body = (await request.json()) as { chatId: string };
        requestOrder.push(body.chatId);
        return HttpResponse.json([]);
      }),
    );

    await Promise.all([
      getChatHistory({
        apiUrl,
        credentials: priorityCredentials,
        chatId: 'background-1',
        count: 1,
        priority: 'background',
      }),
      getChatHistory({
        apiUrl,
        credentials: priorityCredentials,
        chatId: 'background-2',
        count: 1,
        priority: 'background',
      }),
      getChatHistory({
        apiUrl,
        credentials: priorityCredentials,
        chatId: 'foreground',
        count: 100,
      }),
    ]);

    expect(requestOrder).toEqual(['background-1', 'foreground', 'background-2']);
  });
});
