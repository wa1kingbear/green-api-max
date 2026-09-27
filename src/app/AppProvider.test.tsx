import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SELECTED_INSTANCE_STORAGE_KEY } from '../shared/lib/selectedInstanceStorage';
import { AppProvider } from './AppProvider';
import {
  useApp,
  useAppDispatch,
  useChatListState,
  useConversationState,
  useSessionState,
} from './useApp';

const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};

function StateProbe() {
  const { state, dispatch } = useApp();

  return (
    <>
      <span data-testid="connection">{state.connection}</span>
      <span data-testid="instance-id">{state.credentials?.idInstance ?? ''}</span>
      <button
        onClick={() => dispatch({ type: 'connect', payload: credentials })}
        type="button"
      >
        Connect
      </button>
      <button onClick={() => dispatch({ type: 'disconnect' })} type="button">
        Disconnect
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <AppProvider>
      <StateProbe />
    </AppProvider>,
  );
}

const sessionRender = vi.fn();
const chatListRender = vi.fn();
const conversationRender = vi.fn();

function SessionProbe() {
  useSessionState();
  sessionRender();
  return null;
}

function ChatListProbe() {
  useChatListState();
  chatListRender();
  return null;
}

function ConversationProbe() {
  useConversationState();
  conversationRender();
  return null;
}

function ContextRenderProbe() {
  const dispatch = useAppDispatch();

  return (
    <>
      <SessionProbe />
      <ChatListProbe />
      <ConversationProbe />
      <button
        onClick={() => dispatch({ type: 'connect', payload: credentials })}
        type="button"
      >
        Update session
      </button>
      <button
        onClick={() =>
          dispatch({
            type: 'add-message',
            payload: {
              id: 'message-1',
              chatId: 'chat-1',
              direction: 'outgoing',
              text: 'Привет',
              timestamp: 1,
              status: 'sending',
            },
          })
        }
        type="button"
      >
        Add message
      </button>
    </>
  );
}

describe('AppProvider credential persistence', () => {
  it('restores a selected instance from localStorage', () => {
    window.localStorage.setItem(
      SELECTED_INSTANCE_STORAGE_KEY,
      JSON.stringify(credentials),
    );

    renderProvider();

    expect(screen.getByTestId('connection')).toHaveTextContent('connected');
    expect(screen.getByTestId('instance-id')).toHaveTextContent(credentials.idInstance);
  });

  it('stores credentials on connect and removes them on disconnect', async () => {
    const user = userEvent.setup();
    renderProvider();

    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(window.localStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY)).toBe(
      JSON.stringify(credentials),
    );

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(window.localStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('connection')).toHaveTextContent('disconnected');
  });

  it('rerenders only consumers of the changed state slice', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ContextRenderProbe />
      </AppProvider>,
    );
    sessionRender.mockClear();
    chatListRender.mockClear();
    conversationRender.mockClear();

    await user.click(screen.getByRole('button', { name: 'Update session' }));

    expect(sessionRender).toHaveBeenCalledOnce();
    expect(chatListRender).not.toHaveBeenCalled();
    expect(conversationRender).not.toHaveBeenCalled();

    sessionRender.mockClear();
    await user.click(screen.getByRole('button', { name: 'Add message' }));

    expect(sessionRender).not.toHaveBeenCalled();
    expect(chatListRender).not.toHaveBeenCalled();
    expect(conversationRender).toHaveBeenCalledOnce();
  });
});
