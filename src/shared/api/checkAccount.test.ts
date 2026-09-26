import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { checkAccount } from './checkAccount';
import { GreenApiError } from './greenApiError';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/checkAccount/test-token`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('checkAccount', () => {
  it('sends a normalized phone number and returns chat data', async () => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        expect(await request.json()).toEqual({ phoneNumber: 79991234567 });

        return HttpResponse.json({
          exist: true,
          chatId: '10000000',
          fromCache: true,
        });
      }),
    );

    await expect(
      checkAccount({
        apiUrl,
        credentials,
        phoneNumber: '79991234567',
      }),
    ).resolves.toEqual({
      exist: true,
      chatId: '10000000',
      fromCache: true,
    });
  });

  it('maps a non-authorized instance response', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({
          status: false,
          reason: 'instance is starting or not authorized',
        }),
      ),
    );

    const request = checkAccount({
      apiUrl,
      credentials,
      phoneNumber: '79991234567',
    });

    await expect(request).rejects.toMatchObject<Partial<GreenApiError>>({
      code: 'instance-not-authorized',
      retryable: false,
    });
  });

  it('maps the CheckAccount rate limit', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json(
          { status: false, reason: 'User get contact info limit reached' },
          { status: 469 },
        ),
      ),
    );

    const request = checkAccount({
      apiUrl,
      credentials,
      phoneNumber: '79991234567',
    });

    await expect(request).rejects.toMatchObject<Partial<GreenApiError>>({
      code: 'check-account-limit',
      retryable: true,
      httpStatus: 469,
    });
  });
});
