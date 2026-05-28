import type { ContractDetailResponse } from "./types";
import { formatAvgBuyRateSummary } from "./utils";

type ContractDetailSummaryCardsProps = {
  data: ContractDetailResponse;
};

export default function ContractDetailSummaryCards({
  data,
}: ContractDetailSummaryCardsProps) {
  const avgBuyRate = formatAvgBuyRateSummary(data);
  const rateLineCount = data.rate_sheet.length;
  const laneCount = data.rate_sheet_summary.lane_count;
  const surchargeCount = data.surcharges_summary.applied_count;

  return (
    <div className="contract-detail-summary">
      <div className="contract-detail-summary-card">
        <span className="label">Avg buy rate</span>
        <strong>{avgBuyRate.value}</strong>
        <span className="meta">{avgBuyRate.currency}</span>
      </div>
      <div className="contract-detail-summary-card">
        <span className="label">Rate lines</span>
        <strong>{rateLineCount}</strong>
        <span className="meta">across {laneCount} lane{laneCount === 1 ? "" : "s"}</span>
      </div>
      <div className="contract-detail-summary-card">
        <span className="label">Surcharges</span>
        <strong>{surchargeCount}</strong>
        <span className="meta">auto-applied</span>
      </div>
    </div>
  );
}
