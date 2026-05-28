import type { AuditHistoryItem } from "./types";

type ContractAuditSectionProps = {
  items: AuditHistoryItem[];
};

export default function ContractAuditSection({ items }: ContractAuditSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="contract-detail-panel contract-detail-audit">
      <h3>Audit history</h3>
      <div className="contract-detail-timeline">
        {items.map((item) => (
          <div
            key={item.key}
            className={`contract-detail-timeline-item${item.isRecent ? " recent" : ""}`}
          >
            <span className="marker" />
            <div>
              <div className="time">{item.timestamp}</div>
              <div className="label">{item.label}</div>
              <div className="actor">{item.actor}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
