import { FC, ReactNode, RefObject, useEffect } from "react";
import {
  Box,
  Text,
  Textarea,
  ActionIcon,
  ScrollArea,
  Paper,
  Group,
  Avatar,
  Loader,
  Stack,
  Button,
  Tooltip,
  Badge,
  Drawer,
  Burger,
  Center,
  SegmentedControl,
} from "@mantine/core";
import type { ChatMode } from "./chatApi";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconRobot,
  IconUser,
  IconPlus,
  IconTrash,
  IconMessage,
  IconSend,
} from "@tabler/icons-react";
import styles from "./Chatbot.module.css";
import type { ChatReferences } from "./chatbotMessageUtils";
import type { ReferenceLinkTarget } from "./chatReferenceNavigation";
import type { AnalyticsMessagePayload } from "./analyticsChatTypes";
import { useIsAdminUser } from "../../hooks/useIsAdminUser";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { AssistantAnalyticsMessage } from "./AssistantAnalyticsMessage";

export interface ChatbotUiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  references?: ChatReferences;
  analytics?: AnalyticsMessagePayload;
}

export interface ChatbotUiSession {
  id: string;
  label: string;
  createdAt: Date;
  messages: ChatbotUiMessage[];
}

export interface ChatbotPageUiProps {
  subtitle: string;
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
  sessions: ChatbotUiSession[];
  activeSessionId: string | null;
  activeSession: ChatbotUiSession | null;
  sessionsLoading: boolean;
  historyLoading: boolean;
  loading: boolean;
  sessionCreating: boolean;
  input: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onSendMessage: () => void;
  onReferenceLinkClick?: (
    target: ReferenceLinkTarget,
    refs: ChatReferences,
  ) => void;
  voiceBanner?: ReactNode;
  inputListening?: boolean;
  inputPlaceholder?: string;
  micButton: ReactNode;
  /** Embedded drawer/modal: hide sidebar and mode switch. */
  compact?: boolean;
  hideModeSelector?: boolean;
}

