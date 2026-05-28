type ContractDetailFooterProps = {
  rateLineCount: number;
  surchargeCount: number;
  isEditable?: boolean;
  onClose: () => void;
};

export default function ContractDetailFooter({
  rateLineCount,
  surchargeCount,
  isEditable,
  onClose,
}: ContractDetailFooterProps) {
  return (
    <div className="contract-detail-footer">
      <div className="contract-detail-footer-checks">
        <span className={rateLineCount > 0 ? "ok" : ""}>
          {rateLineCount > 0 ? "✓" : "○"} {rateLineCount} rate lines
        </span>
        <span className={surchargeCount > 0 ? "ok" : ""}>
          {surchargeCount > 0 ? "✓" : "○"} {surchargeCount} surcharges
        </span>
      </div>
      <div className="contract-detail-footer-actions">
        <button type="button" className="contract-detail-outline-btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="contract-detail-outline-btn" disabled={!isEditable}>
          Upload rate sheet
        </button>
        <button type="button" className="contract-detail-outline-btn">
          Export PDF
        </button>
        <button type="button" className="contract-detail-primary-btn" disabled={!isEditable}>
          Edit contract
        </button>
        <button type="button" className="contract-detail-danger-btn" disabled={!isEditable}>
          Suspend
        </button>
      </div>
    </div>
  );
}
