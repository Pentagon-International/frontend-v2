import ReceiptCreate from "./ReceiptCreate";

/**
 * Receipt Reversal page: same form and fields as Receipt Create.
 * Used when reversing a posted receipt (e.g. from Receipt Master action menu).
 */
export default function ReceiptReversal() {
  return (
    <ReceiptCreate
      titleOverride="Receipt Reversal"
      backPath="/receipt"
      isReversal
    />
  );
}
