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
    } else if (path.startsWith("/hbl-document-manager")) {
      setActiveNav("Jobcreation");
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
