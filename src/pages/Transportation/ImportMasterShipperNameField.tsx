import { Select } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import FormTextInput from "../../components/FormTextInput";
import { URL } from "../../api/serverUrls";
import { commonSearchAPI } from "../../service/searchApi";
import { toTitleCase } from "../../utils/textFormatter";
import { mapShipmentPartySearchResults } from "../../utils/shipmentParty";

type ImportMasterShipperNameFieldProps = {
  disabled?: boolean;
  size?: string;
  dropdownZIndex?: number;
  shipperId: string;
  shipperName: string;
  error?: string;
  onClear: () => void;
  onSelect: (
    shipperId: string,
    shipperName: string,
    originalData: Record<string, unknown> | null,
  ) => void;
  onFreeText: (shipperName: string) => void;
};

function normalizePartyId(id: string | number | null | undefined): string {
  const s = String(id ?? "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function buildSeedOptions(
  shipperId: string | number | null | undefined,
  shipperName: string | null | undefined,
): Array<{ value: string; label: string }> {
  const id = normalizePartyId(shipperId);
  const name = String(shipperName || "").trim();
  return id && name ? [{ value: id, label: name }] : [];
}

/**
 * House-parity shipper name for Import masters (shipment-party search).
 * - Known party id → Select (option seeded so edit hydrate never shows blank)
 * - Name only (no id) → FormTextInput free-text
 * - No search hits → FormTextInput free-text
 */
export function ImportMasterShipperNameField({
  disabled = false,
  size = "sm",
  dropdownZIndex = 1000,
  shipperId,
  shipperName,
  error,
  onClear,
  onSelect,
  onFreeText,
}: ImportMasterShipperNameFieldProps) {
  const normalizedId = normalizePartyId(shipperId);
  const [shipperSearch, setShipperSearch] = useState(shipperName || "");
  const [shipperOptions, setShipperOptions] = useState(() =>
    buildSeedOptions(shipperId, shipperName),
  );
  const [shipperManualMode, setShipperManualMode] = useState(
    () =>
      !normalizePartyId(shipperId) &&
      String(shipperName || "").trim().length >= 2,
  );
  const [shipperHasResults, setShipperHasResults] = useState<boolean | null>(
    () =>
      normalizePartyId(shipperId) && String(shipperName || "").trim()
        ? true
        : !normalizePartyId(shipperId) &&
            String(shipperName || "").trim().length >= 2
          ? false
          : null,
  );
  const shipperDataRef = useRef<Record<string, Record<string, unknown>>>({});
  const hydratedKeyRef = useRef<string>("");
  const freeTextOwnedRef = useRef(false);
  const shouldFocusFreeTextRef = useRef(false);
  const freeTextInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = normalizePartyId(shipperId);
    const name = String(shipperName || "");
    const key = `${id}|${name}`;
    if (hydratedKeyRef.current === key) return;

    // Only ignore parent updates while user is actively typing free-text (no id).
    if (freeTextOwnedRef.current && !id) {
      hydratedKeyRef.current = key;
      setShipperSearch(name);
      return;
    }

    hydratedKeyRef.current = key;
    setShipperSearch(name);

    if (id && name.trim()) {
      freeTextOwnedRef.current = false;
      setShipperOptions([{ value: id, label: name }]);
      shipperDataRef.current[id] = {
        id,
        customer_name: name,
      };
      setShipperManualMode(false);
      setShipperHasResults(true);
      return;
    }

    if (!id && name.trim().length >= 2) {
      freeTextOwnedRef.current = true;
      setShipperOptions([]);
      shipperDataRef.current = {};
      setShipperManualMode(true);
      setShipperHasResults(false);
      return;
    }

    if (!name.trim()) {
      freeTextOwnedRef.current = false;
      setShipperOptions([]);
      shipperDataRef.current = {};
      setShipperManualMode(false);
      setShipperHasResults(null);
    }
  }, [shipperId, shipperName]);

  useLayoutEffect(() => {
    if (!shouldFocusFreeTextRef.current) return;
    const input = freeTextInputRef.current;
    if (!input) return;
    const cursor = input.value.length;
    input.focus({ preventScroll: true });
    try {
      input.setSelectionRange(cursor, cursor);
    } catch {
      // ignore
    }
    shouldFocusFreeTextRef.current = false;
  }, [shipperManualMode, shipperHasResults, shipperSearch]);

  const selectData = useMemo(() => {
    if (
      normalizedId &&
      String(shipperName || "").trim() &&
      !shipperOptions.some((o) => o.value === normalizedId)
    ) {
      return [
        { value: normalizedId, label: String(shipperName) },
        ...shipperOptions,
      ];
    }
    return shipperOptions;
  }, [normalizedId, shipperName, shipperOptions]);

  const resetSearchState = () => {
    freeTextOwnedRef.current = false;
    setShipperSearch("");
    setShipperOptions([]);
    setShipperManualMode(false);
    setShipperHasResults(null);
    shipperDataRef.current = {};
    hydratedKeyRef.current = "|";
  };

  const debouncedShipperSearch = useDebouncedCallback(async (term: string) => {
    const query = term.trim();
    if (!query || query.length < 2) {
      setShipperOptions([]);
      setShipperHasResults(null);
      setShipperManualMode(false);
      shipperDataRef.current = {};
      return;
    }

    try {
      const results = await commonSearchAPI({
        endpoint: URL.shipmentParty,
        query,
      });
      const arr = Array.isArray(results)
        ? (results as Record<string, unknown>[])
        : [];

      if (!arr.length) {
        freeTextOwnedRef.current = true;
        shouldFocusFreeTextRef.current = true;
        setShipperOptions([]);
        setShipperHasResults(false);
        setShipperManualMode(true);
        shipperDataRef.current = {};
        onFreeText(query);
        return;
      }

      freeTextOwnedRef.current = false;
      const { options: opts, map } = mapShipmentPartySearchResults(arr);
      shipperDataRef.current = map;
      setShipperOptions(opts);
      setShipperHasResults(true);
      setShipperManualMode(false);
    } catch (err) {
      console.error("Import master shipper shipment-party search failed:", err);
      setShipperOptions([]);
      setShipperHasResults(null);
      setShipperManualMode(false);
      shipperDataRef.current = {};
    }
  }, 500);

  const showFreeText =
    !normalizedId &&
    (shipperManualMode || shipperHasResults === false) &&
    shipperSearch.trim().length >= 2;

  if (showFreeText) {
    return (
      <FormTextInput
        ref={freeTextInputRef}
        size={size}
        label="Shipper Name"
        placeholder="Enter shipper name"
        disabled={disabled}
        value={shipperSearch}
        onChange={(e) => {
          const v = toTitleCase(e.currentTarget.value);
          setShipperSearch(v);
          if (!v.trim()) {
            resetSearchState();
            onClear();
            return;
          }
          freeTextOwnedRef.current = true;
          onFreeText(v);
        }}
        error={error}
      />
    );
  }

  return (
    <Select
      size={size}
      label="Shipper Name"
      placeholder="Select or search shipper"
      searchable
      clearable
      disabled={disabled}
      data={selectData}
      searchValue={shipperSearch}
      onSearchChange={(value) => {
        const v = toTitleCase(value);
        setShipperSearch(v);
        if (!v.trim()) {
          resetSearchState();
          onClear();
          return;
        }
        debouncedShipperSearch(v);
      }}
      value={normalizedId || null}
      onChange={(value) => {
        if (!value) {
          resetSearchState();
          onClear();
          return;
        }
        const original = shipperDataRef.current[value] || null;
        const name = String(
          (original as Record<string, unknown> | null)?.customer_name ||
            selectData.find((o) => o.value === value)?.label ||
            "",
        );
        freeTextOwnedRef.current = false;
        setShipperSearch(name);
        setShipperManualMode(false);
        setShipperHasResults(true);
        hydratedKeyRef.current = `${value}|${name}`;
        onSelect(value, toTitleCase(name), original);
      }}
      comboboxProps={{ zIndex: dropdownZIndex }}
      nothingFoundMessage="No shipper found - type to enter new shipper"
      error={error}
      styles={{
        input: {
          fontSize: "13px",
          height: "36px",
          fontFamily: "Inter",
        },
        label: {
          fontSize: "13px",
          fontWeight: 500,
          color: "#424242",
          marginBottom: "4px",
          fontFamily: "Inter",
        },
      }}
    />
  );
}
