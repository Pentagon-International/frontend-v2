import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  chatApi,
  CHAT_URL_SESSION_PARAM,
  CHAT_URL_TYPE_PARAM,
  chatModeFromUrlParam,
  chatTypeParam,
  handleChatApiError,
  resolveChatModeFromUrl,
  sessionIdForApi,
  type ChatMode,
} from "./chatApi";
import {
  navigateFromChatReferences,
  type ChatReferences,
  type ReferenceLinkTarget,
} from "./chatReferenceNavigation";
import {
  mergeSessionMessages,
  normalizeAssistantMessage,
  sleep,
} from "./chatbotMessageUtils";
import { useIsAdminUser } from "../../hooks/useIsAdminUser";
import {
  hasAnalyticsStructuredBlocks,
  parseAnalyticsChatData,
  toAnalyticsMessagePayload,
  type AnalyticsMessagePayload,
} from "./analyticsChatTypes";
import { useOperationsChatSessionStore } from "./operationsChatSessionStore";

export type UseChatSessionsOptions = {
  /** Fixed mode (e.g. global modal — operations only). */
  lockMode?: ChatMode;
  /** Sync type/session_id to URL search params. Disable in embedded modal. */
  syncUrl?: boolean;
  /** Share operations session id in memory until reload/login. */
  usePersistedSession?: boolean;
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  references?: ChatReferences;
  /** Analytics structured blocks from POST /chat/message (not used for operations). */
  analytics?: AnalyticsMessagePayload;
}

export interface ChatSession {
  id: string;
  label: string;
  messages: ChatMessage[];
  createdAt: Date;
}

type ModeSlice = {
  sessions: ChatSession[];
  activeSessionId: string | null;
};

const emptyModeSlice = (): ModeSlice => ({
  sessions: [],
  activeSessionId: null,
});

const WELCOME_MSG = (id: string): ChatMessage => ({
  id: `welcome-${id}`,
  role: "assistant",
  content: "Hello! I'm your Pulse AI assistant. How can I help you today?",
  timestamp: new Date(),
});

