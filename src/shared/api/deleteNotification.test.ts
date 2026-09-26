import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { deleteNotification } from './deleteNotification';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/deleteNotification/test-token/1234567`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('deleteNotification', () => {
  it('confirms notification processing with a DELETE request', async () => {
    server.use(
      http.delete(endpoint, () =>
        HttpResponse.json({ result: true, reason: '' }),
      ),
    );

    await expect(
      deleteNotification({ apiUrl, credentials, receiptId: 1234567 }),
    ).resolves.toBeUndefined();
  });

  it('accepts an already deleted notification as an idempotent result', async () => {
    server.use(
      http.delete(endpoint, () =>
        HttpResponse.json({ result: false, reason: 'Already deleted' }),
      ),
    );

    await expect(
      deleteNotification({ apiUrl, credentials, receiptId: 1234567 }),
    ).resolves.toBeUndefined();
  });
});
