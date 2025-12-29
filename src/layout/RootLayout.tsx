import { Outlet } from "react-router-dom";
import AppShellLayout from "./AppShellLayout";
import { LayoutSync } from "./LayoutSync";

const RootLayout = () => {
  return (
    <AppShellLayout>
      <LayoutSync />
      <Outlet />
    </AppShellLayout>
  );
};

export default RootLayout;