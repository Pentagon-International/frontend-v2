import { useEffect, useLayoutEffect, useRef } from "react";
import type { ActiveEditState } from "./usePdfEditor";
import { countWrappedLines } from "./utils/fieldRectConstraints";

const PDF_INPUT_FONT =
  'Helvetica, "Helvetica Neue", Arial, "Liberation Sans", sans-serif';

type EditableFieldProps = {
  activeEdit: ActiveEditState;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

function snapHeightToLines(heightPx: number, lineHeightPx: number): number {
  return Math.max(lineHeightPx, Math.ceil(heightPx / lineHeightPx) * lineHeightPx);
}

export function EditableField({
  activeEdit,
  onChange,
  onCommit,
  onCancel,
}: EditableFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { field, position, value } = activeEdit;
  const isTextarea = field.type === "textarea" || field.multiline;
  const fontSize = Math.max(position.rect.fontSize, 7);
  const lineHeightPx =
    position.rect.lineHeightPx ?? Math.max(fontSize * 1.15, fontSize + 2);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (isTextarea) {
        el.setSelectionRange(el.value.length, el.value.length);
      } else {
        el.select();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeEdit.field.id, isTextarea]);

  useLayoutEffect(() => {
    if (!isTextarea || !inputRef.current) return;

    const el = inputRef.current;
    const innerWidth = Math.max(position.rect.width - 4, 16);
    const wrappedLines = countWrappedLines(
      value,
      innerWidth,
      fontSize,
      field.fontWeight ?? 400,
    );
    const minHeight = Math.max(
      position.rect.height,
      wrappedLines * lineHeightPx,
    );

    el.style.height = "0px";
    const contentHeight = snapHeightToLines(el.scrollHeight, lineHeightPx);
    el.style.height = `${Math.max(minHeight, contentHeight)}px`;
  }, [
    value,
    isTextarea,
    position.rect.width,
    position.rect.height,
    lineHeightPx,
    fontSize,
    field.fontWeight,
  ]);

  const sharedStyle: React.CSSProperties = {
    position: "absolute",
    left: position.rect.left,
    top: position.rect.top,
    width: position.rect.width,
    minHeight: Math.max(position.rect.height, lineHeightPx),
    margin: 0,
    padding: "0 2px",
    border: "1px solid #105476",
    borderRadius: 0,
    outline: "none",
    background: "rgba(255, 255, 255, 0.97)",
    fontFamily: PDF_INPUT_FONT,
    fontWeight: field.fontWeight ?? 400,
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeightPx}px`,
    color: "#000",
    zIndex: 20,
    boxSizing: "border-box",
    letterSpacing: "normal",
    textTransform: "none",
    pointerEvents: "auto",
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "Enter" && !isTextarea) {
      event.preventDefault();
      onCommit();
      return;
    }
    if (event.key === "Enter" && isTextarea && event.ctrlKey) {
      event.preventDefault();
      onCommit();
      return;
    }
    // Enter / Shift+Enter in textarea: allow default (new line) — do not commit
  };

  if (isTextarea) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
        style={{
          ...sharedStyle,
          resize: "none",
          overflow: "hidden",
          overflowX: "hidden",
          maxWidth: position.rect.width,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
      style={sharedStyle}
    />
  );
}
