// hooks/usePageTitleSync.ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLayoutStore } from "../store/useLayoutStore";

const pathTitleMap: Record<string, string> = {
  "/": "Dashboard",
  "/lead": "Sales",
  "/call-entry": "Sales",
  "/call-entry-create": "Sales",
  "/call-entry-calendar": "Sales",
  "/enquiry": "Sales",
  "/get-rate": "Sales",
  "/enquiry-create": "Sales",
  "/quotation": "Sales",
  "/potential-customers": "Sales",
  "/pipeline": "Sales",
  "/quotation-create": "Sales",
  "/tariff": "Sales",
  "/tariff-create": "Sales",
  "/tariff-bulk-upload": "Sales",
  "/road": "Road",
  "/air": "Air",
  "/SeaExport": "Ocean",
  "/accounts": "Accounts",
  "/supplier-invoice/reversal/create": "Supplier Invoice Reverse",
  "/supplier-invoice/reversal/edit": "Supplier Invoice Reverse",
  "/supplier-invoice/reversal/view": "Supplier Invoice Reverse",
  "/supplier-invoice/reversal": "Supplier Invoice Reversal List",
  "/supplier-invoice/edit": "Supplier Invoice",
  "/supplier-invoice/view": "Supplier Invoice",
  "/supplier-invoice/create": "Supplier Invoice",
  "/supplier-invoice": "Supplier Invoice",
  "/receipt/reversal/view": "Receipt Reversal",
  "/receipt/reversal/edit": "Receipt Reversal",
  "/receipt/reversal/create": "Receipt Reversal",
  "/receipt/reversal": "Receipt Reversal",
  "/receipt/view": "Receipt",
  "/receipt/edit": "Receipt",
  "/receipt/create": "Receipt",
  "/receipt": "Receipt",
  "/payment/view": "Payment",
  "/payment/edit": "Payment",
  "/payment/create": "Payment",
  "/payment": "Payment",
  "/master": "Masters",
  "/reports": "Reports",
  "/help": "Help",
  "/collapse": "Collapse",
  "/settings": "Settings",
  "/customer-service": "Customer Service",

  // if different title for sub-routes
  //   '/master/group-company': 'Group Company',
  //   '/master/company': 'Company',
};

export const usePageTitleSync = () => {
  const location = useLocation();
  const setTitle = useLayoutStore((state) => state.setTitle);
  const setActiveNav = useLayoutStore((state) => state.setActiveNav);

  useEffect(() => {
    const path = location.pathname;
    const matchedPath = Object.keys(pathTitleMap)
      .filter((key) => path.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    const pageTitle = pathTitleMap[matchedPath] || "";
    // console.log("Path-----",path, "----pageTitle---",pageTitle);
    setTitle(pageTitle);
    setActiveNav(pageTitle);
  }, [location.pathname, setTitle, setActiveNav]);
};
