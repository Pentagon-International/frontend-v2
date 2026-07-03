import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLayoutStore } from "../store/useLayoutStore";

export const LayoutSync = () => {
  const location = useLocation();
  const { setActiveNav, setActiveSubNav, setActiveTariffSubNav } =
    useLayoutStore();

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/tariff")) {
      setActiveNav("Sales");
      setActiveSubNav("Tariff");
      if (path.includes("freight")){
        setActiveTariffSubNav("Freight");
      } else if (path.includes("contracts/create")) {
        setActiveTariffSubNav("Contracts");
      } else if (/^\/tariff\/contracts\/[^/]+\/[^/]+$/.test(path)) {
        setActiveTariffSubNav("Contracts");
      } else if (path.includes("contracts")) {
        setActiveTariffSubNav("Contracts");
      } else if (path.includes("origin")) {
        setActiveTariffSubNav("Origin");
      } else if (path.includes("destination")) {
        setActiveTariffSubNav("Destination");
      }
    } else if (path.startsWith("/lead")) {
      setActiveNav("Sales");
      setActiveSubNav("Lead");
    } else if (path.startsWith("/call-entry")) {
      setActiveNav("Sales");
      setActiveSubNav("Call Entry");
    } else if (path.startsWith("/enquiry")) {
      setActiveNav("Sales");
      setActiveSubNav("Enquiry");
    } else if (path.startsWith("/rfq")) {
      setActiveNav("Sales");
      setActiveSubNav("RFQ");
    } else if (path === "/quotation-approval" || path.startsWith("/quotation-approval/")) {
      setActiveNav("Sales");
      setActiveSubNav("Quotation Approval");
    } else if (path === "/quotation" || path.startsWith("/quotation/")) {
      setActiveNav("Sales");
      setActiveSubNav("Quotation");
    } else if (path === "/quotation-create" || path.startsWith("/quotation-create/")) {
      // Set active tab for quotation when navigated via create/edit quote flow
      setActiveNav("Sales");
      setActiveSubNav("Quotation");
    } else if (path.startsWith("/potential-customers")) {
      setActiveNav("Sales");
      setActiveSubNav("Potential Customers");
    } else if (path.startsWith("/pipeline")) {
      setActiveNav("Sales");
      setActiveSubNav("Pipeline");
    } else if (path.startsWith("/customer-service/export-shipment")) {
      setActiveNav("Customer Service");
      setActiveSubNav("Export Booking");
    } else if (path.startsWith("/customer-service/import-shipment")) {
      setActiveNav("Customer Service");
      setActiveSubNav("Import Booking");
    } else if (path.startsWith("/customer-service/import-to-export-booking")) {
      setActiveNav("Customer Service");
      setActiveSubNav("Import to Export Booking");
    } else if (path.startsWith("/inland/export-job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Export Job Generation");
    } else if (path.startsWith("/inland/job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Export Job Generation");
    } else if (path.startsWith("/inland/import-job")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Import Job");
    } else if (path.startsWith("/inland/import-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Import Booking");
    } else if (path.startsWith("/inland/export-job")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Export Job");
    } else if (path.startsWith("/inland/export-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Export Booking");
    } else if (path.startsWith("/inland")) {
      setActiveNav("Transportation");
      setActiveSubNav("Inland Export Booking");
    } else if (path.startsWith("/air/job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Export Job Generation");
    } else if (path.startsWith("/air/export-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Export Generation");
    } else if (path.startsWith("/air/export-job")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Export Job");
    } else if (path.startsWith("/air/import-job")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Import Job");
    } else if (path.startsWith("/air/export-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Export Booking");
    } else if (path.startsWith("/air/import-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Import Booking");
    } else if (path.startsWith("/air/import-to-export-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Import to Export Booking");
    } else if (path.startsWith("/air/import-dsr")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air import DSR");
    } else if (path.startsWith("/air/export-dsr")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air export DSR");
    } else if (path.startsWith("/air")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Export Job Generation"); // Default
    } else if (path.startsWith("/SeaExport/fcl-export-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("FCL Export Generation");
    } else if (path.startsWith("/SeaExport/lcl-export-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("LCL Export Generation");
    } else if (path.startsWith("/SeaExport/fcl-job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("FCL Job Generation");
    } else if (path.startsWith("/SeaExport/lcl-job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("LCL Job Generation");
    } else if (path.startsWith("/SeaExport/export-job")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Export Job");
    } else if (path.startsWith("/SeaExport/import-job")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Import Job");
    } else if (path.startsWith("/SeaExport/export-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Export Booking");
    } else if (path.startsWith("/SeaExport/import-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Import Booking");
    } else if (path.startsWith("/SeaExport/import-to-export-booking")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Import to Export Booking");
    } else if (path.startsWith("/SeaExport/import-dsr")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Import DSR");
    } else if (path.startsWith("/SeaExport/export-dsr")) {
      setActiveNav("Transportation");
      setActiveSubNav("Ocean Export DSR");
    } else if (path.startsWith("/SeaExport")) {
      setActiveNav("Transportation");
      setActiveSubNav("FCL Job Generation"); // Default to FCL
    } else if (path.startsWith("/payment-request-approval")) {
      setActiveNav("Desk");
      setActiveSubNav("Payment Request Approval");
    } else if (path.startsWith("/supplier-invoice-rcm")) {
      setActiveNav("Desk");
      setActiveSubNav("Supplier Invoice RCM");
    } else if (path.startsWith("/supplier-invoice/reversal")) {
      setActiveNav("Desk");
      setActiveSubNav("Supplier Invoice Reversal");
    } else if (path.startsWith("/invoice-reverse")) {
      setActiveNav("Desk");
      setActiveSubNav("Invoice Reverse");
    } else if (path.startsWith("/checker")) {
      setActiveNav("Desk");
      setActiveSubNav("Checker");
    } else if (path.startsWith("/unposted-documents") || path === "/invoices") {
      setActiveNav("Desk");
      setActiveSubNav("Unposted Documents");
    } else if (path.startsWith("/supplier-invoice")) {
      setActiveNav("Desk");
      setActiveSubNav("Supplier Invoice");
    } else if (path.startsWith("/receipt/reversal")) {
      setActiveNav("Desk");
      setActiveSubNav("Receipt Reversal");
    } else if (path.startsWith("/overseas-receipt")) {
      setActiveNav("Desk");
      setActiveSubNav("Overseas Receipt");
    } else if (path.startsWith("/receipt")) {
      setActiveNav("Desk");
      setActiveSubNav("Receipt");
    } else if (path.startsWith("/payment/reversal")) {
      setActiveNav("Desk");
      setActiveSubNav("Payment Reversal");
    } else if (path.startsWith("/overseas-payment")) {
      setActiveNav("Desk");
      setActiveSubNav("Overseas Payment");
    } else if (path.startsWith("/payment")) {
      setActiveNav("Desk");
      setActiveSubNav("Payment");
    } else if (path.startsWith("/journal-voucher-reversal")) {
      setActiveNav("Desk");
      setActiveSubNav("JournalVoucherReversal");
    } else if (path.startsWith("/journal-voucher")) {
      setActiveNav("Desk");
      setActiveSubNav("Journal Voucher");
    } else if (path.startsWith("/subledger-enquiry")) {
      setActiveNav("Desk");
      setActiveSubNav("Subledger Enquiry");
    } else if (path.startsWith("/document-allocation")) {
      setActiveNav("Desk");
      setActiveSubNav("Document Allocation");
    } else if (path.startsWith("/debit-credit-note-trade")) {
      setActiveNav("Desk");
      setActiveSubNav("Debit/Credit Note Trade");
    } else if (path.startsWith("/debit-credit-note-non-trade")) {
      setActiveNav("Desk");
      setActiveSubNav("Debit/Credit Note Non Trade");
    } else if (path.startsWith("/service-job")) {
      setActiveNav("Desk");
      setActiveSubNav("Service Job");
    } else if (path.startsWith("/job-closure")) {
      setActiveNav("Desk");
      setActiveSubNav("Job Closure");
    } else if (path.startsWith("/job-reopen")) {
      setActiveNav("Desk");
      setActiveSubNav("Reopen Job");
    } else if (path.startsWith("/automation/import-job") || path.startsWith("/automation/job-creation")) {
      setActiveNav("Automation");
      setActiveSubNav("Import Job");
    } else if (path.startsWith("/automation/vendor-invoice") || path.startsWith("/automation/invoice-manager")) {
      setActiveNav("Automation");
      setActiveSubNav("Vendor Invoice");
    } else if (path.startsWith("/automation/odex-jobs") || path.startsWith("/odex-jobs")) {
      setActiveNav("Automation");
      setActiveSubNav("ODEX Jobs");
    } else if (path.startsWith("/workflow/hbl-document-manager")) {
      setActiveNav("Automation");
      setActiveSubNav("Import Job");
    } else if (path.startsWith("/workflow/invoice-manager")) {
      setActiveNav("Automation");
      setActiveSubNav("Vendor Invoice");
    } else if (path.startsWith("/workflow/chatbot") || path.startsWith("/workflow/analytics")) {
      setActiveNav("Chatbot");
      setActiveSubNav("");
    } else if (path === "/invoice" || path.startsWith("/invoice/")) {
      setActiveNav("Invoice");
      setActiveSubNav("");
    } else if (path.startsWith("/accounts")) {
      setActiveNav("Desk");
      setActiveSubNav("Accounts");
    } else if (path.startsWith("/master")) {
      setActiveNav("Desk");
      setActiveSubNav("Masters");
    } else if (path.startsWith("/settings")) {
      setActiveNav("Desk");
      setActiveSubNav("Settings");
    } else if (path.startsWith("/reports")) {
      setActiveNav("System");
      setActiveSubNav("Reports");
    } else if (path.startsWith("/help")) {
      setActiveNav("System");
      setActiveSubNav("Help");
    } else if (path.startsWith("/dashboard/enquiry-conversion")) {
      setActiveNav("Dashboard");
      setActiveSubNav("Enquiry Conversion");
    } else if (path.startsWith("/finance-dashboard/profitability")) {
      setActiveNav("Finance Dashboard");
      setActiveSubNav("Profitability");
    } else if (path.startsWith("/finance-dashboard/branch-budget-vs-actual")) {
      setActiveNav("Finance Dashboard");
      setActiveSubNav("Branch Budget vs Actual");
    } else if (path.startsWith("/finance-dashboard/collection-target-vs-performance")) {
      setActiveNav("Finance Dashboard");
      setActiveSubNav("Collection Target vs Performance");
    } else if (path.startsWith("/finance-dashboard/outstanding-ageing")) {
      setActiveNav("Finance Dashboard");
      setActiveSubNav("Outstanding & Ageing");
    } else if (path.startsWith("/finance-dashboard/pending-activities")) {
      setActiveNav("Finance Dashboard");
      setActiveSubNav("Pending Activities");
    } else if (path === "/") {
      setActiveNav("Dashboard");
      setActiveSubNav("Overview");
    } else if (path === "/get-rate") {
      setActiveNav("Sales");
      setActiveSubNav("Enquiry");
    } else {
      setActiveNav("");
      setActiveSubNav("");
      setActiveTariffSubNav("");
    }
  }, [location.pathname]);

  return null;
};
