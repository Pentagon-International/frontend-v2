import { useState } from "react";
import { Box, Skeleton, Text, Tooltip } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import CollectionDashboardSecondTrill from "../CollectionDashboardSecondTrill";
import {
  ERP_LIST_FONT_MONO,
  ERP_LIST_FONT_SANS,
} from "../../../../components/ERPListPage/erpListGeistShell";
import { branchDotColor } from "../accountsDashboardNormalize";
import { BRANCH_CHIP_CITY } from "../collectionTargetVsPerformance/theme";
import type { CollectionOutstandingInvoiceRow } from "./types";
import {
  COL_CARD_BG,
  COL_GOOD,
  COL_INK,
  COL_INK_2,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_NAVY_800,
  COL_WARN,
  COL_WARN_BG,
} from "../collectionTargetVsPerformance/theme";

const INVOICE_GRID = {
  display: "grid",
  gridTemplateColumns:
    "minmax(140px,1.4fr) minmax(160px,1.6fr) minmax(72px,0.9fr) minmax(72px,0.9fr) minmax(72px,0.9fr) 88px 72px 24px",
  gap: 12,
  alignItems: "center",
} as const;

function AmountCell({
  value,
  color,
  bold,
}: {
  value: string;
  color?: string;
  bold?: boolean;
}) {
  const display = value || "—";
  return (
    <Tooltip label={display} withArrow position="top">
      <Text
        component="span"
        fz={12}
        fw={bold ? 600 : 400}
        c={color}
        style={{
          display: "block",
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          cursor: "default",
        }}
      >
        {display}
      </Text>
    </Tooltip>
  );
}

const headerStyle = {
  fontSize: 10,
  fontWeight: 600,
  color: COL_INK_4,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

function ageColor(tone: CollectionOutstandingInvoiceRow["ageTone"]): string {
  if (tone === "overdue") return COL_WARN;
  if (tone === "notDue") return COL_INK_3;
  return COL_INK_3;
}

function StatusBadge({ status, tone }: { status: string; tone: CollectionOutstandingInvoiceRow["statusTone"] }) {
  if (tone === "partial") {
    return (
      <Box
        component="span"
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 4,
          background: COL_WARN_BG,
          color: "#92400e",
          letterSpacing: "0.04em",
        }}
      >
        {status}
      </Box>
    );
  }
  return (
    <Text fz={11} fw={600} c={tone === "open" ? COL_INK_3 : COL_INK_4} tt="uppercase">
      {status}
    </Text>
  );
}

function InvoiceRow({
  row,
  onSelect,
}: {
  row: CollectionOutstandingInvoiceRow;
  onSelect: (row: CollectionOutstandingInvoiceRow) => void;
}) {
  const chipKey = row.branchVariant?.toLowerCase();
  const chipCity = chipKey ? BRANCH_CHIP_CITY[chipKey] ?? chipKey.toUpperCase() : null;

  return (
    <Box
      component="button"
      type="button"
      style={{
        ...INVOICE_GRID,
        width: "100%",
        minWidth: 720,
        textAlign: "left",
        border: "none",
        borderBottom: `1px solid ${COL_LINE}`,
        background: COL_CARD_BG,
        padding: "12px 16px",
        cursor: "pointer",
        fontFamily: ERP_LIST_FONT_SANS,
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#f8fafc";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = COL_CARD_BG;
      }}
      onClick={() => onSelect(row)}
    >
      <Box style={{ minWidth: 0 }}>
        <Text fz={12} fw={600} c={COL_NAVY_800} style={{ letterSpacing: "-0.01em" }}>
          {row.documentNo}
        </Text>
        <Text fz={10.5} c={COL_INK_4} mt={2}>
          {row.invoiceMeta}
        </Text>
      </Box>
      <Box style={{ minWidth: 0 }}>
        <Text fz={12} fw={600} c={COL_INK}>
          {row.customerName}
        </Text>
        <Box
          component="span"
          mt={4}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 7px",
            borderRadius: 3,
            background: "#f8fafc",
            color: COL_INK_3,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            border: `1px solid ${COL_LINE}`,
          }}
        >
          {chipCity ? (
            <Box
              component="span"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: branchDotColor(row.branchVariant),
                flexShrink: 0,
              }}
            />
          ) : null}
          {row.customerMeta.replace(/^●\s*/, "")}
        </Box>
      </Box>
      <AmountCell value={row.amount} color={COL_INK_2} />
      <AmountCell
        value={row.paid}
        color={row.paidTone === "good" ? COL_GOOD : COL_INK_4}
      />
      <AmountCell value={row.balance} color={COL_INK} bold />
      <Text
        fz={11}
        fw={500}
        c={ageColor(row.ageTone)}
        style={{ fontFamily: ERP_LIST_FONT_MONO, textAlign: "right" }}
      >
        {row.ageDisplay}
      </Text>
      <Box style={{ textAlign: "right" }}>
        <StatusBadge status={row.status} tone={row.statusTone} />
      </Box>
      <IconChevronRight size={16} color={COL_INK_4} stroke={1.75} />
    </Box>
  );
}

type CollectionOutstandingInvoicesTableProps = {
  invoices: CollectionOutstandingInvoiceRow[];
  loading?: boolean;
  branchName?: string;
};

export function CollectionOutstandingInvoicesTable({
  invoices,
  loading,
  branchName,
}: CollectionOutstandingInvoicesTableProps) {
  const [selectedInvoice, setSelectedInvoice] =
    useState<CollectionOutstandingInvoiceRow | null>(null);
  const [secondTrillOpened, setSecondTrillOpened] = useState(false);

  const handleInvoiceSelect = (row: CollectionOutstandingInvoiceRow) => {
    setSelectedInvoice(row);
    setSecondTrillOpened(true);
  };

  return (
    <>
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <Box
        px={16}
        py={12}
        style={{
          borderBottom: `1px solid ${COL_LINE}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Text fz={13} fw={600} c={COL_INK}>
          Document-wise Outstanding
        </Text>
        <Text fz={11} c={COL_INK_4}>
          Customer receivable · click to open invoice
        </Text>
      </Box>

      <Box style={{ overflowX: "auto" }}>
      <Box px={16} py={10} style={{ ...INVOICE_GRID, borderBottom: `1px solid ${COL_LINE}`, minWidth: 720 }}>
        <Text style={headerStyle}>Invoice</Text>
        <Text style={headerStyle}>Customer</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Amount</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Paid</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Balance</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Age</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Status</Text>
        <span />
      </Box>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} px={16} py={12} style={{ borderBottom: `1px solid ${COL_LINE}` }}>
            <Skeleton height={36} />
          </Box>
        ))
      ) : invoices.length ? (
        invoices.map((row) => (
            <InvoiceRow
              key={row.invoiceId || row.documentNo}
              row={row}
              onSelect={handleInvoiceSelect}
            />
          ))
      ) : (
        <Box px={16} py={28} style={{ minWidth: 720 }}>
          <Text fz={12} c={COL_INK_4} ta="center">
            No outstanding invoices for this branch in the selected period.
          </Text>
        </Box>
      )}
      </Box>
    </Box>

    <CollectionDashboardSecondTrill
      opened={secondTrillOpened}
      onClose={() => {
        setSecondTrillOpened(false);
        setSelectedInvoice(null);
      }}
      onBack={() => setSecondTrillOpened(false)}
      invoice={selectedInvoice}
      branchName={branchName}
    />
    </>
  );
}
