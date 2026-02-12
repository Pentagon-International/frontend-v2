import ReceiptCreate from "../receipt/ReceiptCreate";

/**
 * Receipt Reversal page: same form and fields as Receipt Create.
 * Used for create (from Receipt Master) or view/edit (from Receipt Reversal list).
 * Back navigates to Receipt Reversal list.
 */
export default function ReceiptReversal() {
  return (
    <ReceiptCreate
      titleOverride="Receipt Reversal"
      backPath="/receipt/reversal"
      isReversal
    />
  );
}
