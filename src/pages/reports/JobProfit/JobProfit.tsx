import { Box, Button, Card, Grid, Group, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import SingleDateInput from "../../../components/SingleDateInput";
import FormTextInput from "../../../components/FormTextInput";
import Dropdown from "../../../components/Dropdown";
import SearchableSelect from "../../../components/SearchableSelect";
import { URL } from "../../../api/serverUrls";

type JobProfitFormValues = {
  segment_code: string;
  salesman_code: string;
  customer_code: string;
  segment_group_code: string;
  agent_code: string;
  job_from_date: Date | null;
  job_to_date: Date | null;
  por: string;
  pol: string;
  pod: string;
  fdc: string;
  freight: string | null;
  report_format: string | null;
  group_by: string | null;
  project_code: string;
  job_status: string | null;
};

export default function JobProfit() {
  const form = useForm<JobProfitFormValues>({
    initialValues: {
      segment_code: "",
      salesman_code: "",
      customer_code: "",
      segment_group_code: "",
      agent_code: "",
      job_from_date: null,
      job_to_date: null,
      por: "",
      pol: "",
      pod: "",
      fdc: "",
      freight: null,
      report_format: "PDF",
      group_by: null,
      project_code: "",
      job_status: "Active",
    },
  });

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Title order={4} style={{ color: "#105476" }}>
          Job Profit
        </Title>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <FormTextInput label="Segment Code" {...form.getInputProps("segment_code")} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <FormTextInput label="Salesman Code" {...form.getInputProps("salesman_code")} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="Customer"
              placeholder="Type customer name"
              apiEndpoint={URL.customer}
              dropdownZIndex={10}
              searchFields={["customer_name", "customer_code"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.customer_code),
                label: String(item.customer_name),
              })}
              value={form.values.customer_code}
              displayValue={form.values.customer_code}
              onChange={(value, selectedData) => {
                form.setFieldValue("customer_code", value || "");
                // If you later need customer name separately, add a separate field.
                void selectedData;
              }}
              minSearchLength={2}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <FormTextInput
              label="Segment Group Code"
              {...form.getInputProps("segment_group_code")}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="Agent"
              placeholder="Type agent name"
              apiEndpoint={URL.agent}
              dropdownZIndex={10}
              searchFields={["customer_name", "customer_code"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.customer_code),
                label: String(item.customer_name),
              })}
              value={form.values.agent_code}
              displayValue={form.values.agent_code}
              onChange={(value) => {
                form.setFieldValue("agent_code", value || "");
              }}
              minSearchLength={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="Job From Date"
              value={form.values.job_from_date}
              onChange={(d) => form.setFieldValue("job_from_date", d)}
              withAsterisk
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="To Date"
              value={form.values.job_to_date}
              onChange={(d) => form.setFieldValue("job_to_date", d)}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="POR"
              placeholder="Type port name"
              apiEndpoint={URL.portMaster}
              dropdownZIndex={10}
              searchFields={["port_code", "port_name"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={form.values.por}
              displayValue={form.values.por}
              onChange={(value) => form.setFieldValue("por", value || "")}
              minSearchLength={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="POL"
              placeholder="Type port name"
              apiEndpoint={URL.portMaster}
              dropdownZIndex={10}
              searchFields={["port_code", "port_name"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={form.values.pol}
              displayValue={form.values.pol}
              onChange={(value) => form.setFieldValue("pol", value || "")}
              minSearchLength={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="POD"
              placeholder="Type port name"
              apiEndpoint={URL.portMaster}
              dropdownZIndex={10}
              searchFields={["port_code", "port_name"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={form.values.pod}
              displayValue={form.values.pod}
              onChange={(value) => form.setFieldValue("pod", value || "")}
              minSearchLength={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="FDC"
              placeholder="Type port name"
              apiEndpoint={URL.portMaster}
              dropdownZIndex={10}
              searchFields={["port_code", "port_name"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={form.values.fdc}
              displayValue={form.values.fdc}
              onChange={(value) => form.setFieldValue("fdc", value || "")}
              minSearchLength={2}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Freight"
              data={[]}
              value={form.values.freight}
              onChange={(v) => form.setFieldValue("freight", v)}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Report Format"
              data={[{ value: "PDF", label: "PDF" }]}
              value={form.values.report_format}
              onChange={(v) => form.setFieldValue("report_format", v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Group By"
              data={[]}
              value={form.values.group_by}
              onChange={(v) => form.setFieldValue("group_by", v)}
              clearable
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <FormTextInput label="Project Code" {...form.getInputProps("project_code")} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Job Status"
              data={[{ value: "Active", label: "Active" }]}
              value={form.values.job_status}
              onChange={(v) => form.setFieldValue("job_status", v)}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Group justify="flex-end" mt="xs">
              <Button
                onClick={() => {
                  // UI-only for now; wire actual report generation next.
                }}
              >
                Print
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
    </Box>
  );
}

