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

      if (path.includes("freight")) setActiveTariffSubNav("Freight");
      else if (path.includes("origin")) setActiveTariffSubNav("Origin");
      else if (path.includes("destination"))
        setActiveTariffSubNav("Destination");
    } else if (path.startsWith("/lead")) {
      setActiveNav("Sales");
      setActiveSubNav("Lead");
    } else if (path.startsWith("/call-entry")) {
      setActiveNav("Sales");
      setActiveSubNav("Call Entry");
    } else if (path.startsWith("/enquiry")) {
      setActiveNav("Sales");
      setActiveSubNav("Enquiry");
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
    } else if (path.startsWith("/air")) {
      setActiveNav("Transportation");
      setActiveSubNav("Air Export Generation"); // Default
    } else if (path.startsWith("/SeaExport/fcl-export-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("FCL Export Generation");
    } else if (path.startsWith("/SeaExport/lcl-export-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("LCL Export Generation");
    } else if (path.startsWith("/SeaExport/fcl-job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("FCL Export Generation");
    } else if (path.startsWith("/SeaExport/lcl-job-generation")) {
      setActiveNav("Transportation");
      setActiveSubNav("LCL Export Generation");
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
    } else if (path.startsWith("/SeaExport")) {
      setActiveNav("Transportation");
      setActiveSubNav("FCL Export Generation"); // Default to FCL
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
    } else if (path === "/") {
      setActiveNav("Dashboard");
      setActiveSubNav("");
    } else {
      setActiveNav("");
      setActiveSubNav("");
      setActiveTariffSubNav("");
    }
  }, [location.pathname]);

  return null;
};
