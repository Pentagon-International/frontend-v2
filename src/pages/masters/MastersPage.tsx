import { Box, Grid, Stack, Text } from "@mantine/core";
import {
  IconBuildingSkyscraper,
  IconUsers,
  IconInfinity,
  IconAnchor,
  IconTruckDelivery,
  IconBuildingEstate,
  IconUsersGroup,
  IconUserHexagon,
  IconContainer,
  IconFileStack,
  IconClipboardCheck,
  IconSitemap,
  IconBrandRedux,
  IconSquareRotated,
  IconExchange,
  IconUserCheck,
  IconCurrencyDollar,
  IconChartBar,
  IconLink,
  IconReceiptTax,
  IconPercentage,
  IconWorld,
  IconCalculator,
  IconTruck,
} from "@tabler/icons-react";
import MasterCard from "../../components/MasterCard";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import useAuthStore from "../../store/authStore";
import { isIndianUserFromProfile } from "../../utils/userNumberFormat";

export default function MastersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const hasCustomerApprovalScreen = Boolean(
    user?.screen_permissions?.customer_approval_screen,
  );
  const showApproveCustomers = hasCustomerApprovalScreen || !isIndiaUser;

  const formatRoute = (label: string) => {
    if (label === "Customer for Approval") return "create-customer";
    if (label === "Maker & Checker Mapping") return "maker-checker-mapping";
    return label.toLowerCase().replace(/\s+/g, "-");
  };

  //Master page child routing
  const { pathname } = useLocation();
  const isBasePath = pathname === "/master";

  // Check user permissions from localStorage
  const hasManagerOrStaffAccess = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return false;
      const user = JSON.parse(userStr);
      return user?.is_manager === true || user?.is_staff === true;
    } catch (error) {
      console.error("Error checking user permissions:", error);
      return false;
    }
  }, []);

  // Build sections with conditional items based on permissions
  const sections = useMemo(
    () => [
      {
        title: "Organization Masters",
        items: [
          {
            icon: <IconBuildingSkyscraper size={28} color="#105476" />,
            label: "Group Company",
          },
          {
            icon: <IconBuildingEstate size={28} color="#105476" />,
            label: "Company",
          },
          { icon: <IconSitemap size={28} color="#105476" />, label: "Branch" },
          {
            icon: <IconUserHexagon size={28} color="#105476" />,
            label: "User",
          },
        ],
      },
      {
        title: "Customer & Partner Masters",
        items: [
          { icon: <IconUsers size={28} color="#105476" />, label: "Customer" },
          {
            icon: <IconTruck size={28} color="#105476" />,
            label: "Vendor",
          },
          {
            icon: <IconUsersGroup size={28} color="#105476" />,
            label: "Customer Type",
          },
          {
            icon: <IconInfinity size={28} color="#105476" />,
            label: "Follow-up",
          },
          {
            icon: <IconSquareRotated size={28} color="#105476" />,
            label: "Frequency",
          },
          {
            icon: <IconWorld size={28} color="#105476" />,
            label: "Network Master",
          },
          // Conditionally include Sales Co-ordinator Reassignation
          ...(hasManagerOrStaffAccess
            ? [
                {
                  icon: <IconExchange size={28} color="#105476" />,
                  label: "Sales Co-ordinator Reassignation",
                },
                {
                  icon: <IconUserCheck size={28} color="#105476" />,
                  label: "Customer Relationship Mapping",
                },
              ]
            : []),
        ],
      },
      {
        title: "Logistics & Operations Masters",
        items: [
          { icon: <IconAnchor size={28} color="#105476" />, label: "Port" },
          {
            icon: <IconContainer size={28} color="#105476" />,
            label: "Container Type",
          },
          {
            icon: <IconFileStack size={28} color="#105476" />,
            label: "Terms of Shipment",
          },
          {
            icon: <IconTruckDelivery size={28} color="#105476" />,
            label: "Service",
          },
          {
            icon: <IconBuildingEstate size={28} color="#105476" />,
            label: "CFS Master",
          },
        ],
      },
      {
        title: "Communication & Interaction Masters",
        items: [
          {
            icon: <IconBrandRedux size={28} color="#105476" />,
            label: "Call Mode",
          },
          ...(isIndiaUser
            ? [
                {
                  icon: <IconFileStack size={28} color="#105476" />,
                  label: "Create Customer-PAN",
                },
              ]
            : [
                {
                  icon: <IconFileStack size={28} color="#105476" />,
                  label: "Customer for Approval",
                },
              ]),
          ...(showApproveCustomers
            ? [
                {
                  icon: <IconClipboardCheck size={28} color="#105476" />,
                  label: "Approve Customers",
                },
              ]
            : []),
        ],
      },
      {
        title: "Accounts",
        items: [
          {
            icon: <IconCurrencyDollar size={28} color="#105476" />,
            label: "Charge",
          },
          {
            icon: <IconCalculator size={28} color="#105476" />,
            label: "TDS Section",
          },
          {
            icon: <IconCalculator size={28} color="#105476" />,
            label: "TDS Rate Section",
          },
          {
            icon: <IconChartBar size={28} color="#105476" />,
            label: "Chart of Accounts",
          },
          {
            icon: <IconLink size={28} color="#105476" />,
            label: "GL Charge Mapping",
          },
          {
            icon: <IconUserCheck size={28} color="#105476" />,
            label: "Maker & Checker Mapping",
          },
          {
            icon: <IconReceiptTax size={28} color="#105476" />,
            label: "GST SAC",
          },
          {
            icon: <IconPercentage size={28} color="#105476" />,
            label: "GST Rate",
          },
          {
            icon: <IconLink size={28} color="#105476" />,
            label: "GST Charge Mapping",
          },
          ...(!isIndiaUser
            ? [
                {
                  icon: <IconPercentage size={28} color="#105476" />,
                  label: "VAT Master",
                },
                {
                  icon: <IconLink size={28} color="#105476" />,
                  label: "VAT-Charge Mapping",
                },
              ]
            : []),
        ],
      },
    ],
    [hasManagerOrStaffAccess, isIndiaUser, showApproveCustomers],
  );

  // function onClick() {
  //   navigate("/master/group-company");
  // }

  return (
    <Box h={"100%"}>
      {isBasePath ? (
        <Stack
          gap="lg"
          // style={{ paddingRight: "30%" }
          // }
        >
          {sections.map((section) => (
            <Box key={section.title}>
              <Text
                mb="md"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#105476",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {section.title}
              </Text>
              <Grid gutter="md" columns={12}>
                {section.items.map(({ icon, label }) => (
                  <Grid.Col key={label} span={{ base: 6, sm: 4, md: 3 }}>
                    <MasterCard
                      icon={icon}
                      label={label}
                      onClick={() => navigate(`/master/${formatRoute(label)}`)}
                    />
                  </Grid.Col>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>
      ) : (
        <Outlet />
      )}
    </Box>
  );
}