const historyKey = (mode: ChatMode, sessionId: string) => `${mode}:${sessionId}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapOperationsSessions = (rows: any[]): ChatSession[] =>
  rows.map((row) => {
    const id = String(row.id);
    return {
      id,
      label: row.title || `Session ${row.id}`,
      messages: [WELCOME_MSG(id)],
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAnalyticsSessions = (rows: any[]): ChatSession[] =>
  rows.map((row) => {
    const id = String(row.session_id ?? row.id);
    return {
      id,
      label: row.title || row.preview || "New Chat",
      messages: [WELCOME_MSG(id)],
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  });

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
  id?: number;
  created_at?: string;
  timestamp?: string;
  references?: unknown;
};

const parseHistoryItems = (_mode: ChatMode, data: unknown): HistoryItem[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = data as any;
  if (Array.isArray(payload)) return payload as HistoryItem[];
  const messages = payload?.messages;
  return Array.isArray(messages) ? (messages as HistoryItem[]) : [];
};

const parseCreatedSessionId = (mode: ChatMode, res: { data?: unknown }): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = res.data as any;
  const data = payload?.data ?? payload;
  if (mode === "analytics") {
    const sid = data?.session_id ?? data?.id;
    return sid != null ? String(sid) : null;
  }
  const id = data?.id;
  return id != null ? String(id) : null;
};

const readSearchParamsFromLocation = () => new URLSearchParams(window.location.search);

const readChatModeFromLocation = (): ChatMode =>
  chatModeFromUrlParam(readSearchParamsFromLocation().get(CHAT_URL_TYPE_PARAM));

const readSessionIdFromLocation = (): string | null => {
  const value = readSearchParamsFromLocation().get(CHAT_URL_SESSION_PARAM);
  return value?.trim() ? value.trim() : null;
};

const resolveActiveSessionId = (
  mode: ChatMode,
  mapped: ChatSession[],
  opts: { syncUrl: boolean; usePersistedSession: boolean },
): string | null => {
  if (mapped.length === 0) return null;

  if (mode === "operations" && opts.usePersistedSession) {
    const urlId = opts.syncUrl ? readSessionIdFromLocation() : null;
    if (urlId && mapped.some((s) => s.id === urlId)) return urlId;
    const stored = useOperationsChatSessionStore.getState().sessionId;
    if (stored && mapped.some((s) => s.id === stored)) return stored;
    return mapped[0].id;
  }

  const urlSessionId = opts.syncUrl ? readSessionIdFromLocation() : null;
  if (urlSessionId && mapped.some((s) => s.id === urlSessionId)) return urlSessionId;
  return mapped[0].id;
};

export const useChatSessions = (options: UseChatSessionsOptions = {}) => {
  const { lockMode, syncUrl = true, usePersistedSession = false } = options;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStaffAdmin = useIsAdminUser();
  const initialMode = lockMode ?? readChatModeFromLocation();
  const [chatMode, setChatMode] = useState<ChatMode>(initialMode);
  const [modeStates, setModeStates] = useState<Record<ChatMode, ModeSlice>>({
    operations: emptyModeSlice(),
    analytics: emptyModeSlice(),
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [historyLoadingKey, setHistoryLoadingKey] = useState<string | null>(null);

  const historyLoaded = useRef<Set<string>>(new Set());
  const historyRequestId = useRef<Record<string, number>>({});
  const sessionsFetchIdRef = useRef(0);
  const activeSessionIdRef = useRef<string | null>(null);
  const chatModeRef = useRef<ChatMode>(initialMode);
  const urlSyncReady = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const modeStatesRef = useRef(modeStates);
  modeStatesRef.current = modeStates;

  const syncChatUrlParams = useCallback(
    (mode: ChatMode, sessionId: string | null, replace = true) => {
      if (!optionsRef.current.syncUrl) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          let changed = false;

          if (prev.get(CHAT_URL_TYPE_PARAM) !== mode) {
            next.set(CHAT_URL_TYPE_PARAM, mode);
            changed = true;
          }

          if (sessionId) {
            if (prev.get(CHAT_URL_SESSION_PARAM) !== sessionId) {
              next.set(CHAT_URL_SESSION_PARAM, sessionId);
              changed = true;
            }
          } else if (prev.has(CHAT_URL_SESSION_PARAM)) {
            next.delete(CHAT_URL_SESSION_PARAM);
            changed = true;
          }

          return changed ? next : prev;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const persistOperationsSessionId = useCallback((sessionId: string | null) => {
    if (optionsRef.current.usePersistedSession && sessionId) {
      useOperationsChatSessionStore.getState().setSessionId(sessionId);
    }
  }, []);

  const { sessions, activeSessionId } = modeStates[chatMode];
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const patchMode = useCallback((mode: ChatMode, patch: Partial<ModeSlice>) => {
    setModeStates((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], ...patch },
    }));
  }, []);

  const applySessionSelection = useCallback(
    (mode: ChatMode, sessionId: string | null) => {
      activeSessionIdRef.current = sessionId;
      patchMode(mode, { activeSessionId: sessionId });
      if (sessionId) {
        syncChatUrlParams(mode, sessionId);
        persistOperationsSessionId(sessionId);
      } else {
        syncChatUrlParams(mode, null);
      }
    },
    [patchMode, syncChatUrlParams, persistOperationsSessionId],
  );

  const updateSessions = useCallback(
    (mode: ChatMode, updater: (prev: ChatSession[]) => ChatSession[]) => {
      setModeStates((prev) => ({
        ...prev,
        [mode]: {
          ...prev[mode],
          sessions: updater(prev[mode].sessions),
        },
      }));
    },
    [],
  );

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    chatModeRef.current = chatMode;
  }, [activeSessionId, chatMode]);

  const fetchHistory = useCallback(
    async (mode: ChatMode, sessionId: string, force = false) => {
      const hk = historyKey(mode, sessionId);
      if (!force && historyLoaded.current.has(hk)) return;

      const requestId = (historyRequestId.current[hk] ?? 0) + 1;
      historyRequestId.current[hk] = requestId;
      setHistoryLoadingKey(hk);

      try {
        const res = await chatApi.get("/chat/history", {
          params: { ...chatTypeParam(mode), session_id: sessionIdForApi(mode, sessionId) },
        });

        const items = parseHistoryItems(mode, res.data?.data);

        if (items.length === 0) {
          historyLoaded.current.add(hk);
          return;
        }

        const historyMessages: ChatMessage[] = items
          .map((item, idx) => {
            const { content: display, references: refs } = normalizeAssistantMessage(
              item.content,
              item.role === "assistant" ? item.references : undefined,
            );
            if (!display) return null;
            const ts = item.timestamp ?? item.created_at;
            return {
              id: item.id != null ? String(item.id) : `history-${idx}`,
              role: item.role,
              content: display,
              timestamp: ts ? new Date(ts) : new Date(),
              references: item.role === "assistant" ? refs : undefined,
            };
          })
          .filter((m): m is ChatMessage => m !== null);

        if (historyMessages.length === 0) {
          historyLoaded.current.add(hk);
          return;
        }

        if (historyRequestId.current[hk] !== requestId) return;

        updateSessions(mode, (prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: mergeSessionMessages(s.messages, historyMessages) }
              : s,
          ),
        );
        historyLoaded.current.add(hk);
      } catch {
        // session still usable without history
      } finally {
        if (historyRequestId.current[hk] === requestId) {
          setHistoryLoadingKey((cur) => (cur === hk ? null : cur));
        }
      }
    },
    [updateSessions],
  );

  const activateSession = useCallback(
    (mode: ChatMode, sessionId: string, loadHistory = true) => {
      applySessionSelection(mode, sessionId);
      if (loadHistory) {
        void fetchHistory(mode, sessionId, true);
      }
    },
    [fetchHistory, applySessionSelection],
  );

  const createOperationsSession = useCallback(async (): Promise<string | null> => {
    try {
      const res = await chatApi.post(
        "/chat/session",
        { title: "New Chat" },
        { params: chatTypeParam("operations") },
      );
      const newId = parseCreatedSessionId("operations", res);
      if (!newId) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (res.data as any)?.data ?? res.data;
      const title = data?.title ?? "New Chat";
      const newSession: ChatSession = {
        id: newId,
        label: title,
        messages: [WELCOME_MSG(newId)],
        createdAt: new Date(),
      };

      updateSessions("operations", (prev) => [newSession, ...prev]);
      applySessionSelection("operations", newId);
      historyLoaded.current.delete(historyKey("operations", newId));
      await fetchHistory("operations", newId, true);
      return newId;
    } catch {
      return null;
    }
  }, [applySessionSelection, fetchHistory, updateSessions]);

  const fetchSessions = useCallback(
    async (mode: ChatMode) => {
      const fetchId = ++sessionsFetchIdRef.current;
      setSessionsLoading(true);

      try {
        const res = await chatApi.get("/chat/sessions", {
          params: chatTypeParam(mode),
        });
        if (fetchId !== sessionsFetchIdRef.current || mode !== chatModeRef.current) return;

        const rows = res.data?.data ?? [];
        const mapped =
          mode === "analytics"
            ? mapAnalyticsSessions(Array.isArray(rows) ? rows : [])
            : mapOperationsSessions(Array.isArray(rows) ? rows : []);

        patchMode(mode, { sessions: mapped });

        const opts = {
          syncUrl: optionsRef.current.syncUrl !== false,
          usePersistedSession: Boolean(optionsRef.current.usePersistedSession),
        };

        if (mapped.length > 0) {
          const refId = activeSessionIdRef.current;
          const activeId =
            refId && mapped.some((s) => s.id === refId)
              ? refId
              : resolveActiveSessionId(mode, mapped, opts);
          if (activeId) {
            applySessionSelection(mode, activeId);
            await fetchHistory(mode, activeId, true);
          }
        } else if (mode === "operations" && opts.usePersistedSession) {
          await createOperationsSession();
        } else {
          applySessionSelection(mode, null);
        }
      } catch {
        // silently fail
      } finally {
        if (fetchId === sessionsFetchIdRef.current && mode === chatModeRef.current) {
          setSessionsLoading(false);
        }
      }
    },
    [fetchHistory, patchMode, applySessionSelection, createOperationsSession],
  );

  const loadMode = useCallback(
    (mode: ChatMode) => {
      historyLoaded.current.clear();
      historyRequestId.current = {};
      fetchSessions(mode);
    },
    [fetchSessions],
  );

  useEffect(() => {
    if (lockMode) {
      setChatMode(lockMode);
      chatModeRef.current = lockMode;
      loadMode(lockMode);
      urlSyncReady.current = true;
      return () => {
        sessionsFetchIdRef.current += 1;
      };
    }

    const mode = resolveChatModeFromUrl(searchParams.get(CHAT_URL_TYPE_PARAM), isStaffAdmin);
    setChatMode(mode);
    chatModeRef.current = mode;
    loadMode(mode);
    if (syncUrl) {
      syncChatUrlParams(mode, readSessionIdFromLocation());
    }
    urlSyncReady.current = true;
    return () => {
      sessionsFetchIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount: restore mode from URL once
  }, []);

  useEffect(() => {
    if (!urlSyncReady.current || !syncUrl || lockMode) return;
    const urlMode = resolveChatModeFromUrl(searchParams.get(CHAT_URL_TYPE_PARAM), isStaffAdmin);
    if (urlMode !== chatModeRef.current) {
      setChatMode(urlMode);
      chatModeRef.current = urlMode;
      setInput("");
      loadMode(urlMode);
      return;
    }

    const urlSessionId = searchParams.get(CHAT_URL_SESSION_PARAM)?.trim() || null;
    if (!urlSessionId || urlSessionId === activeSessionIdRef.current) return;

    const slice = modeStatesRef.current[urlMode];
    if (!slice.sessions.some((s) => s.id === urlSessionId)) return;

    activateSession(urlMode, urlSessionId);
    // Intentionally omit modeStates — including it re-ran this effect after
    // sidebar select (state updated before URL), reverting to the stale session_id.
  }, [searchParams, isStaffAdmin, loadMode, lockMode, syncUrl, activateSession]);

  const handleChatModeChange = useCallback(
    (mode: ChatMode) => {
      if (mode === "analytics" && !isStaffAdmin) return;
      if (mode === chatMode) return;
      setChatMode(mode);
      chatModeRef.current = mode;
      setInput("");
      syncChatUrlParams(mode, readSessionIdFromLocation());
      loadMode(mode);
    },
    [chatMode, loadMode, isStaffAdmin, syncChatUrlParams],
  );

  useEffect(() => {
    if (lockMode) return;
    if (chatMode === "analytics" && !isStaffAdmin) {
      setChatMode("operations");
      chatModeRef.current = "operations";
      syncChatUrlParams("operations", readSessionIdFromLocation());
      loadMode("operations");
    }
  }, [chatMode, isStaffAdmin, loadMode, lockMode, syncChatUrlParams]);

  const handleNewSession = useCallback(async () => {
    const mode = chatModeRef.current;
    setSessionCreating(true);
    try {
      const res = await chatApi.post(
        "/chat/session",
        { title: "New Chat" },
        { params: chatTypeParam(mode) },
      );
      const newId = parseCreatedSessionId(mode, res);
      if (!newId) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (res.data as any)?.data ?? res.data;
      const title = data?.title ?? "New Chat";
      const newSession: ChatSession = {
        id: newId,
        label: title,
        messages: [WELCOME_MSG(newId)],
        createdAt: new Date(),
      };

      updateSessions(mode, (prev) => [newSession, ...prev]);
      applySessionSelection(mode, newId);
      setInput("");
      historyLoaded.current.delete(historyKey(mode, newId));
    } catch {
      // no local-* fallback for operations or analytics
    } finally {
      setSessionCreating(false);
    }
  }, [patchMode, updateSessions, applySessionSelection]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const mode = chatModeRef.current;
      try {
        await chatApi.delete("/chat/session", {
          params: chatTypeParam(mode),
          data: { session_id: sessionIdForApi(mode, sessionId) },
        });
      } catch {
        // proceed with local removal
      }

      let nextActiveId: string | null = null;
      setModeStates((prev) => {
        const slice = prev[mode];
        const remaining = slice.sessions.filter((s) => s.id !== sessionId);
        nextActiveId =
          slice.activeSessionId === sessionId
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : slice.activeSessionId;
        return {
          ...prev,
          [mode]: { sessions: remaining, activeSessionId: nextActiveId },
        };
      });
      applySessionSelection(mode, nextActiveId);
      historyLoaded.current.delete(historyKey(mode, sessionId));
    },
    [applySessionSelection],
  );

  const sendMessage = useCallback(async () => {
    const mode = chatModeRef.current;
    const trimmed = input.trim();
    if (!trimmed || loading || !activeSessionIdRef.current) return;

    let sessionId = activeSessionIdRef.current;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    updateSessions(mode, (prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s,
      ),
    );
    setInput("");
    setLoading(true);

    try {
      const res = await chatApi.post(
        "/chat/message",
        {
          session_id: sessionIdForApi(mode, sessionId),
          message: trimmed,
        },
        { params: chatTypeParam(mode) },
      );

      const data = res.data?.data;
      const returnedSessionId = data?.session_id ?? data?.id;
      if (returnedSessionId != null) {
        const newId = String(returnedSessionId);
        if (newId !== sessionId) {
          updateSessions(mode, (prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, id: newId } : s)),
          );
          historyLoaded.current.delete(historyKey(mode, sessionId));
          sessionId = newId;
          applySessionSelection(mode, newId);
        }
      }

      const title = data?.title;
      if (typeof title === "string" && title.trim()) {
        updateSessions(mode, (prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, label: title.trim() } : s)),
        );
      }

      const rawReply: string =
        data?.reply ??
        data?.message ??
        res.data?.reply ??
        res.data?.message ??
        res.data?.response ??
        "";

      const { content: reply, references } = normalizeAssistantMessage(
        rawReply,
        data?.references,
      );

      if (mode === "analytics") {
        const analyticsData = parseAnalyticsChatData(data);
        const hasStructured = hasAnalyticsStructuredBlocks(analyticsData);
        const hasDisplayText = Boolean(reply?.trim());

        if (!hasDisplayText && !hasStructured) {
          for (let attempt = 0; attempt < 3; attempt++) {
            await sleep(400 * (attempt + 1));
            await fetchHistory(mode, sessionId, true);
          }
          return;
        }

        const analyticsPayload = toAnalyticsMessagePayload(analyticsData);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply ?? "",
          timestamp: new Date(),
          references,
          ...(analyticsPayload ? { analytics: analyticsPayload } : {}),
        };

        updateSessions(mode, (prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s,
          ),
        );
        return;
      }

      if (!reply) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await sleep(400 * (attempt + 1));
          await fetchHistory(mode, sessionId, true);
        }
        return;
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
        references,
      };

      updateSessions(mode, (prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s,
        ),
      );
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: handleChatApiError(err),
        timestamp: new Date(),
      };
      updateSessions(mode, (prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, fetchHistory, patchMode, updateSessions, applySessionSelection]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      activateSession(chatModeRef.current, sessionId);
    },
    [activateSession],
  );

  const historyLoading =
    activeSessionId != null &&
    historyLoadingKey === historyKey(chatMode, activeSessionId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReferenceLinkClick = useCallback(
    async (target: ReferenceLinkTarget, refs: ChatReferences) => {
      await navigateFromChatReferences(target, refs, navigate);
    },
    [navigate],
  );

  return {
    chatMode,
    setChatMode: handleChatModeChange,
    sessions,
    activeSessionId,
    activeSession,
    input,
    setInput,
    loading,
    sessionCreating,
    sessionsLoading,
    historyLoading,
    viewport,
    sendMessage,
    handleKeyDown,
    handleNewSession,
    handleDeleteSession,
    handleSelectSession,
    handleReferenceLinkClick,
  };
};
