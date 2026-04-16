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
  IconMessageQuestion,
  IconPercentage,
  IconPlaneInflight,
  IconRosetteDiscount,
  IconSettingsSpark,
  IconShip,
  IconChevronsLeft,
  IconChevronsRight,
  IconFileAnalytics,
  IconUserPlus,
  IconUsers,
  IconPackage,
  IconMapPin,
  IconMapPinFilled,
  IconChartPie2,
  IconPlane,
  IconPlaneDeparture,
  IconPlaneArrival,
  IconFerry,
  IconFerryFilled,
  IconFileDescription,
  IconCircleCheck,
  IconGitBranch,
  IconReceiptTax,
  IconSearch,
  IconReceipt2,
  IconReceipt,
  IconReceiptOff,
  IconReceiptFilled,
  IconWorld,
  IconCash,
  IconWorldDollar,
  IconCashOff,
  IconChecklist,
  IconFileInvoiceFilled,
  IconFileInvoice,
  IconBook2,
  IconBookOff,
  IconLink,
  IconFileUpload,
  IconFile,
} from "@tabler/icons-react";
import PentLogoFull from "../../assets/images/pentagon-prime.svg";
import PentLogo from "../../assets/images/logo.svg";
import { SimpleNavLink } from "./SimpleNavLink";
import { CollapsibleNav } from "./CollapsibleNav";
import { SubNavLink } from "./SubNavLink";
import { NestedSubNavLink } from "./NestedSubNavLink";
import { SectionTitle } from "./SectionTitle";
import { useState, useEffect } from "react";
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
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);

  // Keep Accounts expanded when on receipt, payment, overseas-receipt or supplier-invoice routes
  useEffect(() => {
    if (
      location.pathname.startsWith("/receipt") ||
      location.pathname.startsWith("/payment") ||
      location.pathname.startsWith("/payment-request-approval") ||
      location.pathname.startsWith("/supplier-invoice") ||
      location.pathname.startsWith("/supplier-invoice-rcm") ||
      location.pathname.startsWith("/overseas-receipt") ||
      location.pathname.startsWith("/overseas-payment") ||
      location.pathname.startsWith("/journal-voucher") ||
      location.pathname.startsWith("/journal-voucher-reversal") ||
      location.pathname.startsWith("/subledger-enquiry") ||
      location.pathname.startsWith("/document-allocation")
    ) {
      setIsAccountsOpen(true);
    }
  }, [location.pathname]);


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
          px="sm"
          pt={!opened ? 12 : 4}
          pb={!opened ? 12 : 8}
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
                height: "45px",
                cursor: "pointer",
                gap: !opened ? "2px" : "",
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
                    height={45}
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
                    height={28}
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
            <Stack mt={!opened ? 0 : 8} gap={4}>
              {opened ? (
                <SectionTitle title="Core" />
              ) : (
                <Divider mb="xs" color="#D5D5D5" size="sm" />
              )}
              <SimpleNavLink
                label="Dashboard"
                icon={IconChartPie2}
                path="/"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                  setIsAirOpen,
                  setIsSeaExportOpen,
                }}
              />
              <Box>
                <CollapsibleNav
                  label="Sales"
                  openedLocal={isSalesOpen}
                  setOpenedLocal={setIsSalesOpen}
                  icon={IconRosetteDiscount as any}
                >
                  <SubNavLink
                    parent="Sales"
                    label="Lead"
                    icon={IconUsers}
                    path="/lead"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen, setIsAirOpen, setIsSeaExportOpen, setIsAccountsOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Call Entry"
                    icon={IconKeyboard}
                    path="/call-entry"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen, setIsAirOpen, setIsSeaExportOpen, setIsAccountsOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Enquiry"
                    icon={IconMessageQuestion}
                    path="/enquiry"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen, setIsAirOpen, setIsSeaExportOpen, setIsAccountsOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="RFQ"
                    icon={IconMessageQuestion}
                    path="/rfq"
                    collapsibles={{
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                      setIsAccountsOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Quotation"
                    icon={IconFileDescription}
                    path="/quotation"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen, setIsAirOpen, setIsSeaExportOpen, setIsAccountsOpen }}
                  />
                  {showQuotationApproval && (
                    <SubNavLink
                      parent="Sales"
                      label="Quotation Approval"
                      icon={IconCircleCheck}
                      path="/quotation-approval"
                      collapsibles={{
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                  )}
                  <SubNavLink
                    parent="Sales"
                    label="Potential Customers"
                    icon={IconUserPlus}
                    path="/potential-customers"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen, setIsAirOpen, setIsSeaExportOpen, setIsAccountsOpen }}
                  />
                  <SubNavLink
                    parent="Sales"
                    label="Pipeline"
                    icon={IconGitBranch}
                    path="/pipeline"
                    collapsibles={{ setIsTariffOpen, setIsCustomerServiceOpen, setIsAirOpen, setIsSeaExportOpen, setIsAccountsOpen }}
                  />

                  {/* Tariff collapsible submenu */}
                  <CollapsibleNav
                    openedLocal={isTariffOpen}
                    setOpenedLocal={setIsTariffOpen}
                    label="Tariff"
                    icon={IconFileSettings as any}
                    parent="Sales"
                  >
                    <NestedSubNavLink
                      parent="Sales"
                      subParent="Tariff"
                      label="Freight"
                      path="/tariff/freight"
                      icon={IconPackage as any}
                      collapsibles={{
                        setIsCustomerServiceOpen,
                        setIsTariffOpen,
                        setIsSalesOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <NestedSubNavLink
                      parent="Sales"
                      subParent="Tariff"
                      label="Origin"
                      path="/tariff/origin"
                      icon={IconMapPin as any}
                      collapsibles={{
                        setIsCustomerServiceOpen,
                        setIsTariffOpen,
                        setIsSalesOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <NestedSubNavLink
                      parent="Sales"
                      subParent="Tariff"
                      label="Destination"
                      path="/tariff/destination"
                      icon={IconMapPinFilled as any}
                      collapsibles={{
                        setIsCustomerServiceOpen,
                        setIsTariffOpen,
                        setIsSalesOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
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
                  icon={IconPlane as any}
                >
                  <SubNavLink
                    parent="Transportation"
                    label="Air Export Booking"
                    icon={IconPlaneDeparture}
                    path="/air/export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Import Booking"
                    icon={IconPlaneArrival}
                    path="/air/import-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Export Job Generation"
                    icon={IconPlaneDeparture}
                    path="/air/job-generation"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Export Job"
                    icon={IconPlaneDeparture}
                    path="/air/export-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Air Import Job"
                    icon={IconPlaneArrival}
                    path="/air/import-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
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
                      setIsSeaExportOpen,
                    }}
                  />
                </CollapsibleNav>
              </Box>
              <Box>
                <CollapsibleNav
                  label="Ocean"
                  openedLocal={isSeaExportOpen}
                  setOpenedLocal={setIsSeaExportOpen}
                  icon={IconShip as any}
                >
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Export Booking"
                    icon={IconFerry}
                    path="/SeaExport/export-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Import Booking"
                    icon={IconFerryFilled}
                    path="/SeaExport/import-booking"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="FCL Job Generation"
                    icon={IconFerry}
                    path="/SeaExport/fcl-job-generation"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="LCL Job Generation"
                    icon={IconFerry}
                    path="/SeaExport/lcl-job-generation"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Export Job"
                    icon={IconFerry}
                    path="/SeaExport/export-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
                      setIsSeaExportOpen,
                    }}
                  />
                  <SubNavLink
                    parent="Transportation"
                    label="Ocean Import Job"
                    icon={IconFerryFilled}
                    path="/SeaExport/import-job"
                    collapsibles={{
                      setIsSalesOpen,
                      setIsTariffOpen,
                      setIsCustomerServiceOpen,
                      setIsAirOpen,
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
                      setIsAirOpen,
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
              <Box>
                <CollapsibleNav
                  label="Accounts"
                  key="Accounts"
                  openedLocal={isAccountsOpen}
                  setOpenedLocal={setIsAccountsOpen}
                  icon={IconReceipt2}
                >
                  {/* <ScrollArea.Autosize mah={380} type="always" offsetScrollbars scrollbarSize={6}> */}
                    <SubNavLink
                      parent="Accounts"
                      label="Receipt"
                      icon={IconReceiptFilled}
                      path="/receipt"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Receipt Reversal"
                      icon={IconReceiptOff}
                      path="/receipt/reversal"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Overseas Receipt"
                      icon={IconWorld}
                      path="/overseas-receipt"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Payment"
                      icon={IconCash}
                      path="/payment"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Overseas Payment"
                      icon={IconWorldDollar}
                      path="/overseas-payment"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Payment Reversal"
                      icon={IconCashOff}
                      path="/payment/reversal"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Payment Request Approval"
                      icon={IconChecklist}
                      path="/payment-request-approval"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Supplier Invoice"
                      icon={IconFileInvoiceFilled}
                      path="/supplier-invoice"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Supplier Invoice Reversal"
                      icon={IconFileInvoice}
                      path="/supplier-invoice/reversal"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Journal Voucher"
                      icon={IconBook2}
                      path="/journal-voucher"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="JournalVoucherReversal"
                      icon={IconBookOff}
                      path="/journal-voucher-reversal"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Subledger Enquiry"
                      icon={IconSearch}
                      path="/subledger-enquiry"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Document Allocation"
                      icon={IconLink}
                      path="/document-allocation"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                    <SubNavLink
                      parent="Accounts"
                      label="Supplier Invoice RCM"
                      icon={IconFileAnalytics}
                      path="/supplier-invoice-rcm"
                      collapsibles={{
                        setIsSalesOpen,
                        setIsTariffOpen,
                        setIsCustomerServiceOpen,
                        setIsAirOpen,
                        setIsSeaExportOpen,
                      }}
                    />
                  {/* </ScrollArea.Autosize> */}
                </CollapsibleNav>
              </Box>
              <SimpleNavLink
                label="Masters"
                key={"Masters"}
                icon={IconFileSettings}
                path="/master"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                  setIsAirOpen,
                  setIsSeaExportOpen,
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
                  setIsAirOpen,
                  setIsSeaExportOpen,
                }}
              />
            </Stack>
            {/* Workflow */}

            <Stack mt={!opened ? 4 : 16} gap={4}>
              {opened ? (
                <SectionTitle title="Workflow" />
              ) : (
                <Divider my="xs" color="#D5D5D5" size="sm" />
              )}
              <SimpleNavLink
                label="Jobcreation"
                key={"Jobcreation"}
                icon={IconFileUpload}
                path="/hbl-document-manager"
                collapsibles={{
                  setIsSalesOpen,
                  setIsTariffOpen,
                  setIsCustomerServiceOpen,
                }}



              />
              <SimpleNavLink
                label="Invoice"
                key={"Invoice"}
                icon={IconFileInvoice}
                path="/invoice"
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
                  setIsAirOpen,
                  setIsSeaExportOpen,
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
                  setIsAirOpen,
                  setIsSeaExportOpen,
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
