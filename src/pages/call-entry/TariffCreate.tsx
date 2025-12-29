import {
  Box,
  Button,
  FileInput,
  Grid,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconCalendar, IconPlus, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { postAPICall } from "../../service/postApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAPICall } from "../../service/getApiCall";

function TariffCreate() {
  const [customerData, setCustomer] = useState([]);
  const [originData, setOrigin] = useState([]);
  const [destinationData, setDestination] = useState([]);
  const [currencyData, setCurrency] = useState([]);

  const navigate = useNavigate();
  const mainForm = useForm({
    initialValues: {
      origin_code: "",
      destination_code: "",
      valid_from: "",
      valid_to: "",
      status: "ACTIVE",
    },
  });

  const gridForm = useForm({
    initialValues: {
      tariff_charges: [
        {
          customer_code: "",
          charge_type: "",
          charge_name: "",
          carrier: "",
          unit: "",
          currency_code: "",
          rate: "",
        },
      ],
    },
  });
  const fetchCustomerMaster = async () => {
    try {
      const response = await getAPICall(`${URL.customer}`, API_HEADER);
      console.log("fetchCustomerMaster response------", response);

      const customerOptions = response.map((item) => ({
        value: String(item.customer_code),
        label: item.customer_name,
      }));
      setCustomer(customerOptions);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  const fetchPortMaster = async () => {
    try {
      const response = await getAPICall(`${URL.portMaster}`, API_HEADER);
      console.log("fetchPortMaster response------", response);

      const originDestinationOptions = response.map((item) => ({
        value: String(item.port_code),
        label: item.port_name,
      }));
      setOrigin(originDestinationOptions);
      setDestination(originDestinationOptions);
      //   setCustomer(customerOptions);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  const fetchCurrency = async () => {
    try {
      const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
      console.log("fetchCurrency response------", response);

      const currencyOptions = response.map((item) => ({
        value: String(item.code),
        label: item.code,
      }));
      setCurrency(currencyOptions);
      //   setOriginData(originDestinationOptions);
      //   setDestinationData(originDestinationOptions);
      //   setCustomer(customerOptions);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchCustomerMaster();
    fetchPortMaster();
    fetchCurrency();
  }, []);

  const tariffSubmit = async () => {
    const mainFormVal = mainForm.values;
    const gridFormVal = gridForm.values;
    const values = {
      ...mainFormVal,
      ...gridFormVal,
    };
    // console.log("Final data----", values);

    try {
      const res = await postAPICall(URL.tariff, values, API_HEADER);
      if (res) {
        ToastNotification({
          type: "success",
          message: "New Tariff is created",
        });
        navigate("/tariff");
      }
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while creating tariff: ${err?.message}`,
      });
    }
  };

  return (
    <>
      {/* <Box mx="auto" p="sm"> */}
      <Box maw={1200} mx="auto" p="md">
        {" "}
        <Title order={4} mt="md" mb={"sm"} c={"#105476"}>
          Tariff
        </Title>
        <Grid grow>
          <Grid.Col span={2}>
            <Select
              key={mainForm.key("origin_code")}
              label="Origin"
              placeholder="Select Origin"
              data={originData}
              {...mainForm.getInputProps("origin_code")}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              key={mainForm.key("destination_code")}
              label="Destination"
              placeholder="Select Destination"
              data={destinationData}
              {...mainForm.getInputProps("destination_code")}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Box maw={300} mx="auto">
              <DateInput
                label="Valid from"
                key={mainForm.key("valid_from")}
                placeholder="YYYY-MM-DD"
                value={mainForm.values.date}
                onChange={(date) => {
                  const formatted = date
                    ? dayjs(date).format("YYYY-MM-DD")
                    : "";
                  mainForm.setFieldValue("valid_from", formatted);
                  console.log("formatted=", formatted);
                }}
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={18} />}
                leftSectionPointerEvents="none"
                radius="md"
                size="md"
                dropdownType="popover"
                styles={{
                  calendar: {
                    padding: "0.5rem",
                    gap: "0.25rem",
                  },
                  day: {
                    width: "2.25rem",
                    height: "2.25rem",
                    fontSize: "0.9rem",
                  },
                  calendarHeaderLevel: {
                    fontSize: "1rem",
                    fontWeight: 500,
                    marginBottom: "0.5rem",
                  },
                  calendarHeaderControl: {
                    width: "2rem",
                    height: "2rem",
                  },
                }}
              />
            </Box>
          </Grid.Col>
          <Grid.Col span={2}>
            <Box maw={300} mx="auto">
              <DateInput
                label="Valid to"
                key={mainForm.key("valid_to")}
                placeholder="YYYY-MM-DD"
                value={mainForm.values.date}
                onChange={(date) => {
                  const formatted = date
                    ? dayjs(date).format("YYYY-MM-DD")
                    : "";
                  mainForm.setFieldValue("valid_to", formatted);
                  console.log("formatted=", formatted);
                }}
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={18} />}
                leftSectionPointerEvents="none"
                radius="md"
                size="md"
                dropdownType="popover"
                styles={{
                  calendar: {
                    padding: "0.5rem",
                    gap: "0.25rem",
                  },
                  day: {
                    width: "2.25rem",
                    height: "2.25rem",
                    fontSize: "0.9rem",
                  },
                  calendarHeaderLevel: {
                    fontSize: "1rem",
                    fontWeight: 500,
                    marginBottom: "0.5rem",
                  },
                  calendarHeaderControl: {
                    width: "2rem",
                    height: "2rem",
                  },
                }}
              />
            </Box>
          </Grid.Col>
          <Grid.Col span={2}>
            <Button
              color="#105476"
              mt={25}
              onClick={() => navigate("/tariff-bulk-upload")}
            >
              Upload File
            </Button>
          </Grid.Col>
          {/* <Grid.Col span={2}>
            <FileInput
              clearable
            //   accept="image/png,image/jpeg"
              label="Upload file"
              placeholder="Upload file"
            />
          </Grid.Col> */}
        </Grid>
        <Stack justify="lg">
          {gridForm.values.tariff_charges.map((_, index) => (
            <Box
              key={index}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
              p="lg"
              mt={"md"}
              // shadow="md"
            >
              <Grid>
                <Grid.Col span={1.5}>
                  {/* <TextInput
                    label="Customer"
                    key={
                      gridForm.values.tariff_charges[index].customer_code ||
                      `${index}-customer_code`
                    }
                    placeholder="Enter Charge name"
                    // data={tariff}
                    {...gridForm.getInputProps(
                      `tariff_charges.${index}.customer_code`
                    )}
                  /> */}
                  <Select
                    key={`customer-name-${gridForm.values.tariff_charges[index].id || index}`}
                    label="Customer Name"
                    withAsterisk
                    data={customerData}
                    placeholder="Select Customer Name"
                    {...gridForm.getInputProps(
                      `tariff_charges.${index}.customer_code`
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <Select
                    label="Charge Type"
                    placeholder="Select Charge"
                    data={["FREIGHT", "ORIGIN", "DESTINATION"]}
                    key={
                      gridForm.values.tariff_charges[index].charge_type ||
                      `${index}-charge_type`
                    }
                    {...gridForm.getInputProps(
                      `tariff_charges.${index}.charge_type`
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <TextInput
                    // mb={"md"}
                    label="Charge Name"
                    placeholder="Enter Charge Name"
                    key={`charge-name-${gridForm.values.tariff_charges[index].id || index}`}
                    variant="default"
                    {...gridForm.getInputProps(
                      `tariff_charges.${index}.charge_name`
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    // mb={"md"}
                    label="Carrier"
                    placeholder="Enter Carrier Name"
                    // key={gridForm.key("carrier")}
                    key={`carrier-name-${gridForm.values.tariff_charges[index].id || index}`}
                    {...gridForm.getInputProps(
                      `tariff_charges.${index}.carrier`
                    )}
                    variant="default"
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <Select
                    label="Unit"
                    placeholder="Select Unit"
                    data={["KG", "CBM", "TON"]}
                    key={
                      gridForm.values.tariff_charges[index].unit ||
                      `unit-${index}-unit`
                    }
                    {...gridForm.getInputProps(`tariff_charges.${index}.unit`)}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  {/* <Select label="Currency" /> */}
                  <Select
                    label="Currency"
                    data={currencyData}
                    key={
                      gridForm.values.tariff_charges[index].currency_code ||
                      `unit-${index}-currency_code`
                    }
                    // placeholder="Currency"
                    // data={currency}
                    {...gridForm.getInputProps(
                      `tariff_charges.${index}.currency_code`
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <NumberInput
                    key={`rate-name-${gridForm.values.tariff_charges[index].id || index}`}
                    min={1}
                    label="Rate"
                    {...gridForm.getInputProps(`tariff_charges.${index}.rate`)}
                  />
                </Grid.Col>
                <Grid.Col span={0.75}>
                  <Button
                    radius={"sm"}
                    //   size="10"
                    mt={20}
                    variant="light"
                    color="#105476"
                    onClick={() =>
                      gridForm.insertListItem("tariff_charges", {
                        customer_code: "",
                        charge_type: "",
                        charge_name: "",
                        carrier: "",
                        unit: "",
                        currency_code: "",
                        rate: "",
                      })
                    }
                  >
                    <IconPlus size={16} />
                  </Button>
                </Grid.Col>
                <Grid.Col span={0.75}>
                  <Button
                    mt={20}
                    // rightSection={<IconTrash size={16} />}
                    variant="light"
                    color="red"
                    onClick={() =>
                      gridForm.removeListItem("tariff_charges", index)
                    }
                  >
                    <IconTrash size={16} />
                  </Button>
                </Grid.Col>
              </Grid>
            </Box>
          ))}
        </Stack>
        <Group justify="right" mt="xl">
          <Group justify="space-between">
            {/* <Button color="#105476" onClick={() => getTariffdata()}>
              Get tariff data
            </Button> */}
            <Button color="#105476" onClick={() => tariffSubmit()}>
              Submit
            </Button>
          </Group>
        </Group>
      </Box>
    </>
  );
}

export default TariffCreate;
