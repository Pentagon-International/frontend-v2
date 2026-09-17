import { Outlet } from "react-router-dom";
import AppShellLayout from "./AppShellLayout";
import { LayoutSync } from "./LayoutSync";
import AllocationDocumentOpenHydrator from "./AllocationDocumentOpenHydrator";

const RootLayout = () => {
  return (
    <AppShellLayout>
      <LayoutSync />
      <AllocationDocumentOpenHydrator />
      <Outlet />
    </AppShellLayout>
  );
};

export default RootLayout;