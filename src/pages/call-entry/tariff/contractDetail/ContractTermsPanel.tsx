import type { ContractBasics } from "./types";
import { ContractDetailTermsGrid } from "./ContractDetailHeader";

type ContractTermsPanelProps = {
  basics: ContractBasics;
};

export default function ContractTermsPanel({ basics }: ContractTermsPanelProps) {
  return (
    <section className="contract-detail-panel">
      <h3>Contract terms</h3>
      <ContractDetailTermsGrid basics={basics} />
    </section>
  );
}
