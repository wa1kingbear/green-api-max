import { ConnectionPage } from '../pages/connection/ConnectionPage';
import { MessengerPage } from '../pages/messenger/MessengerPage';
import { useApp } from './useApp';

export function App() {
  const { state } = useApp();

  return state.connection === 'disconnected' ? <ConnectionPage /> : <MessengerPage />;
}
