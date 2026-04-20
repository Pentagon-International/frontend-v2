import { AppShell, Box } from "@mantine/core";
import { Navbar } from "../components/index";
import MainSectionHeader from "../components/MainSectionHeader";
import ChatBot from "../pages/dashboard/Chatbot";
import { useLayoutStore } from "../store/useLayoutStore";

const AppShellLayout = ({ children }) => {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useLayoutStore();
  const navbarWidth = isSidebarCollapsed ? 64 : 260;

  return (
    <AppShell
      navbar={{
        width: navbarWidth,
        breakpoint: "xs",
      }}
    >
      {/* Sidebar */}
      <AppShell.Navbar
        p={isSidebarCollapsed ? "" : "sm"}
        style={{
          zIndex: 10,
          background: "#0D1B2E",
          width: navbarWidth,
          minWidth: navbarWidth,
          borderRight: "none",
          boxShadow: "2px 0 12px rgba(0, 0, 0, 0.18)",
        }}
      >
        <Navbar
          opened={!isSidebarCollapsed}
          toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </AppShell.Navbar>

      {/* Main content area */}
      <AppShell.Main
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          paddingTop: 0,
          overflow: "visible",
          background: "#F0F4F8",
        }}
      >
        {/* Sticky top header */}
        <Box
          style={{
            zIndex: 10,
            position: "sticky",
            top: 0,
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <MainSectionHeader />
        </Box>

        {/* Page content */}
        <Box
          px="md"
          my="md"
          style={{
            flexGrow: 1,
            minHeight: 0,
            height: "100%",
          }}
        >
          {children}
        </Box>
      </AppShell.Main>

      <ChatBot />
    </AppShell>
  );
};

export default AppShellLayout;
