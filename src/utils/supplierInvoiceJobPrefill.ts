import { resolveSupplierInvoiceHouseCostAmount } from "./houseChargeAmounts";

export type SupplierInvoiceJobPrefillCharge = {
  shipment_no: string;
  charge_id: number | null;
  charge_name?: string;
  currency_id?: string | number | null;
  roe?: string | number | null;
  amount?: string | number | null;
  supplier_code?: string;
  supplier_name?: string;
};

export type SupplierInvoicePrefillFromJob = {
  source: "air-import-job" | "service-job";
  job_id?: string;
  charges?: SupplierInvoiceJobPrefillCharge[];
};

export type BuildHouseSupplierInvoicePrefillArgs = {
  houseCharges: unknown[];
  houseShipmentNo: string;
  jobId: string;
};

export type BuildPrefillResult =
  | { ok: true; prefill: SupplierInvoicePrefillFromJob }
  | { ok: false; message: string };

function toStr(v: unknown): string {
  return String(v ?? "").trim();
}

/** Build prefill payload from current house charge rows (same rules as Create Supplier Invoice). */
export function buildHouseSupplierInvoicePrefill(
  args: BuildHouseSupplierInvoicePrefillArgs,
): BuildPrefillResult {
  const houseShipmentNo = toStr(args.houseShipmentNo);
  if (!houseShipmentNo) {
    return {
      ok: false,
      message: "Shipment ID not found for Supplier Invoice prefill.",
    };
  }

  const houseCharges = Array.isArray(args.houseCharges) ? args.houseCharges : [];
  const withChargeAndSupplier = houseCharges.filter((raw) => {
    const c = raw as Record<string, unknown>;
    return (
      c?.charge_id != null &&
      (toStr(c.supplier_code) || toStr(c.supplier_name))
    );
  });

  if (withChargeAndSupplier.length === 0) {
    return {
      ok: false,
      message: "Select a supplier/vendor to create supplier invoice",
    };
  }

  const charges = withChargeAndSupplier
    .map((raw) => {
      const c = raw as Record<string, unknown>;
      return {
        shipment_no: houseShipmentNo,
        charge_id: c.charge_id != null ? Number(c.charge_id) : null,
        charge_name: toStr(c.charge_name),
        currency_id: c.currency_id ?? c.currency ?? null,
        roe: c.roe ?? null,
        amount: resolveSupplierInvoiceHouseCostAmount(c),
        supplier_code: toStr(c.supplier_code),
        supplier_name: toStr(c.supplier_name),
      };
    })
    .filter(
      (x) =>
        x.charge_id != null &&
        x.amount != null &&
        String(x.amount).trim() !== "",
    );

  if (charges.length === 0) {
    return {
      ok: false,
      message: "Fill cost values on the charge(s) to create supplier invoice",
    };
  }

  return {
    ok: true,
    prefill: {
      source: "air-import-job",
      job_id: toStr(args.jobId) || houseShipmentNo,
      charges,
    },
  };
}

export function supplierInvoiceCreatePath(rcm: boolean): string {
  return rcm ? "/supplier-invoice-rcm/create" : "/supplier-invoice/create";
}
