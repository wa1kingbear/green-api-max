const CHAT_ID_QUERY_PARAM = 'chatId';

export function getChatIdFromUrl(): string | null {
  const chatId = new URL(window.location.href).searchParams.get(CHAT_ID_QUERY_PARAM);
  return chatId?.trim() || null;
}

export function setChatIdInUrl(
  chatId: string | null,
  mode: 'push' | 'replace' = 'push',
): void {
  const url = new URL(window.location.href);
  const currentChatId = url.searchParams.get(CHAT_ID_QUERY_PARAM);

  if (currentChatId === chatId || (!currentChatId && !chatId)) {
    return;
  }

  if (chatId) {
    url.searchParams.set(CHAT_ID_QUERY_PARAM, chatId);
  } else {
    url.searchParams.delete(CHAT_ID_QUERY_PARAM);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;

  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl);
  } else {
    window.history.pushState(null, '', nextUrl);
  }
}
