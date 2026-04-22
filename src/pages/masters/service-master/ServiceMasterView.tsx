import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Popover,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowLeft, IconEdit, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type ServiceData = {
  id: number;
  service_code: string;
  service_name: string;
  transport_mode: string;
  full_groupage: string;
  import_export: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS: { label: string; value: "ACTIVE" | "INACTIVE" }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function ServiceMasterView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const [transportModes, setTransportModes] = useState<{ label: string; value: string }[]>([]);

  const viewData = location.state as ServiceData;

  useEffect(() => {
    const fetchTransportModes = async () => {
      try {
        const res = await getAPICall(URL.portMaster, API_HEADER);
        const activePorts = res.filter((port: any) => port.status === "ACTIVE");
        const uniqueModes = Array.from(new Set(activePorts.map((port: any) => port.transport_mode)));
        const modeOptions = uniqueModes.map((mode) => ({ label: mode, value: mode }));
        setTransportModes(modeOptions);
      } catch (err: any) {
        ToastNotification({
          type: "error",
          message: `Error fetching transport modes: ${err.message}`,
        });
      }
    };
    fetchTransportModes();
  }, []);

  const handleDelete = async (value: ServiceData) => {
    try {
      await deleteApiCall(URL.serviceMaster, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: `Service is successfully deleted`,
      });
      navigate("/master/service");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting Service: ${err.message}`,
      });
    }
  };

  return (
    <Box component="form" style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Service
        </Text>
        <Group gap={50}>
          <SegmentedControl
            size="xs"
            value={viewData.status}
            data={STATUS_OPTIONS}
            radius="sm"
            styles={{
              root: {
                backgroundColor: "#E4E4E4",
                width: "150px",
              },
              indicator: {
                backgroundColor: "#105476",
              },
              label: {
                color: "#105476",
                "&[data-active]": {
                  color: "#ffffff",
                },
              },
            }}
          />
          <Button
            size="xs"
            w={100}
            variant="outline"
            leftSection={<IconEdit size={16} />}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            onClick={() =>
              navigate("/master/service-edit", {
                state: { ...viewData, from: "view" },
              })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Service Code"
            withAsterisk
            value={viewData.service_code}
            w={200}
            readOnly
          />
        </Box>
        <Box>
          <TextInput
            label="Service Name"
            withAsterisk
            value={viewData.service_name}
            w={200}
            readOnly
          />
        </Box>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <Select
            label="Transport Mode"
            data={transportModes}
            value={viewData.transport_mode}
            w={200}
            readOnly
            disabled
          />
        </Box>
        <Box>
          <TextInput
            label="Full/Groupage"
            value={viewData.full_groupage}
            w={200}
            readOnly
          />
        </Box>
        <Box>
          <TextInput
            label="Import/Export"
            value={viewData.import_export}
            w={200}
            readOnly
          />
        </Box>
      </Group>

      <Stack justify="space-between" mt="30%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Popover
            opened={opened}
            width={240}
            position="right-start"
            offset={15}
            clickOutsideEvents={["mouseup", "touchend"]}
            radius="md"
          >
            <Popover.Target>
              <Button
                onClick={open}
                w={120}
                variant="outline"
                leftSection={<IconTrash size={16} />}
                styles={{
                  root: {
                    color: "#105476",
                    borderColor: "red",
                  },
                }}
                c={"red"}
              >
                Delete
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Group mb={5} gap="xs">
                <IconTrash color="red" size={16} />
                <Text size="sm" c="red" fw={700}>
                  Delete
                </Text>
              </Group>
              <Text size="sm" mb="xs">
                Are you sure?
                <br />
                Do you want to delete this?
              </Text>
              <Group mt={10} gap="lg">
                <Button
                  variant="outline"
                  color="#105476"
                  size="xs"
                  onClick={close}
                >
                  Not now
                </Button>
                <Button
                  size="xs"
                  color="#FF0004"
                  style={{ width: "100px" }}
                  onClick={() => {
                    handleDelete(viewData);
                    close();
                  }}
                >
                  Yes, Delete
                </Button>
              </Group>
            </Popover.Dropdown>
          </Popover>

          <Button
            w={120}
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/service")}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            c={"#105476"}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default ServiceMasterView;
