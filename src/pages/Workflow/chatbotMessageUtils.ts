/**
 * Normalizes API/history message payloads for display.
 * LangChain responses may include tool calls alongside user-visible text.
 */

type ContentBlock = { type?: string; text?: string };

import {
  normalizeChatReferences,
  type ChatReferences,
} from "./chatReferenceNavigation";

export type { ChatReferences } from "./chatReferenceNavigation";

export type ChatMessageLike = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  references?: ChatReferences;
};

type RefNeedle = { id: string; kind: "enquiry" | "quotation" };

type LinkSpan = { start: number; end: number; replacement: string };

const REFS_JSON_TAIL =
  /\s*\{[\s\S]*?"(?:enquiry_id|quotation_id)"\s*:\s*"[^"]*"[\s\S]*?\}\s*$/;

const CHAT_REF_LINK_RE = /\[[^\]]*\]\(chat-ref:(?:enquiry|quotation)\)/g;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Unescape literal \\n sequences occasionally returned by the API */
export const unescapeMessageNewlines = (text: string): string =>
  text.replace(/\\n/g, "\n");

/** Remove a trailing embedded references JSON block from plain message text */
export const stripTrailingReferencesJson = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const withoutTail = trimmed.replace(REFS_JSON_TAIL, "").trimEnd();
  return withoutTail || trimmed;
};

const finalizeDisplayText = (text: string): string =>
  unescapeMessageNewlines(stripTrailingReferencesJson(text));

const extractTextFromContent = (content: unknown): string => {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return (content as ContentBlock[])
    .filter((block) => block?.type === "text" && block.text)
    .map((block) => String(block.text).trim())
    .filter(Boolean)
    .join("\n\n");
};

const referencesFromParsedJson = (parsed: Record<string, unknown>): ChatReferences | undefined => {
  const data =
    parsed.data && typeof parsed.data === "object"
      ? (parsed.data as Record<string, unknown>)
      : undefined;
  return (
    normalizeChatReferences(parsed.references) ??
    normalizeChatReferences(data?.references)
  );
};

/** Only enquiry_id / quotation_id from references, matched in message markdown text */
export const injectReferenceLinksIntoContent = (
  content: string,
  refs: ChatReferences,
): string => {
  const needles: RefNeedle[] = [];
  if (refs.quotation_id?.trim()) {
    needles.push({ id: refs.quotation_id.trim(), kind: "quotation" });
  }
  if (refs.enquiry_id?.trim()) {
    needles.push({ id: refs.enquiry_id.trim(), kind: "enquiry" });
  }
  if (needles.length === 0) return content;

  needles.sort((a, b) => b.id.length - a.id.length);

  const spans: LinkSpan[] = [];
  const linkLabel = (needle: RefNeedle) =>
    `[${needle.id}](chat-ref:${needle.kind})`;

  const overlaps = (start: number, end: number) =>
    spans.some((s) => start < s.end && end > s.start);

  const isInsideChatRefLink = (start: number, end: number): boolean => {
    CHAT_REF_LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CHAT_REF_LINK_RE.exec(content)) !== null) {
      const ls = match.index;
      const le = ls + match[0].length;
      if (start >= ls && end <= le) return true;
    }
    return false;
  };

  const isInsideInlineCode = (start: number): boolean => {
    const ticks = (content.slice(0, start).match(/`/g) || []).length;
    return ticks % 2 === 1;
  };

  for (const needle of needles) {
    const escaped = escapeRegExp(needle.id);

    const backtickRe = new RegExp(`\`${escaped}\``, "g");
    let match: RegExpExecArray | null;
    while ((match = backtickRe.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlaps(start, end) || isInsideChatRefLink(start, end)) continue;
      spans.push({ start, end, replacement: linkLabel(needle) });
    }

    const plainRe = new RegExp(escaped, "g");
    while ((match = plainRe.exec(content)) !== null) {
      const start = match.index;
      const end = start + needle.id.length;
      if (overlaps(start, end) || isInsideChatRefLink(start, end)) continue;
      if (isInsideInlineCode(start)) continue;
      spans.push({ start, end, replacement: linkLabel(needle) });
    }
  }

  if (spans.length === 0) return content;

  spans.sort((a, b) => a.start - b.start || b.end - a.end - (b.start - a.start));

  const merged: LinkSpan[] = [];
  for (const span of spans) {
    if (merged.length > 0 && span.start < merged[merged.length - 1].end) continue;
    merged.push(span);
  }

  let out = "";
  let cursor = 0;
  for (const span of merged) {
    out += content.slice(cursor, span.start);
    out += span.replacement;
    cursor = span.end;
  }
  out += content.slice(cursor);
  return out;
};

