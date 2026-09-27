import { ConnectionPage } from '../pages/connection/ConnectionPage';
import { MessengerPage } from '../pages/messenger/MessengerPage';
import { useSessionState } from './useApp';

export function App() {
  const { connection } = useSessionState();

  return connection === 'disconnected' ? <ConnectionPage /> : <MessengerPage />;
}
