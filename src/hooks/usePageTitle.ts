// hooks/usePageTitleSync.ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLayoutStore } from "../store/useLayoutStore";

const pathTitleMap: Record<string, string> = {
  "/dashboard/enquiry-conversion": "Dashboard",
  "/finance-dashboard/profitability": "Finance Dashboard",
  "/finance-dashboard/branch-budget-vs-actual": "Finance Dashboard",
  "/finance-dashboard/collection-target-vs-performance": "Finance Dashboard",
  "/finance-dashboard/outstanding-ageing": "Finance Dashboard",
  "/finance-dashboard/pending-activities": "Finance Dashboard",
  "/": "Dashboard",
  "/lead": "Sales",
  "/call-entry": "Sales",
  "/call-entry-create": "Sales",
  "/call-entry-calendar": "Sales",
  "/enquiry": "Sales",
  "/get-rate": "Sales",
  "/enquiry-create": "Sales",
  "/rfq-create": "Sales",
  "/rfq": "Sales",
  "/quotation": "Sales",
  "/potential-customers": "Sales",
  "/pipeline": "Sales",
  "/quotation-create": "Sales",
  "/tariff": "Sales",
  "/tariff-create": "Sales",
  "/tariff-bulk-upload": "Sales",
  "/road": "Road",
  "/inland": "Inland",
  "/air": "Air",
  "/SeaExport": "Ocean",
  "/air/import-dsr": "Air Import DSR",
  "/air/export-dsr": "Air Export DSR",
  "/SeaExport/import-dsr": "Ocean Import DSR",
  "/SeaExport/export-dsr": "Ocean Export DSR",
  "/accounts": "Accounts",
  "/supplier-invoice/reversal/create": "Supplier Invoice Reverse",
  "/supplier-invoice/reversal/edit": "Supplier Invoice Reverse",
  "/supplier-invoice/reversal/view": "Supplier Invoice Reverse",
  "/supplier-invoice/reversal": "Supplier Invoice Reversal List",
  "/supplier-invoice/edit": "Supplier Invoice",
  "/supplier-invoice/view": "Supplier Invoice",
  "/supplier-invoice/create": "Supplier Invoice",
  "/supplier-invoice": "Supplier Invoice List",
  "/checker": "Checker",
  "/unposted-documents": "Unposted Documents",
  "/invoices": "Unposted Documents",
  "/receipt/reversal/view": "Receipt Reversal",
  "/receipt/reversal/edit": "Receipt Reversal",
  "/receipt/reversal/create": "Receipt Reversal",
  "/receipt/reversal": "Receipt Reversal List",
  "/receipt/view": "Receipt",
  "/receipt/edit": "Receipt",
  "/receipt/create": "Receipt",
  "/receipt": "Receipt List",
  "/overseas-receipt/view": "Overseas Receipt",
  "/overseas-receipt/edit": "Overseas Receipt",
  "/overseas-receipt/create": "Overseas Receipt",
  "/overseas-receipt": "Overseas Receipt List",
  "/overseas-payment/view": "Overseas Payment",
  "/overseas-payment/edit": "Overseas Payment",
  "/overseas-payment/create": "Overseas Payment",
  "/overseas-payment": "Overseas Payment List",
  "/payment/view": "Payment",
  "/payment/edit": "Payment",
  "/payment/create": "Payment",
  "/payment": "Payment List",
  "/journal-voucher/view": "Journal Voucher",
  "/journal-voucher/edit": "Journal Voucher",
  "/journal-voucher/create": "Journal Voucher",
  "/journal-voucher": "Journal Voucher List",
  "/invoice-reverse": "Invoice Reverse",
  "/payment-request-approval": "Payment Request List",
  "/payment-request": "Payment Request",
  "/payment/reversal/view": "Payment Reversal",
  "/payment/reversal/edit": "Payment Reversal",
  "/payment/reversal/create": "Payment Reversal",
  "/payment/reversal": "Payment Reversal List",
  "/subledger-enquiry": "Subledger Enquiry",
  "/document-allocation": "Document Allocation",
  "/debit-credit-note-trade": "Debit/Credit Note Trade",
  "/debit-credit-note-non-trade": "Debit/Credit Note Non Trade",
  "/service-job": "Service Job",
  "/job-closure": "Job Closure",
  "/job-profit-verification": "Job Profit Verification",
  "/job-reopen": "Reopen Job",
  "/bank-reconciliation/create": "Bank Reconciliation",
  "/bank-reconciliation": "Bank Reconciliation",
  "/master": "Masters",
  "/master/create-customer": "Customer for Approval",
  "/reports": "Reports",
  "/help": "Help",
  "/collapse": "Collapse",
  "/settings": "Settings",
  "/customer-service": "Customer Service",
  "/automation/import-job": "Import Job",
  "/automation/vendor-invoice": "Vendor Invoice",
  "/automation/odex-jobs": "ODEX Jobs",
  "/automation/job-creation": "Import Job",
  "/automation/invoice-manager": "Vendor Invoice",
  "/workflow/hbl-document-manager": "Import Job",
  "/workflow/invoice-manager": "Vendor Invoice",
  "/hbl-document-manager": "Import Job",
  "/invoice": "Invoice",
  "/workflow/chatbot": "Chatbot",
  "/workflow/chatbot-google": "Chatbot",
  "/workflow/chatbot-browser": "Chatbot",
  "/chatbot": "Chatbot",
  "/chatbot-google": "Chatbot",
  "/chatbot-browser": "Chatbot",

  // if different title for sub-routes
  //   '/master/group-company': 'Group Company',
  //   '/master/company': 'Company',
};

