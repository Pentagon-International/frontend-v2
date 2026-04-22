import { Container, Stack, Text } from "@mantine/core";
import { useNavigate, useLocation } from "react-router-dom";
import ImportShipmentStepper from "./ImportShipmentStepper";

function ImportShipmentEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get the row data passed from the master page
  const rowData = location.state;

  console.log("ImportShipmentEdit rendered with data:", rowData);

  const handleStepChange = (step: number) => {
    console.log(`Current step: ${step + 1}`);
  };

  const handleComplete = () => {
    console.log("Import shipment update completed!");
    // Navigate back to master like create page
    navigate("../");
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Text size="xl" fw={600} c="#105476" mb="lg">
          Edit Import Booking
        </Text>

        <ImportShipmentStepper
          onStepChange={handleStepChange}
          onComplete={handleComplete}
          initialData={rowData}
          isEditMode={true}
        />
      </Stack>
    </Container>
  );
}

export default ImportShipmentEdit;
