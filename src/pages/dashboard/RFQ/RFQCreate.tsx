import {
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Flex,
  Grid,
  Group,
  Loader,
  Modal,
  Radio,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconDownload,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
  IconUser,
  IconTruckDelivery,
  IconCircleCheck,
  IconFileText,
} from "@tabler/icons-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { getAPICall } from "../../../service/getApiCall";
import { DateInput } from "@mantine/dates";
import { Dropzone } from "@mantine/dropzone";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  DateRangeInput,
  SingleDateInput,
} from "../../../components";
import dayjs from "dayjs";
import { postAPICall } from "../../../service/postApiCall";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QuotationCreate from "../QuotationCreate";
import { useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../../api/axios";
import { toTitleCase } from "../../../utils/textFormatter";
import {
  isOtherServiceInland,
  resolveEffectiveServiceFromTransport,
  resolveEffectiveServiceType,
  usesAirCargoStructure,
} from "../../../utils/otherServiceType";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import FormNumberInput from "../../../components/FormNumberInput";
import useAuthStore from "../../../store/authStore";
import CustomerDataDrawer from "../../../components/CustomerDataDrawer/CustomerDataDrawer";
import LastEnquiriesList from "../LastEnquiriesList";
import FormTextInput from "../../../components/FormTextInput";
import EditPageAuditInfoIcon from "../../../components/EditPageAuditInfoIcon";
import {
  EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX,
  normalizeEditPageAuditInfo,
} from "../../../utils/editPageAuditInfo";

// Type definitions

type TermsOfShipmentData = {
  tos_code: string;
  tos_name: string;
};

type SalespersonData = {
  id: number;
  sales_person: string;
  sales_coordinator: string;
  customer_service: string;
};

type SalespersonsResponse = {
  success: boolean;
  message: string;
  data: SalespersonData[];
};

type QuotationData = {
  id: number;
  enquiry_id: string;
  customer_name: string;
  enquiry_received_date: string;
  origin_name: string;
  destination_name: string;
  sales_person: string;
  quote_currency: string;
  valid_upto: string;
  multi_carrier: boolean;
  quote_type: string;
  carrier_name: string;
  charges: any[];
  service: string;
  created_by: string;
  created_by_name: string;
  status: string;
  status_display: string;
  remark: string;
  trade: string;
  fcl_details: any[];
  location: string | null;
  total_cost: string;
  total_sell: string;
  profit: string;
  chargeable_volume: number | null;
};

type CallEntryData = {
  id: number;
  customer_name: string;
  customer_code: string;
  call_date: string;
  call_mode: string;
  call_summary: string;
  followup_date: string;
  followup_action: string;
  salesman: string;
  expected_profit: number;
};

type JobData = {
  id: number;
  job_no: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  revenue: number;
  profit: number;
};

type ShipmentData = {
  customer_name: string;
  carrier_name: string;
  booking_no: string;
  revenue: number;
  gp: number;
};

type PotentialProfilingData = {
  id: number;
  service: string;
  origin_port_code: string;
  origin_port_name: string;
  destination_port_code: string;
  destination_port_name: string;
  no_of_shipments: number;
  frequency_id: number;
  frequency_name: string;
  volume: number;
  tier: string;
  potential_profit: number;
};

type CustomerDataResponse = {
  customer_info: {
    customer_code: string;
    customer_name: string;
    salesperson: string | null;
    credit_day: number | null;
    total_net_balance: number;
    total_credit_amount: number | null;
    last_visited: string | null;
    overall_total_revenue?: number | null;
    overall_total_gp?: number | null;
    currency?: string;
  };
  quotations: {
    count: number;
    data: QuotationData[];
  };
  call_entries: {
    count: number;
    data: CallEntryData[];
  };
  job_profit: {
    count: number;
    data: JobData[];
  };
  shipment: {
    count: number;
    data: ShipmentData[];
    overall_total_revenue: number;
    overall_total_gp: number;
  };
  potential_profiling: {
    count: number;
    data: PotentialProfilingData[];
  };
};

// Dimension unit options array - JSON object structure
const DIMENSION_UNIT_OPTIONS = [
  {
    service: "AIR",
    unit_value: [
      { value: 6000, Label: "Centimeter" },
      { value: 366, Label: "Inch" },
    ],
  },
  {
    service: "LCL",
    unit_value: [
      { value: 1000000, Label: "Centimeter" },
      { value: 1728, Label: "Inch" },
    ],
  },
];

/** Port dropdown + pill label: `port_name (port_code)` */
const portMasterDisplayFormat = (item: any) => ({
  value: String(item.port_code),
  label: `${item.port_name} (${item.port_code})`,
});


function rfqPortPillLabelFromApi(name: string | undefined, code: string) {
  const c = String(code ?? "").trim();
  if (!c) return "";
  const n = String(name ?? "").trim();
  return n ? `${n} (${c})` : `(${c})`;
}



/** Shared with single-port Pickup/Delivery fields — labels, radios, inputs, accordion headers */
const RFQ_FORM_FIELD_LABEL_STYLE = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#424242",
  fontFamily: "Inter",
  fontStyle: "medium",
} as const;

const RFQ_FORM_RADIO_GROUP_STYLES = {
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
    marginBottom: "4px",
    fontFamily: "Inter",
    fontStyle: "medium",
  },
};

const RFQ_FORM_RADIO_OPTION_STYLES = {
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
    marginBottom: "4px",
    fontFamily: "Inter",
    fontStyle: "medium",
  },
};

const RFQ_FORM_TEXT_INPUT_STYLES = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
    marginBottom: "4px",
    fontFamily: "Inter",
    fontStyle: "medium",
  },
};

const RFQ_FORM_ACCORDION_STYLES = {
  item: { borderColor: "#e9ecef" },
  control: {
    minHeight: 36,
    height: 36,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
    fontFamily: "Inter",
    fontStyle: "medium",
  },
  /** Collapse wrapper — remove extra vertical space */
  panel: {
    padding: 0,
    margin: 0,
  },
  /** Inner div — Mantine default is spacing-md; tighten top/bottom */
  content: {
    padding: "0 10px",
  },
  chevron: {
    color: "#424242",
    width: 16,
    height: 16,
  },
};

/** Check if a service row has multiple origins (used by payload builder). */
function rfqIsMultiOrigin(row: Record<string, unknown>): boolean {
  const codes = Array.isArray(row.origin_codes)
    ? (row.origin_codes as string[]).filter(Boolean)
    : [];
  return codes.length > 1;
}

/** Check if a service row has multiple destinations (used by payload builder). */
function rfqIsMultiDestination(row: Record<string, unknown>): boolean {
  const codes = Array.isArray(row.destination_codes)
    ? (row.destination_codes as string[]).filter(Boolean)
    : [];
  return codes.length > 1;
}

/** Same expansion rules as submit payload (single logical service row). */
function computeRfqExpandedPortPairsFromServiceDetail(serviceDetail: any): {
  origin_code: string;
  destination_code: string;
}[] {
  const sd = serviceDetail as any;
  const rfqOriginCodes = Array.isArray(sd.origin_codes)
    ? (sd.origin_codes as string[]).filter(Boolean)
    : [];
  const rfqDestinationCodes = Array.isArray(sd.destination_codes)
    ? (sd.destination_codes as string[]).filter(Boolean)
    : [];

  const originCodes =
    rfqOriginCodes.length > 0
      ? rfqOriginCodes
      : ([serviceDetail.origin_code].filter(Boolean) as string[]);
  const destinationCodes =
    rfqDestinationCodes.length > 0
      ? rfqDestinationCodes
      : ([serviceDetail.destination_code].filter(Boolean) as string[]);

  const o = originCodes.length ? originCodes : [""];
  const d = destinationCodes.length ? destinationCodes : [""];

  if (o.length > 1 && d.length <= 1) {
    return o.map((origin_code) => ({
      origin_code,
      destination_code: d[0] || "",
    }));
  }
  if (d.length > 1 && o.length <= 1) {
    return d.map((destination_code) => ({
      origin_code: o[0] || "",
      destination_code,
    }));
  }
  if (o.length > 1 && d.length > 1) {
    return o.flatMap((origin_code) =>
      d.map((destination_code) => ({ origin_code, destination_code }))
    );
  }
  return [{ origin_code: o[0] || "", destination_code: d[0] || "" }];
}

/** Map one expanded RFQ API service payload to the shape QuotationCreate expects (per origin/destination pair). */
function mapRfqApiPayloadToQuotationServiceRow(
  apiPayload: Record<string, any>,
  serviceDetail: any,
  index: number,
  pairId?: number | string | null
) {
  const oc = String(apiPayload.origin_code || "");
  const dc = String(apiPayload.destination_code || "");
  const originLabel =
    serviceDetail.origin_display_values?.[oc] ||
    rfqPortPillLabelFromApi(serviceDetail.origin_name, oc);
  const destLabel =
    serviceDetail.destination_display_values?.[dc] ||
    rfqPortPillLabelFromApi(serviceDetail.destination_name, dc);
  const originName =
    (String(originLabel).split(" (")[0] || "").trim() ||
      serviceDetail.origin_name ||
      "";
  const destName =
    (String(destLabel).split(" (")[0] || "").trim() ||
      serviceDetail.destination_name ||
      "";

  const numericId =
    pairId != null && pairId !== "" && !Number.isNaN(Number(pairId))
      ? Number(pairId)
      : 1000000 + index;

  let fclDetails: any[] | undefined;
  if (apiPayload.fcl_details && Array.isArray(apiPayload.fcl_details)) {
    fclDetails = apiPayload.fcl_details.map((fd: any) => ({
      id: fd.id,
      container_type: fd.container_type,
      container_type_code: fd.container_type,
      container_name: fd.container_type,
      no_of_containers: fd.no_of_containers,
      gross_weight: fd.gross_weight,
    }));
  }

  return {
    ...(serviceDetail.id && { id: serviceDetail.id } ),
    service: serviceDetail.service,
    trade: serviceDetail.trade,
    service_code: serviceDetail.service_code,
    service_name: serviceDetail.service_name,
    origin_code: oc,
    origin_code_read: oc,
    origin_name: originName,
    destination_code: dc,
    destination_code_read: dc,
    destination_name: destName,
    pickup: !!apiPayload.pickup,
    delivery: !!apiPayload.delivery,
    pickup_location: apiPayload.pickup_location || "",
    delivery_location: apiPayload.delivery_location || "",
    hazardous_cargo: !!apiPayload.hazardous_cargo,
    stackable: !!apiPayload.stackable,
    shipment_terms_code: serviceDetail.shipment_terms_code,
    shipment_terms_code_read: serviceDetail.shipment_terms_code,
    shipment_terms_name: "",
    icd: apiPayload.icd || "",
    service_remark: serviceDetail.service_remark,
    commodity: serviceDetail.commodity,
    fcl_details: fclDetails,
    no_of_packages: apiPayload.no_of_packages ?? null,
    gross_weight: apiPayload.gross_weight ?? null,
    volume_weight: apiPayload.volume_weight ?? null,
    chargeable_weight: apiPayload.chargeable_weight ?? null,
    volume: apiPayload.volume ?? null,
    chargeable_volume: apiPayload.chargeable_volume ?? null,
    dimension_data: apiPayload.dimension_details,
    dimension_unit: serviceDetail.dimension_unit,
    diemensions: serviceDetail.diemensions,
    cargo_details: serviceDetail.cargo_details,
  };
}

type RfqExpandedPayloadCtx = {
  otherServicesData: any[];
  getDimensionValue: (service: string, unit: string) => number;
  moduleLabel: string;
};

/** Same expansion as enquiry submit: one payload per origin/destination pair. */
function buildExpandedRfqServicePayloadsWithContext(
  serviceDetails: any[],
  isEdit: boolean,
  ctx: RfqExpandedPayloadCtx
): Array<{
  payload: any;
  serviceDetail: any;
  pairId?: number | string | null;
}> {
  const { otherServicesData, getDimensionValue, moduleLabel } = ctx;
  return serviceDetails.flatMap((serviceDetail) => {
    const cargo = serviceDetail.cargo_details[0];
    const servicePayloadBase: any = {
      service: serviceDetail.service,
      pickup: serviceDetail.pickup === "true",
      delivery: serviceDetail.delivery === "true",
      pickup_location: serviceDetail.pickup_location,
      delivery_location: serviceDetail.delivery_location,
      hazardous_cargo: cargo?.hazardous_cargo === "Yes",
      stackable: cargo?.stackable === "Yes",
      shipment_terms_code: serviceDetail.shipment_terms_code,
      icd: serviceDetail.icd || "",
      service_remark: serviceDetail.service_remark,
      commodity: serviceDetail.commodity,
    };

    servicePayloadBase.un_no =
      cargo?.hazardous_cargo === "Yes" ? cargo?.un_no || null : null;
    servicePayloadBase.class_name =
      cargo?.hazardous_cargo === "Yes" ? cargo?.class || null : null;
    servicePayloadBase.pkg_group =
      cargo?.hazardous_cargo === "Yes" ? cargo?.pkg_group || null : null;

    if (serviceDetail.service === "OTHERS") {
      servicePayloadBase.service_name = serviceDetail.service_name || "";
      servicePayloadBase.service_code = serviceDetail.service_code || "";
      servicePayloadBase.trade = isOtherServiceInland(
        serviceDetail.service_code,
        otherServicesData,
      )
        ? serviceDetail.trade
        : null;
    } else {
      servicePayloadBase.trade = serviceDetail.trade;
    }

    const useRfqMultiRowNoExpand =
      moduleLabel === "RFQ" && serviceDetails.length > 1;

    let expandedPairs: { origin_code: string; destination_code: string }[];

    if (useRfqMultiRowNoExpand) {
      const sd = serviceDetail as any;
      const oc =
        Array.isArray(sd.origin_codes) && sd.origin_codes.length > 0
          ? String(sd.origin_codes[0])
          : String(serviceDetail.origin_code || "");
      const dc =
        Array.isArray(sd.destination_codes) && sd.destination_codes.length > 0
          ? String(sd.destination_codes[0])
          : String(serviceDetail.destination_code || "");
      expandedPairs = [{ origin_code: oc, destination_code: dc }];
    } else {
      expandedPairs = computeRfqExpandedPortPairsFromServiceDetail(serviceDetail);
    }

    const singleExpandedPair = expandedPairs.length === 1;

    const buildServicePayload = (
      origin_code: string,
      destination_code: string,
      pairId?: number | string | null
    ) => {
      const servicePayload: any = {
        ...servicePayloadBase,
        origin_code,
        destination_code,
      };

      const sdRow = serviceDetail as Record<string, unknown>;
      let pickupBool = serviceDetail.pickup === "true";
      let pickupLoc = String(serviceDetail.pickup_location || "").trim();
      let deliveryBool = serviceDetail.delivery === "true";
      let deliveryLoc = String(serviceDetail.delivery_location || "").trim();
      if (rfqIsMultiOrigin(sdRow)) {
        const pf =
          (serviceDetail as { pickup_flags_by_origin?: Record<string, string> })
            .pickup_flags_by_origin || {};
        const pl =
          (serviceDetail as { pickup_locations_by_origin?: Record<string, string> })
            .pickup_locations_by_origin || {};
        pickupBool = pf[origin_code] === "true";
        pickupLoc = pickupBool ? String(pl[origin_code] || "").trim() : "";
      }
      if (rfqIsMultiDestination(sdRow)) {
        const df =
          (serviceDetail as {
            delivery_flags_by_destination?: Record<string, string>;
          }).delivery_flags_by_destination || {};
        const dl =
          (serviceDetail as {
            delivery_locations_by_destination?: Record<string, string>;
          }).delivery_locations_by_destination || {};
        deliveryBool = df[destination_code] === "true";
        deliveryLoc = deliveryBool
          ? String(dl[destination_code] || "").trim()
          : "";
      }
      servicePayload.pickup = pickupBool;
      servicePayload.pickup_location = pickupLoc;
      servicePayload.delivery = deliveryBool;
      servicePayload.delivery_location = deliveryLoc;

      if (isEdit) {
        const refs = (serviceDetail as any).rfq_port_pair_refs as
          | Array<{
              id?: number | string;
              origin_code: string;
              destination_code: string;
            }>
          | undefined;
        if (pairId != null && pairId !== "") {
          servicePayload.id = pairId;
        } else if (
          singleExpandedPair &&
          (serviceDetail as any).id &&
          !refs?.length
        ) {
          servicePayload.id = (serviceDetail as any).id;
        }
      }

      let effectiveServiceType = serviceDetail.service;
      if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
        effectiveServiceType = resolveEffectiveServiceType(
          serviceDetail.service,
          serviceDetail.service_code,
          otherServicesData,
        );
      }

      if (effectiveServiceType === "FCL") {
        servicePayload.fcl_details = serviceDetail.cargo_details.map(
          (cargoRow: any) => {
            const fclDetail: any = {
              container_type: cargoRow.container_type_code,
              no_of_containers: Math.trunc(
                Number(cargoRow.no_of_containers) || 0
              ),
              gross_weight: roundToDecimals(cargoRow.gross_weight, 3) ?? 0,
            };
            if (cargoRow.id) {
              fclDetail.id = cargoRow.id;
            }
            return fclDetail;
          }
        );
      } else if (usesAirCargoStructure(effectiveServiceType)) {
        const cargoRow = serviceDetail.cargo_details[0];
        servicePayload.no_of_packages = Math.trunc(
          Number(cargoRow.no_of_packages) || 0
        );
        servicePayload.gross_weight =
          roundToDecimals(cargoRow.gross_weight, 3) ?? 0;
        servicePayload.volume_weight =
          roundToDecimals(cargoRow.volume_weight, 3) ?? 0;
        servicePayload.chargeable_weight =
          roundToDecimals(cargoRow.chargable_weight, 3) ?? 0;
        const dimUnit = serviceDetail.dimension_unit || "";
        const dimRows = Array.isArray(serviceDetail.diemensions)
          ? serviceDetail.diemensions
          : [];
        if (dimUnit && dimRows.length > 0) {
          servicePayload.dimension_details = dimRows.map((r: any) => {
            const dimensionItem: any = {
              pieces: Math.trunc(Number(r?.pieces) || 0),
              length: roundToDecimals(r?.length, 2) ?? 0,
              width: roundToDecimals(r?.width, 2) ?? 0,
              height: roundToDecimals(r?.height, 2) ?? 0,
              value:
                roundToDecimals(
                  Number(r?.value) || getDimensionValue("AIR", dimUnit) || 0,
                  2
                ) ?? 0,
              volume_weight: roundToDecimals(r?.vol_weight, 3) ?? 0,
              dimension_unit: dimUnit,
            };
            if (r?.id) {
              dimensionItem.id = r.id;
            }
            return dimensionItem;
          });
        }
      } else if (effectiveServiceType === "LCL") {
        const cargoRow = serviceDetail.cargo_details[0];
        servicePayload.no_of_packages = Math.trunc(
          Number(cargoRow.no_of_packages) || 0
        );
        servicePayload.gross_weight =
          roundToDecimals(cargoRow.gross_weight, 3) ?? 0;
        servicePayload.volume = roundToDecimals(cargoRow.volume, 3) ?? 0;
        servicePayload.chargeable_volume =
          roundToDecimals(cargoRow.chargable_volume, 3) ?? 0;
        const dimUnit = serviceDetail.dimension_unit || "";
        const dimRows = Array.isArray(serviceDetail.diemensions)
          ? serviceDetail.diemensions
          : [];
        if (dimUnit && dimRows.length > 0) {
          servicePayload.dimension_details = dimRows.map((r: any) => {
            const dimensionItem: any = {
              pieces: Math.trunc(Number(r?.pieces) || 0),
              length: roundToDecimals(r?.length, 2) ?? 0,
              width: roundToDecimals(r?.width, 2) ?? 0,
              height: roundToDecimals(r?.height, 2) ?? 0,
              value:
                roundToDecimals(
                  Number(r?.value) || getDimensionValue("LCL", dimUnit) || 0,
                  2
                ) ?? 0,
              volume_weight: roundToDecimals(r?.vol_weight, 3) ?? 0,
              dimension_unit: dimUnit,
            };
            if (r?.id) {
              dimensionItem.id = r.id;
            }
            return dimensionItem;
          });
        }
      }

      return servicePayload;
    };

    return expandedPairs.map((p) => {
      const pairId = (serviceDetail as any).rfq_port_pair_refs?.find(
        (r: {
          id?: number | string;
          origin_code: string;
          destination_code: string;
        }) =>
          String(r.origin_code) === String(p.origin_code) &&
          String(r.destination_code) === String(p.destination_code)
      )?.id;
      return {
        payload: buildServicePayload(p.origin_code, p.destination_code, pairId),
        serviceDetail,
        pairId: pairId ?? null,
      };
    });
  });
}

function pruneRfqPortPairRefs(
  refs:
    | Array<{ id?: number | string; origin_code: string; destination_code: string }>
    | undefined,
  pairs: { origin_code: string; destination_code: string }[]
): Array<{ id?: number | string; origin_code: string; destination_code: string }> {
  if (!refs?.length) return [];
  const set = new Set(
    pairs.map((p) => `${String(p.origin_code)}|${String(p.destination_code)}`)
  );
  return refs.filter((r) =>
    set.has(`${String(r.origin_code)}|${String(r.destination_code)}`)
  );
}

function rfqServiceRowSignatureExcludingPorts(s: Record<string, unknown>): string {
  const stripIdsDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripIdsDeep);
    if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      Object.keys(o).forEach((k) => {
        if (k === "id") return;
        out[k] = stripIdsDeep(o[k]);
      });
      return out;
    }
    return value;
  };
  return JSON.stringify(
    stripIdsDeep({
      service: s.service,
      trade: s.trade,
      service_code: s.service_code,
      service_name: s.service_name,
      // Omit pickup/delivery so multi-port rows that differ only by port-level address merge
      service_remark: s.service_remark,
      commodity: s.commodity,
      shipment_terms_code: s.shipment_terms_code,
      icd: s.icd,
      dimension_unit: s.dimension_unit,
      diemensions: s.diemensions,
      cargo_details: s.cargo_details,
    })
  );
}

function shouldMergeRfqPortBlock(
  block: any[]
): "multiOrigin" | "multiDest" | null {
  if (block.length < 2) return null;
  const dests = block.map((r) => String(r.destination_code || "").trim());
  const origins = block.map((r) => String(r.origin_code || "").trim());
  const uo = new Set(origins.filter(Boolean));
  const ud = new Set(dests.filter(Boolean));
  if (uo.size > 1 && ud.size <= 1) {
    const onlyDest = [...ud][0] ?? "";
    if (block.every((r) => String(r.destination_code || "").trim() === onlyDest)) {
      return "multiOrigin";
    }
  }
  if (ud.size > 1 && uo.size <= 1) {
    const onlyOrigin = [...uo][0] ?? "";
    if (block.every((r) => String(r.origin_code || "").trim() === onlyOrigin)) {
      return "multiDest";
    }
  }
  return null;
}

function mergeRfqPortBlock(block: any[], mode: "multiOrigin" | "multiDest"): any {
  const merged = { ...block[0] };
  const pairRefs: Array<{
    id?: number | string;
    origin_code: string;
    destination_code: string;
  }> = [];

  const originOrder: string[] = [];
  const destOrder: string[] = [];
  const originDisp: Record<string, string> = {};
  const destDisp: Record<string, string> = {};

  for (const row of block) {
    const oc = String(row.origin_code || "").trim();
    const dc = String(row.destination_code || "").trim();
    pairRefs.push({
      id: row.id,
      origin_code: oc,
      destination_code: dc,
    });
    if (oc && !originOrder.includes(oc)) originOrder.push(oc);
    if (dc && !destOrder.includes(dc)) destOrder.push(dc);
    if (oc) {
      const fromRow = row.origin_display_values?.[oc];
      originDisp[oc] =
        fromRow ||
        rfqPortPillLabelFromApi(row.origin_name || row.origin_port_name, oc);
    }
    if (dc) {
      const fromRow = row.destination_display_values?.[dc];
      destDisp[dc] =
        fromRow ||
        rfqPortPillLabelFromApi(
          row.destination_name || row.destination_port_name,
          dc
        );
    }
  }

  if (mode === "multiOrigin") {
    merged.origin_codes = originOrder;
    merged.destination_codes = destOrder.length ? destOrder : [""];
    merged.origin_code = originOrder[0] || "";
    merged.destination_code = merged.destination_codes[0] || "";
  } else {
    merged.origin_codes = originOrder.length ? originOrder : [""];
    merged.destination_codes = destOrder;
    merged.origin_code = merged.origin_codes[0] || "";
    merged.destination_code = destOrder[0] || "";
  }

  merged.origin_display_values = originDisp;
  merged.destination_display_values = destDisp;
  merged.rfq_port_pair_refs = pairRefs;
  merged.id = block[0].id;

  const pickup_flags_by_origin: Record<string, "true" | "false"> = {};
  const pickup_locations_by_origin: Record<string, string> = {};
  const delivery_flags_by_destination: Record<string, "true" | "false"> = {};
  const delivery_locations_by_destination: Record<string, string> = {};

  for (const row of block) {
    const oc = String(row.origin_code || "").trim();
    const dc = String(row.destination_code || "").trim();
    if (mode === "multiOrigin" && oc) {
      pickup_flags_by_origin[oc] =
        row.pickup === true || row.pickup === "true" ? "true" : "false";
      pickup_locations_by_origin[oc] = row.pickup_location || "";
    }
    if (mode === "multiDest" && dc) {
      delivery_flags_by_destination[dc] =
        row.delivery === true || row.delivery === "true" ? "true" : "false";
      delivery_locations_by_destination[dc] = row.delivery_location || "";
    }
  }

  if (mode === "multiOrigin") {
    merged.pickup_flags_by_origin = pickup_flags_by_origin;
    merged.pickup_locations_by_origin = pickup_locations_by_origin;
    merged.pickup = "false";
    merged.pickup_location = "";
    merged.delivery_flags_by_destination = {};
    merged.delivery_locations_by_destination = {};
    merged.delivery =
      block[0].delivery === true || block[0].delivery === "true"
        ? "true"
        : "false";
    merged.delivery_location = block[0].delivery_location || "";
  } else {
    merged.delivery_flags_by_destination = delivery_flags_by_destination;
    merged.delivery_locations_by_destination = delivery_locations_by_destination;
    merged.delivery = "false";
    merged.delivery_location = "";
    merged.pickup_flags_by_origin = {};
    merged.pickup_locations_by_origin = {};
    merged.pickup =
      block[0].pickup === true || block[0].pickup === "true"
        ? "true"
        : "false";
    merged.pickup_location = block[0].pickup_location || "";
  }

  merged.origin_name =
    (merged.origin_display_values?.[merged.origin_code] || "")
      .split(" (")[0]
      ?.trim() || "";
  merged.destination_name =
    (merged.destination_display_values?.[merged.destination_code] || "")
      .split(" (")[0]
      ?.trim() || "";
  return merged;
}

