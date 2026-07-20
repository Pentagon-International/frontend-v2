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
  Switch,
  TextInput,
  PasswordInput,
} from "@mantine/core";
import { IconMapPin, IconBuilding, IconFlag } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { apiCallProtected } from "../api/axios";
import {
  extractOdexFieldsFromResponse,
  getBranchByUserBranchId,
  hasOdexCredentialsChanged,
} from "../utils/branchOdexCredentials";
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
  odex_username?: string | null;
  odex_password?: string | null;
  has_odex_credentials?: boolean;
  phone_number?: string | null;
}

function ProfileDrawer({ opened, onClose }: ProfileDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);

  console.log("user data in store---", user?.branches);
  // Find the default branch
  const defaultBranch =
    user?.branches?.find((branch) => branch.is_default) || user?.branches?.[0];
  const [selectedBranch, setSelectedBranch] = useState(
    defaultBranch?.user_branch_id || 0,
  );
  const [odexUsername, setOdexUsername] = useState("");
  const [odexPassword, setOdexPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!opened || !defaultBranch) return;
    setSelectedBranch(defaultBranch.user_branch_id);
    setOdexUsername(defaultBranch.odex_username ?? "");
    setOdexPassword(defaultBranch.odex_password ?? "");
    setPhoneNumber(
      (defaultBranch as BranchWithCountry).phone_number ?? "",
    );
  }, [
    opened,
    defaultBranch?.user_branch_id,
    defaultBranch?.odex_username,
    defaultBranch?.odex_password,
    (defaultBranch as BranchWithCountry | undefined)?.phone_number,
  ]);

  const loadOdexFieldsForBranch = (userBranchId: number) => {
    const branch = getBranchByUserBranchId(user?.branches, userBranchId);
    setOdexUsername(branch?.odex_username ?? "");
    setOdexPassword(branch?.odex_password ?? "");
    setPhoneNumber(
      (branch as BranchWithCountry | undefined)?.phone_number ?? "",
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call logout API
      const response = await apiCallProtected.post(
        URL.logoutUser,
        {},
        API_HEADER,
      );

      // If API call is successful (no error in response)
      if (response && !response.data?.error) {
        // Close drawer first, then clear store and redirect (logout handles redirect)
        onClose();
        logout();
      } else {
        // Even if API returns an error, still logout locally
        console.error("Logout API error:", response.data);
        onClose();
        logout();
      }
    } catch (error) {
      // If API call fails, still logout locally
      console.error("Error calling logout API:", error);
      onClose();
      logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleBranchChange = (value: string | null) => {
    if (value) {
      const branchId = parseInt(value, 10);
      setSelectedBranch(branchId);
      if (branchId === defaultBranch?.user_branch_id) {
        loadOdexFieldsForBranch(branchId);
      }
    }
  };

  const [isUpdatingBranch, setIsUpdatingBranch] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || !selectedBranch || !defaultBranch) return;

    const branchChanged =
      selectedBranch !== defaultBranch.user_branch_id;
    const storedActiveBranch = getBranchByUserBranchId(
      user.branches,
      defaultBranch.user_branch_id,
    );
    const odexChanged =
      !branchChanged &&
      hasOdexCredentialsChanged(
        storedActiveBranch,
        odexUsername,
        odexPassword,
        phoneNumber,
      );

    if (!branchChanged && !odexChanged) {
      onClose();
      return;
    }

    setIsUpdatingBranch(true);

    try {
      if (branchChanged) {
        const response = await apiCallProtected.patch(
          `${URL.userBranchMapping}${selectedBranch}/`,
          { is_default: true },
          API_HEADER,
        );

        if (response.data) {
          const responseData = response.data as Record<string, unknown>;
          const odexFromResponse = extractOdexFieldsFromResponse(responseData);

          updateUserProfile({
            branchId: selectedBranch,
            switchDefault: true,
            company: responseData.company_id
              ? {
                  company_id: Number(responseData.company_id),
                  company: String(responseData.company_name ?? ""),
                  company_code: String(responseData.company_code ?? ""),
                }
              : undefined,
            country: responseData.country_id
              ? {
                  country_id: Number(responseData.country_id),
                  country_name: String(responseData.country_name ?? ""),
                  country_code: String(responseData.country_code ?? ""),
                }
              : undefined,
            ...(odexFromResponse.has_odex_credentials
              ? { odexCredentials: odexFromResponse }
              : {}),
          });
        }

        ToastNotification({
          type: "success",
          message: "Profile is updated",
        });

        onClose();

        const isOnDashboard = location.pathname === "/";

        if (isOnDashboard) {
          navigate("/", {
            replace: true,
            state: {
              refreshData: true,
              timestamp: Date.now(),
            },
          });
        } else {
          navigate("/", { replace: true });
        }
        return;
      }

      const response = await apiCallProtected.patch(
        `${URL.userBranchMapping}${defaultBranch.user_branch_id}/`,
        {
          odex_username: odexUsername,
          odex_password: odexPassword,
          phone_number: phoneNumber,
        },
        API_HEADER,
      );

      const responseData = (response.data ?? {}) as Record<string, unknown>;
      const odexFromResponse = extractOdexFieldsFromResponse({
        ...responseData,
        odex_username: responseData.odex_username ?? odexUsername,
        odex_password: responseData.odex_password ?? odexPassword,
        phone_number: responseData.phone_number ?? phoneNumber,
      });

      updateUserProfile({
        branchId: defaultBranch.user_branch_id,
        switchDefault: false,
        odexCredentials: odexFromResponse,
      });

      ToastNotification({
        type: "success",
        message: "ODEX credentials updated",
      });

      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);

      ToastNotification({
        type: "error",
        message: branchChanged
          ? "Failed to update profile"
          : "Failed to update ODEX credentials",
      });
    } finally {
      setIsUpdatingBranch(false);
    }
  };

  if (!user) return null;

  // Check if selected branch is different from default (active) branch
  const isNonActiveBranch = selectedBranch !== defaultBranch?.user_branch_id;
  const storedActiveBranch = getBranchByUserBranchId(
    user.branches,
    defaultBranch?.user_branch_id,
  );
  const odexChanged =
    !isNonActiveBranch &&
    hasOdexCredentialsChanged(
      storedActiveBranch,
      odexUsername,
      odexPassword,
      phoneNumber,
    );
  const hasPendingChanges = isNonActiveBranch || odexChanged;
  const hasOdexConfigured = storedActiveBranch?.has_odex_credentials === true;

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

        {!isNonActiveBranch && (
          <Box>
            <Group justify="space-between" align="center" mb="sm">
              <Text fw={600} fz="md" c="#2c3e50">
                ODEX Configuration
              </Text>
              <Switch
                checked={hasOdexConfigured}
                disabled
              />
              </Group>
            <Stack
              gap="sm"
              component="form"
              autoComplete="off"
              onSubmit={(event) => event.preventDefault()}
            >
              <TextInput
                name="odex-portal-username"
                placeholder="Odex Username"
                value={odexUsername}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                onChange={(event) =>
                  setOdexUsername(event.currentTarget.value)
                }
                styles={{
                  input: {
                    border: "1px solid #e9ecef",
                    borderRadius: "8px",
                    backgroundColor: "#f8f9fa",
                  },
                }}
              />
              <PasswordInput
                name="odex-portal-password"
                placeholder="Odex Password"
                value={odexPassword}
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore
                onChange={(event) =>
                  setOdexPassword(event.currentTarget.value)
                }
                styles={{
                  input: {
                    border: "1px solid #e9ecef",
                    borderRadius: "8px",
                    backgroundColor: "#f8f9fa",
                  },
                }}
              />
              <TextInput
                name="branch-phone-number"
                placeholder="Phone Number"
                value={phoneNumber}
                autoComplete="off"
                onChange={(event) =>
                  setPhoneNumber(event.currentTarget.value)
                }
                styles={{
                  input: {
                    border: "1px solid #e9ecef",
                    borderRadius: "8px",
                    backgroundColor: "#f8f9fa",
                  },
                }}
              />
            </Stack>
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
            disabled={isUpdatingBranch || !hasPendingChanges}
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
            disabled={isLoggingOut}
            loading={isLoggingOut}
            style={{
              borderRadius: "8px",
              fontWeight: 500,
              width: "200px",
            }}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

export default ProfileDrawer;
