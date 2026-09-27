import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { getChats } from './getChats';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/getChats/test-token`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getChats', () => {
  it('returns valid MAX chats', async () => {
    server.use(
      http.get(endpoint, ({ request }) => {
        expect(new URL(request.url).searchParams.get('count')).toBe('100');

        return HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна',
            type: 'user',
            phoneNumber: 79991234567,
            unreadCount: 3,
          },
          { chatId: null, name: 'Invalid', type: 'user', phoneNumber: 0 },
        ]);
      }),
    );

    await expect(getChats({ apiUrl, credentials })).resolves.toEqual([
      {
        chatId: '10000000',
        name: 'Анна',
        type: 'user',
        phoneNumber: '79991234567',
        unreadCount: 3,
      },
    ]);
  });

  it('defaults a missing or invalid unread count to zero', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json([
          {
            chatId: '10000000',
            name: 'Анна',
            type: 'user',
            phoneNumber: 79991234567,
          },
          {
            chatId: '10000001',
            name: 'Сергей',
            type: 'user',
            phoneNumber: 79876543210,
            unreadCount: -2,
          },
        ]),
      ),
    );

    await expect(getChats({ apiUrl, credentials })).resolves.toEqual([
      expect.objectContaining({ chatId: '10000000', unreadCount: 0 }),
      expect.objectContaining({ chatId: '10000001', unreadCount: 0 }),
    ]);
  });

  it('maps an authorization error without exposing request details', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({ reason: `invalid token at ${endpoint}` }, { status: 401 }),
      ),
    );

    await expect(getChats({ apiUrl, credentials })).rejects.toMatchObject({
      code: 'invalid-credentials',
      retryable: false,
      httpStatus: 401,
    });
  });

  it('rejects an unexpected response', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ chats: [] })));

    await expect(getChats({ apiUrl, credentials })).rejects.toMatchObject({
      code: 'unexpected-response',
      retryable: true,
    });
  });
});
