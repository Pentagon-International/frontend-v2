import type { MatchedFieldPosition } from "./utils/matchTextItems";

type EditableOverlayProps = {
  fields: MatchedFieldPosition[];
  activeFieldId: string | null;
  onFieldClick: (fieldId: string) => void;
  disabled?: boolean;
};

export function EditableOverlay({
  fields,
  activeFieldId,
  onFieldClick,
  disabled,
}: EditableOverlayProps) {
  return (
    <>
      {fields.map((field) => {
        const isActive = activeFieldId === field.fieldId;

        return (
          <div
            key={field.fieldId}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled || isActive) return;
              onFieldClick(field.fieldId);
            }}
            style={{
              position: "absolute",
              left: field.rect.left,
              top: field.rect.top,
              width: Math.max(field.rect.width - 12, 16),
              height: Math.max(
                field.rect.height,
                field.rect.lineHeightPx ?? 16,
                16,
              ),
              cursor: disabled ? "default" : "text",
              pointerEvents: disabled ? "none" : "auto",
              backgroundColor: isActive
                ? "rgba(16, 84, 118, 0.12)"
                : "transparent",
              border: isActive
                ? "1px solid rgba(16, 84, 118, 0.65)"
                : "1px solid transparent",
              borderRadius: 1,
              boxSizing: "border-box",
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isActive) {
                e.currentTarget.style.backgroundColor =
                  "rgba(16, 84, 118, 0.06)";
                e.currentTarget.style.border =
                  "1px dashed rgba(16, 84, 118, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.border = "1px solid transparent";
              }
            }}
            title="Click to edit"
          />
        );
      })}
    </>
  );
}
