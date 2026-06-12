import { AppShell, Box } from "@mantine/core";
import { Navbar } from "../components/index";
import MainSectionHeader from "../components/MainSectionHeader";
import GlobalOperationsChatModal from "../pages/Workflow/GlobalOperationsChatModal";
import { useLayoutStore } from "../store/useLayoutStore";
import { useLocation } from "react-router-dom";

const AppShellLayout = ({ children }) => {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useLayoutStore();
  const navbarWidth = isSidebarCollapsed ? 64 : 260;
   const location = useLocation();
  const isWorkflowPage = location.pathname.includes("/workflow/chatbot");

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
          }}
        >
          <MainSectionHeader />
        </Box>

        {/* Page content */}
        <Box
          px={{ base: isWorkflowPage ? 0 :16, sm: isWorkflowPage ? 0 : 24 }}
          mt={0}
          mb={isWorkflowPage ? 0 : "md"}
          style={{
            flexGrow: 1,
            minHeight: 0,
            height: "100%",
          }}
        >
          {children}
        </Box>
      </AppShell.Main>

      <GlobalOperationsChatModal />
    </AppShell>
  );
};

export default AppShellLayout;
