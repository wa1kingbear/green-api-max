import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { receiveNotification } from './receiveNotification';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/receiveNotification/test-token`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('receiveNotification', () => {
  it('returns a notification and sends the long-poll timeout', async () => {
    server.use(
      http.get(endpoint, ({ request }) => {
        expect(new URL(request.url).searchParams.get('receiveTimeout')).toBe('10');

        return HttpResponse.json({
          receiptId: 1234567,
          body: { typeWebhook: 'incomingMessageReceived' },
        });
      }),
    );

    await expect(receiveNotification({ apiUrl, credentials })).resolves.toEqual({
      receiptId: 1234567,
      body: { typeWebhook: 'incomingMessageReceived' },
    });
  });

  it('treats an empty timeout response as no notification', async () => {
    server.use(http.get(endpoint, () => new HttpResponse(null, { status: 200 })));

    await expect(receiveNotification({ apiUrl, credentials })).resolves.toBeNull();
  });

  it('returns a safe error when webhookUrl is configured', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json(
          {
            reason:
              'Message cannot be received because custom webhook url is set.',
          },
          { status: 400 },
        ),
      ),
    );

    await expect(receiveNotification({ apiUrl, credentials })).rejects.toMatchObject({
      code: 'webhook-conflict',
      message: 'Для HTTP API очистите webhookUrl в настройках инстанса.',
      retryable: false,
    });
  });
});
