export type PaymentApprovalDocument = {
  id?: number | string;
  document_name?: string | null;
  file_name?: string | null;
  document_url?: string | null;
  document?: string | null;
  url?: string | null;
  [key: string]: unknown;
};

export type PaymentApprovalAllocation = {
  id?: number | string;
  location?: string | null;
  day_book_name?: string | null;
  day_book_code?: string | null;
  type?: string | null;
  account_code?: string | null;
  subledger_name?: string | null;
  subledger?: string | null;
  document_no?: string | null;
  Inv_Crn_no?: string | null;
  document_date?: string | null;
  currency_code?: string | null;
  currency_name?: string | null;
  adj_curr_amount?: number | string | null;
  adj_local_amount?: number | string | null;
  dr_cr?: string | null;
  Dr_Cr?: string | null;
  documents?: PaymentApprovalDocument[];
  [key: string]: unknown;
};

export type PaymentApprovalRow = {
  id?: number | string;
  sno?: number;
  day_book_name?: string;
  payment_no?: string;
  date?: string;
  type?: string;
  status?: string;
  approval_status?: string;
  amount?: number | string;
  parties?: Array<{
    subledger_name?: string | null;
    [key: string]: unknown;
  }>;
  allocations?: PaymentApprovalAllocation[];
  [key: string]: unknown;
};

export type PaymentApprovalFilters = {
  day_book_id: string;
  day_book_name: string;
  payment_no: string;
  date_from: Date | null;
  date_to: Date | null;
  type: string;
  approval_status: string;
  parties_account_name: string;
  allocation_document_no: string;
  branch_code: string;
};

export type PaymentApprovalColumnVisibility = {
  sno: boolean;
  day_book_name: boolean;
  party_name: boolean;
  payment_no: boolean;
  date: boolean;
  type: boolean;
  amount: boolean;
  status: boolean;
  approval_status: boolean;
};

export const paymentApprovalColumnDefault: PaymentApprovalColumnVisibility = {
  sno: true,
  day_book_name: true,
  party_name: true,
  payment_no: true,
  date: true,
  type: true,
  amount: true,
  status: true,
  approval_status: true,
};

export const paymentApprovalColumnLabels: Record<
  keyof PaymentApprovalColumnVisibility,
  string
> = {
  sno: "S.No",
  day_book_name: "Day Book",
  party_name: "Party name",
  payment_no: "Payment No",
  date: "Date",
  type: "Type",
  amount: "Amount",
  status: "Status",
  approval_status: "Approval Status",
};