/** Edit load: collapse API rows that differ only by origin/destination into one multi-select row. */
function mergeRfqCombinableServices(rows: any[]): any[] {
  if (rows.length < 2) return rows;
  const result: any[] = [];
  let i = 0;
  while (i < rows.length) {
    const sig0 = rfqServiceRowSignatureExcludingPorts(
      rows[i] as Record<string, unknown>
    );
    const block: any[] = [rows[i]];
    let j = i + 1;
    while (j < rows.length) {
      const sig = rfqServiceRowSignatureExcludingPorts(
        rows[j] as Record<string, unknown>
      );
      if (sig !== sig0) break;
      block.push(rows[j]);
      j++;
    }
    if (block.length === 1) {
      result.push(block[0]);
    } else {
      const mode = shouldMergeRfqPortBlock(block);
      if (mode) {
        result.push(mergeRfqPortBlock(block, mode));
      } else {
        block.forEach((r) => result.push(r));
      }
    }
    i = j;
  }
  return result;
}

const getCustomerFormSchema = (moduleLabel: string) =>
  yup.object({
    customer_code: yup.string().required("Customer code is required"),
    enquiry_received_date: yup
      .string()
      .required(`${moduleLabel} received date is required`),
    sales_person: yup.string().required("Sales person is required"),
    sales_coordinator: yup.string().nullable().optional(),
    customer_services: yup.string().nullable().optional(),
    reference_no: yup
      .string()
      .nullable()
      .optional()
      .max(100, "Reference number cannot exceed 100 characters"),
    customer_address: yup.string().nullable().optional(),
    network_id: yup.string().nullable().optional(),
    network_name: yup.string().nullable().optional(),
  });

