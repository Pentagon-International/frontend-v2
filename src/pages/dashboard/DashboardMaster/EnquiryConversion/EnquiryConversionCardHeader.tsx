import { Box, Text, Group, ActionIcon } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { dashboardPanelTitleStyle } from "../dashboardPanelStyles";

export function EnquiryConversionCardHeader({
  title = "Enquiry Conversion",
  subtitle,
  onNavigate,
}: {
  title?: string;
  subtitle: string;
  /** Opens the full Enquiry Conversion module */
  onNavigate?: () => void;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" w="100%">
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          cursor: onNavigate ? "pointer" : undefined,
        }}
        onClick={onNavigate}
        onKeyDown={(e) => {
          if (!onNavigate) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onNavigate();
          }
        }}
        tabIndex={onNavigate ? 0 : undefined}
        role={onNavigate ? "button" : undefined}
      >
        <Text style={dashboardPanelTitleStyle}>{title}</Text>
        <Text size="xs" c="#64748B" mt={4} lineClamp={2}>
          {subtitle}
        </Text>
      </Box>
      {onNavigate ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Open Enquiry Conversion"
          style={{ flexShrink: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
        >
          <IconArrowRight size={18} color="#105476" />
        </ActionIcon>
      ) : null}
    </Group>
  );
}
