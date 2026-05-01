import { Box, Text, Group, ActionIcon } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { enquiryConversionColors } from "./enquiryConversionTokens";

const ERP_FONT = "'Geist', sans-serif";

export function EnquiryConversionCardHeader({
  title = "Enquiry Conversion",
  subtitle,
  onNavigate,
}: {
  title?: string;
  subtitle: string;
  onNavigate?: () => void;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" w="100%">
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          cursor: onNavigate ? "pointer" : undefined,
          fontFamily: ERP_FONT,
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
        <Text
          fz={{ base: 16, sm: 17 }}
          fw={700}
          c={enquiryConversionColors.heading}
          lh={1.25}
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </Text>
        <Text fz={13} fw={500} c={enquiryConversionColors.subHeading} mt={5} lh={1.45} lineClamp={2}>
          {subtitle}
        </Text>
      </Box>
      {onNavigate ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Open Enquiry Conversion"
          style={{ flexShrink: 0, color: enquiryConversionColors.muted }}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
        >
          <IconArrowRight size={20} stroke={1.35} />
        </ActionIcon>
      ) : null}
    </Group>
  );
}
