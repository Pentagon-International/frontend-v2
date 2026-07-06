import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionIcon, Flex, Tooltip } from "@mantine/core";
import { IconUserPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import SearchableSelect from "./SearchableSelect";
import TempCustomerModal, {
  type TempCustomerResponse,
} from "./TempCustomerModal/TempCustomerModal";
import FormTextInput from "./FormTextInput";
import {
  NEW_CUSTOMER_DETAILS_PENDING_ERROR,
  type CustomerSelectionType,
} from "../utils/customerSelection";

type InputMode = "search" | "freeText";

export type CustomerNameSelectHandle = {
  openNewCustomerDetailsModal: () => void;
};

type CustomerNameSelectProps = {
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  value: string;
  displayValue?: string | null;
  selectionType?: CustomerSelectionType;
  allowFreeText?: boolean;
  minSearchLength?: number;
  returnOriginalData?: boolean;
  onCustomerChange: (params: {
    value: string;
    customerName: string;
    selectionType: CustomerSelectionType;
    tempCode: string | null;
    originalData?: Record<string, unknown> | null;
  }) => void;
  displayFormat?: (item: Record<string, unknown>) => {
    value: string;
    label: string;
  };
  searchFields?: string[];
  apiEndpoint?: string;
  dropdownZIndex?: number | null;
};

export default forwardRef<CustomerNameSelectHandle, CustomerNameSelectProps>(
  function CustomerNameSelect(
    {
  label = "Customer Name",
  placeholder = "Type customer name",
  required = false,
  error,
  value,
  displayValue,
  selectionType = "master",
  allowFreeText = false,
  minSearchLength = 2,
  returnOriginalData = false,
  onCustomerChange,
  displayFormat,
  searchFields = ["customer_name", "customer_code"],
  apiEndpoint,
  dropdownZIndex = 5,
    },
    ref,
  ) {
  const [tempModalOpened, { open: openTempModal, close: closeTempModal }] =
    useDisclosure(false);
  const [pendingCustomerName, setPendingCustomerName] = useState("");

  const resolvedDisplayValue =
    displayValue && displayValue.trim() ? displayValue : null;

  const getInitialFreeTextValue = () => {
    if (selectionType === "freeText" || selectionType === "temp") {
      return resolvedDisplayValue || value || "";
    }
    return "";
  };

  const [inputMode, setInputMode] = useState<InputMode>(() =>
    selectionType === "freeText" || selectionType === "temp"
      ? "freeText"
      : "search"
  );
  const [freeTextValue, setFreeTextValue] = useState(getInitialFreeTextValue);

  const freeTextInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusFreeTextRef = useRef(false);
  const lastAppliedFreeTextRef = useRef("");
  const onCustomerChangeRef = useRef(onCustomerChange);
  const prevSelectionTypeRef = useRef(selectionType);
  const selectionTypeRef = useRef(selectionType);

  onCustomerChangeRef.current = onCustomerChange;
  selectionTypeRef.current = selectionType;

  useLayoutEffect(() => {
    if (inputMode !== "freeText" || !shouldFocusFreeTextRef.current) return;

    const input = freeTextInputRef.current;
    if (!input) return;

    const cursor = input.value.length;
    input.focus();
    input.setSelectionRange(cursor, cursor);
    shouldFocusFreeTextRef.current = false;
  }, [inputMode, freeTextValue]);

  useEffect(() => {
    const prevType = prevSelectionTypeRef.current;
    prevSelectionTypeRef.current = selectionType;

    if (selectionType === prevType) return;

    if (selectionType === "master") {
      setInputMode("search");
      lastAppliedFreeTextRef.current = "";
      return;
    }

    if (selectionType === "freeText" || selectionType === "temp") {
      const nextValue = resolvedDisplayValue || value || "";
      setFreeTextValue(nextValue);
      setInputMode("freeText");
    }
  }, [selectionType, value, resolvedDisplayValue]);

  useEffect(() => {
    if (!value.trim()) {
      lastAppliedFreeTextRef.current = "";
    }
  }, [value]);

  const switchToFreeText = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      if (
        lastAppliedFreeTextRef.current === trimmed &&
        selectionTypeRef.current === "temp"
      ) {
        return;
      }

      lastAppliedFreeTextRef.current = trimmed;
      setFreeTextValue(trimmed);
      setInputMode("freeText");
      setPendingCustomerName(trimmed);

      onCustomerChangeRef.current({
        value: trimmed,
        customerName: trimmed,
        selectionType: "freeText",
        tempCode: null,
        originalData: null,
      });
    },
    []
  );

  const handleSearchComplete = useCallback(
    ({
      searchTerm,
      hasResults,
    }: {
      searchTerm: string;
      hasResults: boolean;
    }) => {
      if (!allowFreeText || hasResults || selectionTypeRef.current === "temp") {
        return;
      }

      const trimmed = searchTerm.trim();
      if (trimmed.length < minSearchLength) return;

      switchToFreeText(trimmed);
    },
    [allowFreeText, minSearchLength, switchToFreeText]
  );

  const showUnavailableCustomerIcon = useMemo(() => {
    if (!allowFreeText || selectionType === "temp") return false;
    if (selectionType === "freeText") return true;
    return inputMode === "freeText" && freeTextValue.trim().length > 0;
  }, [allowFreeText, selectionType, inputMode, freeTextValue]);

  const shouldPromptDetailsAction =
    Boolean(error) && error === NEW_CUSTOMER_DETAILS_PENDING_ERROR;

  const handleSelectChange = (
    nextValue: string | null,
    selectedData?: { value: string; label: string } | null,
    originalData?: Record<string, unknown> | null
  ) => {
    if (!nextValue) {
      lastAppliedFreeTextRef.current = "";
      onCustomerChange({
        value: "",
        customerName: "",
        selectionType: "master",
        tempCode: null,
        originalData: null,
      });
      return;
    }

    lastAppliedFreeTextRef.current = "";
    setInputMode("search");
    onCustomerChange({
      value: nextValue,
      customerName: selectedData?.label || nextValue,
      selectionType: "master",
      tempCode: null,
      originalData: originalData ?? null,
    });
  };

  const handleFreeTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setFreeTextValue(nextValue);

    if (!nextValue.trim()) {
      lastAppliedFreeTextRef.current = "";
      setInputMode("search");
      closeTempModal();
      onCustomerChange({
        value: "",
        customerName: "",
        selectionType: "master",
        tempCode: null,
        originalData: null,
      });
      return;
    }

    const trimmed = nextValue.trim();
    lastAppliedFreeTextRef.current = trimmed;
    setPendingCustomerName(trimmed);

    onCustomerChange({
      value: trimmed,
      customerName: trimmed,
      selectionType: "freeText",
      tempCode: null,
      originalData: null,
    });
  };

  const handleTempCustomerSaved = (response: TempCustomerResponse) => {
    lastAppliedFreeTextRef.current = response.customer_name.trim();
    setFreeTextValue(response.customer_name);
    setInputMode("freeText");
    onCustomerChange({
      value: response.temp_code,
      customerName: response.customer_name,
      selectionType: "temp",
      tempCode: response.temp_code,
      originalData: null,
    });
  };

  const openTempCustomerModal = useCallback(() => {
    const name = freeTextValue.trim() || resolvedDisplayValue || value || "";
    if (!name.trim()) return;
    setPendingCustomerName(name.trim());
    openTempModal();
  }, [freeTextValue, resolvedDisplayValue, value, openTempModal]);

  useImperativeHandle(
    ref,
    () => ({
      openNewCustomerDetailsModal: openTempCustomerModal,
    }),
    [openTempCustomerModal],
  );

  return (
    <>
      <Flex gap="xs" align="flex-start">
        <div
          style={{
            flex: showUnavailableCustomerIcon ? 1 : undefined,
            width: showUnavailableCustomerIcon ? undefined : "100%",
          }}
        >
          {inputMode === "freeText" ? (
            <FormTextInput
              ref={freeTextInputRef}
              label={label}
              placeholder={placeholder}
              required={required}
              withAsterisk={required}
              error={error}
              value={freeTextValue}
              onChange={handleFreeTextChange}
            />
          ) : (
            <SearchableSelect
              label={label}
              placeholder={placeholder}
              apiEndpoint={apiEndpoint}
              searchFields={searchFields}
              displayFormat={displayFormat}
              value={
                selectionType === "master" || selectionType === "temp"
                  ? value
                  : ""
              }
              displayValue={
                selectionType === "master" || selectionType === "temp"
                  ? resolvedDisplayValue
                  : null
              }
              onChange={handleSelectChange}
              minSearchLength={minSearchLength}
              required={required}
              error={error}
              returnOriginalData={returnOriginalData}
              dropdownZIndex={dropdownZIndex}
              onSearchComplete={
                allowFreeText ? handleSearchComplete : undefined
              }
              hideEmptyResultsMessage={allowFreeText}
            />
          )}
        </div>
        {showUnavailableCustomerIcon && (
          <Tooltip
            label="Click here to complete new customer details"
            opened={shouldPromptDetailsAction ? true : undefined}
            withArrow
            position="top"
            multiline
            w={220}
          >
            <ActionIcon
              variant="outline"
              color="#105476"
              size={36}
              mt={22}
              onClick={openTempCustomerModal}
              aria-label="Complete new customer details"
            >
              <IconUserPlus size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Flex>

      <TempCustomerModal
        opened={tempModalOpened}
        onClose={closeTempModal}
        customerName={pendingCustomerName}
        onSaved={handleTempCustomerSaved}
      />
    </>
  );
  },
);
