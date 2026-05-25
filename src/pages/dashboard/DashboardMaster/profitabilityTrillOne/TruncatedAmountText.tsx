import { Tooltip, Text } from "@mantine/core";
import { INK, INK_2, INK_3 } from "./constants";
import { formatProfitabilityAmount, profitabilityTrillFonts } from "./utils";

type TruncatedAmountTextProps = {
  value: number;
  currencyCode?: string;
  bold?: boolean;
  muted?: boolean;
  fz?: number;
  fw?: number;
  ta?: React.CSSProperties["textAlign"];
};

export function TruncatedAmountText({
  value,
  currencyCode = "INR",
  bold = false,
  muted = false,
  fz = 12,
  fw,
  ta = "right",
}: TruncatedAmountTextProps) {
  const formatted = formatProfitabilityAmount(value, currencyCode);

  return (
    <Tooltip label={formatted} withArrow position="top">
      <Text
        component="span"
        fz={fz}
        fw={fw ?? (bold ? 600 : 400)}
        c={muted ? INK_3 : bold ? INK : INK_2}
        style={{
          display: "block",
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: ta,
          fontVariantNumeric: "tabular-nums",
          fontFamily: profitabilityTrillFonts.sans,
          cursor: "default",
        }}
      >
        {formatted}
      </Text>
    </Tooltip>
  );
}

type TruncatedFormattedAmountProps = {
  text: string;
  fz?: number;
  fw?: number;
  color?: string;
  ta?: React.CSSProperties["textAlign"];
};

/** KPI-style truncated amount (pre-formatted string). */
export function TruncatedFormattedAmount({
  text,
  fz = 18,
  fw = 600,
  color,
  ta = "left",
}: TruncatedFormattedAmountProps) {
  return (
    <Tooltip label={text} withArrow position="top">
      <Text
        component="span"
        fz={fz}
        fw={fw}
        c={color}
        style={{
          display: "block",
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: ta,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          cursor: "default",
        }}
      >
        {text}
      </Text>
    </Tooltip>
  );
}
