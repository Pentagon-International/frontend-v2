import { AppShell, Box, Divider } from "@mantine/core";
import { Navbar } from "../components/index";
import MainSectionHeader from "../components/MainSectionHeader";
import ChatBot from "../pages/dashboard/Chatbot";
import { useLayoutStore } from "../store/useLayoutStore";

const AppShellLayout = ({ children }) => {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useLayoutStore();
  const navbarWidth = isSidebarCollapsed ? 80 : 237;

  return (
    <AppShell
      padding="md"
      navbar={{
        width: navbarWidth,
        breakpoint: "xs",
      }}
    >
      {/* NavBar Section */}
      <AppShell.Navbar
        p={isSidebarCollapsed ? "" : "sm"}
        style={{
          background: "#F8F9FF",
          width: navbarWidth,
          minWidth: navbarWidth,
        }}
      >
        <Navbar
          opened={!isSidebarCollapsed}
          toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </AppShell.Navbar>

      {/* Main Section */}
      <AppShell.Main
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          paddingTop: 0,
          overflow: "visible",
        }}
      >
        <Box
          style={{
            zIndex: 10,
            position: "sticky",
            top: 0,
            backgroundColor: "white",
            paddingTop: "16px",
          }}
        >
          <MainSectionHeader />
          <Divider my="md" />
        </Box>
        <Box
          style={{
            flexGrow: 1,
            minHeight: 0,
            height: "100%",
          }}
        >
          {children}
        </Box>
      </AppShell.Main>

      {/* Global Chatbot - available on all pages */}
      <ChatBot />
    </AppShell>
  );
};

export default AppShellLayout;
