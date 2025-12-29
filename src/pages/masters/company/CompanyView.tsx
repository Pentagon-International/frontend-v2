import {
  Box,
  Button,
  Divider,
  Flex,
  Grid,
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
import { useLocation, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useEffect, useState } from "react";
import { getAPICall } from "../../../service/getApiCall";

type GroupData = {
  group_code: string;
  group_name: string;
  status: "ACTIVE" | "INACTIVE";
};
type CompanyViewFormData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  group_code: string;
  reporting_name: string;
  status: "ACTIVE" | "INACTIVE";
};

type ViewFormData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  group_name: string;
  reporting_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS: { label: string; value: Status }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function CompanyView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const [groupCompanyOptions, setGroupCompanyOptions] = useState([]);
  const [viewSelectData, setviewSelectData] = useState();
  const viewData = location.state as ViewFormData | undefined;
  // console.log("data check=", viewData);

  useEffect(() => {
    const fetchGroupCompanies = async () => {
      try {
        const response = await getAPICall(URL.groupCompany, API_HEADER);
        const options = response?.map((item) => ({
          value: String(item.group_code),
          label: item.group_name,
        }));
        setGroupCompanyOptions(options);

        const initialSelectValue = options.find(
          (option) => option?.label === viewData?.group_name
        );
        // console.log("initialSelectValue-----", initialSelectValue);

        if (initialSelectValue) {
          setviewSelectData(initialSelectValue.value);
        }
      } catch (error) {
        console.error("Failed to load group companies", error);
      }
    };
    fetchGroupCompanies();
  }, []);

  if (!viewData) {
    return <p>No data to display.</p>;
  }

  const handleDelete = async (value) => {
    try {
      await deleteApiCall(URL.groupCompany, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: `Group is successfully deleted`,
      });
      navigate("/master/company");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting Group: ${err.message}`,
      });
    }
  };

  return (
    <>
      <Box
        component="form"
        style={{ width: "90%", padding: "0 10%" }}
        //   onSubmit={groupForm.onSubmit(handleForm)}
      >
        <Group justify="space-between">
          <Text fw={500} my={"md"}>
            View Company
          </Text>
          <Group
            // w={"50%"}
            gap={50}
            //   style={{marginLeft:20}}
          >
            <SegmentedControl
              size="xs"
              value={viewData.status}
              data={STATUS_OPTIONS}
              radius="sm"
              styles={{
                root: {
                  backgroundColor: "#E4E4E4",
                  color: "105476",
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
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              c={"#105476"}
              variant="outline"
              leftSection={<IconEdit size={16} />}
              onClick={() =>
                navigate("/master/company-edit", {
                  state: { ...viewData, from: "view" },
                })
              }
            >
              Edit
            </Button>
          </Group>
        </Group>
        <Group grow mb="md">
          <TextInput
            label="Company Code"
            withAsterisk
            value={viewData?.company_code}
          />
          <TextInput
            label="Company Name"
            withAsterisk
            value={viewData?.company_name}
          />
          <TextInput label="Website" withAsterisk value={viewData?.website} />
        </Group>

        <Grid mb="md">
          <Grid.Col span={4}>
            <Select
              label="Group Company"
              placeholder="Select group company"
              withAsterisk
              nothingFoundMessage="No Companies found..."
              value={viewSelectData}
              data={groupCompanyOptions}
            ></Select>
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Reporting Name"
              withAsterisk
              value={viewData?.reporting_name}
            />
          </Grid.Col>
        </Grid>

        <Stack justify="space-between" mt={"30%"}>
          <Divider my="md" />
          <Flex gap="sm" justify="space-between" align="center" w="100%">
            <Popover
              opened={opened}
              //   onChange={open}
              width={240}
              position="right-start"
              offset={15}
              clickOutsideEvents={["mouseup", "touchend"]}
              radius={"md"}
            >
              <Popover.Target>
                <Button
                  //   opened={opened}
                  onClick={open}
                  w={120}
                  styles={{
                    root: {
                      color: "#105476",
                      borderColor: "red",
                    },
                  }}
                  c={"red"}
                  variant="outline"
                  leftSection={<IconTrash size={16} />}
                >
                  Delete
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Group mb={5} gap={"xs"}>
                  <IconTrash color="red" size={16} />
                  <Text size="sm" c="red" fw={700}>
                    Delete
                  </Text>
                </Group>
                <Text size="sm" mb="xs">
                  Are you sure!<br></br>
                  Do you want to delete this?
                </Text>
                <Group mt={10} gap={"lg"}>
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
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              c={"#105476"}
              variant="outline"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate("/master/company")}
            >
              Back
            </Button>
          </Flex>
        </Stack>
      </Box>
    </>
  );
}

export default CompanyView;
