import { Group, type GroupProps } from "@mantine/core";
import { useMemo } from "react";
import EditPageAuditInfoIcon from "./EditPageAuditInfoIcon";
import { normalizeEditPageAuditInfo } from "../utils/editPageAuditInfo";

type EditPageHeadingRowProps = {
  visible: boolean;
  auditSource?: Record<string, unknown> | null;
  animateKey?: string | number | null;
  ariaLabel?: string;
  onHoverChange?: (hovered: boolean) => void;
  children: React.ReactNode;
  justify?: GroupProps["justify"];
  gap?: GroupProps["gap"];
};

function EditPageHeadingRow({
  visible,
  auditSource,
  animateKey,
  ariaLabel = "Audit info",
  onHoverChange,
  children,
  justify = "center",
  gap = 6,
}: EditPageHeadingRowProps) {
  const auditInfo = useMemo(
    () => normalizeEditPageAuditInfo(auditSource),
    [auditSource],
  );

  return (
    <Group gap={gap} justify={justify} wrap="nowrap">
      {children}
      <EditPageAuditInfoIcon
        visible={visible}
        auditInfo={auditInfo}
        animateKey={animateKey}
        ariaLabel={ariaLabel}
        onHoverChange={onHoverChange}
      />
    </Group>
  );
}

export default EditPageHeadingRow;
