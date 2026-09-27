import { expect, test, type Route } from '@playwright/test';

const apiBaseUrl = 'https://api.green-api.com';
const idInstance = '1101000001';
const apiTokenInstance = 'test-token';
const instancePath = `/waInstance${idInstance}`;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

test('creates a chat, sends a message and receives a reply', async ({ page }) => {
  let checkAccountBody: unknown;
  let sendMessageBody: unknown;
  let deletedReceiptId: string | undefined;
  let notificationDelivered = false;
  let releaseNotification: (() => void) | undefined;
  const messageSent = new Promise<void>((resolve) => {
    releaseNotification = resolve;
  });

  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (pathname === `${instancePath}/getSettings/${apiTokenInstance}`) {
      await fulfillJson(route, { incomingWebhook: 'yes', webhookUrl: '' });
      return;
    }

    if (pathname === `${instancePath}/getChats/${apiTokenInstance}`) {
      await fulfillJson(route, [
        {
          chatId: '20000000',
          name: 'Анна',
          type: 'user',
          phoneNumber: 79990000000,
        },
      ]);
      return;
    }

    if (pathname === `${instancePath}/getChatHistory/${apiTokenInstance}`) {
      const body = request.postDataJSON() as { chatId?: string } | null;
      await fulfillJson(
        route,
        body?.chatId === '20000000'
          ? [
              {
                type: 'incoming',
                idMessage: 'history-1',
                timestamp: 1763115000,
                chatId: '20000000',
                typeMessage: 'textMessage',
                textMessage: 'Сообщение из истории',
              },
            ]
          : [],
      );
      return;
    }

    if (pathname === `${instancePath}/checkAccount/${apiTokenInstance}`) {
      checkAccountBody = request.postDataJSON();
      await fulfillJson(route, {
        exist: true,
        chatId: '10000000',
        fromCache: false,
      });
      return;
    }

    if (pathname === `${instancePath}/sendMessage/${apiTokenInstance}`) {
      sendMessageBody = request.postDataJSON();
      releaseNotification?.();
      await fulfillJson(route, { idMessage: 'outgoing-1' });
      return;
    }

    if (pathname === `${instancePath}/receiveNotification/${apiTokenInstance}`) {
      if (notificationDelivered) {
        await route.fulfill({ status: 200, headers: corsHeaders, body: '' });
        return;
      }

      await messageSent;
      notificationDelivered = true;
      await fulfillJson(route, {
        receiptId: 9001,
        body: {
          typeWebhook: 'incomingMessageReceived',
          timestamp: 1763115112,
          idMessage: 'incoming-1',
          senderData: { chatId: '10000000' },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'Ответ из MAX' },
          },
        },
      });
      return;
    }

    const deletePrefix = `${instancePath}/deleteNotification/${apiTokenInstance}/`;

    if (pathname.startsWith(deletePrefix)) {
      deletedReceiptId = pathname.slice(deletePrefix.length);
      await fulfillJson(route, { result: true, reason: '' });
      return;
    }

    await route.abort('blockedbyclient');
  });

  await page.goto('/');
  await page.getByLabel('ID инстанса').fill(idInstance);
  await page.getByLabel('API-токен инстанса').fill(apiTokenInstance);
  await page.getByRole('button', { name: 'Подключиться' }).click();

  await expect(page.getByRole('heading', { name: 'Чаты', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('selectedInstance')),
    )
    .toBe(JSON.stringify({ idInstance, apiTokenInstance }));

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Чаты', exact: true })).toBeVisible();

  const existingChat = page.getByRole('button', { name: /Анна/ });
  await expect(existingChat.getByText('Сообщение из истории')).toBeVisible();
  await existingChat.click();
  await expect(
    page.getByRole('region', { name: 'Переписка' }).getByText('Сообщение из истории'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Новый чат' }).first().click();
  await page.getByLabel('Номер телефона').fill('+7 (999) 123-45-67');
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: '+7 999 123-45-67' })).toBeVisible();

  const composer = page.getByRole('textbox', { name: 'Сообщение', exact: true });
  await composer.fill('Привет');
  await composer.press('Enter');

  const messages = page.getByLabel('Сообщения');
  await expect(messages.getByText('Привет')).toBeVisible();
  await expect(messages.getByText('Ответ из MAX')).toBeVisible();
  await expect.poll(() => deletedReceiptId).toBe('9001');

  expect(checkAccountBody).toEqual({ phoneNumber: 79991234567 });
  expect(sendMessageBody).toEqual({ chatId: '10000000', message: 'Привет' });

  await page.getByRole('button', { name: 'Выйти' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Подключите GREEN-API' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('selectedInstance')),
    )
    .toBeNull();
});
