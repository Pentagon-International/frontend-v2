import { DebitCreditNoteCreateBase } from "../debit-credit-note-non-trade/DebitCreditNoteNonTradeCreate";

export default function DebitCreditNoteTradeCreate() {
  return <DebitCreditNoteCreateBase payloadType="trade" showTradeFields />;
}

