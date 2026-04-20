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

export default function MastersPage() {
  const navigate = useNavigate();

  const formatRoute = (label: string) => label.toLowerCase().replace(/\s+/g, "-");

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
            icon: <IconBuildingSkyscraper size={28} color="#2563EB" />,
            label: "Group Company",
          },
          {
            icon: <IconBuildingEstate size={28} color="#2563EB" />,
            label: "Company",
          },
          { icon: <IconSitemap size={28} color="#2563EB" />, label: "Branch" },
          { icon: <IconUserHexagon size={28} color="#2563EB" />, label: "User" },
        ],
      },
      {
        title: "Customer & Partner Masters",
        items: [
          { icon: <IconUsers size={28} color="#2563EB" />, label: "Customer" },
          {
            icon: <IconTruck size={28} color="#2563EB" />,
            label: "Vendor",
          },
          {
            icon: <IconUsersGroup size={28} color="#2563EB" />,
            label: "Customer Type",
          },
          { icon: <IconInfinity size={28} color="#2563EB" />, label: "Follow-up" },
          {
            icon: <IconSquareRotated size={28} color="#2563EB" />,
            label: "Frequency",
          },
          {
            icon: <IconWorld size={28} color="#2563EB" />,
            label: "Network Master",
          },
          // Conditionally include Sales Co-ordinator Reassignation
          ...(hasManagerOrStaffAccess
            ? [
                {
                  icon: <IconExchange size={28} color="#2563EB" />,
                  label: "Sales Co-ordinator Reassignation",
                },
                {
                  icon: <IconUserCheck size={28} color="#2563EB" />,
                  label: "Customer Relationship Mapping",
                },
              ]
            : []),
        ],
      },
      {
        title: "Logistics & Operations Masters",
        items: [
          { icon: <IconAnchor size={28} color="#2563EB" />, label: "Port" },
          {
            icon: <IconContainer size={28} color="#2563EB" />,
            label: "Container Type",
          },
          {
            icon: <IconFileStack size={28} color="#2563EB" />,
            label: "Terms of Shipment",
          },
          {
            icon: <IconTruckDelivery size={28} color="#2563EB" />,
            label: "Service",
          },
          {
            icon: <IconBuildingEstate size={28} color="#2563EB" />,
            label: "CFS Master",
          },
        ],
      },
      {
        title: "Communication & Interaction Masters",
        items: [
          {
            icon: <IconBrandRedux size={28} color="#2563EB" />,
            label: "Call Mode",
          },
          {
            icon: <IconFileStack size={28} color="#2563EB" />,
            label: "Create Customer-PAN",
          },
        ],
      },
      {
        title: "Accounts",
        items: [
          {
            icon: <IconCurrencyDollar size={28} color="#2563EB" />,
            label: "Charge",
          },
          {
            icon: <IconCalculator size={28} color="#2563EB" />,
            label: "TDS Section",
          },
          {
            icon: <IconCalculator size={28} color="#2563EB" />,
            label: "TDS Rate Section",
          },
          {
            icon: <IconChartBar size={28} color="#2563EB" />,
            label: "Chart of Accounts",
          },
          {
            icon: <IconLink size={28} color="#2563EB" />,
            label: "GL Charge Mapping",
          },
          {
            icon: <IconReceiptTax size={28} color="#2563EB" />,
            label: "GST SAC",
          },
          {
            icon: <IconPercentage size={28} color="#2563EB" />,
            label: "GST Rate",
          },
          {
            icon: <IconLink size={28} color="#2563EB" />,
            label: "GST Charge Mapping",
          },
        ],
      },
    ],
    [hasManagerOrStaffAccess]
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
                  color: "#2563EB",
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
