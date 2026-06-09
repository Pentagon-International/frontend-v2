import { useState, useRef, useEffect, FC } from "react";
import { Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import styles from "./Chatbot.module.css";
import { ChatbotPageUi } from "./ChatbotUi";
import { useChatSessions } from "./useChatSessions";

const WHISPER_API = "https://api.openai.com/v1/audio/transcriptions";
const CHUNK_MS = 5000;
const MIN_BLOB_SIZE = 8000;
const WHISPER_HALLUCINATIONS =
  /[\s.,!?]*\b(thank you(\.| for (watching|listening|your time|tuning in|joining( us)?|being here))?|thanks( for (watching|listening|joining))?|bye[\s-]?bye|goodbye|see you( next time| soon| later)?|take care|have a (good|great|nice) (day|one)|that('?s| is) all( for (today|now))?|until next time|stay tuned|don'?t forget to (like|subscribe|share)|please (like|subscribe)|hit (the|that) (like|subscribe)|you\.?)\s*\.?\s*$/gi;
const STOP_VOICE_COMMANDS =
  /\b(stop( recording| listening| now| the recording)?|end( the)? recording|pause recording|finish recording)\b[.,!]?\s*$/i;

const getMimeType = (): string =>
  ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  ) ?? "";

const getExtFromMime = (mime: string): string => {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "mp4";
  return "webm";
};

const Chatbot: FC = () => {
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
  } = useChatSessions({ usePersistedSession: true });

  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"listening" | "processing">("listening");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef("");
  const baseInputRef = useRef("");
  const isListeningRef = useRef(false);
  const mimeTypeRef = useRef<string>("");

  const stopRecording = () => {
    isListeningRef.current = false;
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsListening(false);
    setVoiceStatus("listening");
  };

  const sendToWhisper = async (blob: Blob) => {
    if (blob.size < MIN_BLOB_SIZE || !isListeningRef.current) return;

    setVoiceStatus("processing");

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;
      const mime = mimeTypeRef.current || blob.type || "audio/webm";
      const ext = getExtFromMime(mime);

      const form = new FormData();
      form.append("file", blob, `audio.${ext}`);
      form.append("model", "whisper-1");
      form.append("language", "en");
      form.append("temperature", "0");
      form.append("prompt", "User is speaking to an AI chatbot assistant.");

      const res = await fetch(WHISPER_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) return;

      const data = await res.json();
      const raw = (data.text ?? "").trim().replace(WHISPER_HALLUCINATIONS, "").trim();
      if (!raw || raw.length < 2) return;

      const shouldStop = STOP_VOICE_COMMANDS.test(raw);
      const transcript = raw.replace(STOP_VOICE_COMMANDS, "").trim();

      if (transcript) {
        committedRef.current += transcript + " ";
        setInput(
          baseInputRef.current
            ? `${baseInputRef.current} ${committedRef.current.trimStart()}`
            : committedRef.current.trimStart(),
        );
      }

      if (shouldStop) stopRecording();
    } catch {
      // chunk lost
    } finally {
      if (isListeningRef.current) setVoiceStatus("listening");
    }
  };

  const startChunk = () => {
    if (!streamRef.current || !isListeningRef.current) return;

    audioChunksRef.current = [];
    const mimeType = mimeTypeRef.current;

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
      sendToWhisper(blob);
      if (isListeningRef.current) startChunk();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;

    chunkTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, CHUNK_MS);
  };

  const toggleVoice = async () => {
    if (isListening) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      baseInputRef.current = input;
      committedRef.current = "";
      isListeningRef.current = true;
      mimeTypeRef.current = getMimeType();

      setIsListening(true);
      setVoiceStatus("listening");
      startChunk();
    } catch {
      console.warn("Microphone access denied");
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

  useEffect(() => {
    if (chatMode === "analytics" && isListening) stopRecording();
  }, [chatMode, isListening]);

  return (
    <ChatbotPageUi
      subtitle={
        chatMode === "analytics"
          ? "Structured SQL analytics · Tables & charts"
          : "Whisper voice · Operations & Analytics"
      }
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
                Sending audio to Whisper…
              </Text>
            )}
          </Box>
        ) : undefined
      }
      micButton={
        chatMode === "analytics" ? null : (
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
        )
      }
    />
  );
};

export default Chatbot;
