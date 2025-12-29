import { Container, Stack, Text } from "@mantine/core";
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";
import AirImportBookingStepper from "./AirImportBookingStepper";

function AirImportBookingCreate() {
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
      service: "AIR", // Always AIR for Air Import Booking
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
          from_location_name: serviceDetails.origin_name || "",
          to_location_code: serviceDetails.destination_code_read || "",
          to_location_name: serviceDetails.destination_name || "",
          etd: new Date(),
          eta: new Date(),
          carrier_code: quotationData.carrier_code || "",
          carrier_name: quotationData.carrier || "",
          flight_no: null,
          status: "PLANNED",
        },
      ],

      // Stepper 2 - Party Details (Import: customer = consignee)
      consignee_code: "",
      consignee_name: "",
      consignee_address_id: 0,
      consignee_email: "",
      shipper_code: "",
      shipper_name: "",
      shipper_address_id: 0,
      shipper_email: "",
      forwarder_code: "",
      forwarder_name: "",
      forwarder_address_id: 0,
      forwarder_email: "",
      destination_agent_code: "",
      destination_agent_name: "",
      destination_agent_address_id: 0,
      destination_agent_email: "",
      billing_customer_code: "",
      billing_customer_name: "",
      billing_customer_address_id: 0,
      notify_customer_code: "",
      notify_customer_name: "",
      notify_customer_address_id: 0,
      notify_customer_email: "",
      cha_code: "",
      cha_name: "",
      cha_address_id: 0,

      // Stepper 3 - Commodity Details
      is_hazardous: serviceDetails.hazardous_cargo || false,
      commodity_description: "",
      marks_no: "",
      cargo_details:
        serviceDetails.service === "FCL" &&
        serviceDetails.fcl_details &&
        Array.isArray(serviceDetails.fcl_details)
          ? serviceDetails.fcl_details.map((fcl: Record<string, unknown>) => ({
              no_of_packages: undefined,
              gross_weight: fcl.gross_weight
                ? Number(fcl.gross_weight)
                : undefined,
              volume_weight: undefined,
              chargeable_weight: undefined,
              volume: undefined,
              chargeable_volume: undefined,
              container_type_code: fcl.container_type
                ? String(fcl.container_type)
                : undefined,
              no_of_containers: fcl.no_of_containers
                ? Number(fcl.no_of_containers)
                : undefined,
            }))
          : [
              {
                no_of_packages: serviceDetails.no_of_packages || undefined,
                gross_weight: serviceDetails.gross_weight || undefined,
                volume_weight: serviceDetails.volume_weight || undefined,
                chargeable_weight:
                  serviceDetails.chargeable_weight || undefined,
                volume: serviceDetails.volume || undefined,
                chargeable_volume:
                  serviceDetails.chargeable_volume || undefined,
                container_type_code:
                  serviceDetails.container_type_code || undefined,
                no_of_containers: serviceDetails.no_of_containers || undefined,
              },
            ],

      // Pickup Details
      pickup_location: "",
      pickup_from_code: "",
      pickup_from_name: "",
      pickup_address_id: 0,
      pickup_address_name: "",
      planned_pickup_date: new Date(),
      transporter_name: "",
      transporter_email: "",

      // Delivery Details
      delivery_location: "",
      delivery_from_code: "",
      delivery_from_name: "",
      delivery_address_id: 0,
      delivery_address_name: "",
      planned_delivery_date: new Date(),

      // Stepper 5 - Quotation Details
      quotation_id: quotationData.quotation_id || "",
      quotation_charges: quotationData.charges || [],
    };
  };

  const mappedBookingData = mapBookingDataToStepperFormat(bookingData);

  // Debug logging
  // console.log("ImportShipmentCreate - bookingData:", bookingData);
  // console.log(
  //   "ImportShipmentCreate - serviceDetails:",
  //   bookingData?.serviceDetails
  // );
  // console.log(
  //   "ImportShipmentCreate - fcl_details:",
  //   bookingData?.serviceDetails?.fcl_details
  // );
  // console.log("ImportShipmentCreate - mappedBookingData:", mappedBookingData);
  // console.log(
  //   "ImportShipmentCreate - cargo_details:",
  //   mappedBookingData?.cargo_details
  // );

  const handleStepChange = (step: number) => {
    console.log(`Current step: ${step + 1}`);
  };

  const handleComplete = () => {
    console.log("Air import booking creation completed!");
    // Navigate back to master or show success message
    navigate("../", { state: { refreshData: true } });
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* <Button
          variant="outline"
          onClick={() => navigate("../")}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Import Shipment Master
        </Button> */}

        {/* <Title order={5}>Create Import Shipment</Title> */}
        <Text size="xl" fw={600} c="#105476" mb="lg">
          {isEditMode ? "Edit Air Import Booking" : "Create Air Import Booking"}
        </Text>

        <AirImportBookingStepper
          onStepChange={handleStepChange}
          onComplete={handleComplete}
          initialData={isEditMode ? jobData : mappedBookingData}
          isEditMode={isEditMode}
          jobData={jobData}
        />
      </Stack>
    </Container>
  );
}

export default AirImportBookingCreate;
