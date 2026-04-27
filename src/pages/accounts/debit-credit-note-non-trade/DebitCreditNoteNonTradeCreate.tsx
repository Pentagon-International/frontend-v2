import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Center,
  FileButton,
  Grid,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import {
  SingleDateInput,
  Dropdown,
  SearchableSelect,
} from "../../../components";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useLocation, useNavigate } from "react-router-dom";
import FormTextInput from "../../../components/FormTextInput";
import ToastNotification from "../../../components/ToastNotification";
import { commonSearchAPI } from "../../../service/searchApi";

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? response ?? [];
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchStateMaster = async () => {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? response ?? [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

// Fetch effective SAC for charge + service: POST { items: [{ charge_id, service_id }] }
const fetchGetEffectiveSac = async (
  items: { charge_id: number; service_id: number }[],
): Promise<
  Array<{ charge_id: number; service_id: number; sac_code?: string | null }>
> => {
  try {
    const response = await postAPICall(
      URL.gstChargeMappingGetEffectiveSac,
      { items },
      API_HEADER,
    );
    return (
      (
        response as {
          data?: Array<{
            charge_id: number;
            service_id: number;
            sac_code?: string | null;
          }>;
        }
      )?.data ?? []
    );
  } catch (e) {
    console.error("Failed to fetch effective SAC", e);
    return [];
  }
};

// daybook is loaded via SearchableSelect (no preload)

// customers are loaded via SearchableSelect (no preload)

const CRN_OPTIONS = ["Cost", "Revenue", "Neutral"];

type LineItem = {
  id: string;
  // Trade-only fields (kept optional to allow Non-Trade to reuse same structure)
  shipment_no?: string;
  service_id?: number | null;
  charge_id?: number | null;
  charge_name?: string;
  crn?: string;
  account_id: string; // chart of accounts id (dropdown background value)
  account_code: string;
  account_name: string;
  subledger: string;
  cost_center_code: string;
  cost_center_key: string;
  currency: string;
  roe: number | "";
  amount: number | "";
  amount_in_inr: number | "";
  local_amount: number | "";
  dr_cr: "Dr" | "Cr" | "";
  sac_code: string;
  narration: string;
  note: string;
};

function formatChartOfAccountsLabel(
  glName: string | null | undefined,
  glAccountCode: string | null | undefined,
  accountName: string | null | undefined,
): string {
  const a = String(glName ?? "").trim();
  const b = String(glAccountCode ?? "").trim();
  const c = String(accountName ?? "").trim();
  return [c, b, a].filter(Boolean).join(" - ");
}

const newLineItem = (n: number): LineItem => ({
  id: `line-${Date.now()}-${n}`,
  shipment_no: "",
  service_id: null,
  charge_id: null,
  charge_name: "",
  crn: "",
  account_id: "",
  account_code: "",
  account_name: "",
  subledger: "",
  cost_center_code: "",
  cost_center_key: "",
  currency: "INR",
  roe: "",
  amount: "",
  amount_in_inr: "",
  local_amount: "",
  dr_cr: "",
  sac_code: "",
  narration: "",
  note: "",
});

export function DebitCreditNoteCreateBase({
  payloadType,
  showTradeFields,
}: {
  payloadType: "non_trade" | "trade";
  showTradeFields: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  console.log("[DCN] render", {
    payloadType,
    showTradeFields,
    locationState: location.state,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string>("");

  type SupportingDocument = {
    name: string;
    file: File | null;
  };
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [saveResponse, setSaveResponse] = useState<Record<
    string,
    unknown
  > | null>(null);

  type CustomerRow = {
    id?: number | string;
    customer_code?: string;
    customer_name?: string;
    name?: string;
    address?: string;
  };

  const form = useForm({
    initialValues: {
      daybookId: null as string | null,
      documentType: "",
      partyAccount: "",
      partyName: "",
      address: "",
      stateId: null as string | null,
      currencyId: null as string | null,
      currencyCode: "INR",
      roe: 1 as number | "",
      costCenter: "",
      documentDate: dayjs().toDate() as Date | null,
      documentNo: "",
      gstId: "",
      narration: "",
      note: "",
      lines: [newLineItem(0)] as LineItem[],
      supporting_documents: [] as SupportingDocument[],
    },
  });

  // Cache resolved service_id for a shipment_no so we don't re-fetch repeatedly.
  const shipmentServiceIdCacheRef = useRef<Record<string, number | null>>({});

  const getServiceIdByShipmentNoAsync = async (
    shipmentNoRaw: string | null | undefined,
  ): Promise<number | null> => {
    const shipmentNo = String(shipmentNoRaw ?? "").trim();
    if (!shipmentNo) return null;
    if (shipmentNo in shipmentServiceIdCacheRef.current) {
      return shipmentServiceIdCacheRef.current[shipmentNo];
    }
    try {
      const results = await commonSearchAPI({
        endpoint: URL.filterJobCreate,
        query: shipmentNo,
      });
      const rows = Array.isArray(results)
        ? (results as Array<Record<string, unknown>>)
        : [];
      const match = rows.find(
        (r) => String(r?.shipment_id ?? "").trim() === shipmentNo,
      );
      const serviceIdRaw =
        (
          match as
            | {
                service_id?: unknown;
                serviceId?: unknown;
                job?: { service_id?: unknown };
              }
            | undefined
        )?.service_id ??
        (match as { serviceId?: unknown } | undefined)?.serviceId ??
        (match as { job?: { service_id?: unknown } } | undefined)?.job
          ?.service_id ??
        null;
      const serviceId = serviceIdRaw != null ? Number(serviceIdRaw) : null;
      shipmentServiceIdCacheRef.current[shipmentNo] =
        serviceId != null && Number.isFinite(serviceId) ? serviceId : null;
      return shipmentServiceIdCacheRef.current[shipmentNo];
    } catch {
      shipmentServiceIdCacheRef.current[shipmentNo] = null;
      return null;
    }
  };

  const fetchSacForLine = async (
    lineIndex: number,
    chargeId: number | null,
    shipmentNo: string,
    serviceIdOverride?: number | null,
  ) => {
    if (!showTradeFields) return;
    if (chargeId == null || !shipmentNo) return;
    const serviceId =
      serviceIdOverride != null
        ? serviceIdOverride
        : await getServiceIdByShipmentNoAsync(shipmentNo);
    if (serviceId == null) return;
    const data = await fetchGetEffectiveSac([
      { charge_id: chargeId, service_id: serviceId },
    ]);
    const item = data.find(
      (x) => x.charge_id === chargeId && x.service_id === serviceId,
    );
    const sac = String(item?.sac_code ?? "").trim();
    if (!sac) return;
    form.setFieldValue(`lines.${lineIndex}.sac_code`, sac);
  };

  // (Trade-only SAC auto fetch effect is placed after isReadOnly is defined)

  const setLineById = (id: string, patch: Partial<LineItem>) => {
    const idx = form.values.lines.findIndex((l) => l.id === id);
    if (idx < 0) return;
    form.setFieldValue(`lines.${idx}`, { ...form.values.lines[idx], ...patch });
  };

  const addLine = () =>
    form.insertListItem("lines", newLineItem(form.values.lines.length));
  const removeLine = (id: string) => {
    if (form.values.lines.length <= 1) return;
    const idx = form.values.lines.findIndex((l) => l.id === id);
    if (idx >= 0) form.removeListItem("lines", idx);
  };

  const computeLocalAmount = (
    amount: number | "",
    roe: number | "",
  ): number | "" => {
    if (amount === "" || roe === "") return "";
    if (!Number.isFinite(Number(amount)) || !Number.isFinite(Number(roe)))
      return "";
    return Number(amount) * Number(roe);
  };

  const computeAmountInHeaderCurrency = (
    amount: number | "",
    headerRoe: number | "",
  ): number | "" => {
    if (amount === "" || headerRoe === "") return "";
    if (!Number.isFinite(Number(amount)) || !Number.isFinite(Number(headerRoe)))
      return "";
    return Number(amount) * Number(headerRoe);
  };

  const saveForGst = async (): Promise<string | null> => {
    // Ensure we have an id before calling GST breakup.
    if (saveResponse?.id != null) {
      await onUpdate();
      return String(saveResponse.id);
    }

    const fd = buildDebitCreditNoteFormData();
    try {
      const res = await apiCallProtected.post(
        URL.debitCreditNote,
        fd,
        FORM_DATA_HEADERS,
      );
      // applyCreateResponseToForm will set saveResponse via header.id
      applyCreateResponseToForm(res);
      const createdRoot = res as { data?: unknown };
      const createdData =
        (createdRoot?.data as { data?: unknown } | undefined)?.data ??
        createdRoot?.data ??
        res;
      const createdHeader = createdData as Record<string, unknown>;
      return createdHeader?.id != null ? String(createdHeader.id) : null;
    } catch (err) {
      console.error("Failed to save debit/credit note for GST", err);
      return null;
    }
  };

  const calculateGst = async () => {
    const id = await saveForGst();
    if (!id) return;

    type SacWiseTotal = {
      sac_code?: string;
      total_amount?: number;
      narration?: string;
      account_code?: string | null;
      subledger_code?: string | null;
      roe?: number | null;
      currency_code?: string | null;
      account_name?: string | null;
    };

    setCalcLoading(true);
    setLoadingText("Calculating GST...");
    try {
      const res = await postAPICall(
        URL.invoiceCalculateGstBreakup,
        { debit_credit_note_id: Number(id) },
        API_HEADER,
      );
      const root = res as { data?: unknown };
      const payload = (root?.data ?? res) as Record<string, unknown>;
      const sacWiseTotals = (payload?.sac_wise_totals ?? []) as SacWiseTotal[];

      if (!Array.isArray(sacWiseTotals) || sacWiseTotals.length === 0) return;

      const generatedLines: LineItem[] = sacWiseTotals.map((t, i) => {
        const amount = t.total_amount != null ? Number(t.total_amount) : "";
        const lineRoe = t.roe != null ? Number(t.roe) : "";
        const localAmount = computeLocalAmount(amount, lineRoe);
        const amountInHeader = computeAmountInHeaderCurrency(
          amount,
          form.values.roe,
        );

        return {
          ...newLineItem(form.values.lines.length + i),
          account_id: "",
          account_code: String(t.account_code ?? ""),
          account_name: String(t.account_name ?? ""),
          subledger: String(t.subledger_code ?? ""),
          currency: String(
            t.currency_code ?? form.values.currencyCode ?? "INR",
          ),
          roe: lineRoe,
          amount,
          local_amount: localAmount,
          amount_in_inr: amountInHeader,
          dr_cr:
            (form.values.lines[0]?.dr_cr as "Dr" | "Cr" | undefined) ?? "Dr",
          sac_code: String(t.sac_code ?? ""),
          narration: String(t.narration ?? ""),
          note: "",
        };
      });

      // Append with existing entries (do not wipe user-entered lines).
      form.setFieldValue(
        "lines",
        [...form.values.lines, ...generatedLines].length
          ? [...form.values.lines, ...generatedLines]
          : [newLineItem(0)],
      );
      ToastNotification({
        type: "success",
        message: "GST calculated successfully",
      });
    } catch (e) {
      console.error("Failed to calculate GST breakup", e);
      ToastNotification({ type: "error", message: "Failed to calculate GST" });
    } finally {
      setCalcLoading(false);
      setLoadingText("");
    }
  };

  // Edit/View flow: prefill from list page row data
  useEffect(() => {
    const stateAny = (location.state ?? null) as unknown;
    const stateObj = (stateAny ?? null) as {
      mode?: "view" | "edit";
      data?: unknown;
      row?: unknown;
      record?: unknown;
      item?: unknown;
    } | null;

    // Some list pages pass `{ data: row }`, others pass `row` directly.
    const candidate =
      stateObj?.data ??
      stateObj?.row ??
      stateObj?.record ??
      stateObj?.item ??
      stateAny;

    if (!candidate) return;

    console.log("[DCN] edit prefill: location.state =", location.state);
    console.log("[DCN] edit prefill: candidate =", candidate);

    applyCreateResponseToForm(candidate);
    // Log after state updates flush using latest values
    setTimeout(() => {
      console.log("[DCN] after prefill: lines =", form.getValues().lines);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  const { data: stateData = [] } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  const { data: daybookData = [] } = useQuery({
    queryKey: ["daybookMaster"],
    queryFn: async () => {
      try {
        const res = await getAPICall(`${URL.daybookGet}`, API_HEADER);
        return (res as { data?: unknown[] })?.data ?? res ?? [];
      } catch (e) {
        console.error("Error fetching daybook:", e);
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const daybookOptions = useMemo(() => {
    const data = daybookData as Array<{
      id?: number;
      name?: string;
      document_type?: string;
    }>;
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => ({
        value: String(d.id ?? ""),
        label: String(d.name ?? "").trim() || String(d.id ?? ""),
      }))
      .filter((o) => o.value);
  }, [daybookData]);

  const daybookDocumentTypeById = useMemo(() => {
    const data = daybookData as Array<{ id?: number; document_type?: string }>;
    const map = new Map<string, string>();
    if (Array.isArray(data)) {
      data.forEach((d) => {
        const id = d.id != null ? String(d.id) : "";
        if (!id) return;
        map.set(id, String(d.document_type ?? "").trim());
      });
    }
    return map;
  }, [daybookData]);

  // daybook master list not needed (Daybook is SearchableSelect)

  const currencyOptions = useMemo(() => {
    const data = currencyData as {
      id?: number;
      currency_code?: string;
      code?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((c) => ({
        value: String(c.id ?? ""),
        label: String(c.currency_code ?? c.code ?? c.id ?? "").trim(),
      }))
      .filter((o) => o.value && o.label);
  }, [currencyData]);

  const stateOptions = useMemo(() => {
    const data = stateData as {
      id?: number;
      state_name?: string;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((s) => ({
        value: String(s.id ?? ""),
        label: String(s.state_name ?? s.name ?? s.id ?? "").trim(),
      }))
      .filter((o) => o.value && o.label);
  }, [stateData]);

  const { data: sacCodes = [] } = useQuery({
    queryKey: ["gstSacMasterFilter"],
    queryFn: async () => {
      try {
        const res = await postAPICall(URL.gstSacMasterFilter, {}, API_HEADER);
        const maybeAxios = res as { data?: unknown };
        const payloadUnknown: unknown = maybeAxios?.data ?? res;
        const isObj = (v: unknown): v is Record<string, unknown> =>
          typeof v === "object" && v !== null && !Array.isArray(v);

        // Supported shapes:
        // 1) { data: [...] }
        // 2) { data: { data: [...] } }
        // 3) [...] (already array)
        let rows: unknown[] = [];
        if (Array.isArray(payloadUnknown)) {
          rows = payloadUnknown;
        } else if (
          isObj(payloadUnknown) &&
          Array.isArray(payloadUnknown.data)
        ) {
          rows = payloadUnknown.data as unknown[];
        } else if (
          isObj(payloadUnknown) &&
          isObj(payloadUnknown.data) &&
          Array.isArray((payloadUnknown.data as Record<string, unknown>).data)
        ) {
          rows = (payloadUnknown.data as Record<string, unknown>)
            .data as unknown[];
        }

        const list = rows as Array<{ sac_code?: unknown }>;
        return list
          .map((r) => String(r?.sac_code ?? "").trim())
          .filter(Boolean);
      } catch (e) {
        console.error("Error fetching SAC master:", e);
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const sacCodeOptions = useMemo(() => {
    const uniq = new Set<string>();
    (Array.isArray(sacCodes) ? sacCodes : []).forEach((c) => {
      const v = String(c ?? "").trim();
      if (v) uniq.add(v);
    });
    return Array.from(uniq);
  }, [sacCodes]);

  // daybookOptions removed (Daybook now uses SearchableSelect)

  const FORM_DATA_HEADERS = {
    ...API_HEADER,
    headers: {
      ...(API_HEADER as { headers?: Record<string, string> }).headers,
      "Content-Type": "multipart/form-data",
    },
  };

  const buildDebitCreditNoteFormData = (
    statusOverride?: "UNPOSTED" | "POSTED",
  ): FormData => {
    const currentStatus = String(
      (saveResponse as { status?: unknown } | null)?.status ?? "UNPOSTED",
    ).toUpperCase();
    const status: "UNPOSTED" | "POSTED" =
      statusOverride ?? (currentStatus === "POSTED" ? "POSTED" : "UNPOSTED");

    const debitCreditNote = {
      type: payloadType,
      daybook_id: form.values.daybookId ? Number(form.values.daybookId) : null,
      document_type: form.values.documentType,
      party_code: form.values.partyAccount,
      address: form.values.address,
      state_id: form.values.stateId ? Number(form.values.stateId) : null,
      currency_id: form.values.currencyId
        ? Number(form.values.currencyId)
        : null,
      roe: form.values.roe === "" ? "" : String(form.values.roe),
      document_date: form.values.documentDate
        ? dayjs(form.values.documentDate).format("YYYY-MM-DD")
        : "",
      status,
      cost_center: form.values.costCenter,
      narration: form.values.narration,
      note: form.values.note,
      gst_id: form.values.gstId,
      dr_cr: (form.values.lines[0]?.dr_cr as "Dr" | "Cr" | undefined) ?? "Dr",
      debit_credit_note_tem: form.values.lines.map((l) => ({
        ...(showTradeFields
          ? {
              shipment_no: String(l.shipment_no ?? ""),
              charge_id: l.charge_id ?? null,
              crn: String(l.crn ?? ""),
            }
          : {}),
        account_code: l.account_code,
        subledger: l.subledger,
        code: l.cost_center_code,
        key: l.cost_center_key,
        currency_id: form.values.currencyId
          ? Number(form.values.currencyId)
          : null,
        roe: l.roe === "" ? "" : String(l.roe),
        amount: l.amount === "" ? "" : String(l.amount),
        local_amount: l.local_amount === "" ? "" : String(l.local_amount),
        amount_in_inr: l.amount_in_inr === "" ? "" : String(l.amount_in_inr),
        dr_cr: l.dr_cr || "Dr",
        sac_code: l.sac_code,
        narration: l.narration,
        note: l.note,
      })),
    };

    const fd = new FormData();
    fd.append("debit_credit_note", JSON.stringify(debitCreditNote));

    let fileIndex = 0;
    form.values.supporting_documents.forEach((doc) => {
      if (!doc.file) return;
      fd.append(`document_names[${fileIndex}]`, (doc.name ?? "").toString());
      fd.append(`document[${fileIndex}]`, doc.file);
      fileIndex++;
    });

    return fd;
  };

  const applyCreateResponseToForm = (raw: unknown) => {
    console.log("[DCN] applyCreateResponseToForm: raw =", raw);
    // Supports:
    // - axios response: { data: { ...note } } or { data: { data: { ...note } } }
    // - router state: { mode, data: { ...note } }
    // - direct row: { ...note }
    const unwrap = (x: unknown): unknown => {
      if (!x || typeof x !== "object") return x;
      const obj = x as Record<string, unknown>;
      if ("mode" in obj && "data" in obj) return obj.data;
      if ("data" in obj) {
        const d = obj.data;
        if (d && typeof d === "object") {
          const inner = d as Record<string, unknown>;
          if ("data" in inner) return inner.data;
        }
        return d;
      }
      return x;
    };

    const header = unwrap(raw) as Record<string, unknown>;
    const linesFromDetails = (header as { details?: unknown }).details;
    const linesFromTem = (header as { debit_credit_note_tem?: unknown })
      .debit_credit_note_tem;
    const details = (
      Array.isArray(linesFromDetails)
        ? linesFromDetails
        : Array.isArray(linesFromTem)
          ? linesFromTem
          : []
    ) as Array<Record<string, unknown>>;

    console.log(
      "[DCN] applyCreateResponseToForm: header keys =",
      Object.keys(header ?? {}),
    );
    console.log("[DCN] applyCreateResponseToForm: lines source counts =", {
      details: Array.isArray(linesFromDetails) ? linesFromDetails.length : null,
      debit_credit_note_tem: Array.isArray(linesFromTem)
        ? linesFromTem.length
        : null,
      chosen: details.length,
    });
    if (details.length) {
      console.log(
        "[DCN] applyCreateResponseToForm: first line =",
        details[0],
      );
    }

    if (header?.id != null) setSaveResponse(header);

    // Header fields
    if (header?.daybook_id != null)
      form.setFieldValue("daybookId", String(header.daybook_id));
    if (header?.document_type != null)
      form.setFieldValue("documentType", String(header.document_type));
    if (header?.party_code != null)
      form.setFieldValue("partyAccount", String(header.party_code));
    if (header?.party_name != null)
      form.setFieldValue("partyName", String(header.party_name));
    const partyAddress =
      (header as { party_address?: unknown }).party_address ??
      (header as { address?: unknown }).address ??
      null;
    if (partyAddress != null)
      form.setFieldValue("address", String(partyAddress ?? ""));
    if (header?.state_id != null)
      form.setFieldValue("stateId", String(header.state_id));
    // currency in edit/view flows
    if ((header as { currency_id?: unknown }).currency_id != null) {
      form.setFieldValue(
        "currencyId",
        String((header as { currency_id?: unknown }).currency_id),
      );
    }
    const headerCurrencyCodeRaw =
      (header as { currency_code?: unknown }).currency_code ??
      (header as { currency?: unknown }).currency ??
      null;
    const headerCurrencyCode =
      headerCurrencyCodeRaw != null ? String(headerCurrencyCodeRaw).trim() : "";
    if (headerCurrencyCode) {
      form.setFieldValue("currencyCode", headerCurrencyCode);
    }
    if (header?.roe != null) form.setFieldValue("roe", Number(header.roe));
    if (header?.document_date != null)
      form.setFieldValue(
        "documentDate",
        dayjs(String(header.document_date)).toDate(),
      );
    if (header?.document_no != null)
      form.setFieldValue("documentNo", String(header.document_no));
    if (header?.cost_center != null)
      form.setFieldValue("costCenter", String(header.cost_center));
    if (header?.narration != null)
      form.setFieldValue("narration", String(header.narration));
    if (header?.note != null) form.setFieldValue("note", String(header.note));
    if (header?.gst_id != null)
      form.setFieldValue("gstId", String(header.gst_id));

    // Details -> lines
    if (Array.isArray(details) && details.length) {
      const fallbackCurrencyCode =
        headerCurrencyCode || String(form.values.currencyCode ?? "INR");
      const mapped: LineItem[] = details.map((d, i) => ({
        id: `line-${Date.now()}-${i}`,
        shipment_no: String(d.shipment_no ?? ""),
        service_id:
          (d as { service_id?: unknown }).service_id != null &&
          Number.isFinite(Number((d as { service_id?: unknown }).service_id))
            ? Number((d as { service_id?: unknown }).service_id)
            : null,
        charge_id:
          d.charge_id != null && Number.isFinite(Number(d.charge_id))
            ? Number(d.charge_id)
            : null,
        charge_name: String(
          (d as { charge_name?: unknown }).charge_name ??
            (d as { chargeName?: unknown }).chargeName ??
            "",
        ),
        crn: String(
          (d as { crn?: unknown; CRN?: unknown }).crn ??
            (d as { CRN?: unknown }).CRN ??
            "",
        ),
        account_id: "",
        account_code: String(d.account_code ?? ""),
        account_name: String(d.account_name ?? ""),
        subledger: String(d.subledger ?? ""),
        cost_center_code: String(d.code ?? ""),
        cost_center_key: String(d.key ?? ""),
        currency: String(d.currency_code ?? fallbackCurrencyCode ?? "INR"),
        roe: d.roe != null ? Number(d.roe) : "",
        amount: d.amount != null ? Number(d.amount) : "",
        amount_in_inr: d.amount_in_inr != null ? Number(d.amount_in_inr) : "",
        local_amount: d.local_amount != null ? Number(d.local_amount) : "",
        dr_cr: d.dr_cr === "Dr" || d.dr_cr === "Cr" ? d.dr_cr : "",
        sac_code: String(d.sac_code ?? ""),
        narration: String(d.narration ?? ""),
        note: String(d.note ?? ""),
      }));
      console.log("[DCN] applyCreateResponseToForm: mapped lines =", mapped);
      console.log(
        "[DCN] applyCreateResponseToForm: setting lines length =",
        mapped.length,
      );
      form.setFieldValue("lines", mapped);
    } else {
      console.log(
        "[DCN] applyCreateResponseToForm: no line items found in payload (details/debit_credit_note_tem empty)",
      );
    }
  };

  const onCreate = async () => {
    const fd = buildDebitCreditNoteFormData();
    setIsSubmitting(true);
    setLoadingText("Creating credit/debit note...");
    try {
      const res = await apiCallProtected.post(
        URL.debitCreditNote,
        fd,
        FORM_DATA_HEADERS,
      );
      applyCreateResponseToForm(res);
      ToastNotification({ type: "success", message: "Created successfully" });
    } catch (err) {
      console.error("Failed to create debit/credit note", err);
      ToastNotification({ type: "error", message: "Failed to create" });
    } finally {
      setIsSubmitting(false);
      setLoadingText("");
    }
  };

  const onUpdate = async () => {
    if (saveResponse?.id == null) return;
    const fd = buildDebitCreditNoteFormData();
    // putAPICall expects `formValue.id` to build `${url}${id}/`.
    (fd as unknown as { id: unknown }).id = saveResponse.id;
    setIsSubmitting(true);
    setLoadingText("Updating credit/debit note...");
    try {
      await putAPICall(
        URL.debitCreditNote,
        fd as unknown as FormData,
        FORM_DATA_HEADERS,
      );
      ToastNotification({ type: "success", message: "Updated successfully" });
      // Refresh UI values if backend computed anything
      // Note: putAPICall returns axios response; we can ignore if not needed.
    } finally {
      setIsSubmitting(false);
      setLoadingText("");
    }
  };

  const isEditMode = saveResponse != null;
  const statusUpper = String(
    (saveResponse as { status?: unknown } | null)?.status ?? "",
  ).toUpperCase();
  const navState = (location.state ?? null) as {
    mode?: "view" | "edit";
  } | null;
  const isViewMode = navState?.mode === "view";
  const isPosted = isEditMode && statusUpper === "POSTED";
  const isReadOnly = isViewMode || isPosted;
  const pageLabel = showTradeFields ? "Trade" : "Non Trade";

  useEffect(() => {
    console.log("[DCN] lines changed:", {
      length: form.values.lines.length,
      first: form.values.lines[0],
    });
  }, [form.values.lines]);

  // If currency is INR, default header/line ROE to 1 (do not override user-entered values).
  useEffect(() => {
    if (isReadOnly) return;
    const code = String(form.values.currencyCode ?? "")
      .trim()
      .toUpperCase();
    if (code !== "INR") return;

    if (form.values.roe === "") {
      form.setFieldValue("roe", 1);
    }

    const nextLines = form.values.lines.map((l) =>
      l.roe === "" ? { ...l, roe: 1 } : l,
    );
    const changed = nextLines.some(
      (l, i) => l.roe !== form.values.lines[i]?.roe,
    );
    if (changed) form.setFieldValue("lines", nextLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.currencyCode, isReadOnly]);

  // Trade only: auto-fetch SAC once shipment_no + charge_id are selected.
  const tradeSacKey = showTradeFields
    ? form.values.lines
        .map(
          (l) =>
            `${String(l.shipment_no ?? "").trim()}|${l.charge_id ?? ""}|${String(l.sac_code ?? "").trim()}`,
        )
        .join(",")
    : "";
  useEffect(() => {
    if (!showTradeFields) return;
    if (isReadOnly) return;
    form.values.lines.forEach((l, idx) => {
      const shipmentNo = String(l.shipment_no ?? "").trim();
      const chargeId = l.charge_id != null ? Number(l.charge_id) : null;
      const hasSac = String(l.sac_code ?? "").trim() !== "";
      if (!shipmentNo || chargeId == null || hasSac) return;
      void fetchSacForLine(idx, chargeId, shipmentNo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeSacKey, showTradeFields, isReadOnly]);

  // If header currency code defaults (e.g. INR) but id isn't selected,
  // auto-select the matching currency id so payload doesn't send null.
  useEffect(() => {
    if (isReadOnly) return;
    if (form.values.currencyId) return;
    const code = String(form.values.currencyCode ?? "").trim();
    if (!code) return;
    const match = currencyOptions.find((o) => o.label === code);
    if (!match) return;
    form.setFieldValue("currencyId", match.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currencyOptions,
    form.values.currencyCode,
    form.values.currencyId,
    isReadOnly,
  ]);

  const handlePost = async () => {
    if (saveResponse?.id == null) return;
    setIsSubmitting(true);
    setLoadingText("Posting credit/debit note...");
    try {
      const fd = buildDebitCreditNoteFormData("POSTED");
      const raw = await apiCallProtected.put(
        `${URL.debitCreditNote}${saveResponse.id}/`,
        fd,
        FORM_DATA_HEADERS,
      );
      applyCreateResponseToForm(raw);
      setSaveResponse((prev) => (prev ? { ...prev, status: "POSTED" } : prev));
      ToastNotification({ type: "success", message: "Posted successfully" });
    } catch (e) {
      console.error("Failed to post debit/credit note", e);
      ToastNotification({ type: "error", message: "Failed to post" });
    } finally {
      setIsSubmitting(false);
      setLoadingText("");
    }
  };

  return (
    <Box
      p="sm"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {(isSubmitting || calcLoading) && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255, 255, 255, 0.65)",
            zIndex: 2000,
          }}
        >
          <Center h="100%">
            <Stack gap="xs" align="center">
              <Loader color="#105476" />
              {loadingText ? (
                <Text size="sm" fw={600} c="#105476">
                  {loadingText}
                </Text>
              ) : null}
            </Stack>
          </Center>
        </Box>
      )}
      <Modal
        opened={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        title="Attach Supporting Documents"
        centered
        size="xl"
        style={{ fontFamily: "Inter" }}
        styles={{ title: { fontWeight: 600, color: "#105476" } }}
      >
        <Stack gap="sm">
          {form.values.supporting_documents.map((doc, idx) => (
            <Grid key={`${idx}`} columns={12} gutter="sm" align="flex-end">
              <Grid.Col span={5.5}>
                <FormTextInput
                  label="Document Name"
                  placeholder="Enter document name"
                  value={doc.name}
                  onChange={(e) => {
                    const next = [...form.values.supporting_documents];
                    next[idx] = { ...next[idx], name: e.currentTarget.value };
                    form.setFieldValue("supporting_documents", next);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={5.5}>
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    File
                  </Text>
                  <FileButton
                    onChange={(file) => {
                      const next = [...form.values.supporting_documents];
                      next[idx] = { ...next[idx], file: file ?? null };
                      form.setFieldValue("supporting_documents", next);
                    }}
                    accept="*/*"
                  >
                    {(props) => (
                      <Button
                        {...props}
                        variant="outline"
                        leftSection={<IconUpload size={16} />}
                        w="100%"
                        styles={{
                          root: { justifyContent: "flex-start" },
                        }}
                      >
                        {doc.file ? doc.file.name : "Click to select file"}
                      </Button>
                    )}
                  </FileButton>
                </Box>
              </Grid.Col>
              <Grid.Col span={1}>
                <Button
                  type="button"
                  variant="light"
                  color="red"
                  size="sm"
                  px={12}
                  onClick={() =>
                    form.setFieldValue(
                      "supporting_documents",
                      form.values.supporting_documents.filter(
                        (_, i) => i !== idx,
                      ),
                    )
                  }
                >
                  <IconTrash size={16} />
                </Button>
              </Grid.Col>
            </Grid>
          ))}

          <Group justify="space-between" mt="sm">
            <Button
              type="button"
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                form.setFieldValue("supporting_documents", [
                  ...form.values.supporting_documents,
                  { name: "", file: null },
                ])
              }
              disabled={isReadOnly}
            >
              Add Document
            </Button>
            <Button onClick={() => setDocumentsOpen(false)}>Done</Button>
          </Group>
        </Stack>
      </Modal>

      {/* <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}> */}
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap" align="end">
          <Group gap="sm" wrap="nowrap">
            <Text size="xl" fw={600} c="#105476">
              {isEditMode
                ? `Edit Debit / Credit Note (${pageLabel})`
                : `Create Debit / Credit Note (${pageLabel})`}
            </Text>
          </Group>
          {isEditMode && (
            <Group gap="sm" wrap="nowrap" justify="flex-end">
              <Text size="sm" fw={600} c="#105476">
                Status:
              </Text>
              <Badge
                size="sm"
                variant="light"
                color={isPosted ? "green" : "gray"}
              >
                {isPosted ? "POSTED" : "UNPOSTED"}
              </Badge>
              {form.values.documentNo ? (
                <>
                  <Text size="sm" fw={600} c="#105476">
                    Document No:
                  </Text>
                  <Text size="sm" fw={600} c="#105476">
                    {form.values.documentNo}
                  </Text>
                </>
              ) : null}
            </Group>
          )}
        </Group>

        {/* Header section (Grid 1) */}
        <Grid gutter="sm" mt="sm" columns={13}>
          <Grid.Col span={2}>
            <Dropdown
              label="Daybook"
              placeholder="Select daybook"
              searchable
              data={daybookOptions}
              value={form.values.daybookId}
              onChange={(val) => {
                form.setFieldValue("daybookId", val);
                const docType = val
                  ? daybookDocumentTypeById.get(String(val))
                  : "";
                if (docType) form.setFieldValue("documentType", docType);
              }}
              size="sm"
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.2}>
            <FormTextInput
              label="Document Type"
              placeholder="Enter document type"
              value={form.values.documentType}
              onChange={(e) =>
                form.setFieldValue("documentType", e.currentTarget.value)
              }
              readOnly
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.5}>
            <SearchableSelect
              apiEndpoint={URL.customer}
              label="Party Name"
              placeholder="Type party"
              value={form.values.partyAccount}
              displayValue={form.values.partyName}
              dropdownZIndex={1000}
              minSearchLength={1}
              searchFields={["customer_code", "customer_name", "name"]}
              returnOriginalData
              onChange={(val, selected, original) => {
                form.setFieldValue("partyAccount", val || "");
                form.setFieldValue("partyName", selected?.label ?? "");
                const row = (original as CustomerRow | null) ?? null;
                if (row?.address)
                  form.setFieldValue("address", String(row.address));
              }}
              displayFormat={(item) => ({
                value: String(item.customer_code ?? item.id ?? ""),
                label: String(item.customer_name ?? item.name ?? "").trim(),
              })}
              size="sm"
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={2}>
            <FormTextInput
              label="Address"
              placeholder="Enter address"
              value={form.values.address}
              onChange={(e) =>
                form.setFieldValue("address", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.2}>
            <Dropdown
              label="State"
              placeholder="Select state"
              data={stateOptions.map((o) => o.label)}
              searchable
              value={
                stateOptions.find(
                  (o) => o.value === String(form.values.stateId ?? ""),
                )?.label ?? null
              }
              onChange={(label) => {
                const found = stateOptions.find((o) => o.label === label);
                form.setFieldValue("stateId", found?.value ?? null);
              }}
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1}>
            <Dropdown
              label="Currency"
              placeholder="Select currency"
              searchable
              data={currencyOptions.map((o) => o.label)}
              value={
                currencyOptions.find(
                  (o) => o.value === String(form.values.currencyId ?? ""),
                )?.label ??
                form.values.currencyCode ??
                null
              }
              onChange={(label) => {
                const found = currencyOptions.find((o) => o.label === label);
                form.setFieldValue("currencyId", found?.value ?? null);
                form.setFieldValue("currencyCode", label ?? "");
              }}
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={0.7}>
            <FormTextInput
              label="ROE"
              placeholder="ROE"
              type="number"
              value={form.values.roe === "" ? "" : String(form.values.roe)}
              onChange={(e) => {
                const v = e.currentTarget.value;
                form.setFieldValue("roe", v === "" ? "" : Number(v));
              }}
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={1}>
            <FormTextInput
              label="Cost Center"
              placeholder="Cost center"
              value={form.values.costCenter}
              onChange={(e) =>
                form.setFieldValue("costCenter", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={1.4}>
            <SingleDateInput
              label="Document Date"
              placeholder="YYYY-MM-DD"
              value={form.values.documentDate}
              onChange={(v) => form.setFieldValue("documentDate", v)}
              size="sm"
              disabled={isReadOnly}
            />
          </Grid.Col>
        </Grid>

        {/* Header section (Grid 2) */}
        <Grid gutter="sm" mt="xs" columns={13}>
          <Grid.Col span={2}>
            <FormTextInput
              label="Document No"
              placeholder="Document no"
              value={form.values.documentNo}
              onChange={(e) =>
                form.setFieldValue("documentNo", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <FormTextInput
              label="GST ID"
              placeholder="GST ID"
              value={form.values.gstId}
              onChange={(e) =>
                form.setFieldValue("gstId", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <FormTextInput
              label="Narration"
              placeholder="Narration"
              value={form.values.narration}
              onChange={(e) =>
                form.setFieldValue("narration", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <FormTextInput
              label="Note"
              placeholder="Note"
              value={form.values.note}
              onChange={(e) =>
                form.setFieldValue("note", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
        </Grid>

        {/* Calculate GST button moved to Cost Center header */}

        {/* </Card> */}

        {/* Cost Center section (similar role to SupplierInvoiceCreate Charges section) */}
        {/* <Card shadow="sm" padding="lg" radius="md" withBorder> */}
        <Group justify="space-between" align="center" mb="sm">
          <Text size="sm" fw={600} c="#105476">
            Cost Center
          </Text>
          <Button variant="outline" color="#105476" onClick={calculateGst}>
            Calculate GST
          </Button>
          {/* <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={addLine}>
              Add Row
            </Button> */}
        </Group>
        {/* <Divider mb="sm" /> */}

        <Grid gutter={6} columns={showTradeFields ? 18 : 14}>
          {/* <Grid.Col span={0.3}>
              <Text size="xs" fw={600} c="#105476">
                SNo
              </Text>
            </Grid.Col> */}
          {showTradeFields && (
            <Grid.Col span={1.5}>
              <Text size="xs" fw={600} c="#105476">
                Shipment No
              </Text>
            </Grid.Col>
          )}
          {showTradeFields && (
            <Grid.Col span={1.3}>
              <Text size="xs" fw={600} c="#105476">
                Charge
              </Text>
            </Grid.Col>
          )}
          {showTradeFields && (
            <Grid.Col span={0.9}>
              <Text size="xs" fw={600} c="#105476">
                CRN
              </Text>
            </Grid.Col>
          )}
          <Grid.Col span={showTradeFields ? 1.9 : 2}>
            <Text size="xs" fw={600} c="#105476">
              Account
            </Text>
          </Grid.Col>
          <Grid.Col span={showTradeFields ? 0.9 : 1}>
            <Text size="xs" fw={600} c="#105476">
              Subledger
            </Text>
          </Grid.Col>
          <Grid.Col span={0.9}>
            <Text size="xs" fw={600} c="#105476">
              Code
            </Text>
          </Grid.Col>
          <Grid.Col span={0.9}>
            <Text size="xs" fw={600} c="#105476">
              Key
            </Text>
          </Grid.Col>
          <Grid.Col span={showTradeFields ? 0.9 : 1}>
            <Text size="xs" fw={600} c="#105476">
              Currency
            </Text>
          </Grid.Col>
          <Grid.Col span={0.7}>
            <Text size="xs" fw={600} c="#105476">
              ROE
            </Text>
          </Grid.Col>
          <Grid.Col span={showTradeFields ? 0.9 : 1}>
            <Text size="xs" fw={600} c="#105476">
              Amount
            </Text>
          </Grid.Col>
          <Grid.Col span={1}>
            <Text size="xs" fw={600} c="#105476">
              Local Amount
            </Text>
          </Grid.Col>
          <Grid.Col span={1}>
            <Text size="xs" fw={600} c="#105476">
              Amount in {form.values.currencyCode || "INR"}
            </Text>
          </Grid.Col>
          <Grid.Col span={0.7}>
            <Text size="xs" fw={600} c="#105476">
              Dr/Cr
            </Text>
          </Grid.Col>
          <Grid.Col span={showTradeFields ? 0.9 : 1}>
            <Text size="xs" fw={600} c="#105476">
              SAC Code
            </Text>
          </Grid.Col>
          <Grid.Col span={1}>
            <Text size="xs" fw={600} c="#105476">
              Narration
            </Text>
          </Grid.Col>
          <Grid.Col span={1}>
            <Text size="xs" fw={600} c="#105476">
              Note
            </Text>
          </Grid.Col>
          <Grid.Col span={showTradeFields ? 0.8 : 0.6}>
            <Text size="xs" fw={600} c="#105476">
              Action
            </Text>
          </Grid.Col>

          {form.values.lines.map((l, idx) => (
            <Grid.Col key={l.id} span={showTradeFields ? 18 : 14} p={0} mt={6}>
              <Grid gutter={6} align="end" columns={showTradeFields ? 18 : 14}>
                {/* <Grid.Col span={1}>
                    <Text size="sm">{idx + 1}</Text>
                  </Grid.Col> */}
                {showTradeFields && (
                  <Grid.Col span={1.5}>
                    <SearchableSelect
                      apiEndpoint={URL.filterJobCreate}
                      placeholder="Shipment no"
                      value={String(l.shipment_no ?? "").trim() || null}
                      displayValue={String(l.shipment_no ?? "").trim() || null}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      searchFields={["shipment_id"]}
                      displayFormat={(item: Record<string, unknown>) => {
                        const shipmentId = String(
                          item.shipment_id ?? "",
                        ).trim();
                        return { value: shipmentId, label: shipmentId };
                      }}
                      returnOriginalData
                      onChange={(val, _selected, original) => {
                        const shipmentNo = String(val ?? "").trim();
                        const serviceIdRaw =
                          (
                            original as {
                              service_id?: unknown;
                              serviceId?: unknown;
                            } | null
                          )?.service_id ??
                          (original as { serviceId?: unknown } | null)
                            ?.serviceId ??
                          null;
                        const serviceId =
                          serviceIdRaw != null &&
                          Number.isFinite(Number(serviceIdRaw))
                            ? Number(serviceIdRaw)
                            : null;
                        setLineById(l.id, {
                          shipment_no: shipmentNo,
                          service_id: serviceId,
                        });
                        const chargeId =
                          l.charge_id != null ? Number(l.charge_id) : null;
                        if (shipmentNo && chargeId != null) {
                          void fetchSacForLine(
                            idx,
                            chargeId,
                            shipmentNo,
                            serviceId,
                          );
                        }
                      }}
                      size="xs"
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                )}
                {showTradeFields && (
                  <Grid.Col span={1.3}>
                    <SearchableSelect
                      apiEndpoint={URL.chargeMaster}
                      placeholder="Charge"
                      value={
                        l.charge_id != null ? String(Number(l.charge_id)) : null
                      }
                      displayValue={String(l.charge_name ?? "").trim() || null}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      searchFields={["charge_code", "charge_name", "id"]}
                      displayFormat={(item: Record<string, unknown>) => {
                        const id = String(item.id ?? "").trim();
                        const name = String(item.charge_name ?? "").trim();
                        return { value: id, label: name };
                      }}
                      onChange={(val, selected) => {
                        const chargeId =
                          val && Number.isFinite(Number(val))
                            ? Number(val)
                            : null;
                        setLineById(l.id, {
                          charge_id: chargeId,
                          charge_name: selected?.label ?? "",
                        });
                        const shipmentNo = String(l.shipment_no ?? "").trim();
                        const serviceId =
                          l.service_id != null &&
                          Number.isFinite(Number(l.service_id))
                            ? Number(l.service_id)
                            : null;
                        if (shipmentNo && chargeId != null) {
                          void fetchSacForLine(
                            idx,
                            chargeId,
                            shipmentNo,
                            serviceId,
                          );
                        }
                      }}
                      size="xs"
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                )}
                {showTradeFields && (
                  <Grid.Col span={0.9}>
                    <Dropdown
                      data={CRN_OPTIONS}
                      value={String(l.crn ?? "") || null}
                      onChange={(v) => setLineById(l.id, { crn: v ?? "" })}
                      size="xs"
                      clearable
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                )}
                <Grid.Col span={showTradeFields ? 1.9 : 2}>
                  <SearchableSelect
                    apiEndpoint={URL.chartOfAccounts}
                    placeholder="Account"
                    value={l.account_id || null}
                    displayValue={l.account_name || null}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    searchFields={[
                      "gl_account_code",
                      "account_name",
                      "sl_code",
                      "id",
                    ]}
                    returnOriginalData
                    onChange={(val, selected, original) => {
                      const orig =
                        (original as {
                          id?: number | string;
                          gl_account_code?: string;
                          account_code?: string;
                          account_name?: string;
                          sl_code?: string;
                        } | null) ?? null;
                      const accountId =
                        orig?.id != null ? String(orig.id) : (val ?? "");
                      const code = String(
                        orig?.gl_account_code ?? orig?.account_code ?? "",
                      );
                      const name = String(
                        orig?.account_name ?? selected?.label ?? "",
                      );
                      const glName = String(
                        (orig as { gl_name?: string })?.gl_name ?? "",
                      );
                      const subledgerCode = String(orig?.sl_code ?? "");
                      setLineById(l.id, {
                        account_id: accountId,
                        account_code: code,
                        account_name: formatChartOfAccountsLabel(
                          glName,
                          code,
                          name,
                        ),
                        subledger: subledgerCode || l.subledger,
                      });
                    }}
                    displayFormat={(item) => ({
                      value: String(item.id ?? ""),
                      label: formatChartOfAccountsLabel(
                        String(
                          (item as { gl_name?: string })?.gl_name ?? "",
                        ).trim(),
                        String(
                          item.gl_account_code ?? item.account_code ?? "",
                        ).trim(),
                        String(
                          item.account_name ?? item.name ?? item.id ?? "",
                        ).trim(),
                      ),
                    })}
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={showTradeFields ? 0.9 : 1}>
                  <FormTextInput
                    value={l.subledger}
                    onChange={(e) =>
                      setLineById(l.id, { subledger: e.currentTarget.value })
                    }
                    size="xs"
                    readOnly
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  <FormTextInput
                    value={l.cost_center_code}
                    onChange={(e) =>
                      setLineById(l.id, {
                        cost_center_code: e.currentTarget.value,
                      })
                    }
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  <FormTextInput
                    value={l.cost_center_key}
                    onChange={(e) =>
                      setLineById(l.id, {
                        cost_center_key: e.currentTarget.value,
                      })
                    }
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={showTradeFields ? 0.9 : 1}>
                  <Dropdown
                    searchable
                    data={currencyOptions.map((o) => o.label)}
                    value={l.currency || null}
                    onChange={(label) =>
                      setLineById(l.id, { currency: label ?? "" })
                    }
                    size="xs"
                    clearable
                    placeholder="Currency"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <FormTextInput
                    type="number"
                    value={l.roe === "" ? "" : String(l.roe)}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      const nextRoe = v === "" ? "" : Number(v);
                      const localAmount = computeLocalAmount(l.amount, nextRoe);
                      setLineById(l.id, {
                        roe: nextRoe,
                        local_amount: localAmount,
                      });
                    }}
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={showTradeFields ? 0.9 : 1}>
                  <FormTextInput
                    type="number"
                    value={l.amount === "" ? "" : String(l.amount)}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      const nextAmount = v === "" ? "" : Number(v);
                      const localAmount = computeLocalAmount(nextAmount, l.roe);
                      const amountInHeader = computeAmountInHeaderCurrency(
                        nextAmount,
                        form.values.roe,
                      );
                      setLineById(l.id, {
                        amount: nextAmount,
                        local_amount: localAmount,
                        amount_in_inr: amountInHeader,
                      });
                    }}
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <FormTextInput
                    type="number"
                    value={l.local_amount === "" ? "" : String(l.local_amount)}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setLineById(l.id, {
                        local_amount: v === "" ? "" : Number(v),
                      });
                    }}
                    size="xs"
                    readOnly
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <FormTextInput
                    type="number"
                    value={
                      l.amount_in_inr === "" ? "" : String(l.amount_in_inr)
                    }
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setLineById(l.id, {
                        amount_in_inr: v === "" ? "" : Number(v),
                      });
                    }}
                    size="xs"
                    readOnly
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <Dropdown
                    data={["Dr", "Cr"]}
                    value={l.dr_cr || null}
                    onChange={(v) =>
                      setLineById(l.id, {
                        dr_cr: (v as "Dr" | "Cr" | null) ?? "",
                      })
                    }
                    size="xs"
                    clearable
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <Dropdown
                    searchable
                    data={sacCodeOptions}
                    value={l.sac_code || null}
                    onChange={(val) => {
                      setLineById(l.id, { sac_code: val ?? "" });
                    }}
                    size="xs"
                    clearable
                    placeholder="SAC"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <FormTextInput
                    value={l.narration}
                    onChange={(e) =>
                      setLineById(l.id, { narration: e.currentTarget.value })
                    }
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <FormTextInput
                    value={l.note}
                    onChange={(e) =>
                      setLineById(l.id, { note: e.currentTarget.value })
                    }
                    size="xs"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={0.6}>
                  <Group gap={6} justify="flex-start" wrap="nowrap">
                    {!isReadOnly && idx === form.values.lines.length - 1 && (
                      <Button
                        type="button"
                        radius="sm"
                        size="xs"
                        variant="light"
                        color="#105476"
                        onClick={addLine}
                        styles={{
                          root: {
                            width: 34,
                            paddingInline: 0,
                            paddingBlock: 6,
                          },
                        }}
                      >
                        <IconPlus size={16} />
                      </Button>
                    )}
                    {!isReadOnly && form.values.lines.length > 1 && (
                      <Button
                        type="button"
                        variant="light"
                        color="red"
                        size="xs"
                        onClick={() => removeLine(l.id)}
                        styles={{
                          root: {
                            width: 34,
                            paddingInline: 0,
                            paddingBlock: 6,
                          },
                        }}
                      >
                        <IconTrash size={16} />
                      </Button>
                    )}
                  </Group>
                </Grid.Col>
              </Grid>
            </Grid.Col>
          ))}
        </Grid>

        {/* removed: DR/CR/Net INR totals */}
        {/* </Card> */}
      </Stack>
      {/* </Box> */}

      <Group justify="space-between" mt="lg">
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() =>
            navigate(
              showTradeFields
                ? "/debit-credit-note-trade"
                : "/debit-credit-note-non-trade",
            )
          }
        >
          Back
        </Button>

        <Group gap="sm">
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconUpload size={16} />}
            onClick={() => {
              if (form.values.supporting_documents.length === 0) {
                form.setFieldValue("supporting_documents", [
                  { name: "", file: null },
                ]);
              }
              setDocumentsOpen(true);
            }}
            disabled={isReadOnly}
          >
            Attach Documents
          </Button>
          <Button
            color="#105476"
            onClick={isEditMode ? onUpdate : onCreate}
            disabled={isReadOnly}
          >
            {isEditMode ? "Update" : "Create"}
          </Button>
          {isEditMode && !isPosted && (
            <Button
              variant="outline"
              color="#105476"
              onClick={handlePost}
              disabled={isReadOnly}
            >
              Post
            </Button>
          )}
        </Group>
      </Group>
    </Box>
  );
}

export default function DebitCreditNoteNonTradeCreate() {
  return (
    <DebitCreditNoteCreateBase
      payloadType="non_trade"
      showTradeFields={false}
    />
  );
}
