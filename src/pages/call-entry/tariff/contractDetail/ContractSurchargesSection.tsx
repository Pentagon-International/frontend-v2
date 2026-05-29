import type { ContractSurcharge } from "./types";
import {
  formatSurchargeRate,
  formatSurchargeSubtitle,
  getAppliedSurcharges,
} from "./utils";

type ContractSurchargesSectionProps = {
  surcharges: ContractSurcharge[];
  appliedCount: number;
  totalRows: number;
};

export default function ContractSurchargesSection({
  surcharges,
  appliedCount,
  totalRows,
}: ContractSurchargesSectionProps) {
  const applied = getAppliedSurcharges(surcharges);

  return (
    <section className="contract-detail-section">
      <div className="contract-detail-section-head">
        <div>
          <h3>Surcharges in this contract</h3>
          <p>
            {appliedCount} active · auto-applied to all rates in this contract
            {totalRows > 0 ? ` · ${totalRows} available` : ""}
          </p>
        </div>
      </div>

      {applied.length === 0 ? (
        <div className="contract-detail-empty">No surcharges applied to this contract.</div>
      ) : (
        <div className="contract-detail-surcharge-grid">
          {applied.map((item) => (
            <article key={item.id || item.charge_code} className="contract-detail-surcharge-card">
              <div className="contract-detail-surcharge-top">
                <span className="code">{item.charge_code}</span>
                <strong>{item.charge_name}</strong>
              </div>
              <div className="contract-detail-surcharge-sub">
                {formatSurchargeSubtitle(item)}
              </div>
              <div className="contract-detail-surcharge-rate">
                {formatSurchargeRate(item)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
