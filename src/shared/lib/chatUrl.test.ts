import { getChatIdFromUrl, setChatIdInUrl } from './chatUrl';

describe('chat URL', () => {
  it('reads and writes an encoded chat id while preserving the rest of the URL', () => {
    window.history.replaceState(null, '', '/messenger?view=compact#latest');

    setChatIdInUrl('chat/id 1');

    expect(getChatIdFromUrl()).toBe('chat/id 1');
    expect(window.location.pathname).toBe('/messenger');
    expect(window.location.search).toBe('?view=compact&chatId=chat%2Fid+1');
    expect(window.location.hash).toBe('#latest');
  });

  it('removes only the chat id from the URL', () => {
    window.history.replaceState(null, '', '/?chatId=10000000&view=compact');

    setChatIdInUrl(null, 'replace');

    expect(getChatIdFromUrl()).toBeNull();
    expect(window.location.search).toBe('?view=compact');
  });
});
