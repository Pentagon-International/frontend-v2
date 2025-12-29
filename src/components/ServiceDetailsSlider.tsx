import React from "react";
import {
  Box,
  Card,
  Group,
  Text,
  ActionIcon,
  Stack,
  Badge,
  Center,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

export interface ServiceDetail {
  id: number;
  service: "AIR" | "FCL" | "LCL";
  trade: "Export" | "Import";
  origin_code_read: string;
  origin_name: string;
  destination_code_read: string;
  destination_name: string;
  pickup: boolean;
  delivery: boolean;
  pickup_location: string;
  delivery_location: string;
  hazardous_cargo: boolean;
  shipment_terms_code_read: string;
  shipment_terms_name: string;
  // FCL specific
  fcl_details?: Array<{
    id: number;
    container_type: string;
    container_name: string;
    no_of_containers: number;
    gross_weight: number | null;
  }>;
  // AIR/LCL specific
  no_of_packages?: number | null;
  gross_weight?: number | null;
  volume_weight?: number | null;
  chargeable_weight?: number | null;
  volume?: number | null;
  chargeable_volume?: number | null;
}

interface ServiceDetailsSliderProps {
  services: ServiceDetail[];
  selectedServiceIndex: number;
  onServiceSelect: (index: number) => void;
}

const ServiceDetailsSlider: React.FC<ServiceDetailsSliderProps> = ({
  services,
  selectedServiceIndex,
  onServiceSelect,
}) => {
  const handlePrevious = () => {
    const newIndex =
      selectedServiceIndex === 0
        ? services.length - 1 // Wrap to last service
        : selectedServiceIndex - 1;
    onServiceSelect(newIndex);
  };

  const handleNext = () => {
    const newIndex =
      selectedServiceIndex === services.length - 1
        ? 0 // Wrap to first service
        : selectedServiceIndex + 1;
    onServiceSelect(newIndex);
  };

  const getVisibleServices = () => {
    const totalServices = services.length;
    if (totalServices <= 3) {
      return services.map((service, index) => ({ service, index }));
    }

    // Always show 3 services with the selected one in the middle when possible
    let startIndex = Math.max(0, selectedServiceIndex - 1);
    let endIndex = Math.min(totalServices - 1, startIndex + 2);

    // Adjust if we're near the end
    if (endIndex - startIndex < 2) {
      startIndex = Math.max(0, endIndex - 2);
    }

    return services
      .slice(startIndex, endIndex + 1)
      .map((service, localIndex) => ({
        service,
        index: startIndex + localIndex,
      }));
  };

  const visibleServices = getVisibleServices();

  const getServiceBadgeColor = (service: ServiceDetail["service"]) => {
    switch (service) {
      case "FCL":
        return "blue";
      case "LCL":
        return "green";
      case "AIR":
        return "orange";
      default:
        return "gray";
    }
  };

  if (services.length === 0) {
    return (
      <Center py="md">
        <Text c="dimmed">No services available</Text>
      </Center>
    );
  }

  return (
    <Box mb="lg">
      {/* Header */}
      <Group justify="space-between" align="center" mb="md">
        <Text size="md" fw={600} c="#105476">
          Service Details ({services.length})
        </Text>
        {services.length > 3 && (
          <Text size="xs" c="bo">
            {selectedServiceIndex + 1} of {services.length}
          </Text>
        )}
      </Group>

      {/* Slider Container */}
      <Box
        style={{
          borderRadius: "12px",
          padding: "16px",
          border: "1px solid rgba(16, 84, 118, 0.1)",
        }}
      >
        <Group justify="center" align="center" gap="lg">
          {/* Previous Button */}
          <ActionIcon
            variant="filled"
            color="#105476"
            size="lg"
            onClick={handlePrevious}
            style={{
              backgroundColor: "#105476",
              color: "white",
              boxShadow: "0 2px 8px rgba(16, 84, 118, 0.2)",
              transition: "all 0.3s ease",
            }}
          >
            <IconChevronLeft size={20} />
          </ActionIcon>

          {/* Service Cards */}
          <Group gap="md" justify="center" style={{ minWidth: "800px" }}>
            {visibleServices.map(({ service, index }) => {
              const isSelected = index === selectedServiceIndex;

              return (
                <Card
                  key={service.id}
                  padding="xs"
                  radius="md"
                  withBorder
                  style={{
                    cursor: "pointer",
                    minWidth: "250px",
                    maxWidth: "300px",
                    height: "50px",
                    backgroundColor: isSelected ? "#f0f7ff" : "#ffffff",
                    borderColor: isSelected ? "#105476" : "#e9ecef",
                    borderWidth: isSelected ? 2 : 1,
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    boxShadow: isSelected
                      ? "0 4px 12px rgba(16, 84, 118, 0.15)"
                      : "0 2px 4px rgba(0, 0, 0, 0.05)",
                  }}
                  onClick={() => onServiceSelect(index)}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "scale(1.01)";
                      e.currentTarget.style.borderColor = "#105476";
                      e.currentTarget.style.boxShadow =
                        "0 4px 8px rgba(16, 84, 118, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.borderColor = "#e9ecef";
                      e.currentTarget.style.boxShadow =
                        "0 2px 4px rgba(0, 0, 0, 0.05)";
                    }
                  }}
                >
                  {/* Service Type Badge and Trade in same row */}
                  <Group justify="center" align="center" mb={2}>
                    <Badge
                      color={getServiceBadgeColor(service.service)}
                      size="xs"
                      variant={isSelected ? "filled" : "light"}
                    >
                      {service.service}
                    </Badge>
                    <Text
                      size="xs"
                      c={isSelected ? "#105476" : "dimmed"}
                      fw={isSelected ? 600 : 400}
                    >
                      {service.trade}
                    </Text>
                  </Group>

                  {/* Origin and Destination in single row */}
                  <Group justify="center" align="center" gap={4}>
                    <Text
                      size="xs"
                      c={isSelected ? "#105476" : "#666"}
                      fw={500}
                      ta="center"
                      lineClamp={1}
                      style={{ flex: 1 }}
                    >
                      {service.origin_name}
                    </Text>
                    <Text size="xs" c="dimmed" fw={600}>
                      →
                    </Text>
                    <Text
                      size="xs"
                      c={isSelected ? "#105476" : "#666"}
                      fw={500}
                      ta="center"
                      lineClamp={1}
                      style={{ flex: 1 }}
                    >
                      {service.destination_name}
                    </Text>
                  </Group>

                  {/* Quotation Status Indicator */}
                </Card>
              );
            })}
          </Group>

          {/* Next Button */}
          <ActionIcon
            variant="filled"
            color="#105476"
            size="lg"
            onClick={handleNext}
            style={{
              backgroundColor: "#105476",
              color: "white",
              boxShadow: "0 2px 8px rgba(16, 84, 118, 0.2)",
              transition: "all 0.3s ease",
            }}
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>
      </Box>

      {/* Separator Line */}
      <Box
        style={{
          height: "2px",
          background:
            "linear-gradient(90deg, transparent 0%, #105476 20%, #105476 80%, transparent 100%)",
          margin: "24px 0",
          borderRadius: "1px",
        }}
      />
    </Box>
  );
};

export default ServiceDetailsSlider;