const serviceFormSchema = yup.object({
  service_details: yup
    .array()
    .of(
      yup.object({
        id: yup.string().optional(),
        service: yup
          .string()
          .required("Service is required")
          .oneOf(["AIR", "FCL", "LCL", "OTHERS"], "Select service"),
        trade: yup.string().when("service", {
          is: (service: string) => service !== "OTHERS",
          then: (schema) => schema.required("Trade is required"),
          otherwise: (schema) => schema.nullable(),
        }),
        service_code: yup.string().when("service", {
          is: "OTHERS",
          then: (schema) => schema.required("Service name is required"),
          otherwise: (schema) => schema.nullable(),
        }),
        service_name: yup.string().when("service", {
          is: "OTHERS",
          then: (schema) => schema.optional(),
          otherwise: (schema) => schema.nullable(),
        }),
        origin_code: yup.string().required("Origin is required"),
        origin_name: yup.string().optional(),
        destination_code: yup.string().required("Destination is required"),
        destination_name: yup.string().optional(),
        pickup: yup.string().oneOf(["true", "false"]),
        delivery: yup.string().oneOf(["true", "false"]),
        service_remark: yup.string().optional(),
        commodity: yup.string().optional(),
        shipment_terms_code: yup
          .string()
          .required("Shipment terms are required"),
        icd: yup.string().optional(),

        pickup_location: yup
          .string()
          .when("pickup", {
            is: "true",
            then: (schema) =>
              schema.test(
                "pickup-loc-single",
                "Pickup location is required",
                function (value) {
                  const p = this.parent as {
                    origin_codes?: string[];
                    pickup?: string;
                  };
                  const oc = Array.isArray(p.origin_codes)
                    ? p.origin_codes.filter(Boolean)
                    : [];
                  if (oc.length > 1) return true;
                  return !!(value && String(value).trim());
                }
              ),
            otherwise: (schema) => schema.optional(),
          }),

        delivery_location: yup
          .string()
          .when("delivery", {
            is: "true",
            then: (schema) =>
              schema.test(
                "del-loc-single",
                "Delivery location is required",
                function (value) {
                  const p = this.parent as {
                    destination_codes?: string[];
                    delivery?: string;
                  };
                  const dc = Array.isArray(p.destination_codes)
                    ? p.destination_codes.filter(Boolean)
                    : [];
                  if (dc.length > 1) return true;
                  return !!(value && String(value).trim());
                }
              ),
            otherwise: (schema) => schema.optional(),
          }),

        pickup_flags_by_origin: yup.object().optional(),
        pickup_locations_by_origin: yup.object().optional(),
        delivery_flags_by_destination: yup.object().optional(),
        delivery_locations_by_destination: yup.object().optional(),

        cargo_details: yup
          .array()
          .of(
            yup.object({
              no_of_packages: yup.number().when("$service", {
                is: (service: string) => service === "AIR" || service === "LCL",
                then: (schema) =>
                  schema
                    .required("Number of packages is required")
                    .min(1, "Must be at least 1")
                    .integer("No decimals allowed")
                    .typeError("Must be a whole number")
                    .test(
                      "max-digits",
                      "Maximum 10 digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value)
                        ).toString();
                        return integerPart.length <= 10;
                      }
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              gross_weight: yup.number().when("$service", {
                is: (service: string) =>
                  service === "AIR" || service === "LCL" || service === "FCL",
                then: (schema) =>
                  schema
                    .required("Gross weight is required")
                    .min(0.01, "Must be greater than 0")
                    .test(
                      "decimal-places",
                      "Maximum 3 decimal places allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const decimalPart = String(value).split(".")[1];
                        return !decimalPart || decimalPart.length <= 3;
                      }
                    )
                    .test(
                      "max-digits",
                      "Maximum 8 integer digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value)
                        ).toString();
                        return integerPart.length <= 8;
                      }
                    )
                    .test(
                      "max-total-digits",
                      "Maximum 10 digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const valueStr = String(value).replace(/[^0-9]/g, "");
                        return valueStr.length <= 10;
                      }
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              volume_weight: yup.number().when("$service", {
                is: (service: string) => service === "AIR",
                then: (schema) =>
                  schema
                    .required("Volume weight is required")
                    .min(0.01, "Must be greater than 0")
                    .test(
                      "decimal-places",
                      "Maximum 3 decimal places allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const decimalPart = String(value).split(".")[1];
                        return !decimalPart || decimalPart.length <= 3;
                      }
                    )
                    .test(
                      "max-digits",
                      "Maximum 8 integer digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value)
                        ).toString();
                        return integerPart.length <= 8;
                      }
                    )
                    .test(
                      "max-total-digits",
                      "Maximum 10 digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const valueStr = String(value).replace(/[^0-9]/g, "");
                        return valueStr.length <= 10;
                      }
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              chargable_weight: yup
                .number()
                .nullable()
                // No validation needed - this is auto-calculated from gross_weight and volume_weight
                // Validation errors will appear in the source fields instead
                .optional(),
              volume: yup.number().when("$service", {
                is: (service: string) => service === "LCL",
                then: (schema) =>
                  schema
                    .required("Volume is required")
                    .min(0.01, "Must be greater than 0")
                    .test(
                      "decimal-places",
                      "Maximum 3 decimal places allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const decimalPart = String(value).split(".")[1];
                        return !decimalPart || decimalPart.length <= 3;
                      }
                    )
                    .test("max-integer-digits", "Maximum 7 integer digits allowed", (value) => {
                      if (value === undefined || value === null) return true;
                      const integerPart = Math.floor(
                        Math.abs(value)
                      ).toString();
                      return integerPart.length <= 7;
                    })
                    .test("max-total-digits", "Maximum 10 digits in total allowed", (value) => {
                      if (value === undefined || value === null) return true;
                      const valueStr = String(value).replace(".", "");
                      return valueStr.length <= 10;
                    }),
                otherwise: (schema) => schema.nullable(),
              }),
              chargable_volume: yup
                .number()
                .nullable()
                .test(
                  "decimal-places",
                  "Maximum 3 decimal places allowed",
                  (value) => {
                    if (value === undefined || value === null) return true;
                    const decimalPart = String(value).split(".")[1];
                    return !decimalPart || decimalPart.length <= 3;
                  }
                )
                .test("max-integer-digits", "Maximum 7 integer digits allowed", (value) => {
                  if (value === undefined || value === null) return true;
                  const integerPart = Math.floor(Math.abs(value)).toString();
                  return integerPart.length <= 7;
                })
                .test("max-total-digits", "Maximum 10 digits in total allowed", (value) => {
                  if (value === undefined || value === null) return true;
                  const valueStr = String(value).replace(".", "");
                  return valueStr.length <= 10;
                })
                // No validation needed - this is auto-calculated from gross_weight and volume
                // Validation errors will appear in the source fields instead
                .optional(),
              container_type_code: yup.string().when("$service", {
                is: (service: string) => service === "FCL",
                then: (schema) => schema.required("Container type is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              no_of_containers: yup.number().when("$service", {
                is: (service: string) => service === "FCL",
                then: (schema) =>
                  schema
                    .required("Number of containers is required")
                    .min(1, "Must be at least 1")
                    // .integer("No decimals allowed")
                    .typeError("Must be a whole number"),
                // .test(
                //   "max-digits",
                //   "Maximum 10 digits allowed",
                //   (value) => {
                //     if (value === undefined || value === null) return true;
                //     const integerPart = Math.floor(
                //       Math.abs(value)
                //     ).toString();
                //     return integerPart.length <= 10;
                //   }
                // ),
                otherwise: (schema) => schema.nullable(),
              }),
              hazardous_cargo: yup
                .string()
                .required("Hazardous cargo is required"),
              un_no: yup.string().when("hazardous_cargo", {
                is: (value: string) => value === "Yes",
                then: (schema) => schema.required("UN no is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              class: yup.string().when("hazardous_cargo", {
                is: (value: string) => value === "Yes",
                then: (schema) => schema.required("Class is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              pkg_group: yup.string().when("hazardous_cargo", {
                is: (value: string) => value === "Yes",
                then: (schema) => schema.required("PKG Group is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              stackable: yup.string().required("Stackable cargo is required"),
            })
          )
          .min(1, "At least one cargo detail is required"),
      })
    )
    .min(1, "At least one service detail is required"),
});

const fetchEnquiry = async () => {
  try {
    const requestBody = { filters: { status: "ACTIVE" } };

    const response = await apiCallProtected.post(
      `${URL.enquiryFilter}`,
      requestBody
    );
    console.log("fetchEnquiry check=", response);
    return response;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};
const fetchQuotation = async () => {
  try {
    const requestBody = { filters: { status: "ACTIVE" } };
    const response = await apiCallProtected.post(
      `${URL.quotationFilter}`,
      requestBody
    );
    console.log("fetchQuotation check=", response);
    return response;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// Remove fetchPortMaster as we'll use SearchableSelect instead
// const fetchPortMaster = async () => {
//   const response = await getAPICall(`${URL.portMaster}`, API_HEADER);
//   // console.log("Porttttt response-----", response);
//   return response?.data;
// };

const fetchTermsofShipment = async () => {
  const response = await getAPICall(`${URL.termsOfShipment}`, API_HEADER);
  // console.log("fetchTermsofShipment response----", response);
  return response;
};

const fetchContainerType = async () => {
  const response = await getAPICall(`${URL.containerType}`, API_HEADER);
  console.log("containerType----", response);
  return response;
};

const fetchIcdData = async () => {
  try {
    const response = (await postAPICall(
      URL.icdMasterFilter,
      { filters: {} },
      API_HEADER,
    )) as { data?: Array<{ icd_name?: string; icd_code?: string }> };
    return response?.data ?? [];
  } catch (error) {
    console.error("Error fetching ICD master:", error);
    return [];
  }
};

const fetchSalespersons = async (customerId: string = "") => {
  const payload = {
    customer_code: customerId,
  };
  console.log(
    "🔍 Fetching salespersons with payload:",
    payload,
    "URL:",
    URL.salespersons,
    "Timestamp:",
    new Date().toISOString()
  );
  const response = await postAPICall(URL.salespersons, payload, API_HEADER);
  console.log("📊 Salespersons response:", response);
  return response;
};

const fetchOtherServices = async () => {
  const response = await getAPICall(
    `${URL.serviceMaster}?filter=other_services`,
    API_HEADER
  );
  return response;
};

function RFQCreate() {
  const moduleLabel = "RFQ";
  const moduleKeyPrefix = "RFQ";
  const moduleListPath = "/rfq";
  const location = useLocation();
  const [enq, setEnq] = useState(location.state || null);
  const queryBase = moduleKeyPrefix.toLowerCase();
  const modulePluralKey = queryBase === "enquiry" ? "enquiries" : `${queryBase}s`;
  const moduleFilteredPluralKey = `filtered${modulePluralKey.charAt(0).toUpperCase()}${modulePluralKey.slice(1)}`;
  const lastModulePluralDisplay =
    moduleLabel === "Enquiry" ? "Enquiries" : `${moduleLabel}s`;
  // Initialize active step based on targetStep from navigation or default to 0
  const [active, setActive] = useState((enq as any)?.targetStep ?? 0);
  // Initialize showQuotation based on actionType for edit quotation and create quote flows
  const [showQuotation, setShowQuotation] = useState(
    enq?.actionType === "editQuotation" || enq?.actionType === "createQuote"
  );
  const showEditAuditInfo = useMemo(() => {
    if (!enq) return false;
    if (enq.actionType === "createQuote") return false;
    if (enq.actionType === "edit" || enq.actionType === "editQuotation") {
      return true;
    }
    return Boolean(enq.id || enq.enquiry_id);
  }, [enq]);
  const enquiryAuditInfo = useMemo(
    () => normalizeEditPageAuditInfo(enq),
    [enq],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditInfoHovered, setAuditInfoHovered] = useState(false);
  const [
    documentsModalOpened,
    { open: openDocumentsModal, close: closeDocumentsModal },
  ] = useDisclosure(false);
  const [fileErrors, setFileErrors] = useState<{ [key: number]: string }>({});
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  const navigate = useNavigate();

  // Helper function to download file from URL
  const downloadFile = (url: string, fileName: string) => {
    // Simply open the document_url directly
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const queryClient = useQueryClient(); // Add this line to get query client
  const { user } = useAuthStore();

  // State for salesperson confirmation modal
  const [
    salespersonModalOpened,
    { open: openSalespersonModal, close: closeSalespersonModal },
  ] = useDisclosure(false);
  const [salespersonModalData, setSalespersonModalData] =
    useState<SalespersonData | null>(null);
  const [isCheckingSalesperson, setIsCheckingSalesperson] = useState(false);
  const [lastCheckedServiceIndex, setLastCheckedServiceIndex] = useState<
    number | null
  >(null);
  // Track service indices that have already been processed (user made a decision)
  const [processedServiceIndices, setProcessedServiceIndices] = useState<
    Set<number>
  >(new Set());

  const { data: termsOfShipment = [] } = useQuery({
    queryKey: ["tosData"],
    queryFn: fetchTermsofShipment,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const { data: icdData = [] } = useQuery({
    queryKey: ["icdData"],
    queryFn: fetchIcdData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(termsOfShipment) || !termsOfShipment.length) return [];
    return termsOfShipment.map((item: any) => ({
      value: item.tos_code ? String(item.tos_code) : "",
      label: `${item.tos_name} (${item.tos_code})`,
    }));
  }, [termsOfShipment]);

  const icdOptions = useMemo(() => {
    if (!Array.isArray(icdData) || !icdData.length) return [];
    return icdData.map((item: { icd_name?: string; icd_code?: string }) => ({
      value: item.icd_code ? String(item.icd_code) : "",
      label: item.icd_name || item.icd_code || "",
    }));
  }, [icdData]);

  const customerFormSchema = useMemo(
    () => getCustomerFormSchema(moduleLabel),
    [moduleLabel],
  );

  // Customer Form
  const customerForm = useForm({
    initialValues: {
      customer_code: "",
      enquiry_received_date: dayjs().format("YYYY-MM-DD"),
      sales_person: "",
      sales_coordinator: "",
      customer_services: "",
      reference_no: "",
      customer_address: "",
      network_id: "",
      network_name: "",
      supporting_documents: [] as Array<{
        name: string;
        file: File | null;
        document_url?: string;
        document_id?: number;
        original_document_name?: string; // Store original name to detect changes
      }>,
    },
    validate: yupResolver(customerFormSchema),
  });

  // Service Form
  const serviceForm = useForm({
    initialValues: {
      service_details: [
        {
          service: "",
          trade: "",
          service_code: "",
          service_name: "",
          origin_code: "",
          origin_name: "",
          origin_codes: [] as string[],
          origin_display_values: {} as Record<string, string>,
          destination_code: "",
          destination_name: "",
          destination_codes: [] as string[],
          destination_display_values: {} as Record<string, string>,
          rfq_port_pair_refs: [] as Array<{
            id?: number | string;
            origin_code: string;
            destination_code: string;
          }>,
          pickup: "false",
          delivery: "false",
          pickup_location: "",
          delivery_location: "",
          pickup_flags_by_origin: {} as Record<string, "true" | "false">,
          pickup_locations_by_origin: {} as Record<string, string>,
          delivery_flags_by_destination: {} as Record<string, "true" | "false">,
          delivery_locations_by_destination: {} as Record<string, string>,
          shipment_terms_code: "",
          icd: "", // Added ICD field
          service_remark: "", // Added service remark field
          commodity: "", // Added commodity description field
          dimension_unit: "Centimeter",
          diemensions: [],
          cargo_details: [
            {
              id: null,
              no_of_packages: null,
              gross_weight: null,
              volume_weight: null,
              chargable_weight: null,
              volume: null,
              chargable_volume: null,
              container_type_code: null,
              no_of_containers: null,
              hazardous_cargo: "No",
              un_no: null,
              class: null,
              pkg_group: null,
              stackable: "Yes",
            },
          ],
        },
      ],
    },
    validate: yupResolver(serviceFormSchema),
  });

  // Calculate chargeable volume for LCL service
  const calculateChargeableVolume = useCallback(
    (grossWeight: number | null, volume: number | null): number => {
      if (!grossWeight && !volume) return 0;

      const grossWeightInCbm = grossWeight ? grossWeight / 1000 : 0;
      const volumeInCbm = volume || 0;

      return Math.max(grossWeightInCbm, volumeInCbm);
    },
    []
  );

  // Calculate chargeable weight for AIR service (max of gross weight and volume weight)
  const calculateChargeableWeight = useCallback(
    (grossWeight: number | null, volumeWeight: number | null): number => {
      if (!grossWeight && !volumeWeight) return 0;
      const gross = grossWeight || 0;
      const volume = volumeWeight || 0;
      return Math.max(gross, volume);
    },
    []
  );

  // Debounced function to update chargeable volume and chargeable weight - prevents excessive recalculations
  const debouncedUpdateChargeableValues = useDebouncedCallback(() => {
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        // Safety check: ensure cargo_details exists and has at least one item
        if (
          !serviceDetail.cargo_details ||
          !Array.isArray(serviceDetail.cargo_details) ||
          serviceDetail.cargo_details.length === 0
        ) {
          return; // Skip if no cargo details
        }

        const cargo = serviceDetail.cargo_details[0];
        if (!cargo) {
          return; // Skip if cargo is undefined
        }

        // Determine effective service type inline for OTHERS services
        let effectiveServiceType = serviceDetail.service;
        if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
          // Access otherServicesData from closure (will be available when function executes)
          const selectedOtherService = (otherServicesData || []).find(
            (item: any) => item.value === serviceDetail.service_code
          );
          if (selectedOtherService) {
            const transportMode = selectedOtherService.transport_mode || "";
            const fullGroupage = selectedOtherService.full_groupage || "";
            effectiveServiceType = resolveEffectiveServiceFromTransport(
              transportMode,
              fullGroupage,
            );
          }
        }

        if (effectiveServiceType === "LCL") {
          const grossWeight = Number(cargo.gross_weight) || null;
          const volume = Number(cargo.volume) || null;

          if (grossWeight || volume) {
            const chargeableVolume = calculateChargeableVolume(
              grossWeight,
              volume
            );
            const currentValue = cargo.chargable_volume;

            // Only update if the value actually changed to prevent unnecessary re-renders
            if (currentValue !== chargeableVolume) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
                chargeableVolume
              );
            }
          } else {
            // Clear chargeable volume if both inputs are empty
            if (cargo.chargable_volume !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
                null
              );
            }
          }
          // Clear chargeable weight when service is LCL
          if (cargo && cargo.chargable_weight !== null) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
              null
            );
          }
        } else if (usesAirCargoStructure(effectiveServiceType)) {
          const grossWeight = Number(cargo.gross_weight) || null;
          const volumeWeight = Number(cargo.volume_weight) || null;

          if (grossWeight || volumeWeight) {
            const chargeableWeight = calculateChargeableWeight(
              grossWeight,
              volumeWeight
            );
            const currentValue = cargo.chargable_weight;

            // Only update if the value actually changed to prevent unnecessary re-renders
            if (currentValue !== chargeableWeight) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
                chargeableWeight
              );
            }
          } else {
            // Clear chargeable weight if both inputs are empty
            if (cargo.chargable_weight !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
                null
              );
            }
          }
          // Clear chargeable volume when service is AIR
          if (cargo && cargo.chargable_volume !== null) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
              null
            );
          }
        } else {
          // Clear chargeable values when service is neither LCL nor AIR
          if (cargo) {
            if (cargo.chargable_volume !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
                null
              );
            }
            if (cargo.chargable_weight !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
                null
              );
            }
          }
        }
      }
    );
  }, 300);

  // Optimized effect to recalculate chargeable values when cargo inputs change
  // Track only the cargo fields that affect chargeable calculations
  const cargoValuesKey = useMemo(() => {
    return serviceForm.values.service_details
      .map((s, idx) => {
        const cargo = s.cargo_details[0];
        if (!cargo) return `${idx}:empty`;
        return `${idx}:${s.service}:${cargo.gross_weight || 0}:${cargo.volume_weight || 0}:${cargo.volume || 0}`;
      })
      .join("||");
  }, [serviceForm.values.service_details]);

  useEffect(() => {
    debouncedUpdateChargeableValues();
  }, [cargoValuesKey, debouncedUpdateChargeableValues]);

  // Dimension helper functions
  // const getDimensionValue = useCallback(
  //   (service: string, unit: string): number => {
  //     const u = (unit || "").toLowerCase();
  //     if (service === "LCL") {
  //       if (u === "inch" || u === "inches") return 1000000;
  //       if (u === "centimeter" || u === "cm" || u === "centimeters")
  //         return 0.000016387064;
  //     }
  //     if (service === "AIR") {
  //       if (u === "inch" || u === "inches") return 366.0;
  //       if (u === "centimeter" || u === "cm" || u === "centimeters")
  //         return 6000.0;
  //     }
  //     return 0;
  //   },
  //   []
  // );
  const getDimensionValue = useCallback(
    (service: string, unit: string): number => {
      if (!unit) return 0;

      const serviceOption = DIMENSION_UNIT_OPTIONS.find(
        (option) => option.service === service
      );

      if (serviceOption) {
        const unitOption = serviceOption.unit_value.find(
          (unitItem) => unitItem.Label === unit
        );
        return unitOption ? unitOption.value : 0;
      }

      return 0;
    },
    []
  );

  const roundVol = useCallback((val: number): number => {
    if (!isFinite(val)) return 0;
    const frac = val - Math.trunc(val);
    if (frac >= 0.5) return Math.ceil(val);
    return Math.round(val * 100) / 100;
  }, []);

  // Store original values before dimensions are added
  const originalValuesRef = useRef<{
    [key: string]: {
      no_of_packages: number | null;
      volume?: number | null;
      volume_weight?: number | null;
      gross_weight?: number | null;
    };
  }>({});

  // Helper to check if a service has valid dimension data
  const hasValidDimensions = useCallback((dimensions: any[]): boolean => {
    return (
      Array.isArray(dimensions) &&
      dimensions.length > 0 &&
      dimensions.some(
        (r: any) =>
          (Number(r?.pieces) || 0) > 0 && (Number(r?.vol_weight) || 0) > 0
      )
    );
  }, []);

  // Recalculate dimensions totals - optimized to prevent infinite loops
  const recalcDimensionsTotals = useCallback(() => {
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        // Determine effective service type inline for OTHERS services
        let effectiveServiceType = serviceDetail.service;
        if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
          // Access otherServicesData from closure (will be available when function executes)
          const selectedOtherService = (otherServicesData || []).find(
            (item: any) => item.value === serviceDetail.service_code
          );
          if (selectedOtherService) {
            const transportMode = selectedOtherService.transport_mode || "";
            const fullGroupage = selectedOtherService.full_groupage || "";
            effectiveServiceType = resolveEffectiveServiceFromTransport(
              transportMode,
              fullGroupage,
            );
          }
        }

        if (
          effectiveServiceType !== "AIR" &&
          effectiveServiceType !== "LCL" &&
          effectiveServiceType !== "INLAND"
        )
          return;

        const key = `${serviceIndex}-${effectiveServiceType}`;
        const rows = serviceDetail.diemensions || [];
        const cargo = serviceDetail.cargo_details[0];
        const hasValidDims = hasValidDimensions(rows);

        // If no valid dimension data exists
        if (!hasValidDims) {
          // Clear dimension_unit when dimensions array is empty
          if (!Array.isArray(rows) || rows.length === 0) {
            if (serviceDetail.dimension_unit !== "") {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.dimension_unit`,
                ""
              );
            }
          }

          // Don't restore values or do anything else - let user manually edit
          return;
        }

        // Store original values before first dimension calculation
        if (!originalValuesRef.current[key]) {
          originalValuesRef.current[key] = {
            no_of_packages: cargo?.no_of_packages || null,
            gross_weight: cargo?.gross_weight || null,
            volume:
              effectiveServiceType === "LCL"
                ? cargo?.volume || null
                : undefined,
            volume_weight:
              usesAirCargoStructure(effectiveServiceType)
                ? cargo?.volume_weight || null
                : undefined,
          };
        }

        // Calculate totals from dimensions
        const totalPieces = rows.reduce(
          (sum: number, r: any) => sum + (Number(r?.pieces) || 0),
          0
        );
        const totalVolWeightRaw = rows.reduce(
          (sum: number, r: any) => sum + (Number(r?.vol_weight) || 0),
          0
        );
        const totalVolRounded = roundVol(totalVolWeightRaw);

        // Only update if values actually changed
        if (cargo.no_of_packages !== totalPieces) {
          serviceForm.setFieldValue(
            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
            totalPieces || null
          );
        }

        if (usesAirCargoStructure(effectiveServiceType)) {
          if (cargo.volume_weight !== totalVolRounded) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
              totalVolRounded || null
            );
          }
        } else if (effectiveServiceType === "LCL") {
          if (cargo.volume !== totalVolRounded) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.volume`,
              totalVolRounded || null
            );
          }
        }
      }
    );
  }, [serviceForm, roundVol, hasValidDimensions]);

  // Track dimension changes with proper memoization to prevent infinite loops
  const dimensionsKey = useMemo(() => {
    return serviceForm.values.service_details
      .map((s, idx) => {
        const dims = s.diemensions || [];
        const dimsStr = dims
          .map((d: any) => `${d.pieces}-${d.length}-${d.width}-${d.height}`)
          .join("|");
        return `${idx}:${s.service}:${s.dimension_unit}:${dimsStr}`;
      })
      .join("||");
  }, [serviceForm.values.service_details]);

  useEffect(() => {
    recalcDimensionsTotals();
  }, [dimensionsKey, recalcDimensionsTotals]);

  const createEnquiry = async (values: any): Promise<void> => {
    try {
      setIsSubmitting(true);

      // Always use FormData format
      const formData = new FormData();

      // Get supporting documents
      const supportingDocuments =
        customerForm.values.supporting_documents || [];

      // Append all files with indexed keys and document names (if any files exist)
      // Keep original file name - don't rename files
      supportingDocuments.forEach((doc, index: number) => {
        if (doc.file) {
          // Use original file name
          formData.append(`documents[${index}]`, doc.file);
          formData.append(`document_names[${index}]`, doc.name || "");
        }
      });

      // Always append the enquiry data as JSON string
      formData.append("enquiry_data", JSON.stringify(values));

      // Always use apiCallProtected with FormData
      const res = await apiCallProtected.post(URL.enquiry, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...API_HEADER.headers,
        },
      });

      if (res) {
        // Invalidate all enquiry-related queries to refresh data
        await queryClient.invalidateQueries({ queryKey: [modulePluralKey] });
        await queryClient.invalidateQueries({
          queryKey: [moduleFilteredPluralKey],
        });
        await queryClient.invalidateQueries({ queryKey: [`${queryBase}Search`] });
        await queryClient.invalidateQueries({ queryKey: [`${queryBase}Preview`] });
        await queryClient.invalidateQueries({
          queryKey: ["filteredPreviewData"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["initialPreviewData"],
        });
        await queryClient.invalidateQueries({ queryKey: ["previewSearch"] });

        ToastNotification({
          type: "success",
          message: `${moduleLabel} is created successfully`,
        });

        // Filters and search are now managed via store, just refresh data
        navigate(moduleListPath, { state: { refreshData: true } });
      }
    } catch (err: any) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: `Error while creating enquiry: ${err?.message || "Unknown error"}`,
      });
    }
  };
  const editEnquiry = async (values: any): Promise<void> => {
    console.log("editEnquiry values---", values);

    try {
      setIsSubmitting(true);

      // Always use FormData format
      const formData = new FormData();

      // Get supporting documents
      const supportingDocuments =
        customerForm.values.supporting_documents || [];

      // Append all files with indexed keys and document names (if any files exist)
      // Keep original file name - don't rename files
      supportingDocuments.forEach((doc, index: number) => {
        if (doc.file) {
          // Use original file name
          formData.append(`documents[${index}]`, doc.file);
          formData.append(`document_names[${index}]`, doc.name || "");
        }
      });

      // Always append the enquiry data as JSON string
      formData.append("enquiry_data", JSON.stringify(values));

      // Always use apiCallProtected with FormData
      // Append ID to URL like putAPICall does: url + `${formValue.id}/`
      const res = await apiCallProtected.put(
        `${URL.enquiry}${values.id}/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...API_HEADER.headers,
          },
        }
      );

      if (res) {
        // Invalidate all enquiry-related queries to refresh data
        await queryClient.invalidateQueries({ queryKey: [modulePluralKey] });
        await queryClient.invalidateQueries({
          queryKey: [moduleFilteredPluralKey],
        });
        await queryClient.invalidateQueries({ queryKey: [`${queryBase}Search`] });
        await queryClient.invalidateQueries({ queryKey: [`${queryBase}Preview`] });
        await queryClient.invalidateQueries({
          queryKey: ["filteredPreviewData"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["initialPreviewData"],
        });
        await queryClient.invalidateQueries({ queryKey: ["previewSearch"] });

        ToastNotification({
          type: "success",
          message: `${moduleLabel} is Updated successfully`,
        });

        // Check if we came from edit quotation (fromQuotation flag)
        const fromQuotation = (location.state as any)?.fromQuotation;
        const preserveFilters = (location.state as any)?.preserveFilters;

        // Navigate to quotation list if came from edit quotation, otherwise enquiry list
        if (fromQuotation) {
          // Came from edit quotation, navigate back to quotation list
          if (preserveFilters) {
            navigate("/quotation", {
              state: {
                refreshData: true,
              },
            });
          } else {
            navigate("/quotation", { state: { refreshData: true } });
          }
        } else {
          // Default: navigate to enquiry list (always pass refreshData so list restores filters from store)
          navigate(moduleListPath, { state: { refreshData: true } });
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: `Error while updating enquiry: ${err?.message || "Unknown error"}`,
      });
    }
  };

  // Build enquiry payload (baseData + documentsList) for create/edit - shared by handleFinalSubmit and handleSubmitEnquiry
  const getEnquiryPayload = (isEdit: boolean) => {
    const { supporting_documents, ...customerFormDataWithoutFiles } =
      customerForm.values;
    const networkIdVal = (customerFormDataWithoutFiles as { network_id?: string }).network_id;
    const baseData = {
      ...customerFormDataWithoutFiles,
      network_id: networkIdVal ? Number(networkIdVal) : null,
      is_rfq: true,
      ...(enq?.call_entry_id && { call_entry: enq.call_entry_id }),
      services: buildExpandedRfqServicePayloadsWithContext(
        serviceForm.values.service_details,
        isEdit,
        { otherServicesData, getDimensionValue, moduleLabel }
      ).map((r) => r.payload),
    };

    const documentsList = customerForm.values.supporting_documents
      .filter(
        (doc) => doc.document_id !== undefined && doc.document_id !== null
      )
      .map((doc) => {
        const docItem: { id: number; document_name?: string } = {
          id: doc.document_id!,
        };
        if (
          doc.original_document_name !== undefined &&
          doc.name !== doc.original_document_name
        ) {
          docItem.document_name = doc.name;
        }
        return docItem;
      });

    return { baseData, documentsList };
  };

  const handleFinalSubmit = () => {
    // Custom validation for cargo details based on service type
    let hasCargoErrors = false;
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        const cargo = serviceDetail.cargo_details[0];

        if (!serviceDetail.service) {
          return; // Skip if no service selected yet
        }

        if (
          serviceDetail.service === "OTHERS" &&
          isInlandOtherService(serviceDetail.service_code) &&
          !serviceDetail.trade
        ) {
          serviceForm.setFieldError(
            `service_details.${serviceIndex}.trade`,
            "Trade is required",
          );
          hasCargoErrors = true;
        }

        // Determine effective service type for validation (for OTHERS, determine from selected service)
        let effectiveServiceType = serviceDetail.service;
        if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
          const selectedOtherService = otherServicesData.find(
            (item) => item.value === serviceDetail.service_code
          );
          if (selectedOtherService) {
            const transportMode = selectedOtherService.transport_mode || "";
            const fullGroupage = selectedOtherService.full_groupage || "";
            effectiveServiceType = resolveEffectiveServiceFromTransport(
              transportMode,
              fullGroupage,
            );
          }
        }

        if (effectiveServiceType === "AIR" || effectiveServiceType === "LCL" || effectiveServiceType === "INLAND") {
          if (!cargo?.no_of_packages || cargo.no_of_packages < 1) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
              "Number of packages is required"
            );
            hasCargoErrors = true;
          } else {
            // Check if it's an integer
            if (!Number.isInteger(cargo.no_of_packages)) {
              serviceForm.setFieldError(
                `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
                "No decimals allowed"
              );
              hasCargoErrors = true;
            } else {
              // Check digit limit (10 max)
              const integerPart = Math.floor(
                Math.abs(cargo.no_of_packages)
              ).toString();
              if (integerPart.length > 10) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
                  "Maximum 10 digits allowed"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                );
              }
            }
          }
        }

        if (
          effectiveServiceType === "AIR" ||
          effectiveServiceType === "INLAND" ||
          effectiveServiceType === "LCL" ||
          effectiveServiceType === "FCL"
        ) {
          if (!cargo?.gross_weight || cargo.gross_weight < 0.01) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
              "Gross weight is required"
            );
            hasCargoErrors = true;
          } else {
            // Check digit limits for Gross Weight
            const grossWeightStr = String(cargo.gross_weight).replace(
              /[^0-9]/g,
              ""
            );
            if (grossWeightStr.length > 10) {
              serviceForm.setFieldError(
                `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
                "Maximum 10 digits allowed"
              );
              hasCargoErrors = true;
            } else {
              // Check decimal places
              const decimalPart = String(cargo.gross_weight).split(".")[1];
              if (decimalPart && decimalPart.length > 3) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
                  "Maximum 3 decimal places allowed"
                );
                hasCargoErrors = true;
              } else {
                // Check integer digits (8 max)
                const integerPart = Math.floor(
                  Math.abs(cargo.gross_weight)
                ).toString();
                if (integerPart.length > 8) {
                  serviceForm.setFieldError(
                    `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
                    "Maximum 8 integer digits allowed"
                  );
                  hasCargoErrors = true;
                } else {
                  serviceForm.clearFieldError(
                    `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                  );
                }
              }
            }
          }
        }

        if (usesAirCargoStructure(effectiveServiceType)) {
          if (!cargo?.volume_weight || cargo.volume_weight < 0.01) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
              "Volume weight is required"
            );
            hasCargoErrors = true;
          } else {
            // Check digit limits for Volume Weight
            const volumeWeightStr = String(cargo.volume_weight).replace(
              /[^0-9]/g,
              ""
            );
            if (volumeWeightStr.length > 10) {
              serviceForm.setFieldError(
                `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
                "Maximum 10 digits allowed"
              );
              hasCargoErrors = true;
            } else {
              // Check decimal places
              const decimalPart = String(cargo.volume_weight).split(".")[1];
              if (decimalPart && decimalPart.length > 3) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
                  "Maximum 3 decimal places allowed"
                );
                hasCargoErrors = true;
              } else {
                // Check integer digits (8 max)
                const integerPart = Math.floor(
                  Math.abs(cargo.volume_weight)
                ).toString();
                if (integerPart.length > 8) {
                  serviceForm.setFieldError(
                    `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
                    "Maximum 8 integer digits allowed"
                  );
                  hasCargoErrors = true;
                } else {
                  serviceForm.clearFieldError(
                    `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                  );
                }
              }
            }
          }
        }

        if (effectiveServiceType === "LCL") {
          if (!cargo?.volume || cargo.volume < 0.01) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.volume`,
              "Volume is required"
            );
            hasCargoErrors = true;
          } else {
            // Check digit limits for Volume
            const volumeStr = String(cargo.volume);
            const decimalPart = volumeStr.split(".")[1];
            
            // Check decimal places (max 3)
            if (decimalPart && decimalPart.length > 3) {
              serviceForm.setFieldError(
                `service_details.${serviceIndex}.cargo_details.0.volume`,
                "Maximum 3 decimal places allowed"
              );
              hasCargoErrors = true;
            } else {
              // Check integer digits (max 7)
              const integerPart = Math.floor(Math.abs(cargo.volume)).toString();
              if (integerPart.length > 7) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.0.volume`,
                  "Maximum 7 integer digits allowed"
                );
                hasCargoErrors = true;
              } else {
                // Check total digits (max 10, excluding decimal point)
                const totalDigits = volumeStr.replace(".", "").length;
                if (totalDigits > 10) {
                  serviceForm.setFieldError(
                    `service_details.${serviceIndex}.cargo_details.0.volume`,
                    "Maximum 10 digits in total allowed"
                  );
                  hasCargoErrors = true;
                } else {
                  serviceForm.clearFieldError(
                    `service_details.${serviceIndex}.cargo_details.0.volume`
                  );
                }
              }
            }
          }
        }

        if (effectiveServiceType === "FCL") {
          // FCL can have multiple cargo details, validate each one
          serviceDetail.cargo_details.forEach(
            (fclCargo: any, cargoIndex: number) => {
              const containerTypeCode = fclCargo?.container_type_code;
              if (
                !containerTypeCode ||
                (typeof containerTypeCode === "string" &&
                  !containerTypeCode.trim())
              ) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`,
                  "Container type is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                );
              }
              if (
                !fclCargo?.no_of_containers ||
                fclCargo.no_of_containers < 1
              ) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`,
                  "Number of containers is required"
                );
                hasCargoErrors = true;
              } else {
                // Check if it's an integer
                if (!Number.isInteger(fclCargo.no_of_containers)) {
                  serviceForm.setFieldError(
                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`,
                    "No decimals allowed"
                  );
                  hasCargoErrors = true;
                } else {
                  // Check digit limit (10 max)
                  const integerPart = Math.floor(
                    Math.abs(fclCargo.no_of_containers)
                  ).toString();
                  if (integerPart.length > 10) {
                    serviceForm.setFieldError(
                      `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`,
                      "Maximum 10 digits allowed"
                    );
                    hasCargoErrors = true;
                  } else {
                    serviceForm.clearFieldError(
                      `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                    );
                  }
                }
              }
              if (!fclCargo?.gross_weight || fclCargo.gross_weight < 0.01) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                  "Gross weight is required"
                );
                hasCargoErrors = true;
              } else {
                // Check digit limits for Gross Weight
                const grossWeightStr = String(fclCargo.gross_weight).replace(
                  /[^0-9]/g,
                  ""
                );
                if (grossWeightStr.length > 10) {
                  serviceForm.setFieldError(
                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                    "Maximum 10 digits allowed"
                  );
                  hasCargoErrors = true;
                } else {
                  // Check decimal places
                  const decimalPart = String(fclCargo.gross_weight).split(
                    "."
                  )[1];
                  if (decimalPart && decimalPart.length > 3) {
                    serviceForm.setFieldError(
                      `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                      "Maximum 3 decimal places allowed"
                    );
                    hasCargoErrors = true;
                  } else {
                    // Check integer digits (8 max)
                    const integerPart = Math.floor(
                      Math.abs(fclCargo.gross_weight)
                    ).toString();
                    if (integerPart.length > 8) {
                      serviceForm.setFieldError(
                        `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                        "Maximum 8 integer digits allowed"
                      );
                      hasCargoErrors = true;
                    } else {
                      serviceForm.clearFieldError(
                        `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                      );
                    }
                  }
                }
              }
            }
          );
        }
      }
    );

    // If there are cargo validation errors, navigate to service details step and return
    if (hasCargoErrors) {
      setActive(1);
      return;
    }

    // Check for file size errors
    const hasFileErrors = Object.keys(fileErrors).length > 0;
    if (hasFileErrors) {
      ToastNotification({
        type: "error",
        message: "Please fix file size errors before submitting",
      });
      // Open the documents modal to show errors
      if (!documentsModalOpened) {
        openDocumentsModal();
      }
      return;
    }

    // Validate forms using yup schema
    const cusFormResult = customerForm.validate();
    const serviceFormResult = serviceForm.validate();

    // Check if there are any validation errors (from yup or manually set)
    const hasServiceFormErrors =
      serviceFormResult.hasErrors || Object.keys(serviceForm.errors).length > 0;
    const hasCustomerFormErrors =
      cusFormResult.hasErrors || Object.keys(customerForm.errors).length > 0;

    if (hasCustomerFormErrors || hasServiceFormErrors) {
      // Navigate to the appropriate step if there are errors
      if (hasServiceFormErrors) {
        setActive(1); // Navigate to service details step
      }
      // ToastNotification({
      //   type: "error",
      //   message: "Please fix validation errors before submitting",
      // });
      return;
    }

    if (!hasCustomerFormErrors && !hasServiceFormErrors) {
      const isEditMode =
        enq?.actionType === "edit" || (enq?.id && enq?.quoteType !== "CHATBOT");
      const { baseData, documentsList } = getEnquiryPayload(isEditMode);

      if (isEditMode) {
        const editData = {
          ...baseData,
          id: enq?.id,
          ...(documentsList.length > 0 && { documents_list: documentsList }),
        };
        console.log("Editing data:", editData);
        editEnquiry(editData);
      } else {
        console.log("Creating data:", baseData);
        createEnquiry(baseData);
      }
    } else {
      ToastNotification({
        type: "warning",
        message: "Fill the previous Forms",
      });
    }
  };

  const checkedServiceIndicesRef = useRef<Set<number>>(new Set());

  // Function to check salesperson data from API
  const checkSalespersonData = async (serviceIndex: number) => {
    const customerCode = customerForm.values.customer_code;
    const serviceDetail = serviceForm.values.service_details[serviceIndex];
    const service = serviceDetail?.service;
    const trade = serviceDetail?.trade;

    // Only check if all required fields are available
    if (!customerCode || !service || !trade) {
      console.log("❌ Missing required fields:", {
        customerCode,
        service,
        trade,
        serviceIndex,
      });
      return;
    }

    // Don't check again if this service index has already been processed (user made a decision)
    // 🚫 Already checked (API already called)
    if (checkedServiceIndicesRef.current.has(serviceIndex)) {
      console.log("⛔ API already checked for service index:", serviceIndex);
      return;
    }

    // 🚫 Modal already open
    if (salespersonModalOpened) {
      console.log("⛔ Modal open, skipping API call");
      return;
    }


    // Don't check again if we're currently checking this service index
    if (lastCheckedServiceIndex === serviceIndex && isCheckingSalesperson) {
      console.log("⏭️ Already checking for service index:", serviceIndex);
      return;
    }

    try {
      setIsCheckingSalesperson(true);
      console.log("🔍 Checking salesperson data:", {
        customerCode,
        service,
        trade,
        serviceIndex,
      });
      const response = (await apiCallProtected.post(URL.accountsSalespersons, {
        customer_code: customerCode,
        service: service,
        service_type: trade,
      })) as {
        success?: boolean;
        message?: string;
        data?: SalespersonData[];
      };
      checkedServiceIndicesRef.current.add(serviceIndex);

      if (response?.success && response?.data && response.data.length > 0) {
        const apiSalesperson = response.data[0];
        const currentSalesperson = customerForm.values.sales_person;

        // Compare sales_person from API with current selection
        if (
          apiSalesperson.sales_person &&
          currentSalesperson &&
          apiSalesperson.sales_person !== currentSalesperson
        ) {
          // Only show modal if this service index hasn't been processed yet
          if (!processedServiceIndices.has(serviceIndex)) {
            // Salesperson doesn't match - show modal
            setSalespersonModalData(apiSalesperson);
            openSalespersonModal();
            setLastCheckedServiceIndex(serviceIndex);
          }
        } else {
          // Salesperson matches or no mismatch - mark as processed to avoid future checks
          setProcessedServiceIndices((prev) => new Set(prev).add(serviceIndex));
        }
      }
    } catch (error) {
      console.error("Error checking salesperson data:", error);
    } finally {
      setIsCheckingSalesperson(false);
    }
  };

  // Function to handle Yes button in modal - update form with API data
  const handleUpdateSalespersonData = () => {
    if (salespersonModalData && lastCheckedServiceIndex !== null) {
      if (salespersonModalData.sales_person) {
        customerForm.setFieldValue(
          "sales_person",
          salespersonModalData.sales_person
        );
      }
      if (salespersonModalData.sales_coordinator) {
        customerForm.setFieldValue(
          "sales_coordinator",
          salespersonModalData.sales_coordinator
        );
      } else {
        customerForm.setFieldValue("sales_coordinator", "");
      }
      if (salespersonModalData.customer_service) {
        customerForm.setFieldValue(
          "customer_services",
          salespersonModalData.customer_service
        );
      } else {
        customerForm.setFieldValue("customer_services", "");
      }
      
      // Mark this service index as processed so modal won't open again
      setProcessedServiceIndices((prev) => 
        new Set(prev).add(lastCheckedServiceIndex)
      );
      
      // Close modal first
      closeSalespersonModal();
      setSalespersonModalData(null);

      // Navigate to stepper 1 (Customer Details) - active is 0-indexed, so 0 = step 1
      setTimeout(() => {
        setActive(0);
      }, 200);
    }
  };

  // Function to handle Cancel button - mark as processed without updating
  const handleCancelSalespersonModal = () => {
    if (lastCheckedServiceIndex !== null) {
      // Mark this service index as processed so modal won't open again
      setProcessedServiceIndices((prev) => 
        new Set(prev).add(lastCheckedServiceIndex)
      );
    }
    closeSalespersonModal();
    setSalespersonModalData(null);
  };

  // Function to validate a specific step
  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      const result = customerForm.validate();
      return !result.hasErrors;
    }
    if (stepIndex === 1) {
      const result = serviceForm.validate();
      return !result.hasErrors;
    }
    // Step 2 (Quotation) validation is handled by QuotationCreate component
    return true;
  };

  // Function to handle stepper title click with validation
  const handleStepClick = (targetStep: number) => {
    // Allow backward navigation without validation
    if (targetStep < active) {
      setActive(targetStep);
      return;
    }

    // For forward navigation, validate all steps from current to target
    if (targetStep > active) {
      let allStepsValid = true;
      // Validate each step from current to target (exclusive of target)
      for (let step = active; step < targetStep; step++) {
        const isValid = validateStep(step);
        if (!isValid) {
          allStepsValid = false;
          // Stay on the first invalid step to show errors
          setActive(step);
          break;
        }
      }
      // Only navigate to target if all intermediate steps are valid
      if (allStepsValid) {
        setActive(targetStep);
      }
      // If validation fails, errors are already displayed by form.validate()
    } else {
      // Same step clicked, just navigate
      setActive(targetStep);
    }
  };

  // Function to fetch enquiry data using enquiry_id from chatbot
  const handleNext = () => {
    let validationPassed = true;

    if (active === 0) {
      const result = customerForm.validate();
      if (result.hasErrors) validationPassed = false;
    }

    if (active === 1) {
      // Check if this is from destination flow
      if (enq?.fromDestination && enq?.actionType === "createQuote") {
        // For destination flow, navigate to quotation step instead of submitting
        setActive(2);
        return;
      }

      // Submit on step 1: always call handleFinalSubmit so it runs full validation and hits the API if valid.
      // Do not gate on serviceForm.validate() here, or the create API is never called when validation fails.
      handleFinalSubmit();
      return;
    }

    // Move to next step for active === 0 or 1
    if (validationPassed) {
      setActive((current) => current + 1);
    }
  };

  // Submit enquiry from Service & Cargo Details (step 1) when navigated back from edit quotation / create quote
  const handleSubmitEnquiry = () => {
    const cusFormResult = customerForm.validate();
    const serviceFormResult = serviceForm.validate();
    const hasCustomerFormErrors =
      cusFormResult.hasErrors || Object.keys(customerForm.errors).length > 0;
    const hasServiceFormErrors =
      serviceFormResult.hasErrors || Object.keys(serviceForm.errors).length > 0;
    if (hasCustomerFormErrors || hasServiceFormErrors) return;

    if (!enq?.id) {
      ToastNotification({
        type: "warning",
        message: `${moduleLabel} ID is missing. Cannot save.`,
      });
      return;
    }

    const { baseData, documentsList } = getEnquiryPayload(true);
    const editData = {
      ...baseData,
      id: enq?.id,
      ...(documentsList.length > 0 && { documents_list: documentsList }),
    };
    editEnquiry(editData);
  };

  const { data: enquiryData = [] } = useQuery({
    queryKey: [`${queryBase}Data`],
    queryFn: fetchEnquiry,
    select: (data: any) => data || [],
    staleTime: Infinity,
  });
  const { data: quotationData = [] } = useQuery({
    queryKey: ["quotationData"],
    queryFn: fetchQuotation,
    select: (data: any) => data || [],
    staleTime: Infinity,
  });

  const [selectedCustomerName, setSelectedCustomerName] = useState<
    string | null
  >(null);
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null
  );
  const [isInitialDataLoad, setIsInitialDataLoad] = useState(false);
  const [salespersonsApiCalled, setSalespersonsApiCalled] = useState(false);

  // Customer data drawer state
  const [
    customerDataDrawer,
    { open: openCustomerDataDrawer, close: closeCustomerDataDrawer },
  ] = useDisclosure(false);

  const [
    lastEnquiriesDrawerOpened,
    { open: openLastEnquiriesDrawer, close: closeLastEnquiriesDrawer },
  ] = useDisclosure(false);

  // Customer data state
  const [customerQuotationData, setCustomerQuotationData] = useState<
    QuotationData[]
  >([]);
  const [callEntryData, setCallEntryData] = useState<CallEntryData[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [potentialProfilingData, setPotentialProfilingData] = useState<
    PotentialProfilingData[]
  >([]);
  const [customerCreditDay, setCustomerCreditDay] = useState<number | null>(
    null
  );
  const [customerSalesperson, setCustomerSalesperson] = useState<string | null>(
    null
  );
  const [customerLastVisited, setCustomerLastVisited] = useState<string | null>(
    null
  );
  const [customerTotalCreditAmount, setCustomerTotalCreditAmount] = useState<
    number | null
  >(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState<number | null>(null);
  const [customerCurrency, setCustomerCurrency] = useState<string>("");
  // Date range for customer data - default to previous month
  const getPreviousMonthRange = () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0
    );
    return {
      from: previousMonth,
      to: lastDayOfPreviousMonth,
    };
  };
  const previousMonthRange = getPreviousMonthRange();
  const [customerDataFromDate, setCustomerDataFromDate] = useState<Date | null>(
    previousMonthRange.from
  );
  const [customerDataToDate, setCustomerDataToDate] = useState<Date | null>(
    previousMonthRange.to
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [totalOutstandingAmount, setTotalOutstandingAmount] =
    useState<number>(0);

  const enquiryCount = useMemo(() => {
    if (!selectedCustomerName || !enquiryData?.length) return 0;

    return enquiryData.filter(
      (enq: any) =>
        enq.customer_name?.toLowerCase().trim() ===
        selectedCustomerName.toLowerCase().trim()
    ).length;
  }, [selectedCustomerName, enquiryData]);

  const quotationCount = useMemo(() => {
    if (!selectedCustomerName || !quotationData?.length) return 0;

    return quotationData.filter(
      (quote: any) =>
        quote.customer_name?.toLowerCase().trim() ===
        selectedCustomerName.toLowerCase().trim()
    ).length;
  }, [selectedCustomerName, quotationData]);

  // Optimized container type data query with memoization
  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];

    return rawContainerData.map((item: any) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name,
    }));
  }, [rawContainerData]);

  // Other services data query
  const { data: rawOtherServicesData = [] } = useQuery({
    queryKey: ["otherServices"],
    queryFn: fetchOtherServices,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const otherServicesData = useMemo(() => {
    if (!Array.isArray(rawOtherServicesData) || !rawOtherServicesData.length)
      return [];

    return rawOtherServicesData.map((item: any) => ({
      value: item.service_code ? String(item.service_code) : "",
      label: item.service_name || "",
      transport_mode: item.transport_mode || "",
      full_groupage: item.full_groupage || "",
    }));
  }, [rawOtherServicesData]);

  const isInlandOtherService = useCallback(
    (serviceCode?: string | null) =>
      isOtherServiceInland(serviceCode, otherServicesData),
    [otherServicesData],
  );

  /** One QuotationCreate tab per expanded origin/destination pair (same as enquiry submit). */
  const rfqServicesForQuotation = useMemo(() => {
    return buildExpandedRfqServicePayloadsWithContext(
      serviceForm.values.service_details,
      false,
      { otherServicesData, getDimensionValue, moduleLabel }
    ).map((row, idx) =>
      mapRfqApiPayloadToQuotationServiceRow(
        row.payload,
        row.serviceDetail,
        idx,
        row.pairId
      )
    );
  }, [serviceForm.values.service_details, otherServicesData, getDimensionValue, moduleLabel]);

  // Salespersons data query - initially with empty customer_id
  const { data: rawSalespersonsData = [], refetch: refetchSalespersons } =
    useQuery({
      queryKey: ["salespersons", ""],
      queryFn: () => {
        console.log(
          "🚀 React Query calling fetchSalespersons with empty customer_code"
        );
        return fetchSalespersons("");
      },
      staleTime: 10 * 60 * 1000, // 10 minutes - longer cache
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: true, // Only fetch when component mounts
      retry: 1, // Only retry once on failure
    });

  const salespersonsData = useMemo(() => {
    const response = rawSalespersonsData as SalespersonsResponse;
    if (
      !response?.data ||
      !Array.isArray(response.data) ||
      !response.data.length
    )
      return [];

    return response.data.map((item: SalespersonData) => ({
      value: item.sales_person ? String(item.sales_person) : "",
      label: item.sales_person,
      sales_coordinator: item.sales_coordinator || "",
      customer_service: item.customer_service || "",
    }));
  }, [rawSalespersonsData]);

  useEffect(() => {
    try {
      console.log("🔍 Main useEffect triggered with enq:", enq);
      if (enq !== null) {
        const hasEnquiryPayload =
          Boolean(enq.actionType) ||
          Boolean(enq.id) ||
          Boolean(enq.enquiry_id) ||
          Boolean(enq.customer_code) ||
          Boolean(enq.customer_code_read) ||
          (Array.isArray(enq.services) && enq.services.length > 0) ||
          (Array.isArray(enq.service_details) &&
            enq.service_details.length > 0);

        if (!hasEnquiryPayload) {
          setShowQuotation(false);
          setActive(0);
          return;
        }

        setIsInitialDataLoad(true);
        if (!Array.isArray(termsOfShipment) || termsOfShipment.length === 0) {
          console.log("Waiting for data to load...");
          return;
        }

        // Check if this is from destination create quote flow
        if (enq.actionType === "createQuote" && enq.fromDestination) {
          setShowQuotation(true); // Show quotation step
          setActive(2); // Go to step 3 (Quotation)
        }
        // Check if this is edit quotation action (navigating back from quotation edit)
        else if (enq.actionType === "editQuotation") {
          setShowQuotation(true); // Show quotation step
          // Use targetStep if provided (from navigation), otherwise default to step 0
          const targetStep = (enq as any)?.targetStep;
          setActive(targetStep !== undefined ? targetStep : 0);
        }
        // Check if this is an edit action (Edit Enquiry)
        else if (enq.actionType === "edit") {
          setShowQuotation(false); // Don't show quotation step for edit
          setActive(0); // Start at step 1 (Customer Details)
        }
        // Check if this is create enquiry from call entry (not create quote)
        else if (enq.actionType === "createEnquiry") {
          setShowQuotation(false); // Don't show quotation step for create enquiry
          setActive(0); // Start at step 1 (Customer Details)
        } else {
          setShowQuotation(true); // Show quotation step for create quote
          setActive(2); // Go to step 3 (Quotation) for create quote
        }

        // Set basic fields first (include network from filter/enquiry response for edit)
        const enqWithNetwork = enq as { network_id?: number | null; network_name?: string | null };
        console.log("📝 Setting basic fields:", {
          sales_person: enq?.sales_person,
          sales_coordinator: enq?.sales_coordinator,
          customer_services: enq?.customer_services,
          enquiry_received_date: enq?.enquiry_received_date,
          reference_no: enq?.reference_no,
          customer_address: enq?.customer_address,
          network_id: enqWithNetwork?.network_id,
          network_name: enqWithNetwork?.network_name,
        });

        customerForm.setFieldValue(
          "sales_coordinator",
          enq?.sales_coordinator || ""
        );
        customerForm.setFieldValue("sales_person", enq?.sales_person || "");
        if (!(enq as any)?.prefillFromLastEnquiries) {
          customerForm.setFieldValue(
            "enquiry_received_date",
            enq?.enquiry_received_date || dayjs().format("YYYY-MM-DD")
          );
        }
        customerForm.setFieldValue("reference_no", enq?.reference_no || "");
        customerForm.setFieldValue(
          "customer_address",
          enq?.customer_address || ""
        );
        customerForm.setFieldValue(
          "network_id",
          enqWithNetwork?.network_id != null ? String(enqWithNetwork.network_id) : ""
        );
        customerForm.setFieldValue(
          "network_name",
          enqWithNetwork?.network_name || ""
        );

        // Handle customer selection and sales person population
        if (enq?.customer_code_read) {
          console.log("🏢 Setting customer data:", {
            customer_code: enq.customer_code_read,
            customer_name: enq.customer_name,
            sales_person: enq.sales_person,
          });

          customerForm.setFieldValue("customer_code", enq.customer_code_read);
          setCustomerDisplayName(enq.customer_name || enq.customer_code_read);
          setSelectedCustomerName(enq.customer_name || enq.customer_code_read);

          // If we have sales person data in enquiry, populate it
          if (enq?.sales_person) {
            console.log(
              "👤 Populating sales person from enquiry data:",
              enq.sales_person
            );
            customerForm.setFieldValue("sales_person", enq.sales_person);
            customerForm.setFieldValue(
              "sales_coordinator",
              enq.sales_coordinator || ""
            );
            customerForm.setFieldValue(
              "customer_services",
              enq.customer_services || ""
            );
          }
        }

        // Handle service details - check for new API format with 'services' array
        if (enq?.services && Array.isArray(enq.services)) {
          // New API format: services array
          const mappedServices = enq.services.map((service: any) => {
              // Handle OTHERS service type from quotation (when service_type == "OTHERS" and trade == null)
              let serviceValue = service.service || "";
              let tradeValue = service.trade || "";
              let serviceCodeValue = service.service_code || "";
              let serviceNameValue = service.service_name || "";

              // Check if this is OTHERS type from quotation (service_type == "OTHERS" and trade == null)
              if (
                (service.service_type === "OTHERS" ||
                  service.service === "OTHERS") &&
                (service.trade === null ||
                  service.trade === undefined ||
                  service.trade === "")
              ) {
                serviceValue = "OTHERS";
                tradeValue = "";
                // Use service_type_code and service_type_name if available, otherwise use service_code and service_name
                serviceCodeValue =
                  service.service_type_code || service.service_code || "";
                serviceNameValue =
                  service.service_type_name || service.service_name || "";
              }

              const serviceDetail = {
                id: service.id,
                // Date.now().toString() +
                // Math.random().toString(36).substr(2, 9),
                service: serviceValue,
                trade: tradeValue,
                service_code: serviceCodeValue,
                service_name: serviceNameValue,
                origin_code:
                  service.origin_code_read || service.origin_code || "",
                origin_name:
                  service.origin_name ||
                  service.origin_port_name ||
                  "",
                origin_codes: (() => {
                  const c = service.origin_code_read || service.origin_code;
                  return c ? [String(c)] : [];
                })(),
                origin_display_values: (() => {
                  const c = String(
                    service.origin_code_read || service.origin_code || ""
                  ).trim();
                  if (!c) return {};
                  return {
                    [c]: rfqPortPillLabelFromApi(
                      service.origin_name || service.origin_port_name,
                      c
                    ),
                  };
                })(),
                destination_code:
                  service.destination_code_read ||
                  service.destination_code ||
                  "",
                destination_name:
                  service.destination_name ||
                  service.destination_port_name ||
                  "",
                destination_codes: (() => {
                  const c =
                    service.destination_code_read || service.destination_code;
                  return c ? [String(c)] : [];
                })(),
                destination_display_values: (() => {
                  const c = String(
                    service.destination_code_read ||
                      service.destination_code ||
                      ""
                  ).trim();
                  if (!c) return {};
                  return {
                    [c]: rfqPortPillLabelFromApi(
                      service.destination_name || service.destination_port_name,
                      c
                    ),
                  };
                })(),
                pickup: service.pickup ? "true" : "false",
                delivery: service.delivery ? "true" : "false",
                pickup_location: service.pickup_location || "",
                delivery_location: service.delivery_location || "",
                pickup_flags_by_origin: (() => {
                  const c = String(service.origin_code_read || service.origin_code || "").trim();
                  const pval = (service.pickup ? "true" : "false") as "true" | "false";
                  return c ? { [c]: pval } : {};
                })(),
                pickup_locations_by_origin: (() => {
                  const c = String(service.origin_code_read || service.origin_code || "").trim();
                  return c ? { [c]: service.pickup_location || "" } : {};
                })(),
                delivery_flags_by_destination: (() => {
                  const c = String(service.destination_code_read || service.destination_code || "").trim();
                  const dval = (service.delivery ? "true" : "false") as "true" | "false";
                  return c ? { [c]: dval } : {};
                })(),
                delivery_locations_by_destination: (() => {
                  const c = String(service.destination_code_read || service.destination_code || "").trim();
                  return c ? { [c]: service.delivery_location || "" } : {};
                })(),
                service_remark: service.service_remark || "",
                commodity: service.commodity || "",
                shipment_terms_code:
                  service.shipment_terms_code_read ||
                  service.shipment_terms_code ||
                  "",
                icd: service.icd || "",
                dimension_unit: "Centimeter",
                diemensions: [] as any[],
                cargo_details: [] as any[],
              };

              // Handle cargo details based on service type
              // For OTHERS services, determine structure from cargo data presence or service_code
              let isOthersWithFCL = false;
              let isOthersWithAIR = false;
              let isOthersWithLCL = false;
              let isOthersWithInland = false;

              if (serviceValue === "OTHERS" && serviceCodeValue) {
                // Try to determine structure from otherServicesData if available
                const selectedOtherService = (otherServicesData || []).find(
                  (item: any) => item.value === serviceCodeValue
                );
                if (selectedOtherService) {
                  const transportMode =
                    selectedOtherService.transport_mode || "";
                  const fullGroupage = selectedOtherService.full_groupage || "";
                  if (transportMode === "SEA" && fullGroupage === "FULL") {
                    isOthersWithFCL = true;
                  } else if (
                    transportMode === "SEA" &&
                    fullGroupage === "GROUPAGE"
                  ) {
                    isOthersWithLCL = true;
                  } else if (transportMode === "NA") {
                    isOthersWithInland = true;
                  } else {
                    isOthersWithAIR = true;
                  }
                } else {
                  // Fallback: determine structure from cargo data presence
                  if (
                    service.fcl_details &&
                    Array.isArray(service.fcl_details) &&
                    service.fcl_details.length > 0
                  ) {
                    isOthersWithFCL = true;
                  } else if (
                    service.volume_weight !== undefined &&
                    service.volume_weight !== null &&
                    (service.volume === undefined || service.volume === null)
                  ) {
                    isOthersWithAIR = true;
                  } else if (
                    service.volume !== undefined &&
                    service.volume !== null &&
                    (service.volume_weight === undefined ||
                      service.volume_weight === null)
                  ) {
                    isOthersWithLCL = true;
                  } else {
                    // Default to AIR structure if we have volume_weight
                    isOthersWithAIR =
                      service.volume_weight !== undefined &&
                      service.volume_weight !== null;
                  }
                }
              }

              if (
                (serviceValue === "FCL" || isOthersWithFCL) &&
                service.fcl_details &&
                Array.isArray(service.fcl_details)
              ) {
                // FCL service with multiple containers (or OTHERS with FCL structure)
                serviceDetail.cargo_details = service.fcl_details.map(
                  (fcl: any) => ({
                    id: fcl.id || null,
                    no_of_packages: null,
                    gross_weight: fcl.gross_weight
                      ? Number(fcl.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: null,
                    chargable_volume: null,
                    // Use container_type_code if available, otherwise fallback to container_type
                    container_type_code:
                      fcl.container_type_code || fcl.container_type || null,
                    no_of_containers: fcl.no_of_containers || null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  })
                );
              } else if (serviceValue === "AIR" || isOthersWithAIR || isOthersWithInland) {
                // AIR service with direct cargo fields (or OTHERS with AIR structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: null,
                    chargable_volume: null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else if (serviceValue === "LCL" || isOthersWithLCL) {
                // LCL service with direct cargo fields (or OTHERS with LCL structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else {
                // Default cargo detail (for OTHERS when structure cannot be determined from data)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              }

              // Handle dimension_data mapping from API response
              if (
                service.dimension_data &&
                Array.isArray(service.dimension_data) &&
                service.dimension_data.length > 0
              ) {
                // Map dimension_data to diemensions format
                serviceDetail.diemensions = service.dimension_data.map(
                  (dim: any) => ({
                    id: dim.id || null,
                    pieces: dim.pieces || 0,
                    length: dim.length || 0,
                    width: dim.width || 0,
                    height: dim.height || 0,
                    value: dim.value || 0,
                    vol_weight: dim.volume_weight || 0,
                  })
                );

                // Extract dimension_unit from first dimension item (all should have same unit)
                if (service.dimension_data[0]?.dimension_unit) {
                  serviceDetail.dimension_unit =
                    service.dimension_data[0].dimension_unit;
                }
              }

              return serviceDetail;
            });

          serviceForm.setFieldValue(
            "service_details",
            mergeRfqCombinableServices(mappedServices)
          );
        } else if (enq?.service_details && Array.isArray(enq.service_details)) {
          // Legacy format: service_details array
          serviceForm.setFieldValue(
            "service_details",
            mergeRfqCombinableServices(
              enq.service_details.map((service: any) => {
              const serviceDetail = {
                id: service.id,
                // Date.now().toString() + Math.random().toString(36).substr(2, 9),
                service: service.service || "",
                trade: service.trade || "",
                service_code: service.service_code || "",
                service_name: service.service_name || "",
                origin_code:
                  service.origin_code_read || service.origin_code || "",
                origin_name:
                  service.origin_name ||
                  service.origin_port_name ||
                  "",
                origin_codes: (() => {
                  const c = service.origin_code_read || service.origin_code;
                  return c ? [String(c)] : [];
                })(),
                origin_display_values: (() => {
                  const c = String(
                    service.origin_code_read || service.origin_code || ""
                  ).trim();
                  if (!c) return {};
                  return {
                    [c]: rfqPortPillLabelFromApi(
                      service.origin_name || service.origin_port_name,
                      c
                    ),
                  };
                })(),
                destination_code:
                  service.destination_code_read ||
                  service.destination_code ||
                  "",
                destination_name:
                  service.destination_name ||
                  service.destination_port_name ||
                  "",
                destination_codes: (() => {
                  const c =
                    service.destination_code_read || service.destination_code;
                  return c ? [String(c)] : [];
                })(),
                destination_display_values: (() => {
                  const c = String(
                    service.destination_code_read ||
                      service.destination_code ||
                      ""
                  ).trim();
                  if (!c) return {};
                  return {
                    [c]: rfqPortPillLabelFromApi(
                      service.destination_name || service.destination_port_name,
                      c
                    ),
                  };
                })(),
                pickup: service.pickup ? "true" : "false",
                delivery: service.delivery ? "true" : "false",
                pickup_location: service.pickup_location || "",
                delivery_location: service.delivery_location || "",
                pickup_flags_by_origin: (() => {
                  const c = String(service.origin_code_read || service.origin_code || "").trim();
                  const pval = (service.pickup ? "true" : "false") as "true" | "false";
                  return c ? { [c]: pval } : {};
                })(),
                pickup_locations_by_origin: (() => {
                  const c = String(service.origin_code_read || service.origin_code || "").trim();
                  return c ? { [c]: service.pickup_location || "" } : {};
                })(),
                delivery_flags_by_destination: (() => {
                  const c = String(service.destination_code_read || service.destination_code || "").trim();
                  const dval = (service.delivery ? "true" : "false") as "true" | "false";
                  return c ? { [c]: dval } : {};
                })(),
                delivery_locations_by_destination: (() => {
                  const c = String(service.destination_code_read || service.destination_code || "").trim();
                  return c ? { [c]: service.delivery_location || "" } : {};
                })(),
                service_remark: service.service_remark || "",
                commodity: service.commodity || "",
                shipment_terms_code:
                  service.shipment_terms_code_read ||
                  service.shipment_terms_code ||
                  "",
                icd: service.icd || "",
                dimension_unit: "Centimeter",
                diemensions: [] as any[],
                cargo_details: [] as any[],
              };

              // Handle cargo details based on service type
              // For OTHERS services, determine structure from cargo data presence or service_code
              let isOthersWithFCL = false;
              let isOthersWithAIR = false;
              let isOthersWithLCL = false;
              let isOthersWithInland = false;

              if (service.service === "OTHERS" && service.service_code) {
                // Try to determine structure from otherServicesData if available
                const selectedOtherService = (otherServicesData || []).find(
                  (item: any) => item.value === service.service_code
                );
                if (selectedOtherService) {
                  const transportMode =
                    selectedOtherService.transport_mode || "";
                  const fullGroupage = selectedOtherService.full_groupage || "";
                  if (transportMode === "SEA" && fullGroupage === "FULL") {
                    isOthersWithFCL = true;
                  } else if (
                    transportMode === "SEA" &&
                    fullGroupage === "GROUPAGE"
                  ) {
                    isOthersWithLCL = true;
                  } else if (transportMode === "NA") {
                    isOthersWithInland = true;
                  } else {
                    isOthersWithAIR = true;
                  }
                } else {
                  // Fallback: determine structure from cargo data presence
                  if (
                    service.fcl_details &&
                    Array.isArray(service.fcl_details) &&
                    service.fcl_details.length > 0
                  ) {
                    isOthersWithFCL = true;
                  } else if (
                    service.volume_weight !== undefined &&
                    service.volume_weight !== null &&
                    (service.volume === undefined || service.volume === null)
                  ) {
                    isOthersWithAIR = true;
                  } else if (
                    service.volume !== undefined &&
                    service.volume !== null &&
                    (service.volume_weight === undefined ||
                      service.volume_weight === null)
                  ) {
                    isOthersWithLCL = true;
                  } else {
                    // Default to AIR structure if we have volume_weight
                    isOthersWithAIR =
                      service.volume_weight !== undefined &&
                      service.volume_weight !== null;
                  }
                }
              }

              if (
                (service.service === "FCL" || isOthersWithFCL) &&
                service.fcl_details &&
                Array.isArray(service.fcl_details)
              ) {
                // FCL service with multiple containers (or OTHERS with FCL structure)
                serviceDetail.cargo_details = service.fcl_details.map(
                  (fcl: any) => ({
                    id: fcl.id || null,
                    no_of_packages: null,
                    gross_weight: fcl.gross_weight
                      ? Number(fcl.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: null,
                    chargable_volume: null,
                    container_type_code:
                      fcl.container_type_code || fcl.container_type || null,
                    no_of_containers: fcl.no_of_containers || null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  })
                );
              } else if (service.service === "AIR" || isOthersWithAIR || isOthersWithInland) {
                // AIR service with direct cargo fields (or OTHERS with AIR structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: null,
                    chargable_volume: null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else if (service.service === "LCL" || isOthersWithLCL) {
                // LCL service with direct cargo fields (or OTHERS with LCL structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else {
                // Default cargo detail (for OTHERS when structure cannot be determined from data)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    un_no: service.un_no || null,
                    class: service.class_name || service.class || null,
                    pkg_group: service.pkg_group || null,
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              }

              // COMMENTED OUT TO FIX INFINITE LOOP - Handle dimension_data mapping from API response
              // if (
              //   service.dimension_data &&
              //   Array.isArray(service.dimension_data) &&
              //   service.dimension_data.length > 0
              // ) {
              //   // Map dimension_data to diemensions format
              //   serviceDetail.diemensions = service.dimension_data.map(
              //     (dim: any) => ({
              //       id: dim.id || null,
              //       pieces: dim.pieces || 0,
              //       length: dim.length || 0,
              //       width: dim.width || 0,
              //       height: dim.height || 0,
              //       value: dim.value || 0,
              //       vol_weight: dim.volume_weight || 0,
              //     })
              //   );

              //   // Extract dimension_unit from first dimension item (all should have same unit)
              //   if (service.dimension_data[0]?.dimension_unit) {
              //     serviceDetail.dimension_unit =
              //       service.dimension_data[0].dimension_unit;
              //   }
              // }

              return serviceDetail;
            })
          )
          );
        } else {
          // Legacy format: single service detail (backward compatibility)
          const _legacyOriginCode = String(enq?.origin_code_read || enq?.origin_code || "").trim();
          const _legacyDestCode = String(enq?.destination_code_read || enq?.destination_code || "").trim();
          const _legacyPickup = (enq?.pickup ? "true" : "false") as "true" | "false";
          const _legacyDelivery = (enq?.delivery ? "true" : "false") as "true" | "false";
          const serviceDetail = {
            id: enq.id,
            // Date.now().toString() + Math.random().toString(36).substr(2, 9),
            service: enq?.service || "",
            trade: enq?.trade || "",
            service_code: enq?.service_code || "",
            service_name: enq?.service_name || "",
            origin_code: _legacyOriginCode,
            origin_name: enq?.origin_name || "",
            origin_codes: _legacyOriginCode ? [_legacyOriginCode] : [] as string[],
            origin_display_values: _legacyOriginCode ? {
              [_legacyOriginCode]: rfqPortPillLabelFromApi(enq?.origin_name, _legacyOriginCode),
            } : {} as Record<string, string>,
            destination_code: _legacyDestCode,
            destination_name: enq?.destination_name || "",
            destination_codes: _legacyDestCode ? [_legacyDestCode] : [] as string[],
            destination_display_values: _legacyDestCode ? {
              [_legacyDestCode]: rfqPortPillLabelFromApi(enq?.destination_name, _legacyDestCode),
            } : {} as Record<string, string>,
            rfq_port_pair_refs: [] as Array<{ id?: number | string; origin_code: string; destination_code: string }>,
            pickup: enq?.pickup ? "true" : "false",
            delivery: enq?.delivery ? "true" : "false",
            pickup_location: enq?.pickup_location || "",
            delivery_location: enq?.delivery_location || "",
            pickup_flags_by_origin: _legacyOriginCode ? { [_legacyOriginCode]: _legacyPickup } : {} as Record<string, "true" | "false">,
            pickup_locations_by_origin: _legacyOriginCode ? { [_legacyOriginCode]: enq?.pickup_location || "" } : {} as Record<string, string>,
            delivery_flags_by_destination: _legacyDestCode ? { [_legacyDestCode]: _legacyDelivery } : {} as Record<string, "true" | "false">,
            delivery_locations_by_destination: _legacyDestCode ? { [_legacyDestCode]: enq?.delivery_location || "" } : {} as Record<string, string>,
            shipment_terms_code:
              enq?.shipment_terms_code_read || enq?.shipment_terms_code || "",
            icd: enq?.icd || "",
            service_remark: enq?.service_remark || "",
            commodity: enq?.commodity || "",
            dimension_unit: "Centimeter",
            diemensions: [],
            cargo_details: [] as any[],
          };

          // Handle cargo details based on service type
          // For OTHERS services, determine structure from cargo data presence or service_code
          let isOthersWithFCL = false;
          let isOthersWithAIR = false;
          let isOthersWithLCL = false;
          let isOthersWithInland = false;

          if (enq?.service === "OTHERS" && enq.service_code) {
            // Try to determine structure from otherServicesData if available
            const selectedOtherService = (otherServicesData || []).find(
              (item: any) => item.value === enq.service_code
            );
            if (selectedOtherService) {
              const transportMode = selectedOtherService.transport_mode || "";
              const fullGroupage = selectedOtherService.full_groupage || "";
              if (transportMode === "SEA" && fullGroupage === "FULL") {
                isOthersWithFCL = true;
              } else if (
                transportMode === "SEA" &&
                fullGroupage === "GROUPAGE"
              ) {
                isOthersWithLCL = true;
              } else if (transportMode === "NA") {
                isOthersWithInland = true;
              } else {
                isOthersWithAIR = true;
              }
            } else {
              // Fallback: determine structure from cargo data presence
              if (
                enq.fcl_details &&
                Array.isArray(enq.fcl_details) &&
                enq.fcl_details.length > 0
              ) {
                isOthersWithFCL = true;
              } else if (
                enq.volume_weight !== undefined &&
                enq.volume_weight !== null &&
                (enq.volume === undefined || enq.volume === null)
              ) {
                isOthersWithAIR = true;
              } else if (
                enq.volume !== undefined &&
                enq.volume !== null &&
                (enq.volume_weight === undefined || enq.volume_weight === null)
              ) {
                isOthersWithLCL = true;
              } else {
                // Default to AIR structure if we have volume_weight
                isOthersWithAIR =
                  enq.volume_weight !== undefined && enq.volume_weight !== null;
              }
            }
          }

          if (
            (enq?.service === "FCL" || isOthersWithFCL) &&
            enq.fcl_details &&
            Array.isArray(enq.fcl_details)
          ) {
            // FCL service with multiple containers (or OTHERS with FCL structure)
            serviceDetail.cargo_details = enq.fcl_details.map((fcl: any) => ({
              id: fcl.id || null,
              no_of_packages: null,
              gross_weight: fcl.gross_weight ? Number(fcl.gross_weight) : null,
              volume_weight: null,
              chargable_weight: null,
              volume: null,
              chargable_volume: null,
              container_type_code:
                fcl.container_type_code || fcl.container_type || null,
              no_of_containers: fcl.no_of_containers || null,
              hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
              un_no: enq.un_no || fcl.un_no || null,
              class:
                enq.class_name ||
                fcl.class_name ||
                enq.class ||
                fcl.class ||
                null,
              pkg_group: enq.pkg_group || fcl.pkg_group || null,
              stackable: enq.stackable ? "Yes" : "No",
            }));
          } else if (enq?.service === "AIR" || isOthersWithAIR || isOthersWithInland) {
            // AIR service with direct cargo fields (or OTHERS with AIR structure)
            serviceDetail.cargo_details = [
              {
                id: null,
                no_of_packages: enq.no_of_packages || null,
                gross_weight: enq.gross_weight
                  ? Number(enq.gross_weight)
                  : null,
                volume_weight: enq.volume_weight
                  ? Number(enq.volume_weight)
                  : null,
                chargable_weight: enq.chargeable_weight
                  ? Number(enq.chargeable_weight)
                  : null,
                volume: null,
                chargable_volume: null,
                container_type_code: null,
                no_of_containers: null,
                hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
                un_no: enq.un_no || null,
                class: enq.class_name || enq.class || null,
                pkg_group: enq.pkg_group || null,
                stackable: enq.stackable ? "Yes" : "No",
              },
            ];
          } else if (enq?.service === "LCL" || isOthersWithLCL) {
            // LCL service with direct cargo fields (or OTHERS with LCL structure)
            serviceDetail.cargo_details = [
              {
                id: null,
                no_of_packages: enq.no_of_packages || null,
                gross_weight: enq.gross_weight
                  ? Number(enq.gross_weight)
                  : null,
                volume_weight: null,
                chargable_weight: null,
                volume: enq.volume ? Number(enq.volume) : null,
                chargable_volume: enq.chargeable_volume
                  ? Number(enq.chargeable_volume)
                  : null,
                container_type_code: null,
                no_of_containers: null,
                hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
                un_no: enq.un_no || null,
                class: enq.class_name || enq.class || null,
                pkg_group: enq.pkg_group || null,
                stackable: enq.stackable ? "Yes" : "No",
              },
            ];
          } else {
            // Default cargo detail (for OTHERS when structure cannot be determined from data)
            serviceDetail.cargo_details = [
              {
                id: null,
                no_of_packages: enq.no_of_packages || null,
                gross_weight: enq.gross_weight
                  ? Number(enq.gross_weight)
                  : null,
                volume_weight: enq.volume_weight
                  ? Number(enq.volume_weight)
                  : null,
                chargable_weight: enq.chargeable_weight
                  ? Number(enq.chargeable_weight)
                  : null,
                volume: enq.volume ? Number(enq.volume) : null,
                chargable_volume: enq.chargeable_volume
                  ? Number(enq.chargeable_volume)
                  : null,
                container_type_code: null,
                no_of_containers: null,
                hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
                un_no: enq.un_no || null,
                class: enq.class_name || enq.class || null,
                pkg_group: enq.pkg_group || null,
                stackable: enq.stackable ? "Yes" : "No",
              },
            ];
          }

          // Handle dimension_data mapping from API response
          if (
            enq.dimension_data &&
            Array.isArray(enq.dimension_data) &&
            enq.dimension_data.length > 0
          ) {
            // Map dimension_data to diemensions format
            serviceDetail.diemensions = enq.dimension_data.map((dim: any) => ({
              id: dim.id || null,
              pieces: dim.pieces || 0,
              length: dim.length || 0,
              width: dim.width || 0,
              height: dim.height || 0,
              value: dim.value || 0,
              vol_weight: dim.volume_weight || 0,
            }));

            // Extract dimension_unit from first dimension item (all should have same unit)
            if (enq.dimension_data[0]?.dimension_unit) {
              serviceDetail.dimension_unit =
                enq.dimension_data[0].dimension_unit;
            }
          }

          serviceForm.setFieldValue("service_details", [serviceDetail]);
        }

        // Handle documents_list for supporting documents in edit mode
        if (enq?.documents_list && Array.isArray(enq.documents_list)) {
          const documents = enq.documents_list.map((doc: any) => ({
            name: doc.document_name || "",
            file: null, // Existing files don't need File object
            document_url: doc.document_url || "",
            document_id: doc.id || undefined,
            original_document_name: doc.file_name || "", // Store original file name from file_name key
          }));
          customerForm.setFieldValue("supporting_documents", documents);
        }

        // Note: Origin and destination display names will be handled by the SearchableSelect components
      }
      setIsInitialDataLoad(false); // Reset flag after data loading is complete
    } catch (error) {
      console.error("Error processing enquiry data:", error);
      setError(
        `Error processing enquiry data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }, [enq, termsOfShipment]);

  // Remove the auto-open chatbot logic completely
  // useEffect(() => {
  //   // Removed auto-open chatbot logic - chatbot is now global
  // }, [active]);

  // Store original values when edit data is loaded (for AIR/LCL services) - COMMENTED OUT TO FIX INFINITE LOOP
  // useEffect(() => {
  //   if (
  //     enq &&
  //     enq.actionType === "edit" &&
  //     serviceForm.values.service_details.length > 0
  //   ) {
  //     serviceForm.values.service_details.forEach(
  //       (serviceDetail, serviceIndex) => {
  //         if (
  //           serviceDetail.service === "AIR" ||
  //           serviceDetail.service === "LCL"
  //         ) {
  //           const key = `${serviceIndex}-${serviceDetail.service}`;
  //           const cargo = serviceDetail.cargo_details[0];
  //           if (cargo && !originalValuesRef.current[key]) {
  //             originalValuesRef.current[key] = {
  //               no_of_packages: cargo.no_of_packages || null,
  //               volume:
  //                 serviceDetail.service === "LCL"
  //                   ? cargo.volume || null
  //                   : undefined,
  //               volume_weight:
  //                 serviceDetail.service === "AIR"
  //                   ? cargo.volume_weight || null
  //                   : undefined,
  //             };
  //           }
  //         }
  //       }
  //     );
  //   }
  // }, [enq, serviceForm.values.service_details]);

  // Reset processed service indices when customer changes
  useEffect(() => {
    const customerCode = customerForm.values.customer_code;
    // Reset processed indices when customer changes so modal can show again for new customer
    setProcessedServiceIndices(new Set());
    setLastCheckedServiceIndex(null);
  }, [customerForm.values.customer_code]);

  // useEffect to check salesperson data when customer, service, and trade are all selected
  useEffect(() => {
    const customerCode = customerForm.values.customer_code;

    if (!customerCode) {
      return;
    }

    // Check all service details
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        const service = serviceDetail?.service;
        const trade = serviceDetail?.trade;

        // Only check if service index hasn't been processed yet
        if (service && trade && !processedServiceIndices.has(serviceIndex)) {
          // Small delay to ensure form values are updated
          const timeoutId = setTimeout(() => {
            checkSalespersonData(serviceIndex);
          }, 300);
          timeouts.push(timeoutId);
        }
      }
    );

    // Cleanup function
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [
    customerForm.values.customer_code,
    serviceForm.values.service_details,
    processedServiceIndices,
  ]);

  // Additional effect to populate fields when data is loaded
  useEffect(() => {
    if (enq && Array.isArray(termsOfShipment) && termsOfShipment.length > 0) {
      console.log("Data loaded, attempting to populate fields again");
      console.log("Current form values:", {
        service_details: serviceForm.values.service_details,
      });

      // Try to populate shipment terms field for each service detail
      serviceForm.values.service_details.forEach((serviceDetail, index) => {
        if (enq.shipment_terms_code && !serviceDetail.shipment_terms_code) {
          const tosOption = (termsOfShipment as TermsOfShipmentData[]).find(
            (item: TermsOfShipmentData) =>
              item.tos_code === enq.shipment_terms_code
          );
          if (tosOption) {
            console.log(
              "Setting shipment_terms_code from data loaded effect:",
              tosOption.tos_code
            );
            serviceForm.setFieldValue(
              `service_details.${index}.shipment_terms_code`,
              tosOption.tos_code
            );
          }
        }

        if (
          enq.shipment_terms_code_read &&
          !serviceDetail.shipment_terms_code
        ) {
          const tosOption = (termsOfShipment as TermsOfShipmentData[]).find(
            (item: TermsOfShipmentData) =>
              item.tos_code === enq.shipment_terms_code_read
          );
          if (tosOption) {
            console.log(
              "Setting shipment_terms_code from shipment_terms_code_read:",
              tosOption.tos_code
            );
            serviceForm.setFieldValue(
              `service_details.${index}.shipment_terms_code`,
              tosOption.tos_code
            );
          }
        }
      });
    }
  }, [enq, termsOfShipment, serviceForm.values.service_details]);

  // Additional effect to handle sales person population in edit mode after salespersons data is loaded
  useEffect(() => {
    // console.log("🔧 Edit mode effect triggered:", {
    //   hasEnq: !!enq,
    //   actionType: enq?.actionType,
    //   salespersonsDataLength: salespersonsData.length,
    //   enquirySalesPerson: enq?.sales_person,
    //   currentSalesPerson: customerForm.values.sales_person,
    // });

    if (enq && enq.actionType === "edit" && salespersonsData.length > 0) {
      // If we have sales person data in enquiry and salespersons are loaded, ensure it's populated
      if (enq.sales_person && !customerForm.values.sales_person) {
        console.log(
          "✅ Populating sales person fields in edit mode:",
          enq.sales_person
        );
        customerForm.setFieldValue("sales_person", enq.sales_person);
        customerForm.setFieldValue(
          "sales_coordinator",
          enq.sales_coordinator || ""
        );
        customerForm.setFieldValue(
          "customer_services",
          enq.customer_services || ""
        );
      }
    }
  }, [enq, salespersonsData]);

  // Final verification effect to ensure sales person is populated in edit mode
  useEffect(() => {
    if (
      enq &&
      enq.actionType === "edit" &&
      enq.sales_person &&
      !isInitialDataLoad
    ) {
      console.log("🔍 Final verification - checking sales person field:", {
        enquirySalesPerson: enq.sales_person,
        currentSalesPerson: customerForm.values.sales_person,
        salespersonsDataLength: salespersonsData.length,
      });

      // If sales person is not populated but we have the data, populate it
      if (!customerForm.values.sales_person && salespersonsData.length > 0) {
        console.log("🔄 Final population of sales person:", enq.sales_person);
        customerForm.setFieldValue("sales_person", enq.sales_person);
        customerForm.setFieldValue(
          "sales_coordinator",
          enq.sales_coordinator || ""
        );
        customerForm.setFieldValue(
          "customer_services",
          enq.customer_services || ""
        );
      }
    }
  }, [
    enq,
    // customerForm.values.sales_person,
    salespersonsData.length,
    isInitialDataLoad,
  ]);

  // Track component mount to prevent duplicate API calls
  useEffect(() => {
    console.log("🏁 EnquiryCreate component mounted");
    return () => {
      console.log("🏁 EnquiryCreate component unmounted");
    };
  }, []);

  // Function to handle customer selection and refetch salespersons
  const handleCustomerSelection = async (customerId: string) => {
    console.log(
      "🎯 handleCustomerSelection called with customerId:",
      customerId,
      "Timestamp:",
      new Date().toISOString()
    );

    // Only refetch if customerId is different from current
    if (!customerId) {
      console.log("🔄 Resetting to initial state");
      // Reset to initial state
      if (!salespersonsApiCalled) {
        refetchSalespersons();
        setSalespersonsApiCalled(true);
      }
      return;
    }

    // Refetch salespersons with the selected customer_id
    try {
      console.log("📞 Calling fetchSalespersons for customer:", customerId);
      const response = (await fetchSalespersons(
        customerId
      )) as SalespersonsResponse;

      if (response?.success && response?.data) {
        // Case 2: If API returns single salesperson, auto-fill all fields
        if (response.data.length === 1) {
          const salesperson = response.data[0];
          customerForm.setFieldValue(
            "sales_person",
            salesperson.sales_person || ""
          );
          customerForm.setFieldValue(
            "sales_coordinator",
            salesperson.sales_coordinator || ""
          );
          customerForm.setFieldValue(
            "customer_services",
            salesperson.customer_service || ""
          );
        } else if (response.data.length > 1) {
          // Case 1: Multiple salespersons - clear fields and let user select
          customerForm.setFieldValue("sales_person", "");
          customerForm.setFieldValue("sales_coordinator", "");
          customerForm.setFieldValue("customer_services", "");
        }
      } else if (!response?.success) {
        // If API fails, don't do any action
        console.log("Salespersons API failed:", response?.message);
      }
    } catch (error) {
      console.error("Error fetching salespersons for customer:", error);
    }
  };

  const fetchCustomerData = async (
    customerCode: string,
    fromDate?: Date | null,
    toDate?: Date | null
  ) => {
    try {
      setIsLoadingData(true);

      // Use provided dates or current state values
      const fromDateToUse = fromDate ?? customerDataFromDate;
      const toDateToUse = toDate ?? customerDataToDate;

      if (!fromDateToUse || !toDateToUse) {
        console.error("Date range is required");
        setIsLoadingData(false);
        return;
      }

      // Format dates as YYYY-MM-DD
      const dateFrom = dayjs(fromDateToUse).format("YYYY-MM-DD");
      const dateTo = dayjs(toDateToUse).format("YYYY-MM-DD");

      const payload: {
        customer_code: string;
        date_from: string;
        date_to: string;
      } = {
        customer_code: customerCode,
        date_from: dateFrom,
        date_to: dateTo,
      };

      const customerData = (await postAPICall(
        `${URL.customerData}`,
        payload as any
      )) as CustomerDataResponse;

      // Extract data from the new combined API response
      if (customerData) {
        // Set customer name from customer_info if available
        if (
          customerData.customer_info &&
          customerData.customer_info.customer_name
        ) {
          setSelectedCustomerName(customerData.customer_info.customer_name);
        }

        // Set customer info fields
        if (customerData.customer_info) {
          setCustomerCreditDay(customerData.customer_info.credit_day);
          setCustomerSalesperson(customerData.customer_info.salesperson);
          setCustomerLastVisited(customerData.customer_info.last_visited);
          setCustomerTotalCreditAmount(
            customerData.customer_info.total_credit_amount
          );
          setTotalRevenue(
            customerData.customer_info.overall_total_revenue ?? null
          );
          setTotalProfit(customerData.customer_info.overall_total_gp ?? null);
          if (customerData.customer_info.total_net_balance !== undefined) {
            setTotalOutstandingAmount(
              customerData.customer_info.total_net_balance
            );
          }
          setCustomerCurrency(customerData.customer_info.currency || "");
        }
        const customerDataWithNetwork = customerData as CustomerDataResponse & { network_id?: number | null; network_name?: string | null };
        if (
          customerDataWithNetwork.network_id != null ||
          customerDataWithNetwork.network_name
        ) {
          customerForm.setFieldValue(
            "network_id",
            customerDataWithNetwork.network_id != null
              ? String(customerDataWithNetwork.network_id)
              : ""
          );
          customerForm.setFieldValue(
            "network_name",
            customerDataWithNetwork.network_name || ""
          );
        }

        // Set quotations data
        if (customerData.quotations && customerData.quotations.data) {
          setCustomerQuotationData(customerData.quotations.data);
        }

        // Set call entries data
        if (customerData.call_entries && customerData.call_entries.data) {
          setCallEntryData(customerData.call_entries.data);
        }

        // Set shipment data
        if (customerData.shipment && customerData.shipment.data) {
          setShipmentData(customerData.shipment.data);
        } else {
          setShipmentData([]);
        }

        // Set potential profiling data
        if (
          customerData.potential_profiling &&
          customerData.potential_profiling.data
        ) {
          setPotentialProfilingData(customerData.potential_profiling.data);
        } else {
          setPotentialProfilingData([]);
        }
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
      ToastNotification({
        type: "error",
        message: "Failed to fetch customer data",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  if (error) {
    return (
      <Box p="md" maw={1200} mx="auto">
        <Text color="red" size="lg" ta="center">
          Something went wrong: {error}
        </Text>
        <Button mt="md" onClick={() => setError(null)} color="#105476">
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box
        style={{
          backgroundColor: "#F8F8F8",
          position: "relative",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
          {/* Header */}

          <Flex
            gap="md"
            align="flex-start"
            style={{ height: "calc(100vh - 112px)", width: "100%" }}
          >
            {/* Vertical Stepper Sidebar - Hide when QuotationCreate has its own stepper */}
            {!(showQuotation && active === 2) && (
              <Box
                style={{
                  minWidth: 180,
                  width: "100%",
                  maxWidth: 220,
                  height: "100%",
                  alignSelf: "stretch",
                  borderRadius: "8px",
                  backgroundColor: "#FFFFFF",
                  position: "sticky",
                  top: 0,
                  zIndex: auditInfoHovered
                    ? EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX.hovered
                    : EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX.default,
                  overflow: "visible",
                }}
              >
                <Box
                  style={{
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                  }}
                >
                  <Group gap={6} justify="center" wrap="nowrap">
                    <Text
                      size="md"
                      fw={600}
                      c="#105476"
                      style={{
                        fontFamily: "Inter",
                        fontStyle: "medium",
                        fontSize: "16px",
                        color: "#105476",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        // Determine title based on actionType and whether quotation step is shown
                        if (enq?.actionType === "editQuotation") {
                          return "Edit Quotation";
                        } else if (enq?.actionType === "createQuote") {
                          return "Create Quotation";
                        } else if (enq?.actionType === "edit") {
                          return `Edit ${moduleLabel}`;
                        } else if (enq?.id || enq?.enquiry_id) {
                          // Only check for actual enquiry ID, not form values (which could be from create mode)
                          return `Edit ${moduleLabel}`;
                        } else {
                          return `Create New ${moduleLabel}`;
                        }
                      })()}
                    </Text>
                    <EditPageAuditInfoIcon
                      visible={showEditAuditInfo}
                      auditInfo={enquiryAuditInfo}
                      animateKey={enq?.id || enq?.enquiry_id}
                      ariaLabel={`${moduleLabel} audit info`}
                      onHoverChange={setAuditInfoHovered}
                    />
                  </Group>
                </Box>
                <Stack gap="sm" style={{ height: "100%", padding: "10px" }}>
                  <Box
                    onClick={() => handleStepClick(0)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex align="center" gap="sm">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: active > 0 ? "#EAF9F1" : "#E6F2F8",
                          border:
                            active > 0
                              ? "none"
                              : active === 0
                                ? "2px solid #105476"
                                : "2px solid #d1d5db",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          color:
                            active > 0
                              ? "white"
                              : active === 0
                                ? "#105476"
                                : "#9ca3af",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        {active > 0 ? (
                          <IconCircleCheck
                            size={20}
                            color="#289D69"
                            fill="#EAF9F1"
                          />
                        ) : (
                          // <IconCheck size={20} />
                          <IconUser size={20} color="#105476" fill="#E6F2F8" />
                        )}
                      </Box>
                      <Text
                        size="sm"
                        fw={400}
                        c="#105476"
                        style={{
                          lineHeight: 1.3,
                          fontFamily: "Inter",
                          fontStyle: "regular",
                          fontSize: "13px",
                          color: "#105476",
                        }}
                      >
                        Customer Details
                      </Text>
                    </Flex>
                  </Box>

                  {/* Vertical dotted line connector */}
                  <Box
                    style={{
                      height: "24px",
                      width: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "0",
                      position: "relative",
                    }}
                  >
                    <Box
                      style={{
                        width: "2px",
                        height: "100%",
                        borderLeft: "2px dotted #d1d5db",
                        // marginLeft: "19px", // Center it with the icon (40px / 2 = 20px, minus 1px for border)
                      }}
                    />
                  </Box>

                  <Box
                    onClick={() => handleStepClick(1)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex align="center" gap="sm">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: active > 1 ? "#EAF9F1" : "#fff",
                          border:
                            active > 1
                              ? "none"
                              : active === 1
                                ? "2px solid #105476"
                                : "2px solid #d1d5db",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          color:
                            active > 1
                              ? "white"
                              : active === 1
                                ? "#105476"
                                : "#9ca3af",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        {active > 1 ? (
                          <IconCircleCheck
                            size={20}
                            color="#289D69"
                            fill="#EAF9F1"
                          />
                        ) : (
                          <IconTruckDelivery
                            size={20}
                            color="#105476"
                            fill="#E6F2F8"
                          />
                        )}
                      </Box>
                      <Text
                        size="sm"
                        fw={400}
                        c="#374151"
                        style={{
                          lineHeight: 1.3,
                          fontFamily: "Inter",
                          fontStyle: "regular",
                          fontSize: "13px",
                          color: "#105476",
                        }}
                      >
                        Service & Cargo Details
                      </Text>
                    </Flex>
                  </Box>

                  {showQuotation && (
                    <>
                      {/* Vertical dotted line connector */}
                      <Box
                        style={{
                          height: "24px",
                          width: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginLeft: "0",
                          position: "relative",
                        }}
                      >
                        <Box
                          style={{
                            width: "2px",
                            height: "100%",
                            borderLeft: "2px dotted #d1d5db",
                          }}
                        />
                      </Box>

                      <Box
                        onClick={() => handleStepClick(2)}
                        style={{
                          cursor: "pointer",
                          padding: "4px 0",
                          transition: "all 0.2s",
                        }}
                      >
                        <Flex align="center" gap="sm">
                          <Box
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              backgroundColor: active > 2 ? "#EAF9F1" : "#fff",
                              border:
                                active > 2
                                  ? "none"
                                  : active === 2
                                    ? "2px solid #105476"
                                    : "2px solid #d1d5db",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                              fontWeight: 600,
                              color:
                                active > 2
                                  ? "white"
                                  : active === 2
                                    ? "#105476"
                                    : "#9ca3af",
                              transition: "all 0.2s",
                              flexShrink: 0,
                            }}
                          >
                            {active > 2 ? (
                              <IconCircleCheck
                                size={20}
                                color="#289D69"
                                fill="#EAF9F1"
                              />
                            ) : (
                              <IconFileText
                                size={20}
                                color="#105476"
                                fill="#E6F2F8"
                              />
                            )}
                          </Box>
                          <Text
                            size="sm"
                            fw={400}
                            c="#374151"
                            style={{
                              lineHeight: 1.3,
                              fontFamily: "Inter",
                              fontStyle: "regular",
                              fontSize: "13px",
                              color: "#105476",
                            }}
                          >
                            Quotation
                          </Text>
                        </Flex>
                      </Box>
                    </>
                  )}
                </Stack>
              </Box>
            )}

            {/* Main Content Area */}
            <Box
              style={{
                flex: 1,
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 100px)",
                overflow: "hidden",
              }}
            >
              {active === 0 && (
                <>
                  <Box
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      paddingBottom: "16px",
                      backgroundColor: "#F8F8F8",
                    }}
                  >
                    <Grid
                      style={{ backgroundColor: "#FFFFFF", padding: "10px" }}
                    >
                      <Grid.Col span={6}>
                        <Flex gap="sm" align="flex-end">
                          <div
                            style={{
                              flex: customerForm.values.customer_code
                                ? 0.75
                                : 1,
                              transition: "flex 0.3s ease",
                            }}
                          >
                            <SearchableSelect
                              key={customerForm.key("customer_code")}
                              label="Customer Name"
                              required
                              apiEndpoint={URL.customer}
                              placeholder="Type customer name"
                              searchFields={["customer_code", "customer_name"]}
                              returnOriginalData={true}
                              displayFormat={(item: any) => ({
                                value: String(item.customer_code),
                                label: String(item.customer_name), // Show only customer name
                              })}
                              value={customerForm.values.customer_code}
                              displayValue={customerDisplayName}
                              onChange={(value, selectedData, originalData) => {
                                customerForm.setFieldValue(
                                  "customer_code",
                                  value || ""
                                );
                                // Update display name and selected name
                                if (value && selectedData) {
                                  const customerName = selectedData.label;
                                  setCustomerDisplayName(customerName);
                                  setSelectedCustomerName(customerName);

                                  // Extract primary address from originalData
                                  if (
                                    originalData &&
                                    typeof originalData === "object"
                                  ) {
                                    const customerData = originalData as Record<string, unknown>;
                                    if (
                                      customerData.network_id != null ||
                                      customerData.network_name
                                    ) {
                                      customerForm.setFieldValue(
                                        "network_id",
                                        customerData.network_id != null
                                          ? String(customerData.network_id)
                                          : ""
                                      );
                                      customerForm.setFieldValue(
                                        "network_name",
                                        (customerData.network_name as string) || ""
                                      );
                                    }
                                    if (
                                      customerData.addresses_data &&
                                      Array.isArray(customerData.addresses_data)
                                    ) {
                                      // Find primary address (case-insensitive match)
                                      const primaryAddress =
                                        customerData.addresses_data.find(
                                          (addr: any) =>
                                            addr?.address_type &&
                                            addr.address_type.toUpperCase() ===
                                              "PRIMARY"
                                        );

                                      // Set customer_address only if:
                                      // 1. Not initial load AND not in edit mode, OR
                                      // 2. Not initial load AND in edit mode but customer changed, OR
                                      // 3. Not initial load AND in edit mode and customer_address is empty
                                      const shouldSetAddress =
                                        !isInitialDataLoad &&
                                        (enq?.actionType !== "edit" ||
                                          enq?.customer_code_read !== value ||
                                          !customerForm.values
                                            .customer_address);

                                      if (
                                        primaryAddress?.address &&
                                        shouldSetAddress
                                      ) {
                                        customerForm.setFieldValue(
                                          "customer_address",
                                          primaryAddress.address
                                        );
                                      }
                                    }
                                  }

                                  // Only call handleCustomerSelection if this is not initial data load and not edit mode or if customer changed
                                  if (
                                    !isInitialDataLoad &&
                                    (enq?.actionType !== "edit" ||
                                      enq?.customer_code_read !== value)
                                  ) {
                                    handleCustomerSelection(value);
                                  }

                                  // Check salesperson data if service and trade are already selected
                                  // Check all service details
                                  serviceForm.values.service_details.forEach(
                                    (_, idx) => {
                                      const serviceDetail =
                                        serviceForm.values.service_details[idx];
                                      if (
                                        serviceDetail?.service &&
                                        serviceDetail?.trade
                                      ) {
                                        setTimeout(() => {
                                          checkSalespersonData(idx);
                                        }, 200);
                                      }
                                    }
                                  );
                                } else {
                                  setCustomerDisplayName(null);
                                  setSelectedCustomerName(null);
                                  // Clear customer_address and network when customer is cleared
                                  customerForm.setFieldValue(
                                    "customer_address",
                                    ""
                                  );
                                  customerForm.setFieldValue("network_id", "");
                                  customerForm.setFieldValue("network_name", "");
                                  // Reset salespersons to initial state (empty customer_id)
                                  if (
                                    !isInitialDataLoad &&
                                    enq?.actionType !== "edit" &&
                                    !salespersonsApiCalled
                                  ) {
                                    console.log(
                                      "🔄 Customer cleared - refetching salespersons"
                                    );
                                    refetchSalespersons();
                                    setSalespersonsApiCalled(true);
                                  }
                                }
                              }}
                              error={
                                customerForm.errors.customer_code as string
                              }
                              minSearchLength={3}
                            />
                          </div>

                          {customerForm.values.customer_code && (
                            <div style={{ flex: 0.25 }}>
                              <Group gap={6}>
                                <Button
                                  size="xs"
                                  mb={4}
                                  color="#105476"
                                  onClick={() => {
                                    const customerCode =
                                      customerForm.values.customer_code;
                                    if (customerCode) {
                                      fetchCustomerData(
                                        customerCode,
                                        customerDataFromDate,
                                        customerDataToDate
                                      );
                                      openCustomerDataDrawer();
                                    }
                                  }}
                                >
                                  <IconInfoCircle size={16} />
                                </Button>
                                <Button
                                  size="xs"
                                  mb={4}
                                  color="#105476"
                                  variant="outline"
                                  onClick={() => {
                                    const customerCode =
                                      customerForm.values.customer_code;
                                    if (!customerCode) return;
                                    openLastEnquiriesDrawer();
                                  }}
                                >
                                  <IconCopy size={16} />
                                </Button>
                              </Group>
                            </div>
                          )}
                        </Flex>
                        <Drawer
                          opened={lastEnquiriesDrawerOpened}
                          onClose={() => {
                            closeLastEnquiriesDrawer();
                          }}
                          position="right"
                          size="70%"
                        title={`Last ${lastModulePluralDisplay}`}
                          titleProps={{
                            style: {
                              fontWeight: "bold",
                            }
                          }}
                        >
                          <LastEnquiriesList
                            customerCode={customerForm.values.customer_code}
                            moduleLabel={moduleLabel}
                            moduleKeyPrefix={moduleKeyPrefix}
                            onRowSelect={(row) => {
                              closeLastEnquiriesDrawer();
                              setEnq({
                                ...(row as any),
                                actionType: "createEnquiry",
                                id: undefined,
                                enquiry_id: undefined,
                                prefillFromLastEnquiries: true,
                              });
                            }}
                          />
                        </Drawer>
                        <CustomerDataDrawer
                          opened={customerDataDrawer}
                          onClose={() => {
                            closeCustomerDataDrawer();
                            setCustomerQuotationData([]);
                            setCallEntryData([]);
                            setShipmentData([]);
                            setPotentialProfilingData([]);
                            setCustomerCreditDay(null);
                            setCustomerSalesperson(null);
                            setCustomerLastVisited(null);
                            setCustomerTotalCreditAmount(null);
                            setTotalRevenue(null);
                            setTotalProfit(null);

                            const previousMonthRange = getPreviousMonthRange();
                            setCustomerDataFromDate(previousMonthRange.from);
                            setCustomerDataToDate(previousMonthRange.to);
                          }}
                          title={`Customer Data for ${
                            selectedCustomerName || customerForm.values.customer_code
                          }`}

                          // loading
                          isLoading={isLoadingData}

                          // customer info props
                          customerSalesperson={customerSalesperson}
                          customerCreditDay={customerCreditDay}
                          customerLastVisited={customerLastVisited}
                          customerTotalCreditAmount={customerTotalCreditAmount}
                          totalOutstandingAmount={totalOutstandingAmount}
                          customerCurrency={customerCurrency}
                          totalRevenue={totalRevenue}
                          totalProfit={totalProfit}

                          // admin date filter
                          isAdmin={user?.is_staff || false}
                          fromDate={customerDataFromDate}
                          toDate={customerDataToDate}
                          onFromDateChange={(date) => {
                            setCustomerDataFromDate(date);

                            const customerCode = customerForm.values.customer_code;
                            if (customerCode && date && customerDataToDate) {
                              fetchCustomerData(customerCode, date, customerDataToDate);
                            }
                          }}
                          onToDateChange={(date) => {
                            setCustomerDataToDate(date);

                            const customerCode = customerForm.values.customer_code;
                            if (customerCode && customerDataFromDate && date) {
                              fetchCustomerData(customerCode, customerDataFromDate, date);
                            }
                          }}

                          // Section data
                          quotationData={customerQuotationData}
                          shipmentData={shipmentData}
                          callEntryData={callEntryData}
                          potentialProfilingData={potentialProfilingData}

                          // Navigate handler for quotations
                          onQuotationClick={(quotation) => {
                            const customerCode = customerForm.values.customer_code;

                            navigate("/quotation-create", {
                              state: {
                                enquiry_id: quotation.enquiry_id,
                                service: quotation.service,
                                quotationData: quotation,
                                customerData: {
                                  customer_code: customerCode,
                                  customer_name:
                                    quotation.customer_name || selectedCustomerName,
                                  total_net_balance: totalOutstandingAmount,
                                },
                                returnTo: "customer-create",
                                returnToState: {
                                  customer: customerCode,
                                  customerName:
                                    quotation.customer_name || selectedCustomerName,
                                  openDrawer: true,
                                },
                              },
                            });
                          }}
                        />

                      </Grid.Col>

                      <Grid.Col span={6}>
                        <Box
                          // maw={300}
                          mx="auto"
                        >
                          <SingleDateInput
                            label={`${moduleLabel} Received Date`}
                            withAsterisk
                            placeholder="YYYY-MM-DD"
                            key={customerForm.key("enquiry_received_date")}
                            value={
                              customerForm.values.enquiry_received_date
                                ? dayjs(
                                    customerForm.values.enquiry_received_date
                                  ).toDate()
                                : new Date()
                            }
                            onChange={(date) => {
                              const formatted = date
                                ? dayjs(date).format("YYYY-MM-DD")
                                : "";
                              customerForm.setFieldValue(
                                "enquiry_received_date",
                                formatted
                              );
                            }}
                            error={customerForm.errors.enquiry_received_date}
                            valueFormat="YYYY-MM-DD"
                            leftSection={<IconCalendar size={18} />}
                            leftSectionPointerEvents="none"
                            radius="sm"
                            size="sm"
                            nextIcon={<IconChevronRight size={16} />}
                            previousIcon={<IconChevronLeft size={16} />}
                          />
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Dropdown
                          label="Sales Person"
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          key={customerForm.key("sales_person")}
                          withAsterisk
                          placeholder="Select Salesperson"
                          searchable
                          data={salespersonsData}
                          nothingFoundMessage="No salespersons found"
                          {...customerForm.getInputProps("sales_person")}
                          onChange={(value) => {
                            customerForm.setFieldValue(
                              "sales_person",
                              value || ""
                            );

                            // Auto-fill sales coordinator and customer service based on selected sales person
                            if (value) {
                              const selectedSalesperson = salespersonsData.find(
                                (person: {
                                  value: string;
                                  sales_coordinator: string;
                                  customer_service: string;
                                }) => person.value === value
                              );
                              if (selectedSalesperson) {
                                customerForm.setFieldValue(
                                  "sales_coordinator",
                                  selectedSalesperson.sales_coordinator || ""
                                );
                                customerForm.setFieldValue(
                                  "customer_services",
                                  selectedSalesperson.customer_service || ""
                                );
                              }
                            } else {
                              // Clear fields if no salesperson selected
                              customerForm.setFieldValue(
                                "sales_coordinator",
                                ""
                              );
                              customerForm.setFieldValue(
                                "customer_services",
                                ""
                              );
                            }
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Pricing"
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          key={customerForm.key("sales_coordinator")}
                          value={customerForm.values.sales_coordinator}
                          onChange={(e) => {
                            const formattedValue = toTitleCase(e.target.value);
                            customerForm.setFieldValue(
                              "sales_coordinator",
                              formattedValue
                            );
                          }}
                          error={customerForm.errors.sales_coordinator}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Customer Service"
                          key={customerForm.key("customer_services")}
                          value={customerForm.values.customer_services}
                          onChange={(e) => {
                            const formattedValue = toTitleCase(e.target.value);
                            customerForm.setFieldValue(
                              "customer_services",
                              formattedValue
                            );
                          }}
                          error={customerForm.errors.customer_services}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Reference No"
                          key={customerForm.key("reference_no")}
                          placeholder="Enter reference number"
                          maxLength={100}
                          {...customerForm.getInputProps("reference_no")}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <SearchableSelect
                          label="Network Name"
                          placeholder="Search network..."
                          apiEndpoint={URL.networkMaster}
                          value={customerForm.values.network_id || null}
                          displayValue={customerForm.values.network_name || null}
                          onChange={(value, selectedData) => {
                            customerForm.setFieldValue("network_id", value ?? "");
                            customerForm.setFieldValue(
                              "network_name",
                              selectedData?.label ?? ""
                            );
                          }}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.id ?? ""),
                            label: String(item.network_name ?? ""),
                          })}
                          searchFields={["network_name"]}
                          dropdownZIndex={1000}
                          minSearchLength={1}
                        />
                      </Grid.Col>
                      {/* Customer Address field is hidden in the new design */}
                      {/* <Grid.Col span={6}>
                    <TextInput
                      label="Customer Address"
                      key={customerForm.key("customer_address")}
                      placeholder="Enter Customer Address"
                      value={customerForm.values.customer_address}
                      onChange={(e) => {
                        const formattedValue = toTitleCase(e.target.value);
                        customerForm.setFieldValue(
                          "customer_address",
                          formattedValue
                        );
                      }}
                      error={customerForm.errors.customer_address}
                    />
                  </Grid.Col> */}
                    </Grid>
                  </Box>

                  {/* Buttons for Step 0 */}
                  <Box
                    style={{
                      borderTop: "1px solid #e9ecef",
                      padding: "20px 32px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#d0d0d0",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            // Restore filter state if preserved
                            const preserveFilters = (location.state as any)
                              ?.preserveFilters;
                            // Check if we came from enquiry or quotation
                            const fromEnquiry = (location.state as any)
                              ?.fromEnquiry;
                            const actionType = (location.state as any)
                              ?.actionType;

                            // Navigate to the correct list based on source
                            // If came from call entry (actionType === "createEnquiry"), go back to call entry list
                            if (actionType === "createEnquiry") {
                              // Came from call entry list, go back to call entry list
                              if (preserveFilters) {
                                navigate("/call-entry", {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/call-entry", {
                                  state: { refreshData: true },
                                });
                              }
                            } else if (fromEnquiry || actionType === "edit") {
                              // Came from enquiry list or editing enquiry, go back to enquiry list
                              if (preserveFilters) {
                                navigate(moduleListPath, {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate(moduleListPath, {
                                  state: { refreshData: true },
                                });
                              }
                            } else {
                              // Default: navigate to quotation list (from quotation or new)
                              if (preserveFilters) {
                                navigate("/quotation", {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/quotation", {
                                  state: { refreshData: true },
                                });
                              }
                            }
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#d0d0d0",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            customerForm.reset();
                            setCustomerDisplayName(null);
                            setSelectedCustomerName(null);
                          }}
                        >
                          Clear all
                        </Button>
                      </Group>
                      <Group gap="sm">
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          disabled={
                            !(
                              enq?.actionType === "editQuotation" ||
                              enq?.actionType === "createQuote"
                            )
                          }
                          styles={{
                            root: {
                              borderColor: "#e0e0e0",
                              color: "#999",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            // If from edit quotation or create quote flow, navigate to quotation list
                            if (
                              enq?.actionType === "editQuotation" ||
                              enq?.actionType === "createQuote"
                            ) {
                              const preserveFilters = (enq as any)
                                ?.preserveFilters;
                              if (preserveFilters) {
                                navigate("/quotation", {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/quotation", {
                                  state: { refreshData: true },
                                });
                              }
                            }
                          }}
                        >
                          Back
                        </Button>
                        <Button
                          onClick={() => handleNext()}
                          size="sm"
                          style={{
                            backgroundColor: "#105476",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          }}
                        >
                          Next
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </>
              )}

              {active === 1 && (
                <>
                  <Box
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      // padding: "32px",
                      paddingBottom: "16px",
                      backgroundColor: "#F8F8F8",
                    }}
                  >
                    {/* Service Details Section */}

                    {/* Dynamic Service Details */}
                    <Stack gap="lg" style={{ backgroundColor: "#F8F8F8" }}>
                      <Box
                        style={{
                          border: "1px solid #e9ecef",
                          borderRadius: "8px",
                          padding: "24px",
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        <Text 
                          size="lg"
                          fw={600}
                          c="#105476"
                          style={{
                            paddingBottom: "4px",
                            fontFamily: "Inter",
                            fontStyle: "semibold",
                            fontSize: "16px",
                            color: "#105476",
                            }}
                          >
                            Service Details
                          </Text>
                        {/* SECTION A — Common Fields */}
                        {(() => {
                          const serviceIndex = 0;
                          const serviceDetail = serviceForm.values.service_details[0];
                          if (!serviceDetail) return null;
                          return (
                            <>
                            <Grid>
                              <Grid.Col span={3}>
                                <Dropdown
                                  label="Service"
                                  styles={{
                                    input: {
                                      fontSize: "13px",
                                      fontFamily: "Inter",
                                      height: "36px",
                                    },
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  searchable
                                  withAsterisk
                                  placeholder="Select Service"
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.service`
                                  )}
                                  data={["AIR", "FCL", "LCL", "OTHERS"]}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.service
                                  }
                                  onChange={(value) => {
                                    const previousService =
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.service;

                                    // Set the new service value
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.service`,
                                      value || ""
                                    );

                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.origin_code`,
                                      ""
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.origin_name`,
                                      ""
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.origin_codes` as any,
                                      []
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.origin_display_values` as any,
                                      {}
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.destination_code`,
                                      ""
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.destination_name`,
                                      ""
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.destination_codes` as any,
                                      []
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.destination_display_values` as any,
                                      {}
                                    )
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.rfq_port_pair_refs`,
                                      []
                                    )

                                    // Clear service_code and service_name when service changes
                                    if (value !== "OTHERS") {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.service_code`,
                                        ""
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.service_name`,
                                        ""
                                      );
                                    } else {
                                      // Clear trade when OTHERS is selected
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.trade`,
                                        ""
                                      );
                                    }

                                    // Reset last checked index when service changes
                                    setLastCheckedServiceIndex(null);

                                    // Check salesperson data if customer, service, and trade are all selected (only for non-OTHERS)
                                    if (value && value !== "OTHERS") {
                                      setTimeout(() => {
                                        const currentService =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.service;
                                        const currentTrade =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.trade;
                                        if (
                                          currentService &&
                                          customerForm.values.customer_code &&
                                          currentTrade
                                        ) {
                                          checkSalespersonData(serviceIndex);
                                        }
                                      }, 200);
                                    }

                                    // Clear cargo details when service changes
                                    if (previousService !== value && value) {
                                      // Reset cargo_details to default empty state
                                      const defaultCargoDetail = {
                                        no_of_packages: null,
                                        gross_weight: null,
                                        volume_weight: null,
                                        chargable_weight: null,
                                        volume: null,
                                        chargable_volume: null,
                                        container_type_code: null,
                                        no_of_containers: null,
                                        hazardous_cargo: "No",
                                        un_no: null,
                                        class: null,
                                        pkg_group: null,
                                        stackable: "Yes",
                                      };

                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.cargo_details`,
                                        [defaultCargoDetail]
                                      );

                                      // Reset dimensions (AIR/LCL)
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.dimension_unit`,
                                        "Centimeter"
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.diemensions`,
                                        []
                                      );

                                      // Clear any validation errors for cargo details
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.volume`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.container_type_code`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.no_of_containers`
                                      );
                                    }
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.service`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                {serviceForm.values.service_details[
                                  serviceIndex
                                ]?.service === "OTHERS" ? (
                                  <Dropdown
                                    label="Service Name"
                                    styles={{
                                      input: {
                                        fontSize: "13px",
                                        fontFamily: "Inter",
                                        height: "36px",
                                      },
                                      label: {
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "#424242",
                                        marginBottom: "4px",
                                        fontFamily: "Inter",
                                        fontStyle: "medium",
                                      },
                                    }}
                                    placeholder="Select Service Name"
                                    searchable
                                    withAsterisk
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.service_code`
                                    )}
                                    data={otherServicesData}
                                    value={
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.service_code || ""
                                    }
                                    onChange={(value) => {
                                      const selectedService =
                                        otherServicesData.find(
                                          (item) => item.value === value
                                        );

                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.service_code`,
                                        value || ""
                                      );

                                      if (selectedService) {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.service_name`,
                                          selectedService.label || ""
                                        );

                                        if (
                                          (selectedService.transport_mode ||
                                            "") !== "NA"
                                        ) {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.trade`,
                                            "",
                                          );
                                        }

                                        // Determine cargo structure based on transport_mode and full_groupage
                                        const transportMode =
                                          selectedService.transport_mode || "";
                                        const fullGroupage =
                                          selectedService.full_groupage || "";

                                        const cargoStructure =
                                          resolveEffectiveServiceFromTransport(
                                            transportMode,
                                            fullGroupage,
                                          );

                                        // Reset cargo_details based on determined structure
                                        if (cargoStructure === "FCL") {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.cargo_details`,
                                            [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: "No",
                                                stackable: "Yes",
                                              },
                                            ]
                                          );
                                          // Clear dimensions for FCL
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.dimension_unit`,
                                            "Centimeter"
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.diemensions`,
                                            []
                                          );
                                        } else if (cargoStructure === "LCL") {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.cargo_details`,
                                            [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: "No",
                                                stackable: "Yes",
                                              },
                                            ]
                                          );
                                          // Reset dimensions for LCL
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.dimension_unit`,
                                            "Centimeter"
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.diemensions`,
                                            []
                                          );
                                        } else {
                                          // AIR structure
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.cargo_details`,
                                            [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: "No",
                                                stackable: "Yes",
                                              },
                                            ]
                                          );
                                          // Reset dimensions for AIR
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.dimension_unit`,
                                            "Centimeter"
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.diemensions`,
                                            []
                                          );
                                        }
                                      }
                                    }}
                                    error={
                                      serviceForm.errors[
                                        `service_details.${serviceIndex}.service_code`
                                      ] as string
                                    }
                                  />
                                ) : (
                                  <Dropdown
                                    label="Trade"
                                    placeholder="Select Trade"
                                    searchable
                                    withAsterisk
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.trade`
                                    )}
                                    data={["Export", "Import"]}
                                    value={
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.trade
                                    }
                                    onChange={(value) => {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.trade`,
                                        value || ""
                                      );

                                      // Reset last checked index when trade changes
                                      setLastCheckedServiceIndex(null);

                                      // Check salesperson data if customer, service, and trade are all selected
                                      // Use setTimeout to ensure form value is updated
                                      setTimeout(() => {
                                        const currentService =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.service;
                                        const currentTrade =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.trade;
                                        if (
                                          currentService &&
                                          customerForm.values.customer_code &&
                                          currentTrade
                                        ) {
                                          checkSalespersonData(serviceIndex);
                                        }
                                      }, 200);
                                    }}
                                    error={
                                      serviceForm.errors[
                                        `service_details.${serviceIndex}.trade`
                                      ] as string
                                    }
                                  />
                                )}
                              </Grid.Col>
                              {serviceForm.values.service_details[serviceIndex]
                                ?.service === "OTHERS" &&
                                isInlandOtherService(
                                  serviceForm.values.service_details[serviceIndex]
                                    ?.service_code,
                                ) && (
                                  <Grid.Col span={3}>
                                    <Dropdown
                                      label="Trade"
                                      placeholder="Select Trade"
                                      searchable
                                      withAsterisk
                                      key={serviceForm.key(
                                        `service_details.${serviceIndex}.trade`,
                                      )}
                                      data={["Export", "Import"]}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.trade
                                      }
                                      onChange={(value) => {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.trade`,
                                          value || "",
                                        );
                                        setLastCheckedServiceIndex(null);
                                      }}
                                      error={
                                        serviceForm.errors[
                                          `service_details.${serviceIndex}.trade`
                                        ] as string
                                      }
                                    />
                                  </Grid.Col>
                                )}

                              <Grid.Col span={3}>
                                <Dropdown
                                  placeholder="Select Shipment Terms"
                                  styles={{
                                    input: {
                                      fontSize: "13px",
                                      fontFamily: "Inter",
                                      height: "36px",
                                    },
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  searchable
                                  withAsterisk
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.shipment_terms_code`
                                  )}
                                  label="Shipment Terms"
                                  data={shipmentOptions}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.shipment_terms_code`
                                  )}
                                />
                              </Grid.Col>
                              {/* ICD Field - Only show for non-LCL services */}
                              {serviceForm.values.service_details[serviceIndex]
                                ?.service !== "LCL" && (
                                <Grid.Col span={3}>
                                  <Dropdown
                                    placeholder="Select ICD"
                                    styles={{
                                      input: {
                                        fontSize: "13px",
                                        fontFamily: "Inter",
                                        height: "36px",
                                      },
                                      label: {
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "#424242",
                                        marginBottom: "4px",
                                        fontFamily: "Inter",
                                        fontStyle: "medium",
                                      },
                                    }}
                                    searchable
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.icd`
                                    )}
                                    label="ICD"
                                    data={icdOptions}
                                    {...serviceForm.getInputProps(
                                      `service_details.${serviceIndex}.icd`
                                    )}
                                  />
                                </Grid.Col>
                              )}
                              
                              
                              <Grid.Col span={6}>
                                <TextInput
                                  label="Service Remark"
                                  styles={{
                                    input: {
                                      fontSize: "13px",
                                      fontFamily: "Inter",
                                      height: "36px",
                                    },
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.service_remark`
                                  )}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.service_remark || ""
                                  }
                                  onChange={(e) => {
                                    const formattedValue = toTitleCase(
                                      e.target.value
                                    );
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.service_remark`,
                                      formattedValue
                                    );
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.service_remark`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <TextInput
                                  label="Commodity"
                                  styles={{
                                    input: {
                                      fontSize: "13px",
                                      fontFamily: "Inter",
                                      height: "36px",
                                    },
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.commodity`
                                  )}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.commodity || ""
                                  }
                                  onChange={(e) => {
                                    const formattedValue = toTitleCase(
                                      e.target.value
                                    );
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.commodity`,
                                      formattedValue
                                    );
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.commodity`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <Dropdown
                                  styles={{
                                    input: {
                                      fontSize: "13px",
                                      fontFamily: "Inter",
                                      height: "36px",
                                    },
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.cargo_details.0.stackable`
                                  )}
                                  searchable
                                  label="Stackable Cargo"
                                  withAsterisk
                                  placeholder="Select Stackable"
                                  data={["Yes", "No"]}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.cargo_details.0.stackable`
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <Dropdown
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`
                                  )}
                                  styles={{
                                    input: {
                                      fontSize: "13px",
                                      fontFamily: "Inter",
                                      height: "36px",
                                    },
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  searchable
                                  label="Hazardous Cargo"
                                  withAsterisk
                                  placeholder="Select Hazardous"
                                  data={["Yes", "No"]}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.cargo_details?.[0]?.hazardous_cargo
                                  }
                                  onChange={(value) => {
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`,
                                      value || ""
                                    );

                                    // Clear un_no, class, and pkg_group if "No" is selected
                                    if (value === "No") {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.cargo_details.0.un_no`,
                                        null
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.cargo_details.0.class`,
                                        null
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.cargo_details.0.pkg_group`,
                                        null
                                      );
                                    }
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              {serviceForm.values.service_details[serviceIndex]
                                ?.cargo_details?.[0]?.hazardous_cargo ===
                                "Yes" && (
                                <>
                                  <Grid.Col span={3}>
                                    <TextInput
                                      key={serviceForm.key(
                                        `service_details.${serviceIndex}.cargo_details.0.un_no`
                                      )}
                                      label="UN no"
                                      withAsterisk
                                      styles={{
                                        input: {
                                          fontSize: "13px",
                                          fontFamily: "Inter",
                                          height: "36px",
                                        },
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.cargo_details?.[0]?.un_no || ""
                                      }
                                      onChange={(e) => {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.cargo_details.0.un_no`,
                                          e.target.value
                                        );
                                      }}
                                      error={
                                        serviceForm.errors[
                                          `service_details.${serviceIndex}.cargo_details.0.un_no`
                                        ] as string
                                      }
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={3}>
                                    <TextInput
                                      key={serviceForm.key(
                                        `service_details.${serviceIndex}.cargo_details.0.class`
                                      )}
                                      label="Class"
                                      withAsterisk
                                      styles={{
                                        input: {
                                          fontSize: "13px",
                                          fontFamily: "Inter",
                                          height: "36px",
                                        },
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.cargo_details?.[0]?.class || ""
                                      }
                                      onChange={(e) => {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.cargo_details.0.class`,
                                          e.target.value
                                        );
                                      }}
                                      error={
                                        serviceForm.errors[
                                          `service_details.${serviceIndex}.cargo_details.0.class`
                                        ] as string
                                      }
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={3}>
                                    <TextInput
                                      key={serviceForm.key(
                                        `service_details.${serviceIndex}.cargo_details.0.pkg_group`
                                      )}
                                      label="PKG Group"
                                      withAsterisk
                                      styles={{
                                        input: {
                                          fontSize: "13px",
                                          fontFamily: "Inter",
                                          height: "36px",
                                        },
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.cargo_details?.[0]?.pkg_group || ""
                                      }
                                      onChange={(e) => {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.cargo_details.0.pkg_group`,
                                          e.target.value
                                        );
                                      }}
                                      error={
                                        serviceForm.errors[
                                          `service_details.${serviceIndex}.cargo_details.0.pkg_group`
                                        ] as string
                                      }
                                    />
                                  </Grid.Col>
                                </>
                              )}
                            </Grid>
                            </>
                          );
                        })()}

                        {/* SECTION B — Port & Cargo Details */}
                        <Divider my="lg" color="#105476" />

                        {serviceForm.values.service_details.map(
                          (serviceDetail, serviceIndex) => (
                            <Box key={(serviceDetail as any).id || serviceIndex}>
                                <Flex justify="space-between" mb="xs" gap="md">
                                  <Text size="sm"
                                      fw={600}
                                      c="#105476"
                                      style={{
                                        paddingBottom: "4px",
                                        fontFamily: "Inter",
                                        fontStyle: "semibold",
                                        fontSize: "16px",
                                        color: "#105476",
                                      }} >Port & Cargo Details {serviceForm.values.service_details.length > 1 && `(${serviceIndex + 1})`}</Text>
                                  <Group gap={"sm"}>
                                    <Button
                                      variant="filled"
                                      color="#105476"
                                      size="xs"
                                      leftSection={<IconPlus size={14} />}
                                      styles={{
                                        root: {
                                          fontWeight: 500,
                                          fontSize: "13px",
                                          fontFamily: "Inter",
                                        },
                                      }}
                                      onClick={() => {
                                        const cur =
                                          serviceForm.values.service_details[0];
                                        serviceForm.insertListItem(
                                          "service_details",
                                          {
                                            id: "",
                                            service: cur.service,
                                            trade: cur.trade,
                                            service_code: cur.service_code,
                                            service_name: cur.service_name,
                                            shipment_terms_code:
                                              cur.shipment_terms_code,
                                            icd: cur.icd,
                                            service_remark: cur.service_remark,
                                            commodity: cur.commodity,
                                            origin_code: "",
                                            origin_name: "",
                                            origin_codes: [] as string[],
                                            origin_display_values:
                                              {} as Record<string, string>,
                                            destination_code: "",
                                            destination_name: "",
                                            destination_codes: [] as string[],
                                            destination_display_values:
                                              {} as Record<string, string>,
                                            rfq_port_pair_refs: [] as Array<{
                                              id?: number | string;
                                              origin_code: string;
                                              destination_code: string;
                                            }>,
                                            pickup: "false",
                                            delivery: "false",
                                            pickup_location: "",
                                            delivery_location: "",
                                            pickup_flags_by_origin:
                                              {} as Record<
                                                string,
                                                "true" | "false"
                                              >,
                                            pickup_locations_by_origin:
                                              {} as Record<string, string>,
                                            delivery_flags_by_destination:
                                              {} as Record<
                                                string,
                                                "true" | "false"
                                              >,
                                            delivery_locations_by_destination:
                                              {} as Record<string, string>,
                                            dimension_unit: "Centimeter",
                                            diemensions: [],
                                            cargo_details: [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: cur.cargo_details?.[0]?.hazardous_cargo ?? "No",
                                                un_no: cur.cargo_details?.[0]?.hazardous_cargo === "Yes" ? (cur.cargo_details?.[0]?.un_no ?? null) : null,
                                                class: cur.cargo_details?.[0]?.hazardous_cargo === "Yes" ? (cur.cargo_details?.[0]?.class ?? null) : null,
                                                pkg_group: cur.cargo_details?.[0]?.hazardous_cargo === "Yes" ? (cur.cargo_details?.[0]?.pkg_group ?? null) : null,
                                                stackable: cur.cargo_details?.[0]?.stackable ?? "Yes",
                                              },
                                            ],
                                          },
                                          serviceForm.values.service_details.length
                                        );
                                      }}
                                    >
                                      Add Port Pair
                                    </Button>
                                    {serviceForm.values.service_details.length > 1 && (
                                      <Button
                                        variant="subtle"
                                        color="red"
                                        size="xs"
                                        p={"xs"}
                                        styles={{
                                          root: { minWidth: "auto", height: "auto" },
                                        }}
                                        onClick={() => {
                                          serviceForm.removeListItem(
                                            "service_details",
                                            serviceIndex
                                          );
                                        }}
                                      >
                                        <IconTrash size={20} color="#dc3545" />
                                      </Button>
                                    )}
                                  </Group>
                                </Flex>

                                <Grid>
                                  <Grid.Col span={6}>
                                    <SearchableSelect
                                      label="Origin"
                                      required
                                      apiEndpoint={URL.portMaster}
                                      placeholder="Type origin code or name"
                                      searchFields={["port_code", "port_name"]}
                                      displayFormat={portMasterDisplayFormat}
                                      dropdownZIndex={5}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.origin_code || null
                                      }
                                      displayValue={(() => {
                                        const sd = serviceForm.values
                                          .service_details[
                                            serviceIndex
                                          ] as any;
                                        const code = sd?.origin_code || "";
                                        if (!code) return "";
                                        return (
                                          sd?.origin_display_values?.[code] ||
                                          rfqPortPillLabelFromApi(
                                            sd?.origin_name,
                                            code
                                          ) ||
                                          ""
                                        );
                                      })()}
                                      onChange={(value, selectedData) => {
                                        const label =
                                          selectedData?.label || "";
                                        const code = value || "";
                                        const cur =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ] as any;
                                        if (code) {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_code`,
                                            code
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_codes` as any,
                                            [code]
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_name`,
                                            label.split(" (")[0]
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_display_values` as any,
                                            { [code]: label }
                                          );
                                          const currentPickup = (
                                            (cur?.pickup || "false") as "true" | "false"
                                          );
                                          const currentPickupLoc =
                                            cur?.pickup_location || "";
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_flags_by_origin`,
                                            { [code]: currentPickup }
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_locations_by_origin`,
                                            { [code]: currentPickupLoc }
                                          );
                                          const nextRow = {
                                            ...cur,
                                            origin_code: code,
                                            origin_codes: [code],
                                            origin_name: label.split(" (")[0],
                                            origin_display_values: {
                                              [code]: label,
                                            },
                                          };
                                          const pairs =
                                            computeRfqExpandedPortPairsFromServiceDetail(
                                              nextRow
                                            );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.rfq_port_pair_refs`,
                                            pruneRfqPortPairRefs(
                                              cur.rfq_port_pair_refs,
                                              pairs
                                            )
                                          );
                                        } else {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_code`,
                                            ""
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_codes` as any,
                                            []
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_name`,
                                            ""
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.origin_display_values` as any,
                                            {}
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_flags_by_origin`,
                                            {}
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_locations_by_origin`,
                                            {}
                                          );
                                          const nextRow = {
                                            ...cur,
                                            origin_code: "",
                                            origin_codes: [],
                                            origin_name: "",
                                            origin_display_values: {},
                                          };
                                          const pairs =
                                            computeRfqExpandedPortPairsFromServiceDetail(
                                              nextRow
                                            );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.rfq_port_pair_refs`,
                                            pruneRfqPortPairRefs(
                                              cur.rfq_port_pair_refs,
                                              pairs
                                            )
                                          );
                                        }
                                      }}
                                      error={
                                        serviceForm.errors[
                                          `service_details.${serviceIndex}.origin_code`
                                        ] as string
                                      }
                                      minSearchLength={3}
                                      additionalParams={(() => {
                                        const serviceName =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.service?.toLowerCase();
                                        if (
                                          serviceName === "fcl" ||
                                          serviceName === "lcl"
                                        ) {
                                          return { transport_mode: "SEA" };
                                        }
                                        if (serviceName === "air") {
                                          return { transport_mode: "AIR" };
                                        }
                                        return undefined;
                                      })()}
                                      styles={{
                                        input: {
                                          fontSize: "13px",
                                          fontFamily: "Inter",
                                          height: "36px",
                                        },
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                    />
                                  </Grid.Col>
                                  {/* <Grid.Col
                                    span={2}
                                  >
                                    <Radio.Group
                                      label="Pickup"
                                      styles={{
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                      key={serviceForm.key(
                                        `service_details.${serviceIndex}.pickup`
                                      )}
                                      {...serviceForm.getInputProps(
                                        `service_details.${serviceIndex}.pickup`
                                      )}
                                      onChange={(v) => {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.pickup`,
                                          v
                                        );
                                        if (v === "false") {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_location`,
                                            ""
                                          );
                                        }
                                        const code =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.origin_code || "";
                                        if (code) {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_flags_by_origin`,
                                            { [code]: v as "true" | "false" }
                                          );
                                        }
                                      }}
                                    >
                                      <Group mt={10}>
                                        <Radio
                                          value="true"
                                          label="Yes"
                                          styles={{
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                        />
                                        <Radio
                                          value="false"
                                          label="No"
                                          styles={{
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                        />
                                      </Group>
                                    </Radio.Group>
                                  </Grid.Col>
                                  {serviceForm.values.service_details[
                                    serviceIndex
                                  ]?.pickup === "true" && (
                                    <Grid.Col span={4}>
                                      <TextInput
                                        label="Pickup Location"
                                        styles={{
                                          input: {
                                            fontSize: "13px",
                                            fontFamily: "Inter",
                                            height: "36px",
                                          },
                                          label: {
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            color: "#424242",
                                            marginBottom: "4px",
                                            fontFamily: "Inter",
                                            fontStyle: "medium",
                                          },
                                        }}
                                        key={serviceForm.key(
                                          `service_details.${serviceIndex}.pickup_location`
                                        )}
                                        value={
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.pickup_location || ""
                                        }
                                        onChange={(e) => {
                                          const formattedValue = toTitleCase(
                                            e.target.value
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.pickup_location`,
                                            formattedValue
                                          );
                                          const code =
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.origin_code || "";
                                          if (code) {
                                            serviceForm.setFieldValue(
                                              `service_details.${serviceIndex}.pickup_locations_by_origin`,
                                              { [code]: formattedValue }
                                            );
                                          }
                                        }}
                                        error={
                                          serviceForm.errors[
                                            `service_details.${serviceIndex}.pickup_location`
                                          ] as string
                                        }
                                      />
                                    </Grid.Col>
                                  )} */}
                                  <Grid.Col span={6}>
                                    <SearchableSelect
                                      label="Destination"
                                      required
                                      apiEndpoint={URL.portMaster}
                                      placeholder="Type destination code or name"
                                      searchFields={["port_code", "port_name"]}
                                      displayFormat={portMasterDisplayFormat}
                                      dropdownZIndex={5}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.destination_code || null
                                      }
                                      displayValue={(() => {
                                        const sd = serviceForm.values
                                          .service_details[
                                            serviceIndex
                                          ] as any;
                                        const code =
                                          sd?.destination_code || "";
                                        if (!code) return "";
                                        return (
                                          sd?.destination_display_values?.[
                                            code
                                          ] ||
                                          rfqPortPillLabelFromApi(
                                            sd?.destination_name,
                                            code
                                          ) ||
                                          ""
                                        );
                                      })()}
                                      onChange={(value, selectedData) => {
                                        const label =
                                          selectedData?.label || "";
                                        const code = value || "";
                                        const cur =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ] as any;
                                        if (code) {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_code`,
                                            code
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_codes` as any,
                                            [code]
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_name`,
                                            label.split(" (")[0]
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_display_values` as any,
                                            { [code]: label }
                                          );
                                          const currentDelivery = (
                                            (cur?.delivery ||
                                              "false") as "true" | "false"
                                          );
                                          const currentDeliveryLoc =
                                            cur?.delivery_location || "";
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_flags_by_destination`,
                                            { [code]: currentDelivery }
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_locations_by_destination`,
                                            { [code]: currentDeliveryLoc }
                                          );
                                          const nextRow = {
                                            ...cur,
                                            destination_code: code,
                                            destination_codes: [code],
                                            destination_name:
                                              label.split(" (")[0],
                                            destination_display_values: {
                                              [code]: label,
                                            },
                                          };
                                          const pairs =
                                            computeRfqExpandedPortPairsFromServiceDetail(
                                              nextRow
                                            );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.rfq_port_pair_refs`,
                                            pruneRfqPortPairRefs(
                                              cur.rfq_port_pair_refs,
                                              pairs
                                            )
                                          );
                                        } else {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_code`,
                                            ""
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_codes` as any,
                                            []
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_name`,
                                            ""
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.destination_display_values` as any,
                                            {}
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_flags_by_destination`,
                                            {}
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_locations_by_destination`,
                                            {}
                                          );
                                          const nextRow = {
                                            ...cur,
                                            destination_code: "",
                                            destination_codes: [],
                                            destination_name: "",
                                            destination_display_values: {},
                                          };
                                          const pairs =
                                            computeRfqExpandedPortPairsFromServiceDetail(
                                              nextRow
                                            );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.rfq_port_pair_refs`,
                                            pruneRfqPortPairRefs(
                                              cur.rfq_port_pair_refs,
                                              pairs
                                            )
                                          );
                                        }
                                      }}
                                      error={
                                        serviceForm.errors[
                                          `service_details.${serviceIndex}.destination_code`
                                        ] as string
                                      }
                                      minSearchLength={3}
                                      additionalParams={(() => {
                                        const serviceName =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.service?.toLowerCase();
                                        if (
                                          serviceName === "fcl" ||
                                          serviceName === "lcl"
                                        ) {
                                          return { transport_mode: "SEA" };
                                        }
                                        if (serviceName === "air") {
                                          return { transport_mode: "AIR" };
                                        }
                                        return undefined;
                                      })()}
                                      styles={{
                                        input: {
                                          fontSize: "13px",
                                          fontFamily: "Inter",
                                          height: "36px",
                                        },
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                    />
                                  </Grid.Col>
                                  {/* <Grid.Col
                                    span={2}
                                  >
                                    <Radio.Group
                                      label="Delivery"
                                      styles={{
                                        label: {
                                          fontSize: "13px",
                                          fontWeight: 500,
                                          color: "#424242",
                                          marginBottom: "4px",
                                          fontFamily: "Inter",
                                          fontStyle: "medium",
                                        },
                                      }}
                                      key={serviceForm.key(
                                        `service_details.${serviceIndex}.delivery`
                                      )}
                                      value={
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.delivery
                                      }
                                      onChange={(value) => {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.delivery`,
                                          value
                                        );
                                        if (value === "false") {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_location`,
                                            ""
                                          );
                                        }
                                        const code =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.destination_code || "";
                                        if (code) {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_flags_by_destination`,
                                            { [code]: value as "true" | "false" }
                                          );
                                        }
                                      }}
                                    >
                                      <Group mt={10}>
                                        <Radio
                                          value="true"
                                          label="Yes"
                                          styles={{
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                        />
                                        <Radio
                                          value="false"
                                          label="No"
                                          styles={{
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                        />
                                      </Group>
                                    </Radio.Group>
                                  </Grid.Col>
                                  {serviceForm.values.service_details[
                                    serviceIndex
                                  ]?.delivery === "true" && (
                                    <Grid.Col span={4}>
                                      <TextInput
                                        key={serviceForm.key(
                                          `service_details.${serviceIndex}.delivery_location`
                                        )}
                                        label="Delivery Location"
                                        styles={{
                                          input: {
                                            fontSize: "13px",
                                            fontFamily: "Inter",
                                            height: "36px",
                                          },
                                          label: {
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            color: "#424242",
                                            marginBottom: "4px",
                                            fontFamily: "Inter",
                                            fontStyle: "medium",
                                          },
                                        }}
                                        value={
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.delivery_location || ""
                                        }
                                        onChange={(e) => {
                                          const formattedValue = toTitleCase(
                                            e.target.value
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.delivery_location`,
                                            formattedValue
                                          );
                                          const code =
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.destination_code || "";
                                          if (code) {
                                            serviceForm.setFieldValue(
                                              `service_details.${serviceIndex}.delivery_locations_by_destination`,
                                              { [code]: formattedValue }
                                            );
                                          }
                                        }}
                                        error={
                                          serviceForm.errors[
                                            `service_details.${serviceIndex}.delivery_location`
                                          ] as string
                                        }
                                      />
                                    </Grid.Col>
                                  )} */}
                                </Grid>

                            {/* Cargo Details for this specific service */}
                            {(serviceForm.values.service_details[0]?.service ||
                              serviceDetail.service) &&
                              (() => {
                                // Determine effective service type for rendering (for OTHERS, determine from selected service)
                                const commonServiceDetail =
                                  serviceForm.values.service_details[0] ||
                                  serviceDetail;
                                let effectiveServiceType =
                                  commonServiceDetail.service;
                                if (
                                  commonServiceDetail.service === "OTHERS" &&
                                  commonServiceDetail.service_code
                                ) {
                                  const selectedOtherService =
                                    otherServicesData.find(
                                      (item) =>
                                        item.value ===
                                        commonServiceDetail.service_code
                                    );
                                  if (selectedOtherService) {
                                    const transportMode =
                                      selectedOtherService.transport_mode || "";
                                    const fullGroupage =
                                      selectedOtherService.full_groupage || "";
                                    if (
                                      transportMode === "SEA" &&
                                      fullGroupage === "FULL"
                                    ) {
                                      effectiveServiceType = "FCL";
                                    } else if (
                                      transportMode === "SEA" &&
                                      fullGroupage === "GROUPAGE"
                                    ) {
                                      effectiveServiceType = "LCL";
                                    } else {
                                      effectiveServiceType =
                                        resolveEffectiveServiceFromTransport(
                                          transportMode,
                                          fullGroupage,
                                        );
                                    }
                                  }
                                }
                                return effectiveServiceType;
                              })() && (
                                <>
                                  <Flex
                                    align="center"
                                    justify="space-between"
                                    mt="lg"
                                    mb="xs"
                                  >
                                    <Text
                                      size="md"
                                      fw={500}
                                      c="#105476"
                                      style={{
                                        paddingBottom: "4px",
                                        fontFamily: "Inter",
                                        fontStyle: "semibold",
                                        fontSize: "16px",
                                        color: "#105476",
                                      }}
                                    >
                                      Cargo Details
                                    </Text>
                                    {(() => {
                                      // Determine effective service type for rendering
                                      const commonServiceDetail =
                                        serviceForm.values.service_details[0] ||
                                        serviceDetail;
                                      let effectiveServiceType =
                                        commonServiceDetail.service;
                                      if (
                                        commonServiceDetail.service === "OTHERS" &&
                                        commonServiceDetail.service_code
                                      ) {
                                        const selectedOtherService =
                                          otherServicesData.find(
                                            (item) =>
                                              item.value ===
                                              commonServiceDetail.service_code
                                          );
                                        if (selectedOtherService) {
                                          const transportMode =
                                            selectedOtherService.transport_mode ||
                                            "";
                                          const fullGroupage =
                                            selectedOtherService.full_groupage ||
                                            "";
                                          if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "FULL"
                                          ) {
                                            effectiveServiceType = "FCL";
                                          } else if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "GROUPAGE"
                                          ) {
                                            effectiveServiceType = "LCL";
                                          } else {
                                            effectiveServiceType =
                                              resolveEffectiveServiceFromTransport(
                                                transportMode,
                                                fullGroupage,
                                              );
                                          }
                                        }
                                      }
                                      return effectiveServiceType;
                                    })() === "AIR" ||
                                    (() => {
                                      // Determine effective service type for rendering
                                      const commonServiceDetail =
                                        serviceForm.values.service_details[0] ||
                                        serviceDetail;
                                      let effectiveServiceType =
                                        commonServiceDetail.service;
                                      if (
                                        commonServiceDetail.service === "OTHERS" &&
                                        commonServiceDetail.service_code
                                      ) {
                                        const selectedOtherService =
                                          otherServicesData.find(
                                            (item) =>
                                              item.value ===
                                              commonServiceDetail.service_code
                                          );
                                        if (selectedOtherService) {
                                          const transportMode =
                                            selectedOtherService.transport_mode ||
                                            "";
                                          const fullGroupage =
                                            selectedOtherService.full_groupage ||
                                            "";
                                          if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "FULL"
                                          ) {
                                            effectiveServiceType = "FCL";
                                          } else if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "GROUPAGE"
                                          ) {
                                            effectiveServiceType = "LCL";
                                          } else {
                                            effectiveServiceType =
                                              resolveEffectiveServiceFromTransport(
                                                transportMode,
                                                fullGroupage,
                                              );
                                          }
                                        }
                                      }
                                      return effectiveServiceType;
                                    })() === "LCL" ? (
                                      <Group gap="sm">
                                        {Array.isArray(
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.diemensions
                                        ) &&
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ].diemensions.length > 0 && (
                                            <Dropdown
                                              placeholder="Dimension Unit"
                                              data={
                                                DIMENSION_UNIT_OPTIONS.find(
                                                  (option) => {
                                                    // Determine effective service type for dimension unit
                                                    let effectiveServiceType =
                                                      serviceDetail.service;
                                                    if (
                                                      serviceDetail.service ===
                                                        "OTHERS" &&
                                                      serviceDetail.service_code
                                                    ) {
                                                      const selectedOtherService =
                                                        otherServicesData.find(
                                                          (item) =>
                                                            item.value ===
                                                            serviceDetail.service_code
                                                        );
                                                      if (
                                                        selectedOtherService
                                                      ) {
                                                        const transportMode =
                                                          selectedOtherService.transport_mode ||
                                                          "";
                                                        const fullGroupage =
                                                          selectedOtherService.full_groupage ||
                                                          "";
                                                        if (
                                                          transportMode ===
                                                            "SEA" &&
                                                          fullGroupage ===
                                                            "FULL"
                                                        ) {
                                                          effectiveServiceType =
                                                            "FCL";
                                                        } else if (
                                                          transportMode ===
                                                            "SEA" &&
                                                          fullGroupage ===
                                                            "GROUPAGE"
                                                        ) {
                                                          effectiveServiceType =
                                                            "LCL";
                                                        } else {
                                                          effectiveServiceType =
                                                            "AIR";
                                                        }
                                                      }
                                                    }
                                                    return (
                                                      option.service ===
                                                      effectiveServiceType
                                                    );
                                                  }
                                                )?.unit_value.map((unit) => ({
                                                  value: unit.Label,
                                                  label: unit.Label,
                                                })) || []
                                              }
                                              value={
                                                serviceForm.values
                                                  .service_details[serviceIndex]
                                                  ?.dimension_unit || ""
                                              }
                                              onChange={(value) => {
                                                serviceForm.setFieldValue(
                                                  `service_details.${serviceIndex}.dimension_unit`,
                                                  value || ""
                                                );
                                                const rows =
                                                  serviceForm.values
                                                    .service_details[
                                                    serviceIndex
                                                  ]?.diemensions || [];
                                                // Determine effective service type for dimension calculation
                                                let effectiveServiceType =
                                                  serviceDetail.service;
                                                if (
                                                  serviceDetail.service ===
                                                    "OTHERS" &&
                                                  serviceDetail.service_code
                                                ) {
                                                  const selectedOtherService =
                                                    otherServicesData.find(
                                                      (item) =>
                                                        item.value ===
                                                        serviceDetail.service_code
                                                    );
                                                  if (selectedOtherService) {
                                                    const transportMode =
                                                      selectedOtherService.transport_mode ||
                                                      "";
                                                    const fullGroupage =
                                                      selectedOtherService.full_groupage ||
                                                      "";
                                                    if (
                                                      transportMode === "SEA" &&
                                                      fullGroupage === "FULL"
                                                    ) {
                                                      effectiveServiceType =
                                                        "FCL";
                                                    } else if (
                                                      transportMode === "SEA" &&
                                                      fullGroupage ===
                                                        "GROUPAGE"
                                                    ) {
                                                      effectiveServiceType =
                                                        "LCL";
                                                    } else {
                                                      effectiveServiceType =
                                                        "AIR";
                                                    }
                                                  }
                                                }
                                                const mapped = rows.map(
                                                  (r: any) => {
                                                    const v = getDimensionValue(
                                                      effectiveServiceType,
                                                      value || ""
                                                    );
                                                    const pieces =
                                                      Number(r?.pieces) || 0;
                                                    const length =
                                                      Number(r?.length) || 0;
                                                    const width =
                                                      Number(r?.width) || 0;
                                                    const height =
                                                      Number(r?.height) || 0;
                                                    const vol = v
                                                      ? (pieces *
                                                          length *
                                                          width *
                                                          height) /
                                                        v
                                                      : 0;
                                                    return {
                                                      ...r,
                                                      value: v,
                                                      vol_weight: isFinite(vol)
                                                        ? vol
                                                        : 0,
                                                    };
                                                  }
                                                );
                                                serviceForm.setFieldValue(
                                                  `service_details.${serviceIndex}.diemensions`,
                                                  mapped
                                                );
                                              }}
                                            />
                                          )}
                                        <Button
                                          variant="light"
                                          color="#105476"
                                          leftSection={<IconPlus size={16} />}
                                          styles={{
                                            root: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#105476",
                                              fontFamily: "Inter",
                                              fontStyle: "semibold",
                                            },
                                          }}
                                          onClick={() => {
                                            const unit =
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.dimension_unit ||
                                              "Centimeter";

                                            // Set dimension_unit to Centimeter if not already set
                                            if (
                                              !serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.dimension_unit
                                            ) {
                                              serviceForm.setFieldValue(
                                                `service_details.${serviceIndex}.dimension_unit`,
                                                "Centimeter"
                                              );
                                            }

                                            // Determine effective service type for dimension calculation
                                            let effectiveServiceType =
                                              serviceDetail.service;
                                            if (
                                              serviceDetail.service ===
                                                "OTHERS" &&
                                              serviceDetail.service_code
                                            ) {
                                              const selectedOtherService =
                                                otherServicesData.find(
                                                  (item) =>
                                                    item.value ===
                                                    serviceDetail.service_code
                                                );
                                              if (selectedOtherService) {
                                                const transportMode =
                                                  selectedOtherService.transport_mode ||
                                                  "";
                                                const fullGroupage =
                                                  selectedOtherService.full_groupage ||
                                                  "";
                                                if (
                                                  transportMode === "SEA" &&
                                                  fullGroupage === "FULL"
                                                ) {
                                                  effectiveServiceType = "FCL";
                                                } else if (
                                                  transportMode === "SEA" &&
                                                  fullGroupage === "GROUPAGE"
                                                ) {
                                                  effectiveServiceType = "LCL";
                                                } else {
                                                  effectiveServiceType =
                                                    resolveEffectiveServiceFromTransport(
                                                      transportMode,
                                                      fullGroupage,
                                                    );
                                                }
                                              }
                                            }

                                            const value = getDimensionValue(
                                              effectiveServiceType,
                                              unit
                                            );
                                            const newRow = {
                                              pieces: null,
                                              length: null,
                                              width: null,
                                              height: null,
                                              value: value || null,
                                              vol_weight: null,
                                            };
                                            const list =
                                              (serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions as any[]) || [];
                                            serviceForm.setFieldValue(
                                              `service_details.${serviceIndex}.diemensions`,
                                              [...list, newRow]
                                            );
                                          }}
                                        >
                                          Add Dimension
                                        </Button>
                                      </Group>
                                    ) : null}
                                  </Flex>

                                  {/* Cargo Details Form */}
                                  {(() => {
                                    // Determine effective service type for rendering
                                    const commonServiceDetail =
                                      serviceForm.values.service_details[0] ||
                                      serviceDetail;
                                    let effectiveServiceType =
                                      commonServiceDetail.service;
                                    if (
                                      commonServiceDetail.service === "OTHERS" &&
                                      commonServiceDetail.service_code
                                    ) {
                                      const selectedOtherService =
                                        otherServicesData.find(
                                          (item) =>
                                            item.value ===
                                            commonServiceDetail.service_code
                                        );
                                      if (selectedOtherService) {
                                        const transportMode =
                                          selectedOtherService.transport_mode ||
                                          "";
                                        const fullGroupage =
                                          selectedOtherService.full_groupage ||
                                          "";
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          effectiveServiceType = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          effectiveServiceType = "LCL";
                                        } else {
                                          effectiveServiceType =
                                            resolveEffectiveServiceFromTransport(
                                              transportMode,
                                              fullGroupage,
                                            );
                                        }
                                      }
                                    }
                                    return usesAirCargoStructure(effectiveServiceType);
                                  })() && (
                                    <Grid>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          rightSectionPointerEvents="none"
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                          label="No of Packages"
                                          withAsterisk
                                          min={1}
                                          allowDecimal={false}
                                          decimalScale={0}
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                              : {
                                                  input: {
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                        />
                                      </Grid.Col>
                                      {/* Dimension Unit + Add Button (AIR) */}
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          styles={{
                                            input: {
                                              fontSize: "13px",
                                              fontFamily: "Inter",
                                              height: "36px",
                                            },
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                          label="Gross Weight (kg)"
                                          min={0.01}
                                          withAsterisk
                                          decimalScale={3}
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                                          )}
                                          label="Volume Weight (kg)"
                                          min={0.01}
                                          withAsterisk
                                          decimalScale={3}
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                              : {
                                                  input: {
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.chargable_weight`
                                          )}
                                          label="Chargeable Weight (kg)"
                                          withAsterisk
                                          min={0}
                                          readOnly
                                          decimalScale={3}
                                          value={
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.cargo_details?.[0]
                                              ?.chargable_weight
                                          }
                                          styles={{
                                            input: {
                                              cursor: "not-allowed",
                                              color: "#495057",
                                              fontSize: "13px",
                                              fontFamily: "Inter",
                                              height: "36px",
                                            },
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                        />
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                          mt="xs"
                                          style={{
                                            fontSize: "13px",
                                            fontFamily: "Inter",
                                            fontStyle: "medium",
                                          }}
                                        >
                                          Max of Gross Weight and Volume Weight
                                        </Text>
                                      </Grid.Col>

                                      {/* AIR Dimension Section */}
                                      {Array.isArray(
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.diemensions
                                      ) &&
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ].diemensions.length > 0 && (
                                          <>
                                            <Grid.Col span={12}>
                                              <Grid
                                                style={{
                                                  fontWeight: 600,
                                                  color: "#105476",
                                                  fontSize: "13px",
                                                  fontFamily: "Inter",
                                                  fontStyle: "medium",
                                                }}
                                              >
                                                <Grid.Col span={1.5}>
                                                  Pieces
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Length
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Width
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Height
                                                </Grid.Col>
                                                <Grid.Col span={2}>
                                                  Value
                                                </Grid.Col>
                                                <Grid.Col span={2.5}>
                                                  Volume Weight
                                                </Grid.Col>
                                                <Grid.Col span={0.8}></Grid.Col>
                                              </Grid>
                                            </Grid.Col>
                                            {serviceForm.values.service_details[
                                              serviceIndex
                                            ].diemensions.map(
                                              (row: any, rowIdx: number) => (
                                                <Grid.Col
                                                  span={12}
                                                  key={`air-dim-${serviceIndex}-${rowIdx}`}
                                                >
                                                  <Grid>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={false}
                                                        decimalScale={0}
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        value={
                                                          row?.pieces ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(val) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            pieces: pieces,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        value={
                                                          row?.length ?? null
                                                        }
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(val) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            length: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        value={
                                                          row?.width ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(val) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            width: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        value={
                                                          row?.height ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(val) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            height: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                            backgroundColor:
                                                              "#f8f9fa",
                                                          },
                                                        }}
                                                        value={
                                                          row?.value ?? null
                                                        }
                                                        readOnly
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        decimalScale={3}
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                            backgroundColor:
                                                              "#f8f9fa",
                                                          },
                                                        }}
                                                        value={
                                                          row?.vol_weight ??
                                                          null
                                                        }
                                                        readOnly
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={0.8}>
                                                      <Button
                                                        variant="light"
                                                        color="red"
                                                        onClick={() => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          list.splice(
                                                            rowIdx,
                                                            1
                                                          );
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      >
                                                        <IconTrash size={16} />
                                                      </Button>
                                                    </Grid.Col>
                                                  </Grid>
                                                </Grid.Col>
                                              )
                                            )}
                                          </>
                                        )}
                                    </Grid>
                                  )}

                                  {(() => {
                                    // Determine effective service type for rendering
                                    const commonServiceDetail =
                                      serviceForm.values.service_details[0] ||
                                      serviceDetail;
                                    let effectiveServiceType =
                                      commonServiceDetail.service;
                                    if (
                                      commonServiceDetail.service === "OTHERS" &&
                                      commonServiceDetail.service_code
                                    ) {
                                      const selectedOtherService =
                                        otherServicesData.find(
                                          (item) =>
                                            item.value ===
                                            commonServiceDetail.service_code
                                        );
                                      if (selectedOtherService) {
                                        const transportMode =
                                          selectedOtherService.transport_mode ||
                                          "";
                                        const fullGroupage =
                                          selectedOtherService.full_groupage ||
                                          "";
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          effectiveServiceType = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          effectiveServiceType = "LCL";
                                        } else {
                                          effectiveServiceType =
                                            resolveEffectiveServiceFromTransport(
                                              transportMode,
                                              fullGroupage,
                                            );
                                        }
                                      }
                                    }
                                    return effectiveServiceType;
                                  })() === "LCL" && (
                                    <Grid>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                          label="No of Packages"
                                          min={1}
                                          withAsterisk
                                          allowDecimal={false}
                                          decimalScale={0}
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                              : {
                                                  input: {
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                          styles={{
                                            input: {
                                              fontSize: "13px",
                                              fontFamily: "Inter",
                                              height: "36px",
                                            },
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                          label="Gross Weight (kg)"
                                          min={0.01}
                                          withAsterisk
                                          decimalScale={3}
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.volume`
                                          )}
                                          label="Volume (cbm)"
                                          min={0.01}
                                          withAsterisk
                                          decimalScale={3}
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                              : {
                                                  input: {
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                  },
                                                  label: {
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: "#424242",
                                                    marginBottom: "4px",
                                                    fontFamily: "Inter",
                                                    fontStyle: "medium",
                                                  },
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.volume`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <FormNumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.chargable_volume`
                                          )}
                                          label="Chargeable Volume (cbm)"
                                          min={0}
                                          readOnly
                                          decimalScale={3}
                                          value={
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.cargo_details?.[0]
                                              ?.chargable_volume
                                          }
                                          styles={{
                                            input: {
                                              cursor: "not-allowed",
                                              color: "#495057",
                                              fontSize: "13px",
                                              fontFamily: "Inter",
                                              height: "36px",
                                            },
                                            label: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                              marginBottom: "4px",
                                              fontFamily: "Inter",
                                              fontStyle: "medium",
                                            },
                                          }}
                                        />
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                          mt="xs"
                                          style={{
                                            fontSize: "13px",
                                            fontFamily: "Inter",
                                            fontStyle: "medium",
                                          }}
                                        >
                                          Max of (Gross Weight ÷ 1000) and
                                          Volume
                                        </Text>
                                      </Grid.Col>
                                      {/* LCL Dimension Section */}
                                      {Array.isArray(
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.diemensions
                                      ) &&
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ].diemensions.length > 0 && (
                                          <>
                                            <Grid.Col span={12}>
                                              <Grid
                                                style={{
                                                  fontWeight: 600,
                                                  color: "#105476",
                                                  fontSize: "13px",
                                                  fontFamily: "Inter",
                                                  fontStyle: "medium",
                                                }}
                                              >
                                                <Grid.Col span={1.5}>
                                                  Pieces
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Length
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Width
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Height
                                                </Grid.Col>
                                                <Grid.Col span={2}>
                                                  Value
                                                </Grid.Col>
                                                <Grid.Col span={2.5}>
                                                  Volume Weight
                                                </Grid.Col>
                                                <Grid.Col span={0.8}></Grid.Col>
                                              </Grid>
                                            </Grid.Col>
                                            {serviceForm.values.service_details[
                                              serviceIndex
                                            ].diemensions.map(
                                              (row: any, rowIdx: number) => (
                                                <Grid.Col
                                                  span={12}
                                                  key={`lcl-dim-${serviceIndex}-${rowIdx}`}
                                                >
                                                  <Grid>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={false}
                                                        decimalScale={0}
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                          label: {
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                            marginBottom: "4px",
                                                            fontFamily: "Inter",
                                                            fontStyle: "medium",
                                                          },
                                                        }}
                                                        value={
                                                          row?.pieces ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(val) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            pieces: pieces,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        value={
                                                          row?.length ?? null
                                                        }
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                          label: {
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                            marginBottom: "4px",
                                                            fontFamily: "Inter",
                                                            fontStyle: "medium",
                                                          },
                                                        }}
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(val) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            length: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        value={
                                                          row?.width ?? null
                                                        }
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                          label: {
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                            marginBottom: "4px",
                                                            fontFamily: "Inter",
                                                            fontStyle: "medium",
                                                          },
                                                        }}
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(val) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            width: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        value={
                                                          row?.height ?? null
                                                        }
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                          label: {
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                            marginBottom: "4px",
                                                            fontFamily: "Inter",
                                                            fontStyle: "medium",
                                                          },
                                                        }}
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(val) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            height: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2}>
                                                      <FormNumberInput
                                                        hideControls
                                                        allowDecimal={true}
                                                        decimalScale={2}
                                                        value={
                                                          row?.value ?? null
                                                        }
                                                        readOnly
                                                        styles={{
                                                          input: {
                                                            backgroundColor:
                                                              "#f8f9fa",
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                          label: {
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                            marginBottom: "4px",
                                                            fontFamily: "Inter",
                                                            fontStyle: "medium",
                                                          },
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2.5}>
                                                      <FormNumberInput
                                                        hideControls
                                                        decimalScale={3}
                                                        value={
                                                          row?.vol_weight ??
                                                          null
                                                        }
                                                        readOnly
                                                        styles={{
                                                          input: {
                                                            backgroundColor:
                                                              "#f8f9fa",
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                          label: {
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                            marginBottom: "4px",
                                                            fontFamily: "Inter",
                                                            fontStyle: "medium",
                                                          },
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={0.8}>
                                                      <Button
                                                        variant="light"
                                                        color="red"
                                                        onClick={() => {
                                                          const list = [
                                                            ...(serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ].diemensions ||
                                                              []),
                                                          ];
                                                          list.splice(
                                                            rowIdx,
                                                            1
                                                          );
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      >
                                                        <IconTrash size={16} />
                                                      </Button>
                                                    </Grid.Col>
                                                  </Grid>
                                                </Grid.Col>
                                              )
                                            )}
                                          </>
                                        )}
                                    </Grid>
                                  )}

                                  {(() => {
                                    // Determine effective service type for rendering
                                    const commonServiceDetail =
                                      serviceForm.values.service_details[0] ||
                                      serviceDetail;
                                    let effectiveServiceType =
                                      commonServiceDetail.service;
                                    if (
                                      commonServiceDetail.service === "OTHERS" &&
                                      commonServiceDetail.service_code
                                    ) {
                                      const selectedOtherService =
                                        otherServicesData.find(
                                          (item) =>
                                            item.value ===
                                            commonServiceDetail.service_code
                                        );
                                      if (selectedOtherService) {
                                        const transportMode =
                                          selectedOtherService.transport_mode ||
                                          "";
                                        const fullGroupage =
                                          selectedOtherService.full_groupage ||
                                          "";
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          effectiveServiceType = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          effectiveServiceType = "LCL";
                                        } else {
                                          effectiveServiceType =
                                            resolveEffectiveServiceFromTransport(
                                              transportMode,
                                              fullGroupage,
                                            );
                                        }
                                      }
                                    }
                                    return effectiveServiceType;
                                  })() === "FCL" && (
                                    <Stack gap="md">
                                      {/* Show cargo details for this specific service - use current form values */}
                                      {serviceForm.values.service_details[
                                        serviceIndex
                                      ].cargo_details.map(
                                        (cargoDetail, cargoIndex) => (
                                          <Box
                                            key={`${(serviceDetail as any).id || serviceIndex}-cargo-${cargoDetail.id || cargoIndex}`}
                                          >
                                            <Grid>
                                              <Grid.Col span={3}>
                                                <Dropdown
                                                  key={serviceForm.key(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                                                  )}
                                                  searchable
                                                  styles={{
                                                    input: {
                                                      fontSize: "13px",
                                                      fontFamily: "Inter",
                                                      height: "36px",
                                                    },
                                                    label: {
                                                      fontSize: "13px",
                                                      fontWeight: 500,
                                                      color: "#424242",
                                                      marginBottom: "4px",
                                                      fontFamily: "Inter",
                                                      fontStyle: "medium",
                                                    },
                                                  }}
                                                  label="Container Type"
                                                  placeholder="Select Container Type"
                                                  withAsterisk
                                                  data={containerTypeData}
                                                  nothingFoundMessage="No container types found"
                                                  {...serviceForm.getInputProps(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                                                  )}
                                                />
                                              </Grid.Col>
                                              <Grid.Col span={3}>
                                                <FormNumberInput
                                                  hideControls
                                                  key={serviceForm.key(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                                                  )}
                                                  label="No of Containers"
                                                  styles={{
                                                    input: {
                                                      fontSize: "13px",
                                                      fontFamily: "Inter",
                                                      height: "36px",
                                                    },
                                                    label: {
                                                      fontSize: "13px",
                                                      fontWeight: 500,
                                                      color: "#424242",
                                                      marginBottom: "4px",
                                                      fontFamily: "Inter",
                                                      fontStyle: "medium",
                                                    },
                                                  }}
                                                  placeholder="Enter number of containers"
                                                  min={1}
                                                  withAsterisk
                                                  allowDecimal={false}
                                                  decimalScale={0}
                                                  {...serviceForm.getInputProps(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                                                  )}
                                                />
                                              </Grid.Col>
                                              <Grid.Col span={3}>
                                                <FormNumberInput
                                                  hideControls
                                                  key={serviceForm.key(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                                                  )}
                                                  styles={{
                                                    input: {
                                                      fontSize: "13px",
                                                      fontFamily: "Inter",
                                                      height: "36px",
                                                    },
                                                    label: {
                                                      fontSize: "13px",
                                                      fontWeight: 500,
                                                      color: "#424242",
                                                      marginBottom: "4px",
                                                      fontFamily: "Inter",
                                                      fontStyle: "medium",
                                                    },
                                                  }}
                                                  label="Gross Weight (kg)"
                                                  withAsterisk
                                                  placeholder="Enter gross weight"
                                                  min={0.01}
                                                  decimalScale={3}
                                                  {...serviceForm.getInputProps(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                                                  )}
                                                />
                                              </Grid.Col>
                                              {/* Add button only on the last cargo detail */}
                                              {cargoIndex ===
                                                serviceForm.values
                                                  .service_details[serviceIndex]
                                                  .cargo_details.length -
                                                  1 && (
                                                <Grid.Col span={0.75}>
                                                  <Button
                                                    variant="light"
                                                    color="#105476"
                                                    mt={25}
                                                    onClick={() =>
                                                      serviceForm.insertListItem(
                                                        `service_details.${serviceIndex}.cargo_details`,
                                                        {
                                                          id: null,
                                                          no_of_packages: null,
                                                          gross_weight: null,
                                                          volume_weight: null,
                                                          chargable_weight:
                                                            null,
                                                          volume: null,
                                                          chargable_volume:
                                                            null,
                                                          container_type_code:
                                                            null,
                                                          no_of_containers:
                                                            null,
                                                          hazardous_cargo: "No",
                                                          stackable: "Yes",
                                                        }
                                                      )
                                                    }
                                                  >
                                                    <IconPlus size={16} />
                                                  </Button>
                                                </Grid.Col>
                                              )}
                                              {/* Remove button */}
                                              <Grid.Col span={0.75}>
                                                {serviceForm.values
                                                  .service_details[serviceIndex]
                                                  .cargo_details.length > 1 ? (
                                                  <Button
                                                    variant="light"
                                                    color="red"
                                                    mt={25}
                                                    onClick={() => {
                                                      // Use cargoIndex directly - it's the correct index at render time
                                                      serviceForm.removeListItem(
                                                        `service_details.${serviceIndex}.cargo_details`,
                                                        cargoIndex
                                                      );
                                                    }}
                                                  >
                                                    <IconTrash size={16} />
                                                  </Button>
                                                ) : (
                                                  ""
                                                )}
                                              </Grid.Col>
                                            </Grid>
                                          </Box>
                                        )
                                      )}
                                    </Stack>
                                  )}
                                </>
                              )}
                              {serviceIndex < serviceForm.values.service_details.length - 1 && (
                                <Divider my="lg" color="#105476" />
                              )}
                            </Box>
                          )
                        )}
                      </Box>
                    </Stack>
                  </Box>

                  {/* Buttons for Step 1 */}
                  <Box
                    style={{
                      borderTop: "1px solid #e9ecef",
                      padding: "20px 32px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#d0d0d0",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            // Restore filter state if preserved
                            const preserveFilters = (location.state as any)
                              ?.preserveFilters;
                            // Check if we came from enquiry or quotation
                            const fromEnquiry = (location.state as any)
                              ?.fromEnquiry;
                            const actionType = (location.state as any)
                              ?.actionType;

                            // Navigate to the correct list based on source
                            // If came from call entry (actionType === "createEnquiry"), go back to call entry list
                            if (actionType === "createEnquiry") {
                              // Came from call entry list, go back to call entry list
                              if (preserveFilters) {
                                navigate("/call-entry", {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/call-entry", {
                                  state: { refreshData: true },
                                });
                              }
                            } else if (fromEnquiry || actionType === "edit") {
                              // Came from enquiry list or editing enquiry, go back to enquiry list
                              if (preserveFilters) {
                                navigate(moduleListPath, {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate(moduleListPath, {
                                  state: { refreshData: true },
                                });
                              }
                            } else {
                              // Default: navigate to quotation list (from quotation or new)
                              if (preserveFilters) {
                                navigate("/quotation", {
                                  state: {
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/quotation", {
                                  state: { refreshData: true },
                                });
                              }
                            }
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#d0d0d0",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            serviceForm.reset();
                          }}
                        >
                          Clear all
                        </Button>
                      </Group>

                      <Group gap="sm">
                        <Button
                          variant="outline"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#105476",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            if (
                              customerForm.values.supporting_documents
                                .length === 0
                            ) {
                              customerForm.setFieldValue(
                                "supporting_documents",
                                [{ name: "", file: null }]
                              );
                            }
                            // Validate all existing files for size
                            const newErrors: { [key: number]: string } = {};
                            customerForm.values.supporting_documents.forEach(
                              (doc, idx) => {
                                if (doc.file && doc.file.size > MAX_FILE_SIZE) {
                                  newErrors[idx] =
                                    `File size exceeds 10MB limit. Current size: ${(doc.file.size / (1024 * 1024)).toFixed(2)}MB`;
                                }
                              }
                            );
                            setFileErrors(newErrors);
                            openDocumentsModal();
                          }}
                          disabled={isSubmitting}
                        >
                          Attach supporting document
                        </Button>
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#d0d0d0",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => setActive((current) => current - 1)}
                        >
                          Back
                        </Button>

                        {/* Show Next button for edit/create quotation flow, Submit button otherwise */}
                        {enq?.fromLastEnquiries ? (
                                               <Button
                            rightSection={
                              isSubmitting ? (
                                <Loader size={16} color="white" />
                              ) : null
                            }
                            onClick={() => handleNext()}
                            size="sm"
                            style={{
                              backgroundColor: "#105476",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Submitting..." : "Submit"}
                          </Button>
                        ) : enq?.actionType === "editQuotation" ||
                          enq?.actionType === "createQuote" ? (
                          <>
                            <Button
                              rightSection={
                                isSubmitting ? (
                                  <Loader size={16} color="white" />
                                ) : null
                              }
                              onClick={handleSubmitEnquiry}
                              size="sm"
                              disabled={isSubmitting}
                              style={{
                                backgroundColor: "#105476",
                                fontSize: "13px",
                                fontFamily: "Inter",
                                fontStyle: "medium",
                              }}
                            >
                              {isSubmitting
                                ? "Submitting..."
                                : `Submit ${moduleLabel}`}
                            </Button>
                            <Button
                              onClick={() => {
                                // Validate service form before navigating to quotation
                                const serviceFormResult =
                                  serviceForm.validate();
                                if (!serviceFormResult.hasErrors) {
                                  setActive(2); // Navigate to quotation step
                                }
                              }}
                              size="sm"
                              style={{
                                backgroundColor: "#105476",
                                fontSize: "13px",
                                fontFamily: "Inter",
                                fontStyle: "medium",
                              }}
                            >
                              Next
                            </Button>
                            {/* Show Submit button for create quote flow to allow saving enquiry */}
                            {enq?.actionType === "createQuote" && (
                              <Button
                                rightSection={
                                  isSubmitting ? (
                                    <Loader size={16} color="white" />
                                  ) : null
                                }
                                onClick={() => handleNext()}
                                size="sm"
                                style={{
                                  backgroundColor: "#105476",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                }}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? "Submitting..." : "Submit"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            rightSection={
                              isSubmitting ? (
                                <Loader size={16} color="white" />
                              ) : null
                            }
                            onClick={() => handleNext()}
                            size="sm"
                            style={{
                              backgroundColor: "#105476",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Submitting..." : "Submit"}
                          </Button>
                        )}
                      </Group>
                    </Group>
                  </Box>
                </>
              )}

              {showQuotation && active === 2 && (
                <Box
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    backgroundColor: "#F8F8F8",
                    minHeight: 0,
                  }}
                >
                  <QuotationCreate
                    enquiryData={{
                      ...enq,
                      // Override with current form values
                      customer_code: customerForm.values.customer_code,
                      customer_name: customerDisplayName || "",
                      enquiry_received_date:
                        customerForm.values.enquiry_received_date,
                      sales_person: customerForm.values.sales_person,
                      sales_coordinator: customerForm.values.sales_coordinator,
                      customer_services: customerForm.values.customer_services,
                      services: rfqServicesForQuotation,
                      // Pass quotation data if available (for edit quotation flow)
                      quotation: enq?.quotation,
                    }}
                    goToStep={setActive}
                  />
                </Box>
              )}
            </Box>
          </Flex>
        </Box>

        {/* Supporting Documents Modal */}
        <Modal
          opened={documentsModalOpened}
          onClose={closeDocumentsModal}
          title="Attach Supporting Documents"
          size="xl"
          centered
          style={{
            fontFamily: "Inter",
            fontStyle: "medium",
          }}
        >
          <Stack gap="xs">
            {customerForm.values.supporting_documents.map((doc, index) => (
              <Grid key={index} columns={12} gutter="sm" align="flex-end">
                <Grid.Col span={5.5}>
                  <TextInput
                    label="Document Name"
                    placeholder="Enter document name"
                    value={doc.name}
                    onChange={(e) => {
                      const updatedDocs = [
                        ...customerForm.values.supporting_documents,
                      ];
                      updatedDocs[index] = {
                        ...updatedDocs[index],
                        name: e.target.value,
                      };
                      customerForm.setFieldValue(
                        "supporting_documents",
                        updatedDocs
                      );
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={5.5}>
                  <Box>
                    <Text size="sm" fw={500} mb={4}>
                      File
                    </Text>
                    <Dropzone
                      onDrop={(files: File[]) => {
                        if (files.length === 0) return;
                        const file = files[0]; // Take first file only

                        // Clear previous error for this index
                        if (fileErrors[index]) {
                          const newErrors = { ...fileErrors };
                          delete newErrors[index];
                          setFileErrors(newErrors);
                        }

                        // Validate file size
                        if (file.size > MAX_FILE_SIZE) {
                          const newErrors = { ...fileErrors };
                          newErrors[index] =
                            `File size exceeds 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                          setFileErrors(newErrors);
                          ToastNotification({
                            type: "error",
                            message: `File "${file.name}" exceeds 10MB limit`,
                          });
                          return;
                        }

                        const updatedDocs = [
                          ...customerForm.values.supporting_documents,
                        ];
                        updatedDocs[index] = {
                          ...updatedDocs[index],
                          file: file,
                          document_url: undefined, // Clear existing file URL when new file is uploaded
                          document_id: undefined, // Clear existing document ID when new file is uploaded
                        };
                        customerForm.setFieldValue(
                          "supporting_documents",
                          updatedDocs
                        );
                      }}
                      onReject={(files: any[]) => {
                        const rejection = files[0];
                        if (
                          rejection?.errors?.some(
                            (e: any) => e.code === "file-too-large"
                          )
                        ) {
                          const newErrors = { ...fileErrors };
                          newErrors[index] = "File size exceeds 10MB limit";
                          setFileErrors(newErrors);
                        }
                      }}
                      maxSize={MAX_FILE_SIZE}
                      accept={undefined}
                      multiple={false}
                      disabled={false}
                      styles={{
                        root: {
                          border: "1px solid var(--mantine-color-gray-4)",
                          borderRadius: "var(--mantine-radius-sm)",
                          backgroundColor: "var(--mantine-color-white)",
                          minHeight: "36px",
                          padding: "0",
                          "&:hover": {
                            borderColor: "var(--mantine-color-gray-5)",
                          },
                          "&[data-accept]": {
                            borderColor: "var(--mantine-color-blue-6)",
                            backgroundColor: "var(--mantine-color-blue-0)",
                          },
                          "&[data-reject]": {
                            borderColor: "var(--mantine-color-red-6)",
                            backgroundColor: "var(--mantine-color-red-0)",
                          },
                        },
                        inner: {
                          padding: "0",
                          minHeight: "36px",
                        },
                      }}
                    >
                      <Group
                        justify="space-between"
                        gap="xs"
                        px="sm"
                        style={{
                          minHeight: "36px",
                          pointerEvents: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                          {doc.file ? (
                            <>
                              <IconUpload
                                size={16}
                                color="var(--mantine-color-dimmed)"
                              />
                              <Text
                                size="sm"
                                truncate
                                style={{
                                  flex: 1,
                                  color: "var(--mantine-color-dark)",
                                }}
                              >
                                {doc.file.name}
                              </Text>
                            </>
                          ) : doc.document_url ? (
                            <>
                              <IconDownload
                                size={16}
                                color="var(--mantine-color-blue-6)"
                              />
                              <Text
                                size="sm"
                                truncate
                                style={{
                                  flex: 1,
                                  color: "var(--mantine-color-blue-6)",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  pointerEvents: "auto",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    doc.document_url &&
                                    doc.original_document_name
                                  ) {
                                    downloadFile(
                                      doc.document_url,
                                      doc.original_document_name
                                    );
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = "0.8";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                              >
                                {doc.original_document_name || "Download file"}
                              </Text>
                            </>
                          ) : (
                            <>
                              <IconUpload
                                size={16}
                                color="var(--mantine-color-dimmed)"
                              />
                              <Text
                                size="sm"
                                c="dimmed"
                                truncate
                                style={{ flex: 1 }}
                              >
                                Drag and drop or click to select file
                              </Text>
                            </>
                          )}
                        </Group>
                        {(doc.file || doc.document_url) && (
                          <Button
                            variant="subtle"
                            color="red"
                            size="xs"
                            p={4}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clear error for this index
                              if (fileErrors[index]) {
                                const newErrors = { ...fileErrors };
                                delete newErrors[index];
                                setFileErrors(newErrors);
                              }

                              const updatedDocs = [
                                ...customerForm.values.supporting_documents,
                              ];
                              updatedDocs[index] = {
                                ...updatedDocs[index],
                                file: null,
                                document_url: undefined,
                                document_id: undefined,
                              };
                              customerForm.setFieldValue(
                                "supporting_documents",
                                updatedDocs
                              );
                            }}
                            style={{ pointerEvents: "auto" }}
                          >
                            <IconX size={14} />
                          </Button>
                        )}
                      </Group>
                    </Dropzone>
                    {fileErrors[index] && (
                      <Text size="xs" c="red" mt={4}>
                        {fileErrors[index]}
                      </Text>
                    )}
                  </Box>
                </Grid.Col>
                <Grid.Col span={1}>
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => {
                      // Clear error for this index
                      if (fileErrors[index]) {
                        const newErrors = { ...fileErrors };
                        delete newErrors[index];
                        setFileErrors(newErrors);
                      }

                      if (
                        customerForm.values.supporting_documents.length === 1
                      ) {
                        // If only one row, clear it instead of removing
                        customerForm.setFieldValue("supporting_documents", [
                          { name: "", file: null },
                        ]);
                      } else {
                        // Remove the row and reindex errors
                        const updatedDocs =
                          customerForm.values.supporting_documents.filter(
                            (_, i) => i !== index
                          );
                        customerForm.setFieldValue(
                          "supporting_documents",
                          updatedDocs
                        );
                        // Reindex errors after deletion
                        const newErrors: { [key: number]: string } = {};
                        Object.keys(fileErrors).forEach((key) => {
                          const keyNum = parseInt(key);
                          if (keyNum < index) {
                            newErrors[keyNum] = fileErrors[keyNum];
                          } else if (keyNum > index) {
                            newErrors[keyNum - 1] = fileErrors[keyNum];
                          }
                        });
                        setFileErrors(newErrors);
                      }
                    }}
                  >
                    <IconTrash size={16} />
                  </Button>
                </Grid.Col>
                <Grid.Col span={1} offset={11}>
                  {index ===
                    customerForm.values.supporting_documents.length - 1 && (
                    <Button
                      variant="light"
                      color="#105476"
                      onClick={() => {
                        customerForm.setFieldValue("supporting_documents", [
                          ...customerForm.values.supporting_documents,
                          { name: "", file: null },
                        ]);
                      }}
                    >
                      <IconPlus size={16} />
                    </Button>
                  )}
                </Grid.Col>
              </Grid>
            ))}

            {customerForm.values.supporting_documents.length === 0 && (
              <Button
                variant="light"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  customerForm.setFieldValue("supporting_documents", [
                    { name: "", file: null },
                  ]);
                }}
                fullWidth
              >
                Add Document
              </Button>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeDocumentsModal}>
                Close
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Chatbot is now global and available on all pages */}
      </Box>

      {/* Salesperson Confirmation Modal */}
      <Modal
        opened={salespersonModalOpened}
        onClose={closeSalespersonModal}
        title="Update Salesperson Information"
        centered
        size="lg"
        styles={{
          title: {
            fontWeight: 700,
            fontSize: 20,
            color: "#105476",
          },
        }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            fw={400}
            c="gray"
            style={{
              fontSize: "13px",
              fontFamily: "Inter",
              fontStyle: "medium",
            }}
          >
            The selected service and trade combination has a different
            salesperson assigned. Would you like to update the form with the
            following information?
          </Text>

          {salespersonModalData && (
            <Box>
              <Grid>
                <Grid.Col span={4} px={20}>
                  <Text size="md" fw={600} c="#105476" mb={4}>
                    Sales Person
                  </Text>
                  <Text size="sm" fw={500} mb="md">
                    {salespersonModalData.sales_person || "-"}
                  </Text>
                </Grid.Col>
                <Grid.Col span={4} px={20}>
                  <Text size="md" fw={600} c="#105476" mb={4}>
                    Sales Coordinator
                  </Text>
                  <Text
                    size="sm"
                    fw={500}
                    px={salespersonModalData.sales_coordinator ? 0 : 2}
                    mb="md"
                  >
                    {salespersonModalData.sales_coordinator || "-"}
                  </Text>
                </Grid.Col>
                <Grid.Col span={4} px={20}>
                  <Text size="md" fw={600} c="#105476" mb={4}>
                    Customer Service
                  </Text>
                  <Text
                    size="sm"
                    fw={500}
                    px={salespersonModalData.customer_service ? 0 : 2}
                    mb="md"
                  >
                    {salespersonModalData.customer_service || "-"}
                  </Text>
                </Grid.Col>
              </Grid>
            </Box>
          )}

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={handleCancelSalespersonModal}
              styles={{
                root: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
                label: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              color="#105476"
              onClick={handleUpdateSalespersonData}
              styles={{
                root: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
                label: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
              }}
            >
              Yes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default RFQCreate;
