import EditPageHeadingRow from "./EditPageHeadingRow";
import type { GroupProps } from "@mantine/core";

type MasterAuditHeadingRowProps = {
  auditSource?: Record<string, unknown> | null;
  visible?: boolean;
  animateKey?: string | number | null;
  children: React.ReactNode;
  justify?: GroupProps["justify"];
  gap?: GroupProps["gap"];
};

function MasterAuditHeadingRow({
  auditSource,
  visible,
  animateKey,
  children,
  justify = "flex-start",
  gap = 6,
}: MasterAuditHeadingRowProps) {
  const recordId =
    animateKey ??
    (auditSource as { id?: string | number } | null | undefined)?.id ??
    null;

  return (
    <EditPageHeadingRow
      visible={visible ?? Boolean(auditSource)}
      auditSource={auditSource}
      animateKey={recordId}
      justify={justify}
      gap={gap}
    >
      {children}
    </EditPageHeadingRow>
  );
}

export default MasterAuditHeadingRow;
