import { ActionIcon, Box, Portal, Stack, Text } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import useDateFormat from "../hooks/useDateFormat";
import {
  type EditPageAuditInfo,
  EDIT_PAGE_AUDIT_TOOLTIP_Z_INDEX,
  hasEditPageUpdatedInfo,
} from "../utils/editPageAuditInfo";

type EditPageAuditInfoIconProps = {
  auditInfo: EditPageAuditInfo | null;
  visible?: boolean;
  ariaLabel?: string;
  animateKey?: string | number | null;
  onHoverChange?: (hovered: boolean) => void;
};

type TooltipPosition = {
  top: number;
  left: number;
};

function EditPageAuditInfoIcon({
  auditInfo,
  visible = true,
  ariaLabel = "Audit info",
  animateKey,
  onHoverChange,
}: EditPageAuditInfoIconProps) {
  const dateFormat = useDateFormat();
  const anchorRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(
    null,
  );

  useEffect(() => {
    if (!visible) {
      setJumping(false);
      return;
    }

    setJumping(true);
    const timer = window.setTimeout(() => setJumping(false), 3000);
    return () => window.clearTimeout(timer);
  }, [visible, animateKey]);

  const updateTooltipPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top,
      left: rect.right + 8,
    });
  }, []);

  useLayoutEffect(() => {
    if (!hovered) {
      setTooltipPosition(null);
      return;
    }

    updateTooltipPosition();
    window.addEventListener("scroll", updateTooltipPosition, true);
    window.addEventListener("resize", updateTooltipPosition);

    return () => {
      window.removeEventListener("scroll", updateTooltipPosition, true);
      window.removeEventListener("resize", updateTooltipPosition);
    };
  }, [hovered, updateTooltipPosition]);

  const clearHideTimer = () => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const showTooltip = () => {
    clearHideTimer();
    setHovered(true);
    onHoverChange?.(true);
  };

  const scheduleHideTooltip = () => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      onHoverChange?.(false);
    }, 80);
  };

  const formatDateTime = useCallback(
    (value: string | null | undefined) => {
      if (!value) return null;
      const parsed = dayjs(value);
      return parsed.isValid() ? parsed.format(`${dateFormat} HH:mm`) : null;
    },
    [dateFormat],
  );

  const formatAuditLine = useCallback(
    (by: string | null | undefined, at: string | null | undefined) => {
      const user = by?.trim();
      const date = formatDateTime(at);
      if (user && date) {
        return (
          <Text>
            <span style={{ fontWeight: 700, fontSize: "12px", color: "#105476" }}>
              By ~{" "}
            </span>
            {user} |{" "}
            <span style={{ fontWeight: 700, fontSize: "12px", color: "#105476" }}>
              At ~{" "}
            </span>
            {date}
          </Text>
        );
      }
      if (user) {
        return (
          <Text>
            <span style={{ fontWeight: 700, fontSize: "12px", color: "#105476" }}>
              By ~{" "}
            </span>
            {user}
          </Text>
        );
      }
      if (date) {
        return (
          <Text>
            <span style={{ fontWeight: 700, fontSize: "12px", color: "#105476" }}>
              At ~{" "}
            </span>
            {date}
          </Text>
        );
      }
      return <Text>—</Text>;
    },
    [formatDateTime],
  );

  useEffect(
    () => () => {
      clearHideTimer();
    },
    [],
  );

  if (!visible) return null;

  const showUpdated = hasEditPageUpdatedInfo(auditInfo);

  return (
    <>
      <style>
        {`
          @keyframes editPageAuditInfoJump {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
        `}
      </style>
      <Box
        ref={anchorRef}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
        }}
        onMouseEnter={showTooltip}
        onMouseLeave={scheduleHideTooltip}
      >
        <ActionIcon
          variant="transparent"
          size="sm"
          aria-label={ariaLabel}
          style={{
            color: "#105476",
            animation: jumping
              ? "editPageAuditInfoJump 0.6s ease-in-out infinite"
              : undefined,
          }}
        >
          <IconInfoCircleFilled size={20} />
        </ActionIcon>
      </Box>
      {hovered && tooltipPosition && (
        <Portal>
          <Box
            onMouseEnter={showTooltip}
            onMouseLeave={scheduleHideTooltip}
            style={{
              position: "fixed",
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              zIndex: EDIT_PAGE_AUDIT_TOOLTIP_Z_INDEX,
              minWidth: 220,
              width: "max-content",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #E9ECEF",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Stack gap={12}>
              <Box>
                <Text
                  size="sm"
                  fw={700}
                  c="#105476"
                  style={{ fontFamily: "Inter" }}
                >
                  Created
                </Text>
                <Text
                  size="sm"
                  c="#444953"
                  style={{ fontFamily: "Inter", marginTop: 2 }}
                >
                  {formatAuditLine(
                    auditInfo?.created_by,
                    auditInfo?.created_at,
                  )}
                </Text>
              </Box>
              {showUpdated && (
                <Box>
                  <Text
                    size="sm"
                    fw={700}
                    c="#105476"
                    style={{ fontFamily: "Inter" }}
                  >
                    Last Updated
                  </Text>
                  <Text
                    size="sm"
                    c="#444953"
                    style={{ fontFamily: "Inter", marginTop: 2 }}
                  >
                    {formatAuditLine(
                      auditInfo?.updated_by,
                      auditInfo?.updated_at,
                    )}
                  </Text>
                </Box>
              )}
            </Stack>
          </Box>
        </Portal>
      )}
    </>
  );
}

export default EditPageAuditInfoIcon;
