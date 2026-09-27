import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { getChatHistory } from './getChatHistory';

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

  it('rejects an unexpected response', async () => {
    server.use(http.post(endpoint, () => HttpResponse.json({ messages: [] })));

    await expect(
      getChatHistory({ apiUrl, credentials, chatId: '10000000' }),
    ).rejects.toMatchObject({ code: 'unexpected-response' });
  });
});
