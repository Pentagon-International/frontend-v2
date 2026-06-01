import { FC, useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { UnstyledButton } from "@mantine/core";
import styles from "./Chatbot.module.css";
import {
  getDisplayContent,
  injectReferenceLinksIntoContent,
  type ChatReferences,
} from "./chatbotMessageUtils";
import type { ReferenceLinkTarget } from "./chatReferenceNavigation";
import { chatMarkdownTableComponents } from "./ChatMarkdownTables";

const preserveChatRefUrl = (url: string) =>
  url.startsWith("chat-ref:") ? url : defaultUrlTransform(url);

const parseChatRefHref = (href?: string): ReferenceLinkTarget | null => {
  if (href === "chat-ref:enquiry") return "enquiry";
  if (href === "chat-ref:quotation") return "quotation";
  return null;
};

export const AssistantMarkdown: FC<{
  content: string;
  references?: ChatReferences;
  onReferenceLinkClick?: (
    target: ReferenceLinkTarget,
    refs: ChatReferences,
  ) => void;
}> = ({ content, references, onReferenceLinkClick }) => {
  const plainText = useMemo(() => getDisplayContent(content) ?? content, [content]);

  const linkableRefs = useMemo((): ChatReferences | undefined => {
    if (!references) return undefined;
    const enquiry_id = references.enquiry_id?.trim();
    const quotation_id = references.quotation_id?.trim();
    if (!enquiry_id && !quotation_id) return undefined;
    return { enquiry_id, quotation_id };
  }, [references]);

  const displayContent = useMemo(() => {
    if (!linkableRefs || !onReferenceLinkClick) return plainText;
    return injectReferenceLinksIntoContent(plainText, linkableRefs);
  }, [plainText, linkableRefs, onReferenceLinkClick]);

  const components = useMemo<Components>(() => {
    const base: Components = { ...chatMarkdownTableComponents };

    if (!linkableRefs || !onReferenceLinkClick) return base;

    return {
      ...base,
      a: ({ href, children }) => {
        const target = parseChatRefHref(href);
        if (target) {
          return (
            <UnstyledButton
              type="button"
              className={styles.refLink}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReferenceLinkClick(target, linkableRefs);
              }}
            >
              {children}
            </UnstyledButton>
          );
        }
        if (!href) {
          return <span>{children}</span>;
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    };
  }, [linkableRefs, onReferenceLinkClick]);

  if (!displayContent.trim()) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      urlTransform={preserveChatRefUrl}
    >
      {displayContent}
    </ReactMarkdown>
  );
};
