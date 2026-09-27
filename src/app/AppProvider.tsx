import {
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useMemo,
  useReducer,
} from 'react';

import {
  clearSelectedInstance,
  loadSelectedInstance,
  saveSelectedInstance,
} from '../shared/lib/selectedInstanceStorage';
import { AppContext } from './appContext';
import { type AppAction, type AppState, initialAppState } from './model';
import { appReducer } from './reducer';

function restoreAppState(defaultState: AppState): AppState {
  const credentials = loadSelectedInstance();

  if (!credentials) {
    return defaultState;
  }

  return {
    ...defaultState,
    connection: 'connected',
    credentials,
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [state, reducerDispatch] = useReducer(
    appReducer,
    initialAppState,
    restoreAppState,
  );
  const dispatch = useCallback<Dispatch<AppAction>>((action) => {
    if (action.type === 'connect') {
      saveSelectedInstance(action.payload);
    } else if (action.type === 'disconnect') {
      clearSelectedInstance();
    }

    reducerDispatch(action);
  }, []);
  const value = useMemo(() => ({ state, dispatch }), [dispatch, state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
