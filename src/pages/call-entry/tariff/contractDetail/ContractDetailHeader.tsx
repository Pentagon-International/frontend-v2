import type { ContractBasics } from "./types";
import {
  formatApiDate,
  formatDaysLeft,
  getAutoRenewLabel,
  getServiceModeLabel,
  getStatusPresentation,
  getVendorTypeLabel,
} from "./utils";

type ContractDetailHeaderProps = {
  contractId: string;
  basics: ContractBasics;
  onClose: () => void;
};

export default function ContractDetailHeader({
  contractId,
  basics,
  onClose,
}: ContractDetailHeaderProps) {
  const status = getStatusPresentation(basics.status);

  return (
    <div className="contract-detail-header">
      <div className="contract-detail-header-main">
        <div className="contract-detail-title-row">
          <h2>{contractId}</h2>
          <span className={`contract-detail-status ${status.className}`}>
            <span className="dot" />
            {status.label}
          </span>
        </div>
        <div className="contract-detail-subtitle">
          {basics.vendor_reference} · {basics.carrier_name} ·{" "}
          {getServiceModeLabel(basics.service)}
        </div>
      </div>
      <button
        type="button"
        className="contract-detail-close"
        onClick={onClose}
        aria-label="Close contract detail"
      >
        ×
      </button>
    </div>
  );
}

export function ContractDetailTermsGrid({ basics }: { basics: ContractBasics }) {
  const daysLeft = formatDaysLeft(basics.valid_to);

  return (
    <div className="contract-detail-terms-grid">
      <div className="contract-detail-term">
        <span className="label">Vendor</span>
        <span className="value">
          {basics.carrier_name} ({basics.carrier_code})
        </span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Vendor type</span>
        <span className="value">{getVendorTypeLabel(basics.service)}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Reference</span>
        <span className="value">{basics.vendor_reference}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Mode</span>
        <span className="value">{getServiceModeLabel(basics.service)}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Coverage</span>
        <span className="value">{basics.coverage_description || "—"}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Start</span>
        <span className="value">{formatApiDate(basics.valid_from)}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">End</span>
        <span className="value">
          {formatApiDate(basics.valid_to)}
          {daysLeft !== "—" ? ` (${daysLeft})` : ""}
        </span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Currency</span>
        <span className="value">{basics.currency_code}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Owner</span>
        <span className="value">{basics.created_by || "—"}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Approver</span>
        <span className="value">{basics.approved_by || "—"}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Auto-renew</span>
        <span className="value">{getAutoRenewLabel(basics)}</span>
      </div>
      <div className="contract-detail-term">
        <span className="label">Country</span>
        <span className="value">{basics.country_code || "—"}</span>
      </div>
    </div>
  );
}
