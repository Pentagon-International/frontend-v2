import { useEffect, useMemo, useRef, useState } from "react";
import Dropdown from "./Dropdown";
import FormTextArea from "./FormTextArea";

export type PartyAddressOption = {
  value: string;
  label: string;
  email?: string;
};

export type PartyAddressFieldProps = {
  label: string;
  /** Placeholder when shown as textarea */
  placeholder?: string;
  /** Placeholder when shown as dropdown */
  selectPlaceholder?: string;
  value: string;
  options: PartyAddressOption[];
  /**
   * Called when address changes.
   * `option` is set when picked from dropdown; null for free-text / clear.
   */
  onChange: (value: string, option?: PartyAddressOption | null) => void;
  error?: React.ReactNode;
  disabled?: boolean;
  /** Changes when the selected party changes — re-opens picker for multi-address parties */
  partyKey?: string;
};

/**
 * Party address UX for house pages:
 * - Default / after selection / on blur → TextArea (minRows=2)
 * - Party with multiple addresses → Dropdown until an address is chosen
 * - Click TextArea (with multiple options) → unselect and show Dropdown again
 * - Clear selection in Dropdown → stay in Dropdown until another pick or blur
 */
export default function PartyAddressField({
  label,
  placeholder = "Enter address",
  selectPlaceholder = "Select address",
  value,
  options,
  onChange,
  error,
  disabled,
  partyKey = "",
}: PartyAddressFieldProps) {
  const optionsKey = useMemo(
    () => options.map((item) => item.value).join("\u0001"),
    [options],
  );
  const hasMultiple = options.length > 1;
  const [picking, setPicking] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimer = () => {
    if (blurTimerRef.current != null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearBlurTimer();
    // New party / new option set: open dropdown when multiple addresses exist
    setPicking(hasMultiple);
  }, [optionsKey, partyKey, hasMultiple]);

  useEffect(() => () => clearBlurTimer(), []);

  const showDropdown = hasMultiple && picking;

  if (showDropdown) {
    return (
      <Dropdown
        label={label}
        placeholder={selectPlaceholder}
        searchable
        clearable
        data={options}
        value={value || null}
        disabled={disabled}
        autoFocus
        comboboxProps={{ openOnFocus: true }}
        error={error as string | undefined}
        onChange={(next) => {
          clearBlurTimer();
          if (next) {
            const selected =
              options.find((item) => item.value === next) ?? null;
            onChange(next, selected);
            setPicking(false);
          } else {
            // Unselect — keep dropdown open for another choice
            onChange("", null);
          }
        }}
        onBlur={() => {
          // Defer so portal option clicks can fire onChange before we switch views
          clearBlurTimer();
          blurTimerRef.current = setTimeout(() => {
            setPicking(false);
            blurTimerRef.current = null;
          }, 180);
        }}
      />
    );
  }

  return (
    <FormTextArea
      label={label}
      placeholder={placeholder}
      minRows={2}
      value={value || ""}
      disabled={disabled}
      error={error}
      onChange={(e) => {
        onChange(e.currentTarget.value, null);
      }}
      onClick={() => {
        if (!hasMultiple || disabled) return;
        // Click address to unselect and re-open dropdown
        clearBlurTimer();
        onChange("", null);
        setPicking(true);
      }}
    />
  );
}
