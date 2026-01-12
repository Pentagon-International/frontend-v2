import {
  Drawer,
  Avatar,
  Text,
  Group,
  Stack,
  Button,
  Box,
  Select,
  Center,
  Paper,
  ThemeIcon,
} from "@mantine/core";
import { IconMapPin, IconBuilding, IconFlag } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { apiCallProtected } from "../api/axios";
import { ToastNotification } from "./index";

interface ProfileDrawerProps {
  opened: boolean;
  onClose: () => void;
}

// Extended branch type that includes country information
interface BranchWithCountry {
  user_branch_id: number;
  branch_id: number;
  branch_code: string;
  branch_name: string;
  is_default: boolean;
  main_default: boolean;
  country?: {
    country_id: number;
    country_code: string;
    country_name: string;
  };
  // Allow other properties that may exist on branch objects
  address?: string;
  pin_code?: string;
  city?: unknown;
  state?: unknown;
  logo_url?: string | null;
  branch_title?: string | null;
}

function ProfileDrawer({ opened, onClose }: ProfileDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateUserBranches = useAuthStore((state) => state.updateUserBranches);
  const updateUserCompany = useAuthStore((state) => state.updateUserCompany);
  const updateUserCountry = useAuthStore((state) => state.updateUserCountry);

  console.log("user data in store---", user?.branches);
  // Find the default branch
  const defaultBranch =
    user?.branches?.find((branch) => branch.is_default) || user?.branches?.[0];
  const [selectedBranch, setSelectedBranch] = useState(
    defaultBranch?.user_branch_id || 0
  );

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleBranchChange = (value: string | null) => {
    if (value) {
      setSelectedBranch(parseInt(value));
    }
  };

  const [isUpdatingBranch, setIsUpdatingBranch] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || !selectedBranch) return;

    // Check if the selected branch is different from the default branch
    const isNonActiveBranch = selectedBranch !== defaultBranch?.user_branch_id;

    if (!isNonActiveBranch) {
      // If it's the active branch, no API call needed - just close the drawer
      onClose();
      return;
    }

    setIsUpdatingBranch(true);
    try {
      const payload = { is_default: true };
      const response = await apiCallProtected.patch(
        `${URL.userBranchMapping}${selectedBranch}/`,
        payload,
        API_HEADER
      );

      if (response.data) {
        console.log("Branch updated successfully:", response);
        // Update the store with the new default branch
        updateUserBranches(selectedBranch);

        // Update company information from API response
        if (response?.data.company_id) {
          updateUserCompany({
            company_id: response?.data.company_id,
            company: response?.data.company_name,
            company_code: response?.data.company_code,
          });
        }
        if (response.data.country_id) {
          updateUserCountry({
            country_id: response?.data.country_id,
            country_name: response?.data.country_name,
            country_code: response?.data.country_code,
          });
        }
      }

      // Show success toast
      ToastNotification({
        type: "success",
        message: "Profile is updated",
      });

      // Close the drawer
      onClose();

      // Check if we're already on the dashboard
      const isOnDashboard = location.pathname === "/";

      if (isOnDashboard) {
        // If already on dashboard, navigate with refresh flag to trigger data reload
        navigate("/", {
          replace: true,
          state: {
            refreshData: true,
            timestamp: Date.now(),
          },
        });
      } else {
        // If not on dashboard, navigate normally (this will trigger the company change effect)
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("Error updating branch:", error);
      ToastNotification({
        type: "error",
        message: "Failed to update profile",
      });
    } finally {
      setIsUpdatingBranch(false);
    }
  };

  if (!user) return null;

  // Check if selected branch is different from default (active) branch
  const isNonActiveBranch = selectedBranch !== defaultBranch?.user_branch_id;

  // Prepare branch data for Select component
  const getBranchData = () => {
    if (!user.branches || user.branches.length === 0) return [];

    // If user is not admin, return flat list
    if (!user.is_staff) {
      return user.branches.map((branch) => ({
        value: branch.user_branch_id.toString(),
        label: branch.branch_name,
      }));
    }

    // For admin users: if multiple branches from same country, show country name
    const branchesByCountry = new Map<
      number,
      { countryName: string; branches: BranchWithCountry[] }
    >();

    // Group branches by country_id
    (user.branches as BranchWithCountry[]).forEach((branch) => {
      const countryId = branch.country?.country_id;
      const countryName = branch.country?.country_name || "Unknown";

      if (countryId) {
        if (!branchesByCountry.has(countryId)) {
          branchesByCountry.set(countryId, {
            countryName,
            branches: [],
          });
        }
        branchesByCountry.get(countryId)!.branches.push(branch);
      }
    });

    // Convert to flat list format
    const branchData: Array<{ value: string; label: string }> = [];

    branchesByCountry.forEach(({ countryName, branches }) => {
      if (branches.length > 1) {
        // Multiple branches from same country - show country name
        // Prioritize main_default, then is_default, then first branch
        const defaultBranch =
          branches.find((b) => b.main_default) ||
          branches.find((b) => b.is_default) ||
          branches[0];
        branchData.push({
          value: defaultBranch.user_branch_id.toString(),
          label: countryName,
        });
      } else {
        // Single branch from a country - show branch name
        branchData.push({
          value: branches[0].user_branch_id.toString(),
          label: branches[0].branch_name,
        });
      }
    });

    return branchData;
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Group justify="space-between" w="100%">
          <Text fw={600} fz="lg">
            Profile
          </Text>
        </Group>
      }
      styles={{
        header: {
          borderBottom: "1px solid #e9ecef",
          paddingBottom: "1rem",
        },
        body: {
          padding: "1rem",
        },
      }}
    >
      <Stack gap="xl">
        {/* Centered Profile Header */}
        <Center>
          <Stack gap="md" align="center">
            <Avatar
              size={80}
              radius="xl"
              color="blue"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "3px solid #f8f9fa",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              {user.full_name?.charAt(0) || "U"}
            </Avatar>
            <Box style={{ textAlign: "center" }}>
              <Text fw={600} fz="xl" c="#2c3e50">
                {user.full_name}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {user.user_identifier}
              </Text>
              {/* <Badge
                color={user.is_staff ? "green" : "blue"}
                size="sm"
                mt={8}
                variant="light"
              >
                {user.is_staff ? "Staff" : "User"}
              </Badge> */}
            </Box>
          </Stack>
        </Center>

        {/* Company & Country Information */}
        <Paper
          p="md"
          radius="md"
          style={{ backgroundColor: "#f8f9fa", border: "1px solid #e9ecef" }}
        >
          <Stack gap="md">
            {user?.company?.company_name && (
              <Group gap="sm">
                <ThemeIcon size="sm" color="blue" variant="light">
                  <IconBuilding size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>
                    COMPANY
                  </Text>
                  <Text fw={600} c="#2c3e50">
                    {user.company.company_name}
                  </Text>
                </Box>
              </Group>
            )}

            {user?.country?.country_name && (
              <Group gap="sm">
                <ThemeIcon size="sm" color="green" variant="light">
                  <IconFlag size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>
                    COUNTRY
                  </Text>
                  <Text fw={600} c="#2c3e50">
                    {user.country.country_name}
                  </Text>
                </Box>
              </Group>
            )}

            {/* {user?.user_id && (
              <Group gap="sm">
                <ThemeIcon size="sm" color="orange" variant="light">
                  <IconId size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>
                    USER ID
                  </Text>
                  <Text fw={600} c="#2c3e50">
                    {user.user_id}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Pulse ID: {user.pulse_id}
                  </Text>
                </Box>
              </Group>
            )} */}
          </Stack>
        </Paper>

        {/* Branch Selection */}
        {user?.branches && user.branches.length > 0 && (
          <Box>
            <Text fw={600} fz="md" mb="sm" c="#2c3e50">
              Active Branch
            </Text>
            <Select
              placeholder="Select branch"
              value={selectedBranch.toString()}
              onChange={handleBranchChange}
              data={getBranchData()}
              leftSection={<IconMapPin size={16} />}
              styles={{
                input: {
                  border: "1px solid #e9ecef",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                  "&:focus": {
                    borderColor: "#667eea",
                    backgroundColor: "white",
                  },
                },
              }}
            />
          </Box>
        )}

        {/* Actions */}
        <Stack gap="sm" mt="lg" align="center">
          <Button
            variant="light"
            color={isNonActiveBranch ? "green" : "blue"}
            // fullWidth
            size="md"
            style={{
              borderRadius: "8px",
              fontWeight: 500,
              width: "200px",
            }}
            onClick={handleUpdateProfile}
            disabled={isUpdatingBranch}
            loading={isUpdatingBranch}
          >
            {isUpdatingBranch ? "Updating..." : "Update Profile"}
          </Button>
          <Button
            variant="light"
            color="red"
            // fullWidth
            size="md"
            onClick={handleLogout}
            style={{
              borderRadius: "8px",
              fontWeight: 500,
              width: "200px",
            }}
          >
            Logout
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

export default ProfileDrawer;
