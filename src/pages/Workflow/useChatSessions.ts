import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  chatApi,
  chatTypeParam,
  handleChatApiError,
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  references?: ChatReferences;
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
    const id = String(row.session_id);
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

const parseHistoryItems = (mode: ChatMode, data: unknown): HistoryItem[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = data as any;
  if (mode === "analytics") {
    const messages = payload?.messages;
    return Array.isArray(messages) ? (messages as HistoryItem[]) : [];
  }
  return Array.isArray(payload) ? (payload as HistoryItem[]) : [];
};

const parseCreatedSessionId = (mode: ChatMode, res: { data?: unknown }): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = res.data as any;
  const data = payload?.data ?? payload;
  if (mode === "analytics") {
    const sid = data?.session_id;
    return sid != null ? String(sid) : null;
  }
  const id = data?.id;
  return id != null ? String(id) : null;
};

export const useChatSessions = () => {
  const navigate = useNavigate();
  const isStaffAdmin = useIsAdminUser();
  const [chatMode, setChatMode] = useState<ChatMode>("operations");
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
  const chatModeRef = useRef<ChatMode>("operations");
  const viewport = useRef<HTMLDivElement>(null);

  const { sessions, activeSessionId } = modeStates[chatMode];
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const patchMode = useCallback((mode: ChatMode, patch: Partial<ModeSlice>) => {
    setModeStates((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], ...patch },
    }));
  }, []);

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

        if (mapped.length > 0) {
          const firstId = mapped[0].id;
          activeSessionIdRef.current = firstId;
          patchMode(mode, { activeSessionId: firstId });
          await fetchHistory(mode, firstId, true);
        } else {
          patchMode(mode, { activeSessionId: null });
        }
      } catch {
        // silently fail
      } finally {
        if (fetchId === sessionsFetchIdRef.current && mode === chatModeRef.current) {
          setSessionsLoading(false);
        }
      }
    },
    [fetchHistory, patchMode],
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
    loadMode("operations");
    return () => {
      sessionsFetchIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial operations load only
  }, []);

  const handleChatModeChange = useCallback(
    (mode: ChatMode) => {
      if (mode === "analytics" && !isStaffAdmin) return;
      if (mode === chatMode) return;
      setChatMode(mode);
      setInput("");
      loadMode(mode);
    },
    [chatMode, loadMode, isStaffAdmin],
  );

  useEffect(() => {
    if (chatMode === "analytics" && !isStaffAdmin) {
      setChatMode("operations");
      loadMode("operations");
    }
  }, [chatMode, isStaffAdmin, loadMode]);

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
      patchMode(mode, { activeSessionId: newId });
      setInput("");
      historyLoaded.current.delete(historyKey(mode, newId));
    } catch {
      // no local-* fallback for operations or analytics
    } finally {
      setSessionCreating(false);
    }
  }, [patchMode, updateSessions]);

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

      setModeStates((prev) => {
        const slice = prev[mode];
        const remaining = slice.sessions.filter((s) => s.id !== sessionId);
        const nextActive =
          slice.activeSessionId === sessionId
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : slice.activeSessionId;
        return {
          ...prev,
          [mode]: { sessions: remaining, activeSessionId: nextActive },
        };
      });
      historyLoaded.current.delete(historyKey(mode, sessionId));
    },
    [],
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
      const returnedSessionId = data?.session_id;
      if (returnedSessionId != null) {
        const newId = String(returnedSessionId);
        if (newId !== sessionId) {
          updateSessions(mode, (prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, id: newId } : s)),
          );
          historyLoaded.current.delete(historyKey(mode, sessionId));
          sessionId = newId;
          patchMode(mode, { activeSessionId: newId });
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
  }, [input, loading, fetchHistory, patchMode, updateSessions]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      const mode = chatModeRef.current;
      activeSessionIdRef.current = sessionId;
      patchMode(mode, { activeSessionId: sessionId });
      fetchHistory(mode, sessionId, true);
    },
    [fetchHistory, patchMode],
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