export const ChatbotPageUi: FC<ChatbotPageUiProps> = ({
  subtitle,
  chatMode = "operations",
  onChatModeChange,
  compact = false,
  hideModeSelector = false,
  sessions,
  activeSessionId,
  activeSession,
  sessionsLoading,
  historyLoading,
  loading,
  sessionCreating,
  input,
  viewportRef,
  onInputChange,
  onKeyDown,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSendMessage,
  onReferenceLinkClick,
  voiceBanner,
  inputListening = false,
  inputPlaceholder = "Type a message… (Enter to send)",
  micButton,
}) => {
  const isStaffAdmin = useIsAdminUser();
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const [sidebarOpened, { open: openSidebar, close: closeSidebar }] =
    useDisclosure(false);

  const selectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    if (isMobile) closeSidebar();
  };

  // Scroll after messages render (markdown/history) — fixes first-load clipped replies
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    };

    scrollToBottom("auto");
    const raf = requestAnimationFrame(() => {
      scrollToBottom("auto");
      requestAnimationFrame(() => scrollToBottom("smooth"));
    });
    const t1 = window.setTimeout(() => scrollToBottom("smooth"), 80);
    const t2 = window.setTimeout(() => scrollToBottom("smooth"), 200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    activeSession?.messages,
    activeSession?.messages?.length,
    historyLoading,
    loading,
    activeSessionId,
    viewportRef,
  ]);

  const renderSessionsPanel = () => (
    <>
      <Box p="sm" className={styles.sidebarHeader}>
        <Group justify="space-between" align="center">
          <Text fw={600} fz="sm" c="var(--text-primary, #1E293B)">
            Sessions
          </Text>
          <Tooltip label="New session">
            <ActionIcon
              size="sm"
              variant="light"
              color="blue"
              onClick={onNewSession}
              loading={sessionCreating}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        {sessionsLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : sessions.length === 0 ? (
          <Center py="xl" px="md">
            <Text fz="xs" c="dimmed" ta="center">
              No sessions yet. Create one to start chatting.
            </Text>
          </Center>
        ) : (
          <Stack gap={4} p="xs">
            {sessions.map((session) => (
              <Group
                key={session.id}
                gap={6}
                p="xs"
                wrap="nowrap"
                className={`${styles.sessionItem} ${
                  activeSessionId === session.id ? styles.sessionItemActive : ""
                }`}
                onClick={() => selectSession(session.id)}
              >
                <IconMessage
                  size={18}
                  color="var(--text-secondary, #64748B)"
                  style={{ flexShrink: 0 }}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fz="sm" truncate fw={activeSessionId === session.id ? 600 : 400}>
                    {session.label}
                  </Text>
                  <Text fz={10} c="dimmed" truncate>
                    {session.createdAt.toLocaleDateString()}
                  </Text>
                </Box>
                {sessions.length > 1 && (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    style={{ flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </ScrollArea>

      <Box p="xs" className={styles.sidebarFooter}>
        <Button
          fullWidth
          size="xs"
          variant="light"
          color="blue"
          leftSection={<IconPlus size={12} />}
          onClick={onNewSession}
          loading={sessionCreating}
        >
          New Session
        </Button>
      </Box>
    </>
  );

  const showModeSelector = !hideModeSelector && onChatModeChange && isStaffAdmin;
  const showSidebar = !compact;

  return (
    <Box className={compact ? styles.rootEmbedded : styles.root}>
      {!compact && (
      <Box className={styles.pageHeader}>
        <Box className={styles.pageTitleRow}>
          {isMobile && showSidebar && (
            <Burger
              opened={sidebarOpened}
              onClick={openSidebar}
              size="sm"
              aria-label="Open sessions"
            />
          )}
          <Box className={styles.pageIcon}>
            <IconRobot size={22} stroke={1.5} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text component="h1" className={styles.pageTitle}>
              Pulse AI Assistant
            </Text>
            <Text className={styles.pageSubtitle}>{subtitle}</Text>
          </Box>
        </Box>
        <Box className={styles.headerActions}>
          {activeSession && (
            <Badge variant="light" color="blue" size="md">
              <Text span truncate inherit>
                {activeSession.label}
              </Text>
            </Badge>
          )}
          {showModeSelector && (
            <SegmentedControl
              size="xs"
              value={chatMode}
              onChange={(v) => onChatModeChange(v as ChatMode)}
              data={[
                { label: "Operations", value: "operations" },
                { label: "Analytics", value: "analytics" },
              ]}
              className={styles.modeSelector}
            />
          )}
        </Box>
      </Box>
      )}

      <Box className={styles.layout}>
        {showSidebar && !isMobile && (
          <Paper withBorder className={styles.sidebar}>
            {renderSessionsPanel()}
          </Paper>
        )}

        {showSidebar && (
        <Drawer
          opened={Boolean(isMobile && sidebarOpened)}
          onClose={closeSidebar}
          title="Sessions"
          position="left"
          size="min(300px, 88vw)"
          padding="md"
          zIndex={200}
        >
          <Paper
            withBorder
            className={styles.sidebar}
            style={{ width: "100%", maxWidth: "none", height: "100%" }}
          >
            {renderSessionsPanel()}
          </Paper>
        </Drawer>
        )}

        <Box className={styles.chatMain}>
          <Paper withBorder className={styles.chatPanel}>
            <ScrollArea
              className={styles.messagesArea}
              viewportRef={viewportRef}
              type="auto"
              offsetScrollbars
            >
              <Box className={styles.messagesInner}>
                <Stack gap="lg">
                  {historyLoading && !loading && (
                    <Box className={styles.historyLoading}>
                      <Loader size="md" color="blue" />
                      <Text fz="sm" c="dimmed">
                        Loading conversation…
                      </Text>
                    </Box>
                  )}

                  {!historyLoading && !activeSessionId && !sessionsLoading && (
                    <Box className={styles.emptyState}>
                      <Stack align="center" gap="md">
                        <Box className={styles.emptyStateIcon}>
                          <IconMessage size={26} stroke={1.5} />
                        </Box>
                        <Text fw={500} c="var(--text-primary, #1E293B)">
                          Select or create a session
                        </Text>
                        <Text fz="sm" c="dimmed" maw={320}>
                          Use the sessions panel to start a new conversation with Pulse AI.
                        </Text>
                        {!compact && (
                          <Button
                            size="sm"
                            variant="light"
                            leftSection={<IconPlus size={14} />}
                            onClick={onNewSession}
                            loading={sessionCreating}
                          >
                            New Session
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  )}

                  {!historyLoading &&
                    activeSession?.messages.map((msg) =>
                    msg.role === "user" ? (
                      <Box
                        key={msg.id}
                        className={`${styles.messageRow} ${styles.messageRowUser}`}
                      >
                        <Box className={styles.messageContent}>
                          <Box className={styles.userBubble}>{msg.content}</Box>
                          <Text className={styles.messageTimestamp} ta="right">
                            {msg.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </Box>
                        <Avatar
                          color="gray"
                          radius="xl"
                          size="sm"
                          className={styles.messageAvatar}
                        >
                          <IconUser size={16} />
                        </Avatar>
                      </Box>
                    ) : (
                      <Box key={msg.id} className={styles.messageRow}>
                        <Avatar
                          color="blue"
                          radius="xl"
                          size="sm"
                          className={styles.messageAvatar}
                        >
                          <IconRobot size={16} />
                        </Avatar>
                        <Box className={styles.messageContent}>
                          <Box
                            className={`${styles.assistantBubble} ${styles.assistantBubbleCard}`}
                          >
                            <div className={styles.markdownBody}>
                              {msg.analytics ? (
                                <AssistantAnalyticsMessage
                                  content={msg.content}
                                  analytics={msg.analytics}
                                  references={msg.references}
                                  onReferenceLinkClick={onReferenceLinkClick}
                                />
                              ) : (
                                <AssistantMarkdown
                                  content={msg.content}
                                  references={msg.references}
                                  onReferenceLinkClick={onReferenceLinkClick}
                                />
                              )}
                            </div>
                          </Box>
                          <Text className={styles.messageTimestamp} ta="left">
                            {msg.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </Box>
                      </Box>
                    ),
                  )}

                  {loading && (
                    <Box className={styles.messageRow}>
                      <Avatar color="blue" radius="xl" size="sm" className={styles.messageAvatar}>
                        <IconRobot size={16} />
                      </Avatar>
                      <Box className={styles.messageContent}>
                        <Box className={styles.assistantBubbleCard}>
                          <Loader size="xs" color="blue" />
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Stack>
              </Box>
            </ScrollArea>

            <Box className={styles.inputArea}>
              <Box className={styles.composeOuter}>
                {voiceBanner}
                <Box
                  className={`${styles.composeBar} ${
                    inputListening ? styles.composeBarListening : ""
                  }`}
                >
                  <Box className={styles.textareaWrap}>
                    <Textarea
                      placeholder={inputPlaceholder}
                      value={input}
                      onChange={(e) => onInputChange(e.currentTarget.value)}
                      onKeyDown={onKeyDown}
                      disabled={loading || historyLoading || !activeSessionId}
                      autosize
                      minRows={1}
                      maxRows={5}
                      variant="unstyled"
                    />
                  </Box>
                  <Box className={styles.composeActions}>
                    {micButton}
                    <ActionIcon
                      size="lg"
                      radius="xl"
                      variant="filled"
                      className={styles.sendButton}
                      onClick={onSendMessage}
                      disabled={!input.trim() || loading || historyLoading || !activeSessionId}
                      aria-label="Send message"
                    >
                      <IconSend size={16} />
                    </ActionIcon>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};
