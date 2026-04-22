import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

function BranchMasterEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const rowData = location.state;

  const [companyOptions, setCompanyOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const schema = yup.object().shape({
    branch_code: yup.string().required("Branch Code is required"),
    branch_name: yup.string().required("Branch Name is required"),
    company_code: yup.string().required("Company is required"),
    address: yup.string().required("Address is required"),
    city: yup.string().required("City is required"),
    state: yup.string().required("State is required"),
    pin_code: yup
      .string()
      .required("Pincode is required")
      .matches(/^\d{6}$/, "Pincode must be 6 digits"),
  });

  const form = useForm({
    initialValues: {
      id: rowData?.id || "",
      branch_code: rowData?.branch_code || "",
      branch_name: rowData?.branch_name || "",
      company_code: rowData?.company_code || "", // Note: Must be company_code
      address: rowData?.address || "",
      city: rowData?.city || "",
      state: rowData?.state || "",
      pin_code: rowData?.pin_code || "",
      status: rowData?.status || "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  // Fetch company dropdown
  useEffect(() => {
    const fetchCompanyList = async () => {
      try {
        const res = await getAPICall(URL.company, API_HEADER);
        const dropdown = res.map((company: any) => ({
          value: company.company_code,
          label: company.company_name,
        }));
        setCompanyOptions(dropdown);
      } catch (error: any) {
        ToastNotification({
          type: "error",
          message: `Error fetching companies: ${error.message}`,
        });
      }
    };
    fetchCompanyList();
  }, []);

  const branchMasterEditSubmit = async (values: any) => {
    try {
      await putAPICall(URL.branchMaster, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Branch updated successfully",
      });
      navigate("/master/branch");
    } catch (error: any) {
      ToastNotification({
        type: "error",
        message: `Error updating branch: ${error.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={form.onSubmit(branchMasterEditSubmit)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Branch
        </Text>
        <SegmentedControl
          size="xs"
          radius="sm"
          data={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          {...form.getInputProps("status")}
          styles={{
            root: { width: 150, backgroundColor: "#E4E4E4" },
            indicator: { backgroundColor: "#105476" },
            label: {
              color: "#105476",
              "&[data-active]": { color: "#ffffff" },
            },
          }}
        />
      </Group>

      <Group grow mb="md">
        <TextInput
          label="Branch Code"
          withAsterisk
          {...form.getInputProps("branch_code")}
        />
        <TextInput
          label="Branch Name"
          withAsterisk
          value={form.values.branch_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("branch_name", formattedValue);
          }}
          error={form.errors.branch_name}
        />
      </Group>

      <Group grow mb="md">
        <Select
          label="Company"
          withAsterisk
          data={companyOptions}
          searchable
          {...form.getInputProps("company_code")}
        />
        <TextInput
          label="Address"
          withAsterisk
          value={form.values.address}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("address", formattedValue);
          }}
          error={form.errors.address}
        />
      </Group>

      <Group grow mb="md">
        <TextInput label="City" withAsterisk {...form.getInputProps("city")} />
        <TextInput
          label="State"
          withAsterisk
          {...form.getInputProps("state")}
        />
        <TextInput
          label="Pincode"
          withAsterisk
          {...form.getInputProps("pin_code")}
        />
      </Group>

      <Stack justify="space-between" mt={"30%"}>
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/branch")}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
          >
            Back
          </Button>
          <Flex gap="md">
            <Button
              variant="outline"
              onClick={() => navigate("/master/branch")}
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              rightSection={<IconCheck size={16} />}
            >
              Update
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );
}

export default BranchMasterEdit;
