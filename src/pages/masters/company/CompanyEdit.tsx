import {
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { putAPICall } from "../../../service/putApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useEffect, useState } from "react";
import { getAPICall } from "../../../service/getApiCall";
import { toTitleCase } from "../../../utils/textFormatter";

type CompanyEditFormData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  group_code: string;
  reporting_name: string;
  status: "ACTIVE" | "INACTIVE";
};

type EditFormData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  group_name: string;
  reporting_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  company_code: yup.string().required("Company Code is required"),
  company_name: yup.string().required("Company Name is required"),
  website: yup.string().required("Company is required"),
  group_code: yup.string().required("Group Code is required"),
  reporting_name: yup.string().required("Reporting Name is required"),
});

function CompanyEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const [groupCompanyOptions, setGroupCompanyOptions] = useState([]);
  const editFormData = location.state as EditFormData;

  const editForm = useForm<CompanyEditFormData>({
    initialValues: {
      id: editFormData?.id || 0,
      company_code: editFormData?.company_code || "",
      company_name: editFormData?.company_name || "",
      website: editFormData?.website || "",
      group_code: editFormData?.group_name || "",
      reporting_name: editFormData?.reporting_name || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

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
          (option) => option?.label === editFormData.group_name
        );

        if (initialSelectValue) {
          editForm.setFieldValue("group_code", initialSelectValue?.value);
        }
      } catch (error) {
        console.error("Failed to load group companies", error);
      }
    };
    fetchGroupCompanies();
  }, []);

  const handleEditForm = async (values: CompanyEditFormData): Promise<void> => {
    console.log("check check check-----", values);

    try {
      await putAPICall(URL.company, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: `Company updated successfully`,
      });
      navigate("/master/company");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while updating Company: ${err.message}`,
      });
    }
  };

  function handleBack() {
    // console.log("handleBack check");

    if (editFormData?.from === "view") {
      navigate("/master/company-view", {
        state: editFormData,
      });
    } else {
      navigate("/master/company");
    }
  }

  return (
    <Box
      component="form"
      style={{ width: "90%", padding: "0 10%" }}
      onSubmit={editForm.onSubmit(handleEditForm)}
    >
      <Group justify="space-between">
        <Text fw={500} my={"md"}>
          Edit Company
        </Text>
        <SegmentedControl
          {...editForm.getInputProps("status")}
          data={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          size="xs"
          radius="sm"
          styles={{
            root: {
              backgroundColor: "#E4E4E4",
              color: "#105476",
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
      </Group>

      <Group grow mb="md">
        <TextInput
          label="Company Code"
          withAsterisk
          key={editForm.key("company_code")}
          {...editForm.getInputProps("company_code")}
        />
        <TextInput
          label="Company Name"
          withAsterisk
          key={editForm.key("company_name")}
          value={editForm.values.company_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            editForm.setFieldValue("company_name", formattedValue);
          }}
          error={editForm.errors.company_name}
        />
        <TextInput
          label="Website"
          withAsterisk
          key={editForm.key("website")}
          {...editForm.getInputProps("website")}
        />
      </Group>

      <Grid mb="md">
        <Grid.Col span={4}>
          <Select
            label="Group Company"
            placeholder="Select group company"
            withAsterisk
            searchable
            clearable
            nothingFoundMessage="No Companies found..."
            data={groupCompanyOptions}
            {...editForm.getInputProps("group_code")}
            // defaultValue={group_code}
          ></Select>
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput
            label="Reporting Name"
            withAsterisk
            key={editForm.key("reporting_name")}
            value={editForm.values.reporting_name}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("reporting_name", formattedValue);
            }}
            error={editForm.errors.reporting_name}
          />
        </Grid.Col>
      </Grid>

      <Stack justify="space-between" mt={"30%"}>
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            w={130}
            variant="outline"
            c="#105476"
            styles={{ root: { borderColor: "#105476" } }}
            leftSection={<IconArrowLeft size={16} />}
            // onClick={() => navigate("/master/company")}
            onClick={handleBack}
          >
            Back
          </Button>
          <Group>
            <Button
              w={130}
              variant="outline"
              c="#105476"
              onClick={() => navigate("/master/company")}
            >
              Cancel
            </Button>
            <Button
              w={130}
              type="submit"
              color="#105476"
              rightSection={<IconCheck size={16} />}
            >
              Update
            </Button>
          </Group>
        </Flex>
      </Stack>
    </Box>
  );
}

export default CompanyEdit;
