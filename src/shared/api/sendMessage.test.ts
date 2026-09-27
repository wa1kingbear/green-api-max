import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { sendMessage } from './sendMessage';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/sendMessage/test-token`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('sendMessage', () => {
  it('sends text to the active chat and returns idMessage', async () => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        expect(await request.json()).toEqual({
          chatId: '10000000',
          message: 'Привет',
        });

        return HttpResponse.json({ idMessage: '1763115112345' });
      }),
    );

    await expect(
      sendMessage({
        apiUrl,
        credentials,
        chatId: '10000000',
        message: 'Привет',
      }),
    ).resolves.toEqual({ idMessage: '1763115112345' });
  });

  it('returns a retryable error for a temporary server failure', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({ message: 'temporary error' }, { status: 500 }),
      ),
    );

    await expect(
      sendMessage({
        apiUrl,
        credentials,
        chatId: '10000000',
        message: 'Привет',
      }),
    ).rejects.toMatchObject({
      code: 'send-message-failed',
      retryable: true,
      httpStatus: 500,
    });
  });

  it('rejects an unexpected success response', async () => {
    server.use(http.post(endpoint, () => HttpResponse.json({ status: true })));

    await expect(
      sendMessage({
        apiUrl,
        credentials,
        chatId: '10000000',
        message: 'Привет',
      }),
    ).rejects.toMatchObject({ code: 'unexpected-response' });
  });
});
