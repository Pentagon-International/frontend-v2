import {
  Box,
  Center,
  Divider,
  Flex,
  Image,
  ScrollArea,
  Stack,
} from "@mantine/core";
import {
  IconFileSettings,
  IconHelpCircle,
  IconKeyboard,
  IconLetterPSmall,
  IconLifebuoy,
  IconMessageQuestion,
  IconPercentage,
  IconPlaneInflight,
  IconRosetteDiscount,
  IconSettingsSpark,
  IconShip,
  IconTruck,
  IconChevronsLeft,
  IconChevronsRight,
  IconFileAnalytics,
  IconUserPlus,
  IconTimelineEventExclamation,
  IconHeadphones,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconArrowsExchange,
  IconCheck,
  IconUsers,
} from "@tabler/icons-react";
import PentLogoFull from "../../assets/images/pentagon-prime.svg";
import PentLogo from "../../assets/images/logo.svg";
import { SimpleNavLink } from "./SimpleNavLink";
import { CollapsibleNav } from "./CollapsibleNav";
import { SubNavLink } from "./SubNavLink";
import { NestedSubNavLink } from "./NestedSubNavLink";
import { SectionTitle } from "./SectionTitle";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore";

const Navbar = ({
  opened,
  toggle,
}: {
  opened: boolean;
  toggle: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isManagerOrAdmin = Boolean(user?.is_manager || user?.is_staff);
  const hasQuotationApprovalPermission = Boolean(
    user?.screen_permissions?.quotation_approval
  );
  const showQuotationApproval = isManagerOrAdmin && hasQuotationApprovalPermission;
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isTariffOpen, setIsTariffOpen] = useState(false);
  const [isCustomerServiceOpen, setIsCustomerServiceOpen] = useState(false);
  const [isSeaExportOpen, setIsSeaExportOpen] = useState(false);
  const [isAirOpen, setIsAirOpen] = useState(false);

  const handleLogoClick = () => {
    // Navigate to dashboard with reset flag if not already at base level
    if (location.pathname === "/") {
      // Already on dashboard - navigate with reset flag to reset drill levels
      navigate("/", { state: { resetDashboard: true }, replace: true });
    } else {
      // Navigate to dashboard
      navigate("/", { state: { resetDashboard: true } });
    }
  };
  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <>
        {/* Logo and Title */}
        <Box
          p="sm"
          pt={!opened ? "md" : "sm"}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <Center>
            <Flex
              justify="center"
              align="center"
              style={{
                position: "relative",
                backgroundColor: "transparent",
                width: "100%",
                height: "50px",
                cursor: "pointer",
                gap: !opened ? "5px" : "",
              }}
              onClick={handleLogoClick}
            >
              {opened ? (
                <>
                  <Image
                    src={PentLogoFull}
                    alt="Pulse Logo"
                    width="auto"
                    fit="contain"
                    height={50}
                  />

                  <IconChevronsLeft
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    style={{ position: "absolute", right: 0, color: "#105476" }}
                    size={24}
                  />
                </>
              ) : (
                <>
                  <Image
                    src={PentLogo}
                    alt="Pulse Logo"
                    width="auto"
                    fit="contain"
                    height={30}
                  />

                  <IconChevronsRight
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    style={{ color: "#105476" }}
                    size={24}
                  />
                </>
              )}
            </Flex>
          </Center>
        </Box>

        {/* Scroll Area */}
        <ScrollArea
          type="never"
          p="sm"
          style={{
            flex: 1,
            overflow: "auto",
          }}
        >
          <Flex
            style={{
              justifyContent: "center",
              width: "100%",
              flexDirection: "column",
              alignItems: !opened ? "center" : "",
            }}
          >
            {/* Core Section */}
            <Stack mt={!opened ? 4 : 16} gap={4}>
              {opened ? (
                <SectionTitle title="Core" />
              ) : (
                <Divider my="xs" color="#D5D5D5" size="sm" />
              )}
              <SimpleNavLink
                label="Dashboard"
                icon={IconLifebuoy}
                path="/"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              />
              <Box>
                <CollapsibleNav
                  label="Sales"
                  openedLocal={isSalesOpen}
                  setOpenedLocal={setIsSalesOpen}
                  icon={IconRosetteDiscount}
                >
                  <SubNavLink
                    parent="Sales"
                    label="Lead"
                    icon={IconUsers}
                    path="/lead"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Call Entry"
                    icon={IconKeyboard}
                    path="/call-entry"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Enquiry"
                    icon={IconMessageQuestion}
                    path="/enquiry"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Quotation"
                    icon={IconLetterPSmall}
                    path="/quotation"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen }}
                  />
                  {showQuotationApproval && (
                    <SubNavLink
                      parent="Sales"
                      label="Quotation Approval"
                      icon={IconCheck}
                      path="/quotation-approval"
                      collapsibles={{
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                      }}
                    />
                  )}
                  <SubNavLink
                    parent="Sales"
                    label="Potential Customers"
                    icon={IconUserPlus}
                    path="/potential-customers"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Pipeline"
                    icon={IconTimelineEventExclamation}
                    path="/pipeline"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen }}
                  />

                  {/* Tariff collapsible submenu */}
                  <CollapsibleNav
                    openedLocal={isTariffOpen}
                    setOpenedLocal={setIsTariffOpen}
                    label="Tariff"
                    icon={IconFileSettings}
                    parent="Sales"
                  >
                    <NestedSubNavLink
                      parent="Sales"
                      subParent="Tariff"
                      label="Freight"
                      path="/tariff/freight"
                    />
                    <NestedSubNavLink
                      parent="Sales"
                      subParent="Tariff"
                      label="Origin"
                      path="/tariff/origin"
                    />
                    <NestedSubNavLink
                      parent="Sales"
                      subParent="Tariff"
                      label="Destination"
                      path="/tariff/destination"
                    />
                  </CollapsibleNav>
                </CollapsibleNav>
              </Box>
            </Stack>

            {/* Customer Service Section */}
            {/* <Stack mt={!opened ? 4 : 16} gap={4}>
              {opened ? (
                <SectionTitle title="Customer Service" />
              ) : (
                <Divider my="xs" color="#D5D5D5" size="sm" />
              )}
              <Box>
                <CollapsibleNav
                  label="Customer Service"
                  openedLocal={isCustomerServiceOpen}
                  setOpenedLocal={setIsCustomerServiceOpen}
                  icon={IconHeadphones}
                >
                  <SubNavLink
                    parent="Customer Service"
                    label="Export Booking"
                    icon={IconArrowUpRight}
                    path="/customer-service/export-shipment"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Customer Service"
                    label="Import Booking"
                    icon={IconArrowDownLeft}
                    path="/customer-service/import-shipment"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Customer Service"
                    label="Import to Export Booking"
                    icon={IconArrowsExchange}
                    path="/customer-service/import-to-export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                    }}
                  />
                </CollapsibleNav>
              </Box>
            </Stack> */}

            {/* Transportation Section */}
            <Stack mt={!opened ? 4 : 16} gap={4}>
              {opened ? (
                <SectionTitle title="Transportation" />
              ) : (
                <Divider my="xs" color="#D5D5D5" size="sm" />
              )}
              {/* <SimpleNavLink
                label="Road"
                icon={IconTruck}
                path="/road"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              /> */}
              <Box>
                <CollapsibleNav
                  label="Air"
                  openedLocal={isAirOpen}
                  setOpenedLocal={setIsAirOpen}
                  icon={IconPlaneInflight}
                >
                  <SubNavLink
                    parent="Transportation"
                    label="Air Export Generation"
                    icon={IconPlaneInflight}
                    path="/air/export-generation"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Export Job"
                    icon={IconPlaneInflight}
                    path="/air/export-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Import Job"
                    icon={IconPlaneInflight}
                    path="/air/import-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Export Booking"
                    icon={IconPlaneInflight}
                    path="/air/export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Import Booking"
                    icon={IconPlaneInflight}
                    path="/air/import-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Import to Export Booking"
                    icon={IconPlaneInflight}
                    path="/air/import-to-export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                    }}
                  />
                </CollapsibleNav>
              </Box>
              <Box>
                <CollapsibleNav
                  label="Ocean"
                  openedLocal={isSeaExportOpen}
                  setOpenedLocal={setIsSeaExportOpen}
                  icon={IconShip}
                >
                  <SubNavLink
                    parent="Transportation"
                    label="FCL Export Generation"
                    icon={IconShip}
                    path="/SeaExport/fcl-export-generation"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="LCL Export Generation"
                    icon={IconShip}
                    path="/SeaExport/lcl-export-generation"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Export Job"
                    icon={IconShip}
                    path="/SeaExport/export-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Import Job"
                    icon={IconShip}
                    path="/SeaExport/import-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Export Booking"
                    icon={IconShip}
                    path="/SeaExport/export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Import Booking"
                    icon={IconShip}
                    path="/SeaExport/import-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Import to Export Booking"
                    icon={IconShip}
                    path="/SeaExport/import-to-export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                </CollapsibleNav>
              </Box>
            </Stack>

            {/* Desk Section */}
            <Stack mt={!opened ? 4 : 16} gap={4}>
              {opened ? (
                <SectionTitle title="Desk" />
              ) : (
                <Divider my="xs" color="#D5D5D5" size="sm" />
              )}
              <SimpleNavLink
                label="Accounts"
                key={"Accounts"}
                icon={IconPercentage}
                path="/accounts"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              />
              <SimpleNavLink
                label="Masters"
                key={"Masters"}
                icon={IconFileSettings}
                path="/master"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              />
              <SimpleNavLink
                label="Settings"
                key={"Settings"}
                icon={IconSettingsSpark}
                path="/settings"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              />
            </Stack>

            {/* System Section */}
            <Stack mt={!opened ? 4 : 16} gap={4}>
              {opened ? (
                <SectionTitle title="System" />
              ) : (
                <Divider my="xs" color="#D5D5D5" size="sm" />
              )}
              <SimpleNavLink
                label="Reports"
                icon={IconFileAnalytics}
                path="/reports"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              />
              <SimpleNavLink
                label="Help"
                icon={IconHelpCircle}
                path="/help"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}
              />
            </Stack>
          </Flex>

          {/* View Section */}
          {/* {opened ? <SectionTitle title="View" /> : <Space h="sm" />}
          <NavLink
            label="Collapse"
            key={"Collapse"}
            leftSection={<IconLayoutSidebarLeftCollapse size={20} />}
            styles={getLinkStyles(activeNav === "Collapse", "Collapse")}
            onClick={() => handleNavClick("Collapse", "/collapse")}
          /> */}
        </ScrollArea>
      </>
    </Box>
  );
};

export default Navbar;
