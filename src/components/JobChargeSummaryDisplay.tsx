import { Grid, Stack, Text } from "@mantine/core";
import {
  formatJobSummaryAmount,
  getHouseChargesForTotals,
  getUserLoggedInCurrencyCode,
  resolveHouseLocalTotals,
  type HousingLevelSummary,
} from "../utils/jobSummaryTotals";
import type { BranchCurrencyContext } from "../utils/userNumberFormat";

type ChargeLike = {
  sell_local_amount?: unknown;
  local_amount?: unknown;
  cost_local_amount?: unknown;
};

type HouseChargeSource = {
  charges?: ChargeLike[];
  mawb_charges?: ChargeLike[];
  mbl_charges?: ChargeLike[];
  summary?: HousingLevelSummary | null;
};

type HouseCardSummaryTotalsProps = {
  house?: HouseChargeSource | null;
  charges?: ChargeLike[];
  summary?: HousingLevelSummary | null;
  branches?: BranchCurrencyContext[] | null;
};

function ColumnTotalValue({
  value,
  branches,
}: {
  value: number | null;
  branches?: BranchCurrencyContext[] | null;
}) {
  return (
    <Text size="sm" fw={600}>
      {formatJobSummaryAmount(value, branches)}
    </Text>
  );
}

export function HouseCardSummaryTotals({
  house,
  charges,
  summary,
  branches,
}: HouseCardSummaryTotalsProps) {
  const chargeRows = house
    ? getHouseChargesForTotals(house)
    : getHouseChargesForTotals({ charges });
  const summaryData = summary ?? house?.summary ?? null;
  const { totalSell, totalCost } = resolveHouseLocalTotals(
    chargeRows,
    summaryData,
  );
  const currencyLabel = getUserLoggedInCurrencyCode(branches);

  const sellLabel = currencyLabel
    ? `Total Sell (${currencyLabel})`
    : "Total Sell";
  const costLabel = currencyLabel
    ? `Total Cost (${currencyLabel})`
    : "Total Cost";

  return (
    <>
      <Grid.Col span={2}>
        <Stack gap={4}>
          <Text size="sm" fw={500} c="dimmed">
            {sellLabel}
          </Text>
          <Text size="sm" fw={600}>
            {formatJobSummaryAmount(totalSell, branches)}
          </Text>
        </Stack>
      </Grid.Col>
      <Grid.Col span={2}>
        <Stack gap={4}>
          <Text size="sm" fw={500} c="dimmed">
            {costLabel}
          </Text>
          <Text size="sm" fw={600}>
            {formatJobSummaryAmount(totalCost, branches)}
          </Text>
        </Stack>
      </Grid.Col>
    </>
  );
}

type ChargesLocalAmountTotalsRowProps = {
  house?: HouseChargeSource | null;
  charges?: ChargeLike[];
  summary?: HousingLevelSummary | null;
  branches?: BranchCurrencyContext[] | null;
  /** Grid span before the Amount column (Total label). */
  offsetBeforeAmountCol?: number;
  /**
   * @deprecated Prefer offsetBeforeAmountCol. When set, amount offset is derived as
   * offsetBeforeSellCol - amountColSpan.
   */
  offsetBeforeSellCol?: number;
  amountColSpan?: number;
  sellColSpan?: number;
  /** Grid span between sell local and cost local columns */
  middleColSpan?: number;
  costColSpan?: number;
};

export function ChargesLocalAmountTotalsRow({
  house,
  charges,
  summary,
  branches,
  offsetBeforeAmountCol,
  offsetBeforeSellCol = 7.2,
  amountColSpan = 0.85,
  sellColSpan = 0.85,
  middleColSpan = 1.7,
  costColSpan = 0.85,
}: ChargesLocalAmountTotalsRowProps) {
  const chargeRows = house
    ? getHouseChargesForTotals(house)
    : getHouseChargesForTotals({ charges });
  const summaryData = summary ?? house?.summary ?? null;
  const { totalSell, totalCost } = resolveHouseLocalTotals(
    chargeRows,
    summaryData,
  );

  const amountOffset =
    offsetBeforeAmountCol ?? Math.max(0, offsetBeforeSellCol - amountColSpan);

  return (
    <Grid mt="xs" gutter="sm" style={{ color: "#105476" }} align="flex-start">
      <Grid.Col span={amountOffset} />
      <Grid.Col span={amountColSpan}>
        <Text size="sm" fw={600} c="#105476" ta="right" pr={22}>
          Total:
        </Text>
      </Grid.Col>
      <Grid.Col span={sellColSpan}>
        <ColumnTotalValue value={totalSell} branches={branches} />
      </Grid.Col>
      <Grid.Col span={middleColSpan} />
      <Grid.Col span={costColSpan}>
        <ColumnTotalValue value={totalCost} branches={branches} />
      </Grid.Col>
    </Grid>
  );
}
