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
