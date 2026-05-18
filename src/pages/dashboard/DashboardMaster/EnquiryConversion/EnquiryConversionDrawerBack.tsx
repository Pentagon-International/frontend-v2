import { Box, Button } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";

/** Light pill “Back” + vertical rule for drilldown drawer headers (Pentagon Sales mock). */
export function EnquiryConversionDrawerBack({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="default"
      size="xs"
      leftSection={<IconArrowLeft size={16} stroke={2} />}
      onClick={onClick}
      aria-label="Back"
      styles={{
        root: {
          backgroundColor: "#F3F4F6",
          border: "1px solid #E5E7EB",
          color: "#374151",
          fontWeight: 500,
          fontSize: 13,
          lineHeight: 1.2,
          borderRadius: 6,
          height: 32,
          minHeight: 32,
          paddingLeft: 10,
          paddingRight: 12,
        },
        label: { fontWeight: 500 },
        section: { marginRight: 4 },
      }}
    >
      Back
    </Button>
  );
}

export function EnquiryConversionDrawerHeaderSeparator() {
  return (
    <Box
      aria-hidden
      style={{
        width: 1,
        height: 20,
        background: "#E5E7EB",
        flexShrink: 0,
      }}
    />
  );
}
