import { FC, ReactNode, RefObject, useEffect, useState } from "react";
import {
  Box,
  Text,
  Textarea,
  ActionIcon,
  ScrollArea,
  Group,
  Avatar,
  Loader,
  Stack,
  Button,
  Tooltip,
  Drawer,
  Center,
  SegmentedControl,
  UnstyledButton,
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
  IconLayoutSidebar,
  IconInfoCircle,
} from "@tabler/icons-react";
import styles from "./Chatbot.module.css";
import type { ChatReferences } from "./chatbotMessageUtils";
import type { ReferenceLinkTarget } from "./chatReferenceNavigation";
import type { AnalyticsMessagePayload } from "./analyticsChatTypes";
import { useIsAdminUser } from "../../hooks/useIsAdminUser";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { AssistantAnalyticsMessage } from "./AssistantAnalyticsMessage";
import {
  AnalyticsMemoryPanel,
  AnalyticsTrainPanel,
  type AnalyticsAdminView,
} from "./analytics/AnalyticsAdminPanels";

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
  /** Extra controls in page header (e.g. analytics status pill). */
  headerExtra?: ReactNode;
}

export const ChatbotPageUi: FC<ChatbotPageUiProps> = ({
  subtitle,
  chatMode = "operations",
  onChatModeChange,
  compact = false,
  hideModeSelector = false,
  headerExtra,
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
  const [mobileSidebarOpened, { open: openMobileSidebar, close: closeMobileSidebar }] =
    useDisclosure(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsAdminView>("chat");

  const selectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    if (isMobile) closeMobileSidebar();
  };

  useEffect(() => {
    if (chatMode !== "analytics") setAnalyticsView("chat");
  }, [chatMode]);

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

  const showModeSelector = !hideModeSelector && onChatModeChange && isStaffAdmin;
  const showAnalyticsSubNav = !compact && chatMode === "analytics" && isStaffAdmin;
  const showAdminPanel = showAnalyticsSubNav && analyticsView !== "chat";
  const showSidebar = !compact;
  const sidebarVisible = showSidebar && (isMobile ? false : desktopSidebarOpen);

  const toggleSidebar = () => {
    if (isMobile) {
      openMobileSidebar();
    } else {
      setDesktopSidebarOpen((v) => !v);
    }
  };

  const renderSidebarContent = () => (
    <>
      <Box className={styles.sidebarTop}>
        <Group gap="sm" wrap="nowrap">
          <Box className={styles.sidebarLogo}>
            <IconRobot size={20} stroke={1.5} />
          </Box>
          <Text fw={600} fz="sm" className={styles.sidebarTitle}>
            Pulse AI
          </Text>
        </Group>
      </Box>
      <Box px="sm" py="xs" my="xs">
        <Button
          fullWidth
          size="sm"
          variant="default"
          leftSection={<IconPlus size={16} />}
          onClick={onNewSession}
          loading={sessionCreating}
          className={styles.newChatBtn}
        >
          New chat
        </Button>
      </Box>

      <Box px="sm" py="xs" mt="sm" mb="xs">
        <Text fz="sm" c="dimmed" tt="uppercase" fw={600}>
          Recent Chats
        </Text>
      </Box>

      <ScrollArea scrollbarSize={8} className={styles.sidebarSessions} type="auto" offsetScrollbars>
        {sessionsLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : sessions.length === 0 ? (
          <Center py="xl" px="md">
            <Text fz="xs" c="dimmed" ta="center">
              No chats yet
            </Text>
          </Center>
        ) : (
          <Stack gap={2} p="xs">
            {sessions.map((session) => (
              <UnstyledButton
                key={session.id}
                className={`${styles.sessionItem} ${
                  activeSessionId === session.id ? styles.sessionItemActive : ""
                }`}
                onClick={() => selectSession(session.id)}
              >
                <Group gap={8} wrap="nowrap" w="100%">
                  <IconMessage size={16} className={styles.sessionIcon} />
                  <Text fz="sm" truncate fw={activeSessionId === session.id ? 600 : 400} style={{ flex: 1 }}>
                    {session.label}
                  </Text>
                  {sessions.length > 1 && (
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      className={styles.sessionDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                    >
                      <IconTrash size={14} color="red" />
                    </ActionIcon>
                  )}
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </>
  );

  const renderChatMessages = () => (
    <>
      <ScrollArea
        scrollbarSize={8}
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
                    <IconRobot size={28} stroke={1.5} />
                  </Box>
                  <Text fw={600} fz="lg" c="var(--text-primary, #1E293B)">
                    How can I help you today?
                  </Text>
                  <Text fz="sm" c="dimmed" maw={360} ta="center">
                    {subtitle}
                  </Text>
                  {!compact && (
                    <Button
                      size="sm"
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={onNewSession}
                      loading={sessionCreating}
                    >
                      New chat
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
          <Box style={{display: "flex", alignItems: "center", justifyContent: "center", gap:4, marginTop: 8}}>
            <IconInfoCircle size={12} color="#222222" />
            <Text fz="xs" c="dimmed" ta="center">
              Chatbot is in early access and may occasionally produce incorrect or nonsensical answers. Always verify critical information.
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );

  const renderMainContent = () => {
    if (showAdminPanel) {
      return (
        <ScrollArea scrollbarSize={8} className={styles.adminScrollArea} type="auto" offsetScrollbars>
          {analyticsView === "train" ? <AnalyticsTrainPanel /> : <AnalyticsMemoryPanel />}
        </ScrollArea>
      );
    }
    return <Box className={styles.chatPanel}>{renderChatMessages()}</Box>;
  };

  if (compact) {
    return (
      <Box className={styles.rootEmbedded}>
        <Box className={styles.mainColumn}>
          <Box className={styles.mainBody}>{renderChatMessages()}</Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.root}>
      <Box className={styles.shell}>
        {sidebarVisible && (
          <aside className={styles.sidebar}>{renderSidebarContent()}</aside>
        )}

        {showSidebar && (
          <Drawer
            opened={Boolean(isMobile && mobileSidebarOpened)}
            onClose={closeMobileSidebar}
            withCloseButton={false}
            position="left"
            size="min(280px, 88vw)"
            padding={0}
            zIndex={200}
            classNames={{ body: styles.drawerBody }}
          >
            <Box className={styles.sidebarDrawer}>{renderSidebarContent()}</Box>
          </Drawer>
        )}

        <Box className={styles.mainColumn}>
          <Box className={styles.mainHeader}>
            <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Tooltip label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={toggleSidebar}
                  aria-label="Toggle sidebar"
                >
                  <IconLayoutSidebar size={24} stroke={1.5} />
                </ActionIcon>
              </Tooltip>
              <Text fw={600} fz="sm" truncate className={styles.sessionTitle}>
                {activeSession?.label ?? "New chat"}
              </Text>
            </Group>
            <Group gap="sm" wrap="nowrap" className={styles.mainHeaderActions}>
              {headerExtra}
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
            </Group>
          </Box>

          {showAnalyticsSubNav && (
            <Box className={styles.subHeader}>
              <SegmentedControl
                size="xs"
                value={analyticsView}
                onChange={(v) => setAnalyticsView(v as AnalyticsAdminView)}
                data={[
                  { label: "Chat", value: "chat" },
                  { label: "Train", value: "train" },
                  { label: "Memory", value: "memory" },
                ]}
              />
            </Box>
          )}

          <Box className={styles.mainBody}>{renderMainContent()}</Box>
        </Box>
      </Box>
    </Box>
  );
};
