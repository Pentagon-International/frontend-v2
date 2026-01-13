import { Box, Flex, Text, Center, Loader } from "@mantine/core";
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  IconCircleCheck,
  IconUser,
  IconTruckDelivery,
  IconPackage,
  IconMapPin,
  IconCurrencyDollar,
} from "@tabler/icons-react";
import OceanExportBookingStepper from "./OceanExportBookingStepper";

function OceanExportBookingCreate() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect mode from URL pathname and location state
  const mode = useMemo(() => {
    const pathname = location.pathname.toLowerCase();
    const hasJobData = location.state?.job && location.state.job.id;

    // Check for edit, view, or create in the pathname
    if (pathname.includes("/edit") || hasJobData) {
      return "edit";
    } else if (pathname.includes("/view")) {
      return "view";
    }
    // Default to create if neither edit nor view
    return "create";
  }, [location.pathname, location.state]);

  const jobData = location.state?.job;
  const isEditMode = mode === "edit" && !!jobData;

  // Get booking data from quotation if available (for create mode)
  const bookingData = location.state?.bookingData;

  console.log("=== AirExportGenerationCreate Debug ===");
  console.log("location.state:", location.state);
  console.log("bookingData:", bookingData);
  console.log("typeof bookingData:", typeof bookingData);
  console.log("bookingData exists:", !!bookingData);

  // Map booking data to stepper format
  const mapBookingDataToStepperFormat = (data: Record<string, unknown>) => {
    if (!data) return undefined;

    const { enquiryData, quotationData, serviceDetails } = data as {
      enquiryData: Record<string, unknown>;
      quotationData: Record<string, unknown>;
      serviceDetails: Record<string, unknown>;
    };

    return {
      // Stepper 1 fields
      customer_code: enquiryData.customer_code || "",
      customer_name: enquiryData.customer_name || "",
      service: "", // Will be set to FCL or LCL by user in Ocean Export Booking
      origin_code: serviceDetails.origin_code_read || "",
      origin_name: serviceDetails.origin_name || "",
      destination_code: serviceDetails.destination_code_read || "",
      destination_name: serviceDetails.destination_name || "",
      shipment_terms_code: serviceDetails.shipment_terms_code_read || "",
      shipment_terms_name: serviceDetails.shipment_terms_name || "",
      carrier_code: quotationData.carrier_code || "",
      carrier_name: quotationData.carrier || "",
      date: new Date(),
      freight: "PREPAID", // Default value
      routed: "YES", // Default value
      routed_by: enquiryData.sales_person || "",
      customer_service_name: "", // Will be filled by user
      is_direct: true,
      is_coload: false,

      // Ocean Schedule fields
      schedule_id: "",
      eta: new Date(),
      etd: new Date(),
      vessel_name: "",
      voyage_no: "",

      // Routing details (from origin to destination) - using correct field name
      routing_details: [
        {
          move_type: "MAIN",
          from_location_code: serviceDetails.origin_code_read || "",
          to_location_code: serviceDetails.destination_code_read || "",
          etd: new Date(),
          eta: new Date(),
          carrier_code: "",
          flight_no: null,
          status: "PLANNED",
        },
      ],

      // Stepper 2 - Party Details (Export: customer = shipper)
      shipper_code: "",
      shipper_name: "",
      shipper_address_id: 0,
      shipper_email: "",
      consignee_code: "",
      consignee_name: "",
      consignee_address_id: 0,
      consignee_email: "",
      forwarder_code: "",
      forwarder_address_id: 0,
      forwarder_email: "",
      destination_agent_code: "",
      destination_agent_address_id: 0,
      destination_agent_email: "",
      billing_customer_code: "",
      billing_customer_address_id: 0,
      notify_customer_code: "",
      notify_customer_address_id: 0,
      notify_customer_email: "",
      cha_code: "",
      cha_address_id: 0,

      // Stepper 3 - Commodity Details
      is_hazardous: serviceDetails.hazardous_cargo || false,
      commodity_description: "",
      marks_no: "",
      cargo_details: [
        {
          no_of_packages: serviceDetails.no_of_packages || undefined,
          gross_weight: serviceDetails.gross_weight || undefined,
          volume_weight: serviceDetails.volume_weight || undefined,
          chargeable_weight: serviceDetails.chargeable_weight || undefined,
          volume: serviceDetails.volume || undefined,
          chargeable_volume: serviceDetails.chargeable_volume || undefined,
          container_type_code: serviceDetails.container_type_code || undefined,
          no_of_containers: serviceDetails.no_of_containers || undefined,
        },
      ],

      // Pickup Details
      pickup_location: "",
      pickup_from_code: "",
      pickup_address_id: "",
      planned_pickup_date: new Date(),
      transporter_name: "",
      transporter_email: "",

      // Delivery Details
      delivery_location: "",
      delivery_from_code: "",
      delivery_address_id: "",
      planned_delivery_date: new Date(),

      // Stepper 5 - Quotation Details
      quotation_id: quotationData.quotation_id || "",
      quotation_charges: quotationData.charges || [],
    };
  };

  const mappedBookingData = mapBookingDataToStepperFormat(bookingData);

  // Debug logging
  console.log("OceanExportBookingCreate - mode:", mode);
  console.log("OceanExportBookingCreate - jobData:", jobData);
  console.log("OceanExportBookingCreate - bookingData:", bookingData);
  console.log(
    "OceanExportBookingCreate - mappedBookingData:",
    mappedBookingData
  );

  const [active, setActive] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStepChange = (step: number) => {
    console.log(`Current step: ${step + 1}`);
    setActive(step);
  };

  const handleStepClick = (step: number) => {
    setActive(step);
  };

  const steps = [
    { label: "Export Booking", icon: IconUser },
    { label: "Party Details", icon: IconTruckDelivery },
    { label: "Cargo Details", icon: IconPackage },
    { label: "Pickup/Delivery", icon: IconMapPin },
    { label: "Rate Details", icon: IconCurrencyDollar },
  ];

  const handleComplete = () => {
    console.log("Ocean export booking creation completed!");
    // Navigate back to master or show success message
    navigate("../", { state: { refreshData: true } });
  };

  return (
    <Box
      component="form"
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {isSubmitting && (
        <Center
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 255, 255, 0.65)",
            zIndex: 15,
          }}
        >
          <Loader color="#105476" size="lg" />
        </Center>
      )}

      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Vertical Stepper Sidebar */}
          <Box
            style={{
              minWidth: 240,
              width: "100%",
              maxWidth: 250,
              height: "100%",
              alignSelf: "stretch",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
              position: "sticky",
              top: 0,
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              overflowY: "auto",
            }}
          >
            <Box
              style={{
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                size="md"
                fw={600}
                c="#105476"
                style={{
                  fontFamily: "Inter",
                  fontStyle: "medium",
                  fontSize: "16px",
                  color: "#105476",
                  textAlign: "center",
                }}
              >
                {isEditMode
                  ? "Edit Ocean Export Booking"
                  : "Create Ocean Export Booking"}
              </Text>
            </Box>

            {/* Step 1 */}
            <Box
              onClick={() => handleStepClick(0)}
              style={{
                cursor: "pointer",
                padding: "4px 0",
                transition: "all 0.2s",
              }}
            >
              <Flex align="center" gap="sm">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: active > 0 ? "#EAF9F1" : "#fff",
                    border:
                      active > 0
                        ? "none"
                        : active === 0
                          ? "2px solid #105476"
                          : "2px solid #d1d5db",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color:
                      active > 0
                        ? "white"
                        : active === 0
                          ? "#105476"
                          : "#9ca3af",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {active > 0 ? (
                    <IconCircleCheck size={20} color="#289D69" fill="#EAF9F1" />
                  ) : (
                    <IconUser size={20} color="#105476" fill="#E6F2F8" />
                  )}
                </Box>
                <Text
                  size="sm"
                  fw={400}
                  c="#105476"
                  style={{
                    lineHeight: 1.3,
                    fontFamily: "Inter",
                    fontStyle: "regular",
                    fontSize: "13px",
                    color: "#105476",
                  }}
                >
                  Export Booking
                </Text>
              </Flex>
            </Box>

            {/* Vertical dotted line connector */}
            <Box
              style={{
                height: "24px",
                width: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "0",
                position: "relative",
              }}
            >
              <Box
                style={{
                  width: "2px",
                  height: "100%",
                  borderLeft: "2px dotted #d1d5db",
                }}
              />
            </Box>

            {/* Step 2 */}
            <Box
              onClick={() => handleStepClick(1)}
              style={{
                cursor: "pointer",
                padding: "4px 0",
                transition: "all 0.2s",
              }}
            >
              <Flex align="center" gap="sm">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: active > 1 ? "#EAF9F1" : "#fff",
                    border:
                      active > 1
                        ? "none"
                        : active === 1
                          ? "2px solid #105476"
                          : "2px solid #d1d5db",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color:
                      active > 1
                        ? "white"
                        : active === 1
                          ? "#105476"
                          : "#9ca3af",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {active > 1 ? (
                    <IconCircleCheck size={20} color="#289D69" fill="#EAF9F1" />
                  ) : (
                    <IconTruckDelivery
                      size={20}
                      color="#105476"
                      fill="#E6F2F8"
                    />
                  )}
                </Box>
                <Text
                  size="sm"
                  fw={400}
                  c="#374151"
                  style={{
                    lineHeight: 1.3,
                    fontFamily: "Inter",
                    fontStyle: "regular",
                    fontSize: "13px",
                    color: "#105476",
                  }}
                >
                  Party Details
                </Text>
              </Flex>
            </Box>

            {/* Vertical dotted line connector */}
            <Box
              style={{
                height: "24px",
                width: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "0",
                position: "relative",
              }}
            >
              <Box
                style={{
                  width: "2px",
                  height: "100%",
                  borderLeft: "2px dotted #d1d5db",
                }}
              />
            </Box>

            {/* Step 3 */}
            <Box
              onClick={() => handleStepClick(2)}
              style={{
                cursor: "pointer",
                padding: "4px 0",
                transition: "all 0.2s",
              }}
            >
              <Flex align="center" gap="sm">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: active > 2 ? "#EAF9F1" : "#fff",
                    border:
                      active > 2
                        ? "none"
                        : active === 2
                          ? "2px solid #105476"
                          : "2px solid #d1d5db",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color:
                      active > 2
                        ? "white"
                        : active === 2
                          ? "#105476"
                          : "#9ca3af",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {active > 2 ? (
                    <IconCircleCheck size={20} color="#289D69" fill="#EAF9F1" />
                  ) : (
                    <IconPackage size={20} color="#105476" fill="#E6F2F8" />
                  )}
                </Box>
                <Text
                  size="sm"
                  fw={400}
                  c="#374151"
                  style={{
                    lineHeight: 1.3,
                    fontFamily: "Inter",
                    fontStyle: "regular",
                    fontSize: "13px",
                    color: "#105476",
                  }}
                >
                  Cargo Details
                </Text>
              </Flex>
            </Box>

            {/* Vertical dotted line connector */}
            <Box
              style={{
                height: "24px",
                width: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "0",
                position: "relative",
              }}
            >
              <Box
                style={{
                  width: "2px",
                  height: "100%",
                  borderLeft: "2px dotted #d1d5db",
                }}
              />
            </Box>

            {/* Step 4 */}
            <Box
              onClick={() => handleStepClick(3)}
              style={{
                cursor: "pointer",
                padding: "4px 0",
                transition: "all 0.2s",
              }}
            >
              <Flex align="center" gap="sm">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: active > 3 ? "#EAF9F1" : "#fff",
                    border:
                      active > 3
                        ? "none"
                        : active === 3
                          ? "2px solid #105476"
                          : "2px solid #d1d5db",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color:
                      active > 3
                        ? "white"
                        : active === 3
                          ? "#105476"
                          : "#9ca3af",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {active > 3 ? (
                    <IconCircleCheck size={20} color="#289D69" fill="#EAF9F1" />
                  ) : (
                    <IconMapPin size={20} color="#105476" fill="#E6F2F8" />
                  )}
                </Box>
                <Text
                  size="sm"
                  fw={400}
                  c="#374151"
                  style={{
                    lineHeight: 1.3,
                    fontFamily: "Inter",
                    fontStyle: "regular",
                    fontSize: "13px",
                    color: "#105476",
                  }}
                >
                  Pickup/Delivery
                </Text>
              </Flex>
            </Box>

            {/* Vertical dotted line connector */}
            <Box
              style={{
                height: "24px",
                width: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "0",
                position: "relative",
              }}
            >
              <Box
                style={{
                  width: "2px",
                  height: "100%",
                  borderLeft: "2px dotted #d1d5db",
                }}
              />
            </Box>

            {/* Step 5 */}
            <Box
              onClick={() => handleStepClick(4)}
              style={{
                cursor: "pointer",
                padding: "4px 0",
                transition: "all 0.2s",
              }}
            >
              <Flex align="center" gap="sm">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: active > 4 ? "#EAF9F1" : "#fff",
                    border:
                      active > 4
                        ? "none"
                        : active === 4
                          ? "2px solid #105476"
                          : "2px solid #d1d5db",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color:
                      active > 4
                        ? "white"
                        : active === 4
                          ? "#105476"
                          : "#9ca3af",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {active > 4 ? (
                    <IconCircleCheck size={20} color="#289D69" fill="#EAF9F1" />
                  ) : (
                    <IconCurrencyDollar
                      size={20}
                      color="#105476"
                      fill="#E6F2F8"
                    />
                  )}
                </Box>
                <Text
                  size="sm"
                  fw={400}
                  c="#374151"
                  style={{
                    lineHeight: 1.3,
                    fontFamily: "Inter",
                    fontStyle: "regular",
                    fontSize: "13px",
                    color: "#105476",
                  }}
                >
                  Rate Details
                </Text>
              </Flex>
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            style={{
              flex: 1,
              width: "100%",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              gap: "8px",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                borderRadius: "8px",
                backgroundColor: "#FFFFFF",
              }}
            >
              <OceanExportBookingStepper
                onStepChange={handleStepChange}
                onComplete={handleComplete}
                initialData={isEditMode ? jobData : mappedBookingData}
                isEditMode={isEditMode}
                jobData={jobData}
                active={active}
                setActive={setActive}
              />
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

export default OceanExportBookingCreate;
