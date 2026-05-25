import { useState, useRef, useEffect, FC } from "react";
import { Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import styles from "./Chatbot.module.css";
import { ChatbotPageUi } from "./ChatbotUi";
import { useChatSessions } from "./useChatSessions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): any =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const STOP_VOICE_COMMANDS =
  /\b(stop( recording| listening| now| the recording)?|end( the)? recording|pause recording|finish recording)\b[.,!]?\s*$/i;

const ChatbotBrowser: FC = () => {
  const {
    chatMode,
    setChatMode,
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
  } = useChatSessions();

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"listening" | "converting" | "reconnecting">(
    "listening",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef("");
  const baseInputRef = useRef("");
  const isListeningRef = useRef(false);

  const scheduleRestart = (delayMs = 300) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) startRecognition();
    }, delayMs);
  };

  const startRecognition = () => {
    const SR = getSR();
    if (!SR || !isListeningRef.current) return;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    try {
      const recognition = new SR();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        let finalChunk = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalChunk += `${t} `;
          else interim += t;
        }
        if (finalChunk) {
          const shouldStop = STOP_VOICE_COMMANDS.test(finalChunk.trim());
          const clean = finalChunk.replace(STOP_VOICE_COMMANDS, "").trim();
          if (clean) committedRef.current += `${clean} `;
          if (shouldStop) {
            isListeningRef.current = false;
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            recognition.stop();
            setIsListening(false);
            setInterimText("");
            return;
          }
        }
        setInterimText(interim);
        setVoiceStatus(interim ? "converting" : "listening");
        setInput(
          baseInputRef.current
            ? `${baseInputRef.current} ${(committedRef.current + interim).trimStart()}`
            : (committedRef.current + interim).trimStart(),
        );
      };

      recognition.onend = () => {
        setInterimText("");
        if (isListeningRef.current) {
          setVoiceStatus("reconnecting");
          scheduleRestart(300);
        } else {
          setIsListening(false);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        const fatal = ["not-allowed", "service-not-allowed"];
        if (fatal.includes(e.error)) {
          isListeningRef.current = false;
          setIsListening(false);
          setInterimText("");
          return;
        }
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setVoiceStatus("listening");
    } catch {
      scheduleRestart(600);
    }
  };

  const stopRecording = () => {
    isListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  };

  const toggleVoice = () => {
    if (!getSR()) return;
    if (isListening) {
      stopRecording();
      return;
    }
    baseInputRef.current = input;
    committedRef.current = "";
    isListeningRef.current = true;
    setIsListening(true);
    startRecognition();
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  return (
    <ChatbotPageUi
      subtitle="Browser speech · Operations & Analytics"
      chatMode={chatMode}
      onChatModeChange={setChatMode}
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
      inputListening={isListening}
      inputPlaceholder={isListening ? "Speak now…" : "Type a message… (Enter to send)"}
      voiceBanner={
        isListening ? (
          <Box className={styles.voiceBanner}>
            <span className={styles.voiceDots}>
              <span className={styles.voiceDot} />
              <span className={styles.voiceDot} />
              <span className={styles.voiceDot} />
            </span>
            <Text fz="xs" c="red.7" fw={500} style={{ flexShrink: 0 }}>
              {voiceStatus === "reconnecting"
                ? "Reconnecting…"
                : voiceStatus === "converting"
                  ? "Converting…"
                  : "Listening…"}
            </Text>
            {interimText && (
              <Text
                fz="xs"
                c="dimmed"
                fs="italic"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                &quot;{interimText}&quot;
              </Text>
            )}
          </Box>
        ) : undefined
      }
      micButton={
        <Tooltip
          label={
            isListening
              ? "Stop recording"
              : getSR()
                ? "Voice input (Browser)"
                : "Browser speech not supported"
          }
        >
          <ActionIcon
            size="lg"
            radius="md"
            variant={isListening ? "filled" : "light"}
            color={isListening ? "red" : "gray"}
            onClick={toggleVoice}
            disabled={!getSR() || !activeSessionId}
            className={isListening ? styles.micPulse : undefined}
          >
            {isListening ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
          </ActionIcon>
        </Tooltip>
      }
    />
  );
};

export default ChatbotBrowser;
