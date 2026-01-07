import {
  Avatar,
  Box,
  Center,
  Flex,
  Group,
  Image,
  Indicator,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowRight,
  IconBell,
  IconChevronRight,
  IconChevronsRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconUser,
} from "@tabler/icons-react";
import { useState } from "react";
import { useLayoutStore } from "../store/useLayoutStore";
import useAuthStore from "../store/authStore";
import ProfileDrawer from "./ProfileDrawer";
import PentLogo from "../assets/images/pentagon-prime.svg";

// interface HeaderProps {
//   title: string;
// }

function MainSectionHeader() {
  const title = useLayoutStore((state) => state.title);
  const [profileDrawerOpened, setProfileDrawerOpened] = useState(false);

  const user = useAuthStore((state) => state.user);
  // const logout = useAuthStore((state) => state.logout);

  const fullName = user?.full_name || "User";
  const email = user?.email || "";

  console.log("MainSectionHeader render:", { user, fullName, email });

  const handleProfileClick = () => {
    setProfileDrawerOpened(true);
  };

  const handleProfileDrawerClose = () => {
    setProfileDrawerOpened(false);
  };

  return (
    <>
      <Flex
        justify="space-between"
        align="center"
        bg="white"
        mih={30}
        style={{padding:"0 24px"}}
        //   style={{ borderBottom: "1px solid #f0f0f0" }}
      >
        <Box
          style={{
            borderLeft: "3px solid #14597A", // Unique accent bar
            paddingLeft: 12,
          }}
        >
          <Text
            fw={700}
            fz={22}
            style={{
              color: "#2C3E50",
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
        </Box>
        {/* Right section */}

        <Group gap="xl" align="center" wrap="nowrap">
          {/* Notification with dot */}
          <Indicator
            size={6}
            color="red"
            style={{ cursor: "pointer" }}
            offset={2}
          >
            <IconBell size={24} stroke={2} color="#105476" />
          </Indicator>

          {/* User info */}
          <UnstyledButton onClick={handleProfileClick} px={0}>
            <Group gap="sm" align="center" wrap="nowrap">
              <Box style={{ lineHeight: 1 }}>
                <Text size="sm" ta="right" c="#212629ff" fw={500}>
                  {fullName}
                </Text>
                <Text size="xs" c="dimmed">
                  {email}
                </Text>
              </Box>
              <Flex
                justify="center"
                align="center"
                fw={400}
                style={{
                  fontFamily: "Outfit",
                  width: "36px",
                  height: "36px",
                  color: "white",
                  padding: "4px",
                  borderRadius: "50%",
                  backgroundColor: "#105476",
                }}
              >{fullName.slice(0,1)}</Flex>

            </Group>
          </UnstyledButton>
        </Group>
      </Flex>

      <ProfileDrawer
        opened={profileDrawerOpened}
        onClose={handleProfileDrawerClose}
      />
    </>
  );
}

export default MainSectionHeader;