/** Client-side optimistic messages use numeric Date.now() ids */
const isClientGeneratedId = (id: string): boolean => /^\d{10,}$/.test(id);

const messageKey = (m: Pick<ChatMessageLike, "role" | "content">) =>
  `${m.role}::${m.content}`;

/**
 * Merges server history with local optimistic messages so in-flight replies
 * are not wiped when fetchHistory completes after sendMessage.
 */
export const mergeSessionMessages = (
  local: ChatMessageLike[],
  history: ChatMessageLike[],
): ChatMessageLike[] => {
  if (history.length === 0) return local;

  const historyKeys = new Set(history.map(messageKey));

  const pendingLocal = local.filter(
    (m) => isClientGeneratedId(m.id) && !historyKeys.has(messageKey(m)),
  );

  return [...history, ...pendingLocal].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
};

/** Returns null when the message should be hidden from the thread entirely. */
export const getDisplayContent = (content: string): string | null => {
  const trimmed = content?.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> & {
      type?: string;
      role?: string;
      reply?: string;
      message?: string;
      content?: unknown;
      data?: {
        content?: unknown;
        tool_calls?: unknown[];
        reply?: string;
        message?: string;
        references?: unknown;
      };
    };

    if (parsed?.type === "tool") return null;

    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return finalizeDisplayText(parsed.reply.trim());
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return finalizeDisplayText(parsed.message.trim());
    }

    if (typeof parsed.content === "string" && parsed.content.trim()) {
      return finalizeDisplayText(parsed.content.trim());
    }

    const data = (parsed?.data ?? parsed) as typeof parsed.data & Record<string, unknown>;

    if (typeof data?.reply === "string" && data.reply.trim()) {
      return finalizeDisplayText(data.reply.trim());
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return finalizeDisplayText(data.message.trim());
    }

    const text =
      extractTextFromContent(data?.content) || extractTextFromContent(parsed?.content);

    if (text) return finalizeDisplayText(text);

    if (parsed?.type === "ai") {
      const hasToolCalls =
        (Array.isArray(data?.tool_calls) && data.tool_calls.length > 0) ||
        (Array.isArray(data?.content) &&
          (data.content as ContentBlock[]).some((c) => c?.type === "tool_use"));

      if (hasToolCalls) return null;
    }

    if (typeof data?.content === "string" && data.content.trim()) {
      return finalizeDisplayText(data.content.trim());
    }

    if (parsed.references && !parsed.content && !parsed.reply && !parsed.message) {
      return null;
    }
  } catch {
    // Plain text / markdown — use as-is
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return null;
  }

  return finalizeDisplayText(trimmed);
};

/** Extract user-visible text and optional references from API/history payloads */
export const normalizeAssistantMessage = (
  raw: string,
  externalRefs?: unknown,
): { content: string | null; references?: ChatReferences } => {
  let references = normalizeChatReferences(externalRefs) ?? undefined;

  const trimmed = raw?.trim() ?? "";
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      references = references ?? referencesFromParsedJson(parsed);
    } catch {
      // plain text
    }
  }

  const content = getDisplayContent(raw);
  return { content, references };
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
