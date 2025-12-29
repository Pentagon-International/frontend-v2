import { useEffect, useState, useMemo } from "react";
import { ToastNotification } from "../../../components";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";
import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { yupResolver } from "mantine-form-yup-resolver";
import * as yup from "yup";
import {
  IconArrowLeft,
  IconCheck,
} from "@tabler/icons-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { putAPICall } from "../../../service/putApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { DateInput } from "@mantine/dates";
import { SearchableSelect } from "../../../components";
import { IconChevronRight, IconChevronLeft, IconCalendar } from "@tabler/icons-react";

type CoordinatorReassignationFormData = {
  coordinator_id: string;
  coordinator_user_id: number | null;
  assigned_coordinator_id: string;
  assigned_coordinator_user_id: number | null;
  from_date: Date | null;
  to_date: Date | null;
};


const validationSchema = yup.object({
  coordinator_id: yup.string().required("Actual Co-ordinator is required"),
  assigned_coordinator_id: yup.string().required("Assigned To is required"),
  from_date: yup.date().required("From Date is required"),
  to_date: yup.date().required("To Date is required"),
});

function CoordinatorReassignationCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Check user permissions from localStorage
  const hasManagerOrStaffAccess = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return false;
      const user = JSON.parse(userStr);
      return user?.is_manager === true || user?.is_staff === true;
    } catch (error) {
      console.error("Error checking user permissions:", error);
      return false;
    }
  }, []);

  // Redirect unauthorized users to /master
  useEffect(() => {
    if (!hasManagerOrStaffAccess) {
      navigate("/master", { replace: true });
    }
  }, [hasManagerOrStaffAccess, navigate]);

  const isEditMode = !!id;
  const editData = location.state as CoordinatorReassignationFormData & {
    id?: number;
    coordinator_name?: string;
    coordinator_user_id?: number;
    assigned_coordinator_name?: string;
    assigned_coordinator_user_id?: number;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [coordinatorDisplayName, setCoordinatorDisplayName] = useState<
    string | null
  >(null);
  const [assignedCoordinatorDisplayName, setAssignedCoordinatorDisplayName] =
    useState<string | null>(null);

  const form = useForm<CoordinatorReassignationFormData>({
    validate: yupResolver(validationSchema) as unknown as (
      values: CoordinatorReassignationFormData
    ) => Record<string, string>,
    initialValues: {
      coordinator_id: "",
      coordinator_user_id: null,
      assigned_coordinator_id: "",
      assigned_coordinator_user_id: null,
      from_date: null,
      to_date: null,
    },
  });

  // Reset form initialization flag when route changes
  useEffect(() => {
    setIsFormInitialized(false);
  }, [id, location.pathname]);

  // Load edit data - only run once when editData is available
  useEffect(() => {
    if (isEditMode && editData && !isFormInitialized) {
      form.setValues({
        coordinator_id: editData.coordinator_id || "",
        coordinator_user_id: editData.coordinator_user_id || null,
        assigned_coordinator_id: editData.assigned_coordinator_id || "",
        assigned_coordinator_user_id: editData.assigned_coordinator_user_id || null,
        from_date:
          editData.from_date && typeof editData.from_date === "string"
            ? new Date(editData.from_date)
            : editData.from_date instanceof Date
            ? editData.from_date
            : null,
        to_date:
          editData.to_date && typeof editData.to_date === "string"
            ? new Date(editData.to_date)
            : editData.to_date instanceof Date
            ? editData.to_date
            : null,
      });
      setCoordinatorDisplayName(editData.coordinator_name || null);
      setAssignedCoordinatorDisplayName(
        editData.assigned_coordinator_name || null
      );
      setIsFormInitialized(true);
    }
  }, [isEditMode, editData, isFormInitialized]);

  const handleSubmit = async (values: CoordinatorReassignationFormData) => {
    try {
      setIsSubmitting(true);

      // Format dates to YYYY-MM-DD in local timezone (not UTC)
      // This prevents date shifting when user is in a timezone behind UTC
      const formatDateLocal = (date: Date | null): string => {
        if (!date) return "";
        // Format in local timezone to avoid date shifting
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const payload: Record<string, unknown> = {
        coordinator_id: values.coordinator_user_id,
        assigned_coordinator_id: values.assigned_coordinator_user_id,
        from_date: formatDateLocal(values.from_date),
        to_date: formatDateLocal(values.to_date),
      };

      if (isEditMode && editData?.id) {
        payload.id = editData.id;
        await putAPICall(URL.coordinatorAssigned, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Coordinator reassignation updated successfully!",
        });
      } else {
        await postAPICall(URL.coordinatorAssigned, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Coordinator reassignation created successfully!",
        });
      }

      navigate("/master/sales-co-ordinator-reassignation", { state: { refreshData: true } });
    } catch (error) {
      console.error("Error submitting coordinator reassignation:", error);
      ToastNotification({
        type: "error",
        message: `Failed to ${
          isEditMode ? "update" : "create"
        } coordinator reassignation. Please try again.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if user doesn't have access
  if (!hasManagerOrStaffAccess) {
    return null;
  }

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)} px="lg" py="md">
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600} c="#105476">
          {isEditMode
            ? "Edit Sales Co-ordinator Reassignation"
            : "Create Sales Co-ordinator Reassignation"}
        </Text>
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate("/master/sales-co-ordinator-reassignation")}
        >
          Back to List
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Grid gutter="md">
            <Grid.Col span={6}>
              <SearchableSelect
                label="Actual Co-ordinator"
                placeholder="Type coordinator name (min 3 letters)"
                apiEndpoint={URL.userByCoordinator}
                searchFields={["user_name", "user_id"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.user_id || item.id || ""),
                  label: String(item.user_name || ""),
                })}
                value={form.values.coordinator_id}
                displayValue={coordinatorDisplayName}
                returnOriginalData={true}
                onChange={(value, selectedData, originalData) => {
                  if (value === null) {
                    // Clear all fields when value is null
                    form.setFieldValue("coordinator_id", "");
                    form.setFieldValue("coordinator_user_id", null);
                    setCoordinatorDisplayName(null);
                  } else {
                    form.setFieldValue("coordinator_id", value || "");
                    setCoordinatorDisplayName(selectedData?.label || null);
                    // Extract user_id (numeric) from original data
                    const userId = originalData?.id
                      ? Number(originalData.id)
                      : null;
                    form.setFieldValue("coordinator_user_id", userId);
                  }
                }}
                error={form.errors.coordinator_id as string}
                minSearchLength={3}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <SearchableSelect
                label="Assigned To"
                placeholder="Type coordinator name (min 3 letters)"
                apiEndpoint={URL.user}
                searchFields={["user_name", "user_id"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.user_id || item.id || ""),
                  label: String(item.user_name || ""),
                })}
                value={form.values.assigned_coordinator_id}
                displayValue={assignedCoordinatorDisplayName}
                returnOriginalData={true}
                onChange={(value, selectedData, originalData) => {
                  if (value === null) {
                    // Clear all fields when value is null
                    form.setFieldValue("assigned_coordinator_id", "");
                    form.setFieldValue("assigned_coordinator_user_id", null);
                    setAssignedCoordinatorDisplayName(null);
                  } else {
                    form.setFieldValue("assigned_coordinator_id", value || "");
                    setAssignedCoordinatorDisplayName(selectedData?.label || null);
                    // Extract user_id (numeric) from original data
                    const userId = originalData?.id
                      ? Number(originalData.id)
                      : null;
                    form.setFieldValue("assigned_coordinator_user_id", userId);
                  }
                }}
                error={form.errors.assigned_coordinator_id as string}
                minSearchLength={3}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="From Date"
                placeholder="YYYY-MM-DD"
                withAsterisk
                value={form.values.from_date}
                onChange={(date) => form.setFieldValue("from_date", date)}
                error={form.errors.from_date}
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={18} />}
                leftSectionPointerEvents="none"
                radius="sm"
                size="sm"
                nextIcon={<IconChevronRight size={16} />}
                previousIcon={<IconChevronLeft size={16} />}
                clearable
                styles={{
                  day: {
                    width: "2.25rem",
                    height: "2.25rem",
                    fontSize: "0.9rem",
                  },
                  calendarHeaderLevel: {
                    fontSize: "1rem",
                    fontWeight: 500,
                    marginBottom: "0.5rem",
                    flex: 1,
                    textAlign: "center",
                  },
                  calendarHeaderControl: {
                    width: "2rem",
                    height: "2rem",
                    margin: "0 0.5rem",
                  },
                  calendarHeader: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  },
                }}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="To Date"
                placeholder="YYYY-MM-DD"
                withAsterisk
                value={form.values.to_date}
                onChange={(date) => form.setFieldValue("to_date", date)}
                error={form.errors.to_date}
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={18} />}
                leftSectionPointerEvents="none"
                radius="sm"
                size="sm"
                nextIcon={<IconChevronRight size={16} />}
                previousIcon={<IconChevronLeft size={16} />}
                clearable
                styles={{
                  day: {
                    width: "2.25rem",
                    height: "2.25rem",
                    fontSize: "0.9rem",
                  },
                  calendarHeaderLevel: {
                    fontSize: "1rem",
                    fontWeight: 500,
                    marginBottom: "0.5rem",
                    flex: 1,
                    textAlign: "center",
                  },
                  calendarHeaderControl: {
                    width: "2rem",
                    height: "2rem",
                    margin: "0 0.5rem",
                  },
                  calendarHeader: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  },
                }}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => navigate("/master/sales-co-ordinator-reassignation")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              leftSection={<IconCheck size={16} />}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update"
                : "Create"}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}

export default CoordinatorReassignationCreate;

