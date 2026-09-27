import { fireEvent, render, screen } from '@testing-library/react';

import type { Message } from '../../app/model';
import { MessageList } from './MessageList';

function createMessage(id: string, timestamp: number): Message {
  return {
    id,
    chatId: '10000000',
    direction: 'incoming',
    text: `Сообщение ${id}`,
    timestamp,
    status: 'sent',
  };
}

describe('MessageList', () => {
  it('shows a control for returning to the bottom after scrolling up', () => {
    render(
      <MessageList
        canLoadMore={false}
        isLoadingMore={false}
        loadMoreFailed={false}
        messages={[createMessage('1', 1), createMessage('2', 2)]}
        onLoadMore={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const list = screen.getByLabelText('Сообщения');
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTo: {
        configurable: true,
        value: ({ top }: ScrollToOptions) => {
          list.scrollTop = top ?? 0;
        },
      },
    });
    list.scrollTop = 200;

    fireEvent.scroll(list);

    const scrollButton = screen.getByRole('button', { name: 'Прокрутить вниз' });
    fireEvent.click(scrollButton);

    expect(list.scrollTop).toBe(1_000);
    expect(
      screen.queryByRole('button', { name: 'Прокрутить вниз' }),
    ).not.toBeInTheDocument();
  });

  it('separates messages from different calendar dates', () => {
    const firstDay = new Date(2026, 8, 26, 10).getTime();
    const secondDay = new Date(2026, 8, 27, 10).getTime();

    render(
      <MessageList
        canLoadMore={false}
        isLoadingMore={false}
        loadMoreFailed={false}
        messages={[
          createMessage('1', firstDay),
          createMessage('2', firstDay + 60_000),
          createMessage('3', secondDay),
        ]}
        onLoadMore={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getAllByRole('separator')).toHaveLength(2);
    expect(
      screen.getByRole('separator', { name: /26 сентября 2026/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('separator', { name: /27 сентября 2026/ }),
    ).toBeInTheDocument();
  });

  it('preserves the visible position when older messages are prepended', () => {
    let scrollHeight = 200;
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });

    const recentMessages = [createMessage('2', 2), createMessage('3', 3)];
    const { rerender } = render(
      <MessageList
        canLoadMore
        isLoadingMore={false}
        loadMoreFailed={false}
        messages={recentMessages}
        onLoadMore={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const list = screen.getByLabelText('Сообщения');
    list.scrollTop = 50;
    scrollHeight = 300;

    rerender(
      <MessageList
        canLoadMore={false}
        isLoadingMore={false}
        loadMoreFailed={false}
        messages={[createMessage('1', 1), ...recentMessages]}
        onLoadMore={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(list.scrollTop).toBe(150);

    if (originalScrollHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollHeight',
        originalScrollHeight,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    }
  });
});
