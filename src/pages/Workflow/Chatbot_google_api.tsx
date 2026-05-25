import { useState, useRef, useEffect, FC } from "react";
import { Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import styles from "./Chatbot.module.css";
import { ChatbotPageUi } from "./ChatbotUi";
import { useChatSessions } from "./useChatSessions";

const GOOGLE_SPEECH_API = "https://speech.googleapis.com/v1/speech:recognize";
const CHUNK_MS = 5000;
const STOP_VOICE_COMMANDS =
  /\b(stop( recording| listening| now| the recording)?|end( the)? recording|pause recording|finish recording)\b[.,!]?\s*$/i;

const getMimeType = () =>
  ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  ) ?? "";

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

const ChatbotGoogleApi: FC = () => {
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
  const [voiceStatus, setVoiceStatus] = useState<"listening" | "processing">("listening");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef("");
  const baseInputRef = useRef("");
  const isListeningRef = useRef(false);

  const stopRecording = () => {
    isListeningRef.current = false;
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsListening(false);
    setVoiceStatus("listening");
  };

  const sendToGoogle = async (blob: Blob) => {
    if (blob.size < 500 || !isListeningRef.current) return;
    setVoiceStatus("processing");
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY as string;
      const base64 = await blobToBase64(blob);
      const mimeType = blob.type;
      const encoding = mimeType.includes("ogg") ? "OGG_OPUS" : "WEBM_OPUS";
      const res = await fetch(`${GOOGLE_SPEECH_API}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            encoding,
            sampleRateHertz: 48000,
            languageCode: "en-US",
            enableAutomaticPunctuation: true,
          },
          audio: { content: base64 },
        }),
      });
      const data = await res.json();
      const raw = (data.results ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      const shouldStop = STOP_VOICE_COMMANDS.test(raw);
      const transcript = raw.replace(STOP_VOICE_COMMANDS, "").trim();
      if (transcript) {
        committedRef.current += `${transcript} `;
        setInput(
          baseInputRef.current
            ? `${baseInputRef.current} ${committedRef.current.trimStart()}`
            : committedRef.current.trimStart(),
        );
      }
      if (shouldStop) stopRecording();
    } catch {
      /* chunk lost */
    } finally {
      if (isListeningRef.current) setVoiceStatus("listening");
    }
  };

  const startChunk = () => {
    if (!streamRef.current || !isListeningRef.current) return;
    audioChunksRef.current = [];
    const mimeType = getMimeType();
    const recorder = new MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : undefined,
    );
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: mimeType || "audio/webm",
      });
      sendToGoogle(blob);
      if (isListeningRef.current) startChunk();
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    chunkTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    }, CHUNK_MS);
  };

  const toggleVoice = async () => {
    if (isListening) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      baseInputRef.current = input;
      committedRef.current = "";
      isListeningRef.current = true;
      setIsListening(true);
      setVoiceStatus("listening");
      startChunk();
    } catch {
      /* mic permission denied */
    }
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <ChatbotPageUi
      subtitle="Google Speech · Operations & Analytics"
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
              {voiceStatus === "processing" ? "Processing…" : "Listening…"}
            </Text>
            {voiceStatus === "processing" && (
              <Text fz="xs" c="dimmed" fs="italic">
                Sending audio to Google…
              </Text>
            )}
          </Box>
        ) : undefined
      }
      micButton={
        <Tooltip label={isListening ? "Stop recording" : "Voice input"}>
          <ActionIcon
            size="lg"
            radius="md"
            variant={isListening ? "filled" : "light"}
            color={isListening ? "red" : "gray"}
            onClick={toggleVoice}
            disabled={!activeSessionId}
            className={isListening ? styles.micPulse : undefined}
          >
            {isListening ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
          </ActionIcon>
        </Tooltip>
      }
    />
  );
};

export default ChatbotGoogleApi;
