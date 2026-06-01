import { create } from "zustand";

/** In-memory operations session (cleared on reload, login, or logout). */
type OperationsChatSessionState = {
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
};

export const useOperationsChatSessionStore = create<OperationsChatSessionState>((set) => ({
  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),
}));

export const resetOperationsChatSession = () => {
  useOperationsChatSessionStore.setState({ sessionId: null });
};
