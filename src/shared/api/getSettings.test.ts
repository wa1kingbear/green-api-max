import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { getSettings } from './getSettings';
import { GreenApiError } from './greenApiError';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/getSettings/test-token`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getSettings', () => {
  it('returns the settings required for HTTP polling', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({
          incomingWebhook: 'yes',
          webhookUrl: '',
          typeInstance: 'v3',
        }),
      ),
    );

    await expect(getSettings({ apiUrl, credentials })).resolves.toEqual({
      incomingWebhook: 'yes',
      webhookUrl: '',
    });
  });

  it('maps invalid credentials without exposing response details', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({ reason: `invalid token at ${endpoint}` }, { status: 401 }),
      ),
    );

    const request = getSettings({ apiUrl, credentials });

    await expect(request).rejects.toMatchObject<Partial<GreenApiError>>({
      code: 'invalid-credentials',
      message: 'Не удалось подключиться. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: 401,
    });
  });

  it('rejects an incomplete settings response', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ incomingWebhook: 'yes' })));

    await expect(getSettings({ apiUrl, credentials })).rejects.toMatchObject<
      Partial<GreenApiError>
    >({
      code: 'unexpected-response',
      retryable: true,
    });
  });
});
