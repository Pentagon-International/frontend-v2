import {
  Box,
  Button,
  CloseButton,
  Divider,
  FileButton,
  Flex,
  Grid,
  Group,
  Progress,
  rem,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconCheck,
  IconFile,
  IconUpload,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useEffect, useState } from "react";
import { getAPICall } from "../../../service/getApiCall";

type CompanyFormData = {
  company_code: string;
  company_name: string;
  website: string;
  group_code: string;
  reporting_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const MAX_SIZE_MB = 3;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

function CompanyNew() {
  const [groupCompanyOptions, setGroupCompanyOptions] = useState([]);
  const navigate = useNavigate();
  //   const [uploadProgress, setUploadProgress] = useState(0);
  //   const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchGroupCompanies = async () => {
      try {
        const response = await getAPICall(URL.groupCompany, API_HEADER);
        // console.log("fetchGroupCompanies response=", response);

        const options = response.map((item) => ({
          value: String(item.group_code),
          label: item.group_name,
        }));
        // console.log("Options vallue=", options);
        setGroupCompanyOptions(options);
      } catch (error) {
        console.error("Failed to load group companies", error);
      }
    };

    fetchGroupCompanies();
  }, []);

  const schema = yup.object().shape({
    company_code: yup.string().required("Company Code is required"),
    company_name: yup.string().required("Company Name is required"),
    website: yup.string().required("Website is required"),
    group_code: yup.string().required("Group Code is required"),
    reporting_name: yup.string().required("Reporting Name is required"),
  });

  //File upload
  const handleFile = (file: File | null) => {
    if (!file) return;
    const error = form.validateField("file", file);
    if (!error) {
      form.setFieldValue("file", file);
      setUploadedFile(file);
      simulateUpload();
    }
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const companyForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      company_code: "",
      company_name: "",
      website: "",
      group_code: "",
      reporting_name: "",
      //   file: null,
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
    // validate: {
    //   file: (value) => {
    //     if (!value) return "File is required";
    //     if (!ACCEPTED_TYPES.includes(value.type))
    //       return "Unsupported file type";
    //     if (value.size > MAX_SIZE_MB * 1024 * 1024)
    //       return "File exceeds 3MB limit";
    //     return null;
    //   },
    // },
  });

  const handleCreateForm = async (values: CompanyFormData): Promise<void> => {
    console.log("handleCreateForm", values);

    try {
      await postAPICall(URL.company, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Company created successfully",
      });
      navigate("/master/company");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while creating company type: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={companyForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my="md">
        Create Company
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Company Code"
          withAsterisk
          key={companyForm.key("company_code")}
          {...companyForm.getInputProps("company_code")}
        />
        <TextInput
          label="Company Name"
          withAsterisk
          key={companyForm.key("company_name")}
          {...companyForm.getInputProps("company_name")}
        />
        <TextInput
          label="Website"
          withAsterisk
          key={companyForm.key("website")}
          {...companyForm.getInputProps("website")}
        />
      </Group>

      <Grid mb="md">
        <Grid.Col span={4}>
          {/* <TextInput
            label="Group Company"
            withAsterisk
            key={companyForm.key("group_code")}
            {...companyForm.getInputProps("group_code")}
          /> */}
          <Select
            label="Group Company"
            placeholder="Select group company"
            withAsterisk
            searchable
            clearable
            nothingFoundMessage="No Companies found..."
            data={groupCompanyOptions}
            {...companyForm.getInputProps("group_code")}
          ></Select>
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput
            label="Reporting Name"
            withAsterisk
            key={companyForm.key("reporting_name")}
            {...companyForm.getInputProps("reporting_name")}
          />
        </Grid.Col>
      </Grid>
      <Group>
        {/* <Text fw={500} my="md">
          Upload Logo
        </Text> */}
        {/* <Box maw={500}>
          <Text fw={500} mb="xs">
            Upload Logo
          </Text>

          <Box
            style={(theme) => ({
              border: `1px dashed ${theme.colors.gray[4]}`,
              padding: rem(20),
              borderRadius: rem(8),
              textAlign: "center",
            })}
          >
            <Group display="center" gap="xs">
              <ThemeIcon size={40} radius="xl" color="blue">
                <IconUpload size={24} />
              </ThemeIcon>
            </Group>

            <Text mt="sm">
              Drag and drop here or{" "}
              <FileButton
                onChange={handleFile}
                accept="image/png,image/jpeg,image/jpg"
              >
                {(props) => (
                  <Text
                    span
                    c="blue"
                    {...props}
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                  >
                    Browse File
                  </Text>
                )}
              </FileButton>
            </Text>
            <Text size="xs" c="dimmed">
              Supports : PNG, JPG, JPEG format within 3MB
            </Text>
          </Box>

          {uploadedFile && (
            <Box
              mt="lg"
              style={{
                border: "1px solid #dee2e6",
                borderRadius: rem(8),
                padding: rem(12),
              }}
            >
              <Group display="apart" align="center">
                <Group gap="sm">
                  <ThemeIcon variant="light" radius="xl" color="blue">
                    <IconFile size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm">{uploadedFile.name}</Text>
                    <Text size="xs" color="blue">
                      {uploadProgress < 100
                        ? `Uploading... ${uploadProgress}%`
                        : "Upload complete"}
                    </Text>
                  </div>
                </Group>
                <CloseButton
                  onClick={() => {
                    setUploadedFile(null);
                    form.reset();
                    setUploadProgress(0);
                  }}
                />
              </Group>
              <Progress mt="xs" value={uploadProgress} color="blue" />
            </Box>
          )}
        </Box> */}
      </Group>

      <Stack justify="space-between" mt="40%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            c="#105476"
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/company")}
          >
            Back
          </Button>
          <Flex gap="md">
            <Button
              variant="outline"
              c="#105476"
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              onClick={() => navigate("/master/company")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              rightSection={<IconCheck size={16} />}
            >
              Submit
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );
}

export default CompanyNew;
