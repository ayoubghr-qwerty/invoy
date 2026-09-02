import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

const KeyboardActionsContext = createContext({
  actions: {},
  registerActions: () => {},
  unregisterActions: () => {},
});

export function KeyboardActionsProvider({ children }) {
  const actionsRef = useRef({});
  const latestRef = useRef({});
  const [, forceUpdate] = useState(0);

  const registerActions = useCallback((pageId, pageActions) => {
    latestRef.current = { ...latestRef.current, [pageId]: pageActions };
    actionsRef.current[pageId] = pageActions;
    forceUpdate((n) => n + 1);
  }, []);

  const unregisterActions = useCallback((pageId) => {
    delete actionsRef.current[pageId];
    delete latestRef.current[pageId];
    forceUpdate((n) => n + 1);
  }, []);

  return (
    <KeyboardActionsContext.Provider
      value={{
        actions: actionsRef.current,
        registerActions,
        unregisterActions,
      }}
    >
      {children}
    </KeyboardActionsContext.Provider>
  );
}

export function useKeyboardActions() {
  return useContext(KeyboardActionsContext);
}
