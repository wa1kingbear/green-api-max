import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { getAvatar } from './getAvatar';

const apiUrl = 'https://test-api.green-api.com';
const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};
const endpoint = `${apiUrl}/waInstance1101000001/getAvatar/test-token`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getAvatar', () => {
  it('returns an avatar URL and sends the chat identifier', async () => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        expect(await request.json()).toEqual({ chatId: '10000000' });
        return HttpResponse.json({
          urlAvatar: 'https://i.oneme.ru/avatar.jpg',
        });
      }),
    );

    await expect(getAvatar({ apiUrl, credentials, chatId: '10000000' })).resolves.toBe(
      'https://i.oneme.ru/avatar.jpg',
    );
  });

  it('returns null when an avatar is unavailable', async () => {
    server.use(http.post(endpoint, () => HttpResponse.json({ urlAvatar: '' })));

    await expect(
      getAvatar({ apiUrl, credentials, chatId: '10000000' }),
    ).resolves.toBeNull();
  });

  it('reuses a cached avatar instead of spending another request after refresh', async () => {
    let requestCount = 0;
    server.use(
      http.post(endpoint, () => {
        requestCount += 1;
        return HttpResponse.json({ urlAvatar: 'https://i.oneme.ru/avatar.jpg' });
      }),
    );

    await getAvatar({ apiUrl, credentials, chatId: '10000000' });
    await getAvatar({ apiUrl, credentials, chatId: '10000000' });

    expect(requestCount).toBe(1);
  });

  it('stops further avatar requests temporarily after a quota error', async () => {
    let requestCount = 0;
    server.use(
      http.post(endpoint, () => {
        requestCount += 1;
        return HttpResponse.json(
          {
            invokeStatus: {
              method: 'getAvatar',
              status: 'QUOTE_EXCEEDED',
            },
          },
          { status: 466 },
        );
      }),
    );

    await expect(
      getAvatar({ apiUrl, credentials, chatId: '10000000' }),
    ).rejects.toMatchObject({ httpStatus: 466, retryable: false });
    await expect(
      getAvatar({ apiUrl, credentials, chatId: '10000001' }),
    ).rejects.toMatchObject({ httpStatus: 466, retryable: false });

    expect(requestCount).toBe(1);
  });

  it('does not block other chats after a correspondent quota error', async () => {
    let requestCount = 0;
    server.use(
      http.post(endpoint, () => {
        requestCount += 1;
        return HttpResponse.json(
          {
            quotaData: {
              method: 'correspondents',
              status: 'CORRESPONDENTS_QUOTA_EXCEEDED',
            },
          },
          { status: 466 },
        );
      }),
    );

    await expect(
      getAvatar({ apiUrl, credentials, chatId: '10000000' }),
    ).rejects.toMatchObject({ httpStatus: 466 });
    await expect(
      getAvatar({ apiUrl, credentials, chatId: '10000001' }),
    ).rejects.toMatchObject({ httpStatus: 466 });

    expect(requestCount).toBe(2);
  });

  it('rejects an unsafe avatar URL', async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({ urlAvatar: 'javascript:alert(1)' }),
      ),
    );

    await expect(
      getAvatar({ apiUrl, credentials, chatId: '10000000' }),
    ).rejects.toMatchObject({ code: 'unexpected-response' });
  });

  it('spaces concurrent requests to respect the API rate limit', async () => {
    const requestStartedAt: number[] = [];
    server.use(
      http.post(endpoint, () => {
        requestStartedAt.push(Date.now());
        return HttpResponse.json({ urlAvatar: '' });
      }),
    );

    await Promise.all([
      getAvatar({ apiUrl, credentials, chatId: '10000000' }),
      getAvatar({ apiUrl, credentials, chatId: '10000001' }),
    ]);

    expect(requestStartedAt).toHaveLength(2);
    expect(requestStartedAt[1]! - requestStartedAt[0]!).toBeGreaterThanOrEqual(100);
  });
});
