import type { ContractBasics } from "./types";

type ContractVendorSectionProps = {
  basics: ContractBasics;
  rateLineCount: number;
  laneCount: number;
  surchargeCount: number;
  updatedAtLabel: string;
};

export default function ContractVendorSection({
  basics,
  rateLineCount,
  laneCount,
  surchargeCount,
  updatedAtLabel,
}: ContractVendorSectionProps) {
  return (
    <section className="contract-detail-panel contract-detail-vendor">
      <h3>Vendor summary</h3>
      <div className="contract-detail-vendor-grid">
        <div className="contract-detail-vendor-row">
          <span>Vendor</span>
          <strong>{basics.carrier_name}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Country</span>
          <strong>{basics.country_code || "—"}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Rate lines</span>
          <strong>{rateLineCount}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Lanes covered</span>
          <strong>{laneCount}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Surcharges applied</span>
          <strong>{surchargeCount}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Last updated</span>
          <strong>{updatedAtLabel}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Contract owner</span>
          <strong>{basics.created_by || "—"}</strong>
        </div>
        <div className="contract-detail-vendor-row">
          <span>Approver</span>
          <strong>{basics.approved_by || "—"}</strong>
        </div>
      </div>
    </section>
  );
}
