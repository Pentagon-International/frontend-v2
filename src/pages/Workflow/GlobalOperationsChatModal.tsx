import { FC, useCallback } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHistory, IconRobot } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChatbotPageUi } from "./ChatbotUi";
import { useChatSessions } from "./useChatSessions";
import { CHAT_URL_SESSION_PARAM, CHAT_URL_TYPE_PARAM } from "./chatApi";
import { CHATBOT_PATH, isWorkflowChatbotPath } from "./jobcreation/workflowUrls";
import { navigateFromChatReferences } from "./chatReferenceNavigation";
import type { ReferenceLinkTarget } from "./chatReferenceNavigation";
import type { ChatReferences } from "./chatbotMessageUtils";
import styles from "./Chatbot.module.css";

const GlobalOperationsChatModal: FC = () => {
  const [opened, { open, close }] = useDisclosure(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const {
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
    handleSelectSession,
    handleNewSession,
    handleDeleteSession,
  } = useChatSessions({
    lockMode: "operations",
    syncUrl: false,
    usePersistedSession: true,
    enabled: opened,
  });

  const handleShowHistory = () => {
    if (!activeSessionId) return;
    const params = new URLSearchParams({
      [CHAT_URL_TYPE_PARAM]: "operations",
      [CHAT_URL_SESSION_PARAM]: activeSessionId,
    });
    close();
    navigate(`${CHATBOT_PATH}?${params.toString()}`);
  };

  const handleReferenceLinkClick = useCallback(
    async (target: ReferenceLinkTarget, refs: ChatReferences) => {
      await navigateFromChatReferences(target, refs, navigate);
      close();
    },
    [navigate, close],
  );

  if (isWorkflowChatbotPath(pathname)) {
    return null;
  }

  return (
    <>
      <Box className={styles.fabWrap}>
        <ActionIcon
          variant="filled"
          radius="xl"
          size="xl"
          color="blue"
          onClick={open}
          aria-label="Open Pulse AI assistant"
        >
          <IconRobot size={22} stroke={1.5} />
        </ActionIcon>
      </Box>

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="min(540px, 100vw)"
        title={
          <Group justify="space-between" wrap="nowrap" style={{ width: "100%" }}>
            <Group gap="xs" wrap="nowrap">
              <IconRobot size={20} stroke={1.5} />
              <Text fw={600} fz="sm">
                Pulse AI
              </Text>
            </Group>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconHistory size={14} />}
              onClick={handleShowHistory}
              disabled={!activeSessionId}
            >
              Show history
            </Button>
          </Group>
        }
        padding={0}
        styles={{
          header: { borderBottom: "1px solid var(--mantine-color-gray-200)", padding: "12px 16px" },
          body: { height: "calc(100% - 56px)", padding: 0, display: "flex", flexDirection: "column" },
        }}
      >
        {opened && (
          <Box className={styles.embeddedChat}>
            <ChatbotPageUi
              subtitle="Create enquiries and quotations"
              hideModeSelector
              compact
              sessions={sessions}
              activeSessionId={activeSessionId}
              activeSession={activeSession}
              sessionsLoading={sessionsLoading}
              historyLoading={historyLoading}
              loading={loading}
              sessionCreating={sessionCreating}
              input={input}
              viewportRef={viewport}
              onInputChange={setInput}
              onKeyDown={handleKeyDown}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onSendMessage={sendMessage}
              onReferenceLinkClick={handleReferenceLinkClick}
              micButton={<span />}
            />
          </Box>
        )}
      </Drawer>
    </>
  );
};

export default GlobalOperationsChatModal;