const pathActiveNavMap: Record<string, string> = {
  "/finance-dashboard/profitability": "Finance Dashboard",
  "/finance-dashboard/branch-budget-vs-actual": "Finance Dashboard",
  "/finance-dashboard/collection-target-vs-performance": "Finance Dashboard",
  "/finance-dashboard/outstanding-ageing": "Finance Dashboard",
  "/finance-dashboard/pending-activities": "Finance Dashboard",
  "/air/import-dsr": "Transportation",
  "/air/export-dsr": "Transportation",
  "/SeaExport/import-dsr": "Transportation",
  "/SeaExport/export-dsr": "Transportation",
};

const pathActiveSubNavMap: Record<string, string> = {
  "/finance-dashboard/profitability": "Profitability",
  "/finance-dashboard/branch-budget-vs-actual": "Branch Budget vs Actual",
  "/finance-dashboard/collection-target-vs-performance": "Collection Target vs Performance",
  "/finance-dashboard/outstanding-ageing": "Outstanding & Ageing",
  "/finance-dashboard/pending-activities": "Pending Activities",
  "/air/import-dsr": "Air import DSR",
  "/air/export-dsr": "Air export DSR",
  "/SeaExport/import-dsr": "Ocean Import DSR",
  "/SeaExport/export-dsr": "Ocean Export DSR",
  "/checker": "Checker",
  "/unposted-documents": "Unposted Documents",
  "/invoices": "Unposted Documents",
  "/invoice-reverse": "Invoice Reverse",
};

export const usePageTitleSync = () => {
  const location = useLocation();
  const setTitle = useLayoutStore((state) => state.setTitle);
  const setActiveNav = useLayoutStore((state) => state.setActiveNav);
  const setActiveSubNav = useLayoutStore((state) => state.setActiveSubNav);

  useEffect(() => {
    const path = location.pathname;
    const matchedTitlePath = Object.keys(pathTitleMap)
      .filter((key) => path.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    const pageTitle = pathTitleMap[matchedTitlePath] || "";

    const matchedActiveNavPath = Object.keys(pathActiveNavMap)
      .filter((key) => path.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    const activeNav = pathActiveNavMap[matchedActiveNavPath] ?? pageTitle;

    const matchedSubNavPath = Object.keys(pathActiveSubNavMap)
      .filter((key) => path.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    const activeSubNav = pathActiveSubNavMap[matchedSubNavPath] ?? "";

    setTitle(pageTitle);
    setActiveNav(activeNav);
    setActiveSubNav(activeSubNav);
  }, [location.pathname, setTitle, setActiveNav, setActiveSubNav]);
};
