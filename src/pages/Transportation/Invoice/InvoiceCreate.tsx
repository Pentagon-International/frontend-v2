import {
  Box,
  Button,
  Grid,
  Group,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  Stack,
  Flex,
  Center,
  Loader,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
  SingleDateInput,
} from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import useAuthStore from "../../../store/authStore";

// Fetch functions
const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    console.log("currency response---", response);

    return response;
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchStateMaster = async () => {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    return (response as any)?.data || response || [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

// Placeholder for daybook - replace with actual API endpoint when available
const fetchDaybook = async () => {
  try {
    // TODO: Replace with actual daybook API endpoint
    // const response = await getAPICall(`${URL.daybook}`, API_HEADER);
    // return response;
    return [];
  } catch (error) {
    console.error("Error fetching daybook:", error);
    return [];
  }
};

// Fetch charge master
const fetchChargeMaster = async () => {
  try {
    const payload = {
      filters: {},
    };
    const response = await postAPICall(
      URL.chargeMasterFilter,
      payload,
      API_HEADER,
    );
    return (response as any)?.data || [];
  } catch (error) {
    console.error("Error fetching charge master:", error);
    return [];
  }
};

// Fetch unit master
const fetchUnitMaster = async () => {
  try {
    const payload = {
      filters: {
        service_type: "AIR",
      },
    };
    const response = await postAPICall(
      URL.unitMasterFilter,
      payload,
      API_HEADER,
    );
    return (response as any)?.data || [];
  } catch (error) {
    console.error("Error fetching unit master:", error);
    return [];
  }
};

type ChargeItem = {
  charge_name: string;
  unit_code: string;
  no_of_unit: number | null;
  currency: string;
  billing_currency?: string | null;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null; // Internal naming: currency_amount (amount in currency)
  header_amount: number | null;
  amount_in_local: number | null; // Auto-calculated as: amount * roe
  tax_code: string;
};

type InvoiceFormData = {
  bill_to: string;
  address: string;
  state: string;
  gstn: string;
  shipment_no: string;
  daybook: string;
  document_date: Date | null;
  due_date: Date | null;
  currency: string;
  roe: number | null;
  narration: string;
  irn_no: string;
  charges: ChargeItem[];
};

// Normalize form date value to Date | null for SingleDateInput (handles string from serialization)
function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function InvoiceCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Default branch currency (active branch: is_default === true) for Billing Currency
  const defaultBranchCurrency =
    (user?.branches?.find(
      (b: { is_default?: boolean }) => b.is_default === true
    ) as { currency?: { currency_code?: string } } | undefined)?.currency
      ?.currency_code ?? "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billToDisplayName, setBillToDisplayName] = useState<string | null>(
    null,
  );
  const [addressOptions, setAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  // Helper function to calculate ROE based on currency and user's country
  const getRoeValue = useCallback(
    (currency: string): number => {
      const userCountryCode = user?.country?.country_code;
      const currencyUpper = currency?.toUpperCase();

      if (userCountryCode === "IN") {
        if (currencyUpper === "INR") return 1;
        if (currencyUpper === "USD") return 88.75;
      } else if (userCountryCode === "AE") {
        if (currencyUpper === "AED") return 1;
        if (currencyUpper === "USD") return 3.67;
      }

      return 1;
    },
    [user?.country?.country_code],
  );

  const form = useForm<InvoiceFormData>({
    initialValues: {
      bill_to: "",
      address: "",
      state: "",
      gstn: "",
      shipment_no: "",
      daybook: "",
      document_date: new Date(), // Set to today's date by default
      due_date: null,
      currency: defaultBranchCurrency, // Default: active branch currency from login
      roe: null,
      narration: "",
      irn_no: "",
      charges: [],
    },
    validate: {
      bill_to: (value) => (!value ? "Bill To is required" : null),
      address: (value) => (!value ? "Address is required" : null),
      state: (value) => (!value ? "State is required" : null),
      shipment_no: (value) => (!value ? "Shipment No is required" : null),
      // daybook: (value) => (!value ? "Daybook is required" : null),
      document_date: (value) => (!value ? "Document Date is required" : null),
      due_date: (value) => (!value ? "Due Date is required" : null),
      currency: (value) => (!value ? "Currency is required" : null),
      roe: (value) => (value === null ? "ROE is required" : null),
    },
  });

  // Fetch currency data
  const { data: currencyData = [], isLoading: isCurrencyLoading } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  // Fetch state data
  const { data: stateData = [], isLoading: isStateLoading } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  // Fetch daybook data
  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook"],
    queryFn: fetchDaybook,
    staleTime: Infinity,
  });

  // Fetch charge master data
  const { data: chargeData = [], isLoading: isChargeLoading } = useQuery({
    queryKey: ["chargeMaster"],
    queryFn: fetchChargeMaster,
    staleTime: Infinity,
  });

  // Fetch unit master data
  const { data: unitData = [], isLoading: isUnitLoading } = useQuery({
    queryKey: ["unitMaster", "AIR"],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
  });

  // Format currency options
  const currencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.code || item.currency_code || ""),
      label: `${item.code || item.currency_code || ""}`,
    }));
  }, [currencyData]);

  // Format state options
  const stateOptions = useMemo(() => {
    const data = stateData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.id || ""),
      label: item.state_name || item.name || "",
    }));
  }, [stateData]);

  // Format daybook options
  const daybookOptions = useMemo(() => {
    const data = daybookData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.id || item.code || ""),
      label: item.name || item.daybook_name || "",
    }));
  }, [daybookData]);

  // Format charge options
  const chargeOptions = useMemo(() => {
    const data = chargeData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.charge_code || item.id || ""),
      label: item.charge_name || item.name || "",
    }));
  }, [chargeData]);

  // Format unit options
  const unitOptions = useMemo(() => {
    const data = unitData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.unit_code || item.code || item.id || ""),
      label: item.unit_name || item.name || "",
    }));
  }, [unitData]);

  // Set Billing Currency from user's default branch when user is available and currency is still empty
  useEffect(() => {
    if (!defaultBranchCurrency || form.values.currency) return;
    form.setFieldValue("currency", defaultBranchCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBranchCurrency]);

  // Keep Bill To, State and Address in sync: when customer (Bill To) is empty, clear state and address
  useEffect(() => {
    const billTo = form.values.bill_to;
    if (!billTo || (typeof billTo === "string" && billTo.trim() === "")) {
      if (form.values.address) form.setFieldValue("address", "");
      if (form.values.state) form.setFieldValue("state", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.bill_to]);

  // Populate form from house (HAWB) state: shipper/Bill To/address and house charges → invoice charges
  useEffect(() => {
    const hawbDetails =
      location.state?.hawbDetails || location.state?.housingDetails || [];

    if (Array.isArray(hawbDetails) && hawbDetails.length > 0) {
      // Get the first HAWB detail
      const firstHawb = hawbDetails[0];

      if (firstHawb) {
        // Set shipment_id from housing to shipment_no field
        if (firstHawb.shipment_id) {
          form.setFieldValue("shipment_no", String(firstHawb.shipment_id));
        }

        // Set shipper address in the address field
        if (firstHawb.shipper_address) {
          form.setFieldValue("address", firstHawb.shipper_address);
        }

        // Set shipper name in Bill To field (customer name for payload and validation)
        if (firstHawb.shipper_name) {
          setBillToDisplayName(firstHawb.shipper_name);
          form.setFieldValue("bill_to", firstHawb.shipper_name);
        }

        // State from housing is set after state API loads (see useEffect below)

        // Map house (HAWB) charges into invoice charges form (same shape as housing stepper for common fields)
        if (
          firstHawb.charges &&
          Array.isArray(firstHawb.charges) &&
          firstHawb.charges.length > 0
        ) {
          const mappedCharges = firstHawb.charges.map((charge: any) => {
            // Handle unit_code from unit_details or direct field (API may return nested object)
            const unitDetails = charge.unit_details as
              | { unit_code?: string }
              | undefined;
            const unitCode =
              charge.unit_code ||
              charge.unit_input ||
              unitDetails?.unit_code ||
              "";

            // Handle currency from currency_details or direct field (API may return nested object)
            const currencyDetails = charge.currency_details as
              | { currency_code?: string }
              | undefined;
            const currency =
              charge.currency || currencyDetails?.currency_code || "";

            return {
              // Fields common with house charges stepper
              charge_name: charge.charge_name ? String(charge.charge_name) : "",
              unit_code: unitCode ? String(unitCode) : "",
              no_of_unit: charge.no_of_unit as number | null,
              currency: currency ? String(currency) : "",
              roe: charge.roe as number | null,
              amount_per_unit: charge.amount_per_unit as number | null,
              amount: charge.amount as number | null,
              // Fields that do not exist on house charges start empty on invoice
              header_amount: null,
              amount_in_local: null,
              tax_code: "",
            };
          });
          form.setFieldValue("charges", mappedCharges);
        } else {
          // If no charges, initialize with one empty charge
          form.setFieldValue("charges", [
            {
              charge_name: "",
              unit_code: "",
              no_of_unit: null,
              currency: "",
              billing_currency: null,
              roe: null,
              amount_per_unit: null,
              amount: null,
              header_amount: null,
              amount_in_local: null,
              tax_code: "",
            },
          ]);
        }
      }
    } else {
      // If no HAWB details, initialize with one empty charge
      form.setFieldValue("charges", [
        {
          charge_name: "",
          unit_code: "",
          no_of_unit: null,
          currency: "",
          billing_currency: null,
          roe: null,
          amount_per_unit: null,
          amount: null,
          header_amount: null,
          amount_in_local: null,
          tax_code: "",
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Set state from housing shipper_state_id once state API has loaded
  // Use hawbDetails first, then fallback to job.housing_details (from API) when passed house has no shipper_state_id
  useEffect(() => {
    if (isStateLoading || !stateData?.length) return;
    const hawbDetails =
      location.state?.hawbDetails || location.state?.housingDetails || [];
    const firstHawb = Array.isArray(hawbDetails) && hawbDetails.length > 0 ? hawbDetails[0] : null;
    const jobHousing = (location.state?.job as { housing_details?: Array<{ shipper_state_id?: number | null }> })?.housing_details;
    const shipperStateId =
      firstHawb?.shipper_state_id != null
        ? firstHawb.shipper_state_id
        : jobHousing?.[0]?.shipper_state_id ?? null;
    if (shipperStateId != null) {
      form.setFieldValue("state", String(shipperStateId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStateLoading, stateData]);

  // Auto-set ROE when currency changes
  const chargeCurrencies = form.values.charges.map((c) => c.currency).join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      // Auto-set ROE if currency is selected but ROE is not set
      let roe = charge.roe;
      if (charge.currency && !roe) {
        roe = getRoeValue(charge.currency);
      }

      // Only update ROE, don't touch amount
      if (roe !== charge.roe) {
        return {
          ...charge,
          roe: roe || null,
        };
      }

      return charge;
    });

    // Only update if there are actual changes to ROE
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.roe !== form.values.charges[index]?.roe,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrencies, getRoeValue]);

  // Auto-calculate amount when amount_per_unit, no_of_unit, or roe changes
  const chargeAmountPerUnits = form.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = form.values.charges
    .map((c) => c.no_of_unit)
    .join(",");
  const chargeRoes = form.values.charges.map((c) => c.roe).join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge, index) => {
      // Auto-calculate amount if amount_per_unit is provided
      if (
        charge.amount_per_unit !== null &&
        charge.amount_per_unit !== undefined &&
        charge.amount_per_unit > 0 &&
        charge.no_of_unit !== null &&
        charge.no_of_unit > 0 &&
        charge.roe !== null &&
        charge.roe !== undefined &&
        charge.roe > 0
      ) {
        const calculatedAmount =
          charge.no_of_unit * charge.roe * charge.amount_per_unit;
        if (calculatedAmount > 0 && calculatedAmount !== charge.amount) {
          return {
            ...charge,
            amount: calculatedAmount,
          };
        }
      }

      return charge;
    });

    // Only update if there are actual changes to amount
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.amount !== form.values.charges[index]?.amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits, chargeRoes]);

  // Auto-calculate amount_in_local (Local Amount) as: amount (currency_amount) * charge.roe
  const chargeAmounts = form.values.charges.map((c) => c.amount).join(",");
  const chargeRoesForLocal = form.values.charges.map((c) => c.roe).join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount !== null &&
        charge.amount !== undefined &&
        charge.amount > 0 &&
        charge.roe !== null &&
        charge.roe !== undefined &&
        charge.roe > 0
      ) {
        const calculatedLocalAmount = charge.amount * charge.roe;
        if (
          calculatedLocalAmount > 0 &&
          calculatedLocalAmount !== charge.amount_in_local
        ) {
          return {
            ...charge,
            amount_in_local: calculatedLocalAmount,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.amount_in_local !== form.values.charges[index]?.amount_in_local,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmounts, chargeRoesForLocal]);

  // Auto-calculate header_amount:
  // - If invoice Billing Currency (top currency) matches charge currency → header_amount = amount_in_local
  // - If they differ → header_amount = amount_in_local / invoice-level ROE
  const headerBillingCurrency = form.values.currency;
  const headerRoe = form.values.roe;
  const chargeLocalAmounts = form.values.charges
    .map((c) => c.amount_in_local)
    .join(",");
  const chargeCurrenciesForHeader = form.values.charges
    .map((c) => c.currency)
    .join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_in_local !== null &&
        charge.amount_in_local !== undefined &&
        charge.amount_in_local > 0 &&
        headerBillingCurrency &&
        charge.currency
      ) {
        let newHeaderAmount: number | null = null;

        if (
          headerBillingCurrency.toUpperCase() ===
          String(charge.currency).toUpperCase()
        ) {
          // Same currency → header amount equals local amount
          newHeaderAmount = charge.amount_in_local;
        } else if (
          headerRoe !== null &&
          headerRoe !== undefined &&
          headerRoe > 0
        ) {
          // Different currency → divide local amount by top-level ROE
          newHeaderAmount = charge.amount_in_local / headerRoe;
        }

        if (
          newHeaderAmount !== null &&
          newHeaderAmount > 0 &&
          newHeaderAmount !== charge.header_amount
        ) {
          return {
            ...charge,
            header_amount: newHeaderAmount,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.header_amount !== form.values.charges[index]?.header_amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    headerBillingCurrency,
    headerRoe,
    chargeLocalAmounts,
    chargeCurrenciesForHeader,
  ]);

  // Bill To change: (1) When cleared → clear state and address. (2) When customer selected from search → set Bill To + State from customer response (addresses_data.state_id). (3) When from house page → shipper/state set on load (mount effect).
  const handleBillToChange = (
    value: string | null,
    selectedData?: { value: string; label: string } | null,
    originalData?: Record<string, unknown> | null,
  ) => {
    form.setFieldValue("bill_to", value ?? "");
    setBillToDisplayName(selectedData?.label ?? null);

    // When Bill To is removed/cleared, clear state and address-related fields and stop
    const isCleared =
      value == null || (typeof value === "string" && value.trim() === "");
    if (isCleared) {
      setAddressOptions([]);
      form.setFieldValue("address", "");
      form.setFieldValue("state", "");
      return;
    }

    // Customer selected from search: populate address options and state from customer response (addresses_data)
    if (
      originalData &&
      (originalData as Record<string, unknown>).addresses_data
    ) {
      const addressesData = (originalData as Record<string, unknown>)
        .addresses_data as Array<{
        id: number;
        address: string;
        state_id?: number;
      }>;
      const addressOptions = (addressesData || []).map(
        (addr: { id: number; address: string }) => ({
          value: String(addr.id),
          label: addr.address,
        }),
      );

      setAddressOptions(addressOptions);
      form.setFieldValue("address", "");

      // Set state_id from first address that has state_id (e.g. primary) in customer response
      const addrWithState = (addressesData || []).find(
        (a: { state_id?: number }) => a.state_id != null,
      );
      if (addrWithState?.state_id != null) {
        form.setFieldValue("state", String(addrWithState.state_id));
      }
    } else {
      setAddressOptions([]);
      form.setFieldValue("address", "");
      // Do not clear state here — value is set (e.g. from house) but we may not have originalData
    }
  };

  // Handle form submission
  const handleSubmit = async (values: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      // Validate charges
      const invalidCharges = values.charges.some((charge) => {
        const hasMissingRequired =
          !charge.charge_name ||
          !charge.currency ||
          charge.roe === null ||
          charge.amount === null ||
          charge.amount_in_local === null ||
          !charge.tax_code;

        return hasMissingRequired;
      });

      if (invalidCharges) {
        ToastNotification({
          message: "Please fill all required fields in charges section",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }

      const stateId = Number(values.state);
      const currencyItem = (currencyData as any[])?.find(
        (c: any) =>
          (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;

      if (!stateId || stateId <= 0) {
        ToastNotification({
          message: "Please select a valid State",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }
      if (currencyId == null || currencyId <= 0) {
        ToastNotification({
          message: "Please select a valid Billing Currency",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        bill_to: values.bill_to,
        address: values.address,
        state_id: stateId,
        gstn: values.gstn || null,
        shipment_no: values.shipment_no,
        daybook: values.daybook,
        document_date: values.document_date
          ? new Date(values.document_date).toISOString().split("T")[0]
          : null,
        due_date: values.due_date
          ? new Date(values.due_date).toISOString().split("T")[0]
          : null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: values.irn_no || null,
        status: "unpost",
        charges: values.charges.map((charge) => {
          const chargeCurrencyItem = (currencyData as any[])?.find(
            (c: any) =>
              (c.code || c.currency_code || "").toString() === charge.currency,
          );
          const chargeCurrencyId =
            chargeCurrencyItem?.id != null
              ? Number(chargeCurrencyItem.id)
              : null;
          const unitItem = (unitData as any[])?.find(
            (u: any) =>
              String(u.unit_code || u.code || u.id) === charge.unit_code,
          );
          const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
          return {
            shipment_no: values.shipment_no,
            charge: charge.charge_name,
            unit_id: unitId,
            no_of_unit: charge.no_of_unit ?? 0,
            currency_id: chargeCurrencyId,
            roe: charge.roe ?? 0,
            amount_per_unit: charge.amount_per_unit ?? 0,
            amount: charge.amount ?? 0,
            amount_in_local: charge.amount_in_local ?? 0,
            amount_in_header: charge.header_amount ?? 0,
            tax_code: charge.tax_code || "",
          };
        }),
      };

      const response = await postAPICall(URL.invoice, payload, API_HEADER);
      if (response) {
        ToastNotification({
          message: "Invoice created successfully",
          type: "success",
        });
        navigate(-1);
      }
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      ToastNotification({
        message: error?.message || "Failed to create invoice",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" mb="xs">
          <Text size="xl" fw={600} c="#105476">
            Create Invoice
          </Text>
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Group>

        {/* Form */}
        <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
          <Grid>
            {/* Row 1: 4 fields - Bill To (span 4 = 2 fields), State, GSTN, Shipment No */}
            {/* Bill To - spans 2 fields (span=4) */}
            <Grid.Col span={4}>
              <SearchableSelect
                label="Bill To"
                placeholder="Type customer name"
                apiEndpoint={URL.customer}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.customer_name),
                  label: String(item.customer_name),
                })}
                value={form.values.bill_to}
                displayValue={billToDisplayName || undefined}
                onChange={handleBillToChange}
                returnOriginalData={true}
                withAsterisk
                dropdownZIndex={1000}
                error={
                  form.errors.bill_to ? String(form.errors.bill_to) : undefined
                }
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* State */}
            <Grid.Col span={2}>
              <Dropdown
                label="State"
                placeholder={isStateLoading ? "Loading states" : "Select state"}
                data={stateOptions}
                value={form.values.state ? form.values.state : null}
                onChange={(value) => form.setFieldValue("state", value ?? "")}
                searchable
                withAsterisk
                error={form.errors.state || undefined}
                disabled={isStateLoading}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* GSTN */}
            <Grid.Col span={2}>
              <TextInput
                label="GSTN"
                placeholder="Enter GSTN"
                value={form.values.gstn}
                onChange={(e) => form.setFieldValue("gstn", e.target.value)}
                error={form.errors.gstn}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* Shipment No */}
            <Grid.Col span={2}>
              <TextInput
                label="Shipment No"
                placeholder="Enter shipment number"
                value={form.values.shipment_no}
                onChange={(e) =>
                  form.setFieldValue("shipment_no", e.target.value)
                }
                withAsterisk
                error={form.errors.shipment_no}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* Row 2: 5 fields - Daybook, Document Date, Due Date, Currency, ROE, IRN No */}
            {/* Daybook */}
            <Grid.Col span={2}>
              <Dropdown
                label="Daybook"
                placeholder="Select daybook"
                data={["test"]}
                value={form.values.daybook}
                onChange={(value) => form.setFieldValue("daybook", value || "")}
                searchable
                withAsterisk
                error={form.errors.daybook}
                disabled={isDaybookLoading}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>
            {/* Document Date */}
            <Grid.Col span={2}>
              <SingleDateInput
                label="Document Date"
                placeholder="Select document date"
                value={normalizeDate(form.values.document_date)}
                onChange={(date) => form.setFieldValue("document_date", date)}
                withAsterisk
                error={
                  form.errors.document_date
                    ? typeof form.errors.document_date === "string"
                      ? form.errors.document_date
                      : String(form.errors.document_date)
                    : undefined
                }
              />
            </Grid.Col>

            {/* Due Date - same value/onChange pattern as Document Date */}
            <Grid.Col span={2}>
              <SingleDateInput
                label="Due Date"
                placeholder="Select due date"
                value={normalizeDate(form.values.due_date)}
                onChange={(date) => form.setFieldValue("due_date", date)}
                withAsterisk
                error={
                  form.errors.due_date
                    ? typeof form.errors.due_date === "string"
                      ? form.errors.due_date
                      : String(form.errors.due_date)
                    : undefined
                }
              />
            </Grid.Col>

            {/* Currency */}
            <Grid.Col span={2}>
              <Dropdown
                label="Billing Currency"
                placeholder="Select currency"
                data={currencyOptions}
                value={form.values.currency}
                onChange={(value) =>
                  form.setFieldValue("currency", value || "")
                }
                searchable
                withAsterisk
                error={
                  form.errors.currency
                    ? String(form.errors.currency)
                    : undefined
                }
                disabled={isCurrencyLoading}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* ROE */}
            <Grid.Col span={2}>
              <NumberInput
                label="ROE"
                placeholder="Enter rate of exchange"
                value={form.values.roe ?? undefined}
                onChange={(value) => {
                  const numValue =
                    typeof value === "number"
                      ? value
                      : typeof value === "string"
                        ? parseFloat(value) || null
                        : null;
                  form.setFieldValue("roe", numValue);
                }}
                withAsterisk
                error={form.errors.roe ? String(form.errors.roe) : undefined}
                min={0}
                decimalScale={4}
                step={0.0001}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* IRN No */}
            <Grid.Col span={2}>
              <TextInput
                label="IRN No"
                placeholder="Enter IRN number"
                value={form.values.irn_no}
                onChange={(e) => form.setFieldValue("irn_no", e.target.value)}
                error={form.errors.irn_no}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>

            {/* Address - moved to end */}
            <Grid.Col span={6}>
              {addressOptions.length > 0 ? (
                <Dropdown
                  label="Address"
                  placeholder="Select address"
                  data={addressOptions}
                  value={form.values.address}
                  onChange={(value) =>
                    form.setFieldValue("address", value || "")
                  }
                  searchable
                  withAsterisk
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                  styles={{
                    input: {
                      fontSize: "13px",
                      fontFamily: "Inter",
                      height: "36px",
                    },
                    label: {
                      fontSize: "13px",
                      fontFamily: "Inter",
                      marginBottom: "4px",
                    },
                  }}
                />
              ) : (
                <TextInput
                  label="Address"
                  placeholder="Enter address"
                  value={form.values.address}
                  onChange={(e) =>
                    form.setFieldValue("address", e.target.value)
                  }
                  withAsterisk
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                  styles={{
                    input: {
                      fontSize: "13px",
                      fontFamily: "Inter",
                      height: "36px",
                    },
                    label: {
                      fontSize: "13px",
                      fontFamily: "Inter",
                      marginBottom: "4px",
                    },
                  }}
                />
              )}
            </Grid.Col>

            {/* Narration - moved to end */}
            <Grid.Col span={6}>
              <Textarea
                label="Narration"
                placeholder="Enter narration"
                value={form.values.narration}
                onChange={(e) =>
                  form.setFieldValue("narration", e.target.value)
                }
                error={form.errors.narration}
                rows={2}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
              />
            </Grid.Col>
          </Grid>

          {/* Charges Section */}
          <Box mt="md">
            {/* <Grid>
              <Grid.Col span={12} mt="md" style={{position: "sticky", top: 0, zIndex: 100, backgroundColor: "white", padding: "8px 0"}}>
                <Grid style={{borderRadius: "4px", padding: "5px 10px", backgroundColor: "#fafafa"}}>
                  <Grid.Col span={12}>
                    <Text
                      size="md"
                      fw={600}
                      c="#105476"
                      style={{
                        fontFamily: "Inter",
                        fontStyle: "medium",
                        fontSize: "16px",
                        color: "#105476",
                        textAlign: "left",
                      }}
                    >
                      Charges
                    </Text>
                  </Grid.Col>
                </Grid>
              </Grid.Col>
            </Grid> */}

            {/* Dynamic Charges Rows */}
            <Box mb="sm" mt="md">
              <Grid
                w="100%"
                gutter="sm"
                py="sm"
                style={{
                  position: "sticky",
                  top: 45,
                  zIndex: 100,
                  backgroundColor: "white",
                  fontWeight: 600,
                  color: "#105476",
                }}
              >
                <Grid.Col span={2}>Charge</Grid.Col>
                <Grid.Col span={1}>Currency</Grid.Col>
                <Grid.Col span={0.75}>ROE</Grid.Col>
                <Grid.Col span={1}>No of Unit</Grid.Col>
                <Grid.Col span={1}>Amount per Unit</Grid.Col>
                <Grid.Col span={1.25}>Amount</Grid.Col>
                <Grid.Col span={1.25}>Header Amount</Grid.Col>
                <Grid.Col span={1.25}>Local Amount</Grid.Col>
                <Grid.Col span={1.25}>Tax Code</Grid.Col>
                <Grid.Col span={0.5}>Actions</Grid.Col>
              </Grid>

              {form.values.charges.map((charge, index) => (
                <Grid
                  key={index}
                  w="100%"
                  gutter="sm"
                  mt={index !== 0 ? "sm" : 0}
                >
                  <Grid.Col span={2}>
                    <TextInput
                      placeholder="Charge"
                      withAsterisk
                      value={charge.charge_name}
                      onChange={(e) => {
                        form.setFieldValue(
                          `charges.${index}.charge_name`,
                          e.target.value,
                        );
                        // Clear error when field is updated
                        if (chargeErrors[index]?.charge_name) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].charge_name;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.charge_name}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Dropdown
                      placeholder="Select Currency"
                      withAsterisk
                      searchable
                      data={currencyOptions}
                      value={charge.currency || null}
                      onChange={(value) => {
                        const roe = value ? getRoeValue(value) : null;
                        form.setFieldValue(
                          `charges.${index}.currency`,
                          value || "",
                        );
                        if (roe !== null) {
                          form.setFieldValue(`charges.${index}.roe`, roe);
                        }
                        // Clear error when field is updated
                        if (chargeErrors[index]?.currency) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].currency;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.currency}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.75}>
                    <NumberInput
                      placeholder="ROE"
                      min={0}
                      hideControls
                      withAsterisk
                      value={charge.roe || undefined}
                      onChange={(value) => {
                        const roe = value as number | null;
                        form.setFieldValue(`charges.${index}.roe`, roe);
                        const currentCharge = form.values.charges[index];

                        // Auto-calculate amount (currency_amount) if amount_per_unit is provided
                        if (
                          currentCharge.amount_per_unit !== null &&
                          currentCharge.amount_per_unit !== undefined &&
                          currentCharge.amount_per_unit > 0 &&
                          currentCharge.no_of_unit !== null &&
                          currentCharge.no_of_unit > 0 &&
                          roe !== null &&
                          roe > 0
                        ) {
                          const calculatedAmount =
                            currentCharge.no_of_unit *
                            roe *
                            currentCharge.amount_per_unit;
                          if (calculatedAmount > 0) {
                            form.setFieldValue(
                              `charges.${index}.amount`,
                              calculatedAmount,
                            );
                          }
                        }

                        // Auto-calculate Local Amount = currency_amount * roe
                        if (
                          currentCharge.amount !== null &&
                          currentCharge.amount !== undefined &&
                          currentCharge.amount > 0 &&
                          roe !== null &&
                          roe > 0
                        ) {
                          const calculatedLocalAmount =
                            currentCharge.amount * roe;
                          if (calculatedLocalAmount > 0) {
                            form.setFieldValue(
                              `charges.${index}.amount_in_local`,
                              calculatedLocalAmount,
                            );
                          }
                        }

                        // Clear error when field is updated
                        if (chargeErrors[index]?.roe) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].roe;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.roe}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <NumberInput
                      placeholder="No of Unit"
                      min={0}
                      hideControls
                      value={charge.no_of_unit || undefined}
                      onChange={(value) => {
                        const noOfUnit = value as number | null;
                        form.setFieldValue(
                          `charges.${index}.no_of_unit`,
                          noOfUnit,
                        );
                        // Auto-calculate amount if amount_per_unit is provided
                        const currentCharge = form.values.charges[index];
                        if (
                          currentCharge.amount_per_unit !== null &&
                          currentCharge.amount_per_unit !== undefined &&
                          currentCharge.amount_per_unit > 0 &&
                          noOfUnit !== null &&
                          noOfUnit > 0 &&
                          currentCharge.roe !== null &&
                          currentCharge.roe !== undefined &&
                          currentCharge.roe > 0
                        ) {
                          const calculatedAmount =
                            noOfUnit *
                            currentCharge.roe *
                            currentCharge.amount_per_unit;
                          if (calculatedAmount > 0) {
                            form.setFieldValue(
                              `charges.${index}.amount`,
                              calculatedAmount,
                            );
                          }
                        }
                      }}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <NumberInput
                      placeholder="Per Unit"
                      min={0}
                      hideControls
                      value={charge.amount_per_unit || undefined}
                      onChange={(value) => {
                        const amountPerUnit = value as number | null;
                        form.setFieldValue(
                          `charges.${index}.amount_per_unit`,
                          amountPerUnit,
                        );
                        // Auto-calculate amount if amount_per_unit is provided
                        const currentCharge = form.values.charges[index];
                        if (
                          amountPerUnit !== null &&
                          amountPerUnit !== undefined &&
                          amountPerUnit > 0 &&
                          currentCharge.no_of_unit !== null &&
                          currentCharge.no_of_unit > 0 &&
                          currentCharge.roe !== null &&
                          currentCharge.roe !== undefined &&
                          currentCharge.roe > 0
                        ) {
                          const calculatedAmount =
                            currentCharge.no_of_unit *
                            currentCharge.roe *
                            amountPerUnit;
                          if (calculatedAmount > 0) {
                            form.setFieldValue(
                              `charges.${index}.amount`,
                              calculatedAmount,
                            );
                          }
                        }
                      }}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <NumberInput
                      placeholder="Amount"
                      min={0}
                      hideControls
                      withAsterisk
                      value={charge.amount || undefined}
                      onChange={(value) => {
                        const currencyAmount = value as number | null;
                        form.setFieldValue(
                          `charges.${index}.amount`,
                          currencyAmount,
                        );

                        // Auto-calculate Local Amount = currency_amount * roe
                        const currentCharge = form.values.charges[index];
                        if (
                          currencyAmount !== null &&
                          currencyAmount !== undefined &&
                          currencyAmount > 0 &&
                          currentCharge.roe !== null &&
                          currentCharge.roe !== undefined &&
                          currentCharge.roe > 0
                        ) {
                          const calculatedLocalAmount =
                            currencyAmount * currentCharge.roe;
                          if (calculatedLocalAmount > 0) {
                            form.setFieldValue(
                              `charges.${index}.amount_in_local`,
                              calculatedLocalAmount,
                            );
                          }
                        }

                        // Clear error when field is updated
                        if (chargeErrors[index]?.amount) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].amount;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.amount}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <NumberInput
                      placeholder="Header Amount"
                      min={0}
                      hideControls
                      value={charge.header_amount || undefined}
                      onChange={(value) => {
                        form.setFieldValue(
                          `charges.${index}.header_amount`,
                          value as number | null,
                        );
                      }}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <NumberInput
                      placeholder="Local Amount"
                      min={0}
                      hideControls
                      withAsterisk
                      value={charge.amount_in_local || undefined}
                      onChange={(value) => {
                        form.setFieldValue(
                          `charges.${index}.amount_in_local`,
                          value as number | null,
                        );
                      }}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <TextInput
                      placeholder="Tax Code"
                      withAsterisk
                      value={charge.tax_code}
                      onChange={(e) => {
                        form.setFieldValue(
                          `charges.${index}.tax_code`,
                          e.target.value,
                        );
                      }}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Group gap="xs">
                      {form.values.charges.length > 1 && (
                        <Button
                          variant="light"
                          color="red"
                          size="sm"
                          px={12}
                          onClick={() => {
                            form.removeListItem("charges", index);
                          }}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                      {form.values.charges.length - 1 === index && (
                        <Button
                          radius="sm"
                          px={12}
                          size="sm"
                          variant="light"
                          color="#105476"
                          onClick={() => {
                            form.insertListItem("charges", {
                              charge_name: "",
                              unit_code: "",
                              no_of_unit: null,
                              currency: "",
                              billing_currency: null,
                              roe: null,
                              amount_per_unit: null,
                              amount: null,
                              header_amount: null,
                              amount_in_local: null,
                              tax_code: "",
                            });
                          }}
                        >
                          <IconPlus size={16} />
                        </Button>
                      )}
                    </Group>
                  </Grid.Col>
                </Grid>
              ))}
            </Box>
          </Box>

          {/* Action Buttons */}
          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              rightSection={<IconChevronRight size={16} />}
              loading={isSubmitting}
            >
              Save Invoice
            </Button>
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}

export default InvoiceCreate;
