import {
  Box,
  Flex,
  Group,
  Indicator,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconBell } from "@tabler/icons-react";
import { useState } from "react";
import { useLayoutStore } from "../store/useLayoutStore";
import useAuthStore from "../store/authStore";
import ProfileDrawer from "./ProfileDrawer";

function MainSectionHeader() {
  const title = useLayoutStore((state) => state.title);
  const [profileDrawerOpened, setProfileDrawerOpened] = useState(false);

  const user = useAuthStore((state) => state.user);
  const fullName = user?.full_name || "User";
  const email = user?.email || "";

  return (
    <>
      <Flex
        justify="space-between"
        align="center"
        bg="white"
        style={{ padding: "0 24px", minHeight: "54px" }}
      >
        {/* Page title with enterprise blue left accent */}
        <Box
          style={{
            borderLeft: "3px solid #2563EB",
            paddingLeft: 12,
          }}
        >
          <Text
            fw={600}
            style={{
              fontSize: "17px",
              color: "#1E293B",
              letterSpacing: 0.1,
              lineHeight: 1.3,
            }}
          >
            {title}
          </Text>
        </Box>

        {/* Right section */}
        <Group gap="lg" align="center" wrap="nowrap">
          {/* Notification bell */}
          <Indicator
            size={7}
            color="red"
            style={{ cursor: "pointer" }}
            offset={2}
          >
            <IconBell
              size={20}
              stroke={1.5}
              color="#64748B"
              aria-label="Notifications"
            />
          </Indicator>

          {/* User profile */}
          <UnstyledButton
            onClick={() => setProfileDrawerOpened(true)}
            px={0}
            aria-label="Open profile menu"
          >
            <Group gap="sm" align="center" wrap="nowrap">
              <Box style={{ lineHeight: 1.35, textAlign: "right" }}>
                <Text
                  style={{
                    fontSize: "13.5px",
                    color: "#1E293B",
                    fontWeight: 500,
                    lineHeight: 1.35,
                  }}
                >
                  {fullName}
                </Text>
                <Text
                  style={{
                    fontSize: "12px",
                    color: "#94A3B8",
                    lineHeight: 1.2,
                  }}
                >
                  {email}
                </Text>
              </Box>

              {/* Avatar — gradient square with rounded corners */}
              <Flex
                justify="center"
                align="center"
                aria-hidden="true"
                style={{
                  width: "34px",
                  height: "34px",
                  color: "#ffffff",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  flexShrink: 0,
                  letterSpacing: 0,
                  userSelect: "none",
                }}
              >
                {fullName.slice(0, 1).toUpperCase()}
              </Flex>
            </Group>
          </UnstyledButton>
        </Group>
      </Flex>

      <ProfileDrawer
        opened={profileDrawerOpened}
        onClose={() => setProfileDrawerOpened(false)}
      />
    </>
  );
}

export default MainSectionHeader;
