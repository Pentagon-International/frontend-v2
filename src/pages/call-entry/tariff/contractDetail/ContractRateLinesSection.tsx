import type { ContractBasics, ContractRateLine } from "./types";
import {
  formatDaysLeft,
  formatLaneLabel,
  formatMoney,
  getValidityPercent,
} from "./utils";

type ContractRateLinesSectionProps = {
  lines: ContractRateLine[];
  basics: ContractBasics;
};

export default function ContractRateLinesSection({
  lines,
  basics,
}: ContractRateLinesSectionProps) {
  const validityPercent = getValidityPercent(basics.valid_from, basics.valid_to);
  const daysLeftLabel = formatDaysLeft(basics.valid_to);

  return (
    <section className="contract-detail-section">
      <div className="contract-detail-section-head">
        <div>
          <h3>Rate lines</h3>
          <p>
            {lines.length} line{lines.length === 1 ? "" : "s"} · click any row to drill into
            rate detail
          </p>
        </div>
        {/* <button type="button" className="contract-detail-outline-btn">
          Upload update
        </button> */}
      </div>

      {lines.length === 0 ? (
        <div className="contract-detail-empty">No rate lines available.</div>
      ) : (
        <div className="contract-detail-table-wrap">
          <table className="contract-detail-table">
            <thead>
              <tr>
                <th>Lane / line</th>
                <th>Unit</th>
                <th>Buy rate</th>
                <th>Service</th>
                <th>Valid until</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id || `${line.line_no}-${line.origin_code}-${line.destination_code}`}>
                  <td>
                    <div className="contract-detail-lane">{formatLaneLabel(line)}</div>
                    {line.notes ? <div className="contract-detail-note">{line.notes}</div> : null}
                  </td>
                  <td>{line.equipment || line.unit || "—"}</td>
                  <td>
                    <strong>
                      {formatMoney(line.buy_rate || line.rate, basics.currency_code)}
                    </strong>
                  </td>
                  <td>{line.service_transit || "—"}</td>
                  <td>
                    <div className="contract-detail-validity-days">{daysLeftLabel}</div>
                    <div className="contract-detail-validity-bar">
                      <div
                        className="fill"
                        style={{ width: `${Math.max(0, Math.min(100, validityPercent))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
