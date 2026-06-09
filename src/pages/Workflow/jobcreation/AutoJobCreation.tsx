import { useState, useEffect, useRef, useCallback, useMemo, FC, ReactNode } from "react";
import axios from "axios";
import { postAPICall } from "../../../service/postApiCall";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import { FilePreviewFrame } from "./automationFilePreview";

const hblApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}workflow`,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "processing" | "done" | "failed" | "job_created" | string;
type FileType   = "hbl" | "mbl" | string;

interface FileRecord {
  id?: number;
  txn_id: string;
  filename: string;
  status: FileStatus;
  api_payload?: PayloadData;
  uploaded_at?: string;
  bl_number?: string;
  shipper_name?: string;
  consignee_name?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  on_board_date?: string;
  file_type?: FileType;
  pdf_type?: string;
  size_kb?: number;
  cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
  processed_at?: string;
  extracted_data?: PayloadData;
  diff_summary?: string;
  error_message?: string;
  created_by?: string;
  mbl_file_url?: string;
  hbl_file_url?: string;
}

interface OceanRouting {
  from_port_code?: string;
  to_port_code?: string;
  vessel?: string;
  voyage_number?: string;
  transport_type?: string;
}

interface ContainerDetail {
  container_no?: string;
  container_number?: string;
  container_type_input?: string;
  actual_seal_no?: string;
  container_type?: string;
  seal_no?: string;
  seal_number?: string;
  no_of_packages?: number;
  packages?: number;
  package_type?: string;
  gross_weight?: string;
  gross_weight_kgs?: number;
  volume?: string;
  volume_cbm?: number;
  tare_weight_kgs?: number;
  chargeable_weight?: string;
  haz?: boolean;
  description?: string;
}

interface CargoSummary {
  total_containers?: string | number;
  container_mix?: string;
  total_packages?: string | number;
  gross_weight_kgs?: string | number;
  volume_cbm?: string | number;
}

interface HousingDetail {
  hbl_number?: string;
  trade?: string;
  routed?: string;
  cargo_mode?: string;
  hs_code?: string;
  marks_no?: string;
  origin_code?: string;
  destination_code?: string;
  invoice_no?: string;
  invoice_date?: string;
  date_of_issue?: string;
  on_board_date?: string;
  freight_terms?: string;
  number_of_originals?: string | number;
  no_of_originals?: string | number;
  place_of_issue?: string;
  place_of_acceptance?: string;
  place_of_delivery?: string;
  shipment_terms_code?: string;
  shipment_reference_no?: string;
  shipper_name?: string;
  shipper_brn?: string;
  shipper_attn?: string;
  shipper_address?: string;
  shipper_tel?: string;
  shipper_fax?: string;
  shipper_phone?: string;
  shipper_email?: string;
  consignee_name?: string;
  consignee_gst?: string;
  consignee_iec?: string;
  consignee_address?: string;
  consignee_pan?: string;
  consignee_phone?: string | string[];
  consignee_fax?: string;
  consignee_email?: string;
  gst_no_consignee?: string;
  notify1_customer_name?: string;
  notify1_customer_gst?: string;
  notify1_customer_iec?: string;
  notify1_customer_address?: string;
  notify1_customer_pan?: string;
  notify1_customer_phone?: string;
  notify1_customer_email?: string;
  notify2_customer_name?: string;
  notify2_customer_address?: string;
  notify2_customer_email?: string;
  agent_name?: string;
  agent_address?: string;
  agent_phone?: string | string[];
  agent_email?: string;
  agent_gst_no?: string;
  agent_mobile?: string;
  agent_pan_no?: string;
  issuing_agent?: string;
  issuing_agent_email?: string | string[];
  issuing_agent_address?: string;
  commodity_description?: string;
  package_type?: string;
  total_packages?: number;
  total_volume_cbm?: number;
  total_gross_weight_kgs?: number;
  cargo_summary?: CargoSummary;
  cargo_details?: ContainerDetail[];
  events?: Array<{ type?: string; date?: string }>;
  freight_payable_at?: string;
  pi_no?: string;
  pi_date?: string;
  po_no?: string;
  lc_number?: string;
  lc_date?: string;
  iec_no?: string;
  pan_no?: string;
  carrier_name?: string;
  shipped_on_board_date?: string;
  free_time_at_destination?: string;
  [key: string]: unknown;
}

interface PayloadData {
  mbl_number?: string;
  bl_number?: string;
  serial_no?: string;
  service?: string;
  service_type?: string;
  document_type?: string;
  transport_mode?: string;
  release_type?: string;
  freight_terms?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  place_of_receipt?: string;
  place_of_delivery?: string;
  origin_code?: string;
  destination_code?: string;
  freight_payable_at?: string;
  export_reference?: string;
  ocean_routings?: OceanRouting[];
  vessel_name?: string;
  voyage_number?: string;
  carrier_code?: string;
  carrier_full_name?: string;
  carrier_head_office?: string;
  agent?: string;
  signed_by?: string;
  date_of_issue?: string;
  on_board_date?: string;
  shipped_on_board_date?: string;
  place_of_issue?: string;
  no_of_original_bls?: number;
  number_of_original_waybills?: string;
  signing_agent?: string;
  signed_on_behalf_of?: string;
  freight_payment_terms?: string;
  container_details?: ContainerDetail[];
  special_clauses?: string;
  housing_details?: HousingDetail[];
}

interface FilesResponse {
  files: FileRecord[];
}

interface UploadResult {
  txn_id?: string;
  uploaded: Array<{ filename: string; file_type: string; size_kb: number; pdf_type?: string; txn_id: string }>;
  errors?: Array<{ filename: string; error: string }>;
  error?: boolean;
}

interface ToastState {
  msg: string;
  type: "success" | "error" | "info";
}

interface PortOption {
  port_code: string;
  port_name: string;
  transport_mode: string;
  alias_code: string;
}

interface CarrierOption {
  carrier_code: string;
  carrier_name: string;
  transport_mode?: string;
  alias_code?: string;
}

interface ContainerTypeOption {
  container_code: string;
  container_name: string;
  alias_code?: string;
}

type ModalState =
  | { type: "upload" }
  | { type: "detail"; record: FileRecord }
  | { type: "payload"; txn_id: string; record?: FileRecord }
  | { type: "fix_port"; record: FileRecord }
  | null;

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;500;600;700;800&display=swap');
  .hbl-app {
    --bg: #f0f1f5; --surface: #ffffff; --surface2: #f4f5f8;
    --border: #e3e6ed; --border2: #c8cdd9; --text: #111827; --muted: #6b7280;
    --accent: #105476; --accent2: #1d4ed8; --green: #059669; --yellow: #d97706;
    --red: #dc2626; --cyan: #0891b2; --hbl: #7c3aed; --mbl: #0891b2;
    --mono: 'JetBrains Mono', monospace; --sans: 'Syne', sans-serif;
  }
  @keyframes hbl-spin { to { transform: rotate(360deg); } }
  @keyframes hbl-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes hbl-modal-in { from { opacity:0; transform:scale(.96) translateY(8px) } }
  @keyframes hbl-bar-up { from { transform:translateX(-50%) translateY(80px) } to { transform:translateX(-50%) translateY(0) } }
  @keyframes hbl-toast-in { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
  .hbl-app { width:100%; display:flex; flex-direction:column; font-family:var(--sans); background:var(--surface); color:var(--text); min-height:300px; margin:1rem 0; border-radius:1rem; box-shadow:0 4px 12px rgba(0,0,0,.05); max-height:calc(100vh - 88px); overflow:hidden; }
  .hbl-app *, .hbl-app *::before, .hbl-app *::after { box-sizing: border-box; }
  .hbl-app .topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 20px; display: flex; align-items: center; gap: 14px; min-height: 54px; flex-wrap: wrap; border-radius: 8px 8px 0 0; flex-shrink: 0;border-radius:1rem; }
  .hbl-app .top-brand { display: flex; align-items: center; gap: 10px; }
  .hbl-app .top-brand-icon { width: 32px; height: 32px; background: var(--accent); border-radius: 7px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; flex-shrink: 0; }
  .hbl-app .top-brand-text { f font-size:.95rem; font-weight:700; letter-spacing:-.02em; color:var(--text);}
  .hbl-app .top-brand-sub { font-size: .65rem; color: var(--muted); font-family: var(--mono); }
  .hbl-app .top-divider { width: 1px; height: 24px; background: var(--border); }
  .hbl-app .search-wrap { position: relative; flex: 1; max-width: 380px; }
  .hbl-app .search-wrap input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px 8px 34px; font-size: .8rem; font-family: var(--sans); color: var(--text); outline: none; transition: border-color .15s; }
  .hbl-app .search-wrap input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,.1); background: var(--surface); }
  .hbl-app .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .75rem; pointer-events: none; }
  .hbl-app .btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 7px; font-size: .8rem; font-weight: 600; font-family: var(--sans); cursor: pointer; transition: all .15s; border: none; white-space: nowrap; padding: 8px 14px; }
  .hbl-app .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(37,99,235,.3); }
  .hbl-app .btn-primary:hover:not(:disabled) { background: var(--accent2); }
  .hbl-app .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .hbl-app .btn-green { background: var(--green); color: #fff; box-shadow: 0 1px 3px rgba(5,150,105,.3); }
  .hbl-app .btn-green:hover:not(:disabled) { background: #047857; }
  .hbl-app .btn-green:disabled { opacity: .5; cursor: not-allowed; }
  .hbl-app .btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--muted); }
  .hbl-app .btn-ghost:hover { color: var(--text); border-color: var(--border2); background: var(--surface2); }
  .hbl-app .filter-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 8px 28px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
  .hbl-app .filter-label { font-size: .72rem; color: var(--muted); font-weight: 600; }
  .hbl-app .chip { padding: 4px 12px; border-radius: 99px; border: 1px solid var(--border); background: transparent; color: var(--muted); font-size: .72rem; font-family: var(--sans); cursor: pointer; transition: all .15s; }
  .hbl-app .chip:hover { border-color: var(--border2); color: var(--text); background: var(--surface2); }
  .hbl-app .chip.active { background: var(--accent); border-color: var(--accent); color: white; }
  .hbl-app .filter-sep { width: 1px; height: 16px; background: var(--border); margin: 0 4px; }
  .hbl-app .per-page { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; color: var(--muted); padding: 4px 8px; font-size: .72rem; font-family: var(--sans); cursor: pointer; outline: none; }
  .hbl-app .records-count { font-family: var(--mono); font-size: .68rem; color: var(--muted); margin-left: auto; }
  .hbl-app .table-wrap { background: var(--bg); flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .hbl-app table { width: 100%; border-collapse: collapse; background: var(--surface); display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .hbl-app thead { display: table; width: 100%; table-layout: fixed; flex-shrink: 0; }
  .hbl-app thead tr { background: var(--surface2); }
  .hbl-app th { text-align: left; padding: 10px 14px; font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; cursor: pointer; user-select: none; }
  .hbl-app th:first-child { padding-left: 24px; width: 36px; }
  .hbl-app th:last-child { padding-right: 24px; }
  .hbl-app th:hover { color: var(--text); }
  .hbl-app tbody { display: block; overflow-y: auto; flex: 1; min-height: 0; }
  .hbl-app tbody tr { display: table; width: 100%; table-layout: fixed; border-bottom: 1px solid var(--border); transition: background .1s; cursor: pointer; }
  .hbl-app tbody tr:hover { background: #f8f9fc; }
  .hbl-app tbody tr.selected { background: rgba(37,99,235,.05); }
  .hbl-app td { padding: 11px 14px; font-size: .8rem; color: var(--muted); vertical-align: middle; }
  .hbl-app td:first-child { padding-left: 24px; }
  .hbl-app td:last-child { padding-right: 24px; }
  .hbl-app td input[type=checkbox] { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }
  .hbl-app .td-txn { font-family: var(--mono); font-size: .7rem; color: var(--accent); white-space: nowrap; }
  .hbl-app .td-filename { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-weight: 600; }
  .hbl-app .td-bl { font-family: var(--mono); font-size: .72rem; color: var(--cyan); }
  .hbl-app .td-date { font-family: var(--mono); font-size: .68rem; white-space: nowrap; }
  .hbl-app .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 4px; font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
  .hbl-app .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
  .hbl-app .badge-pending { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }
  .hbl-app .badge-pending::before { background: var(--yellow); animation: hbl-pulse 1.5s infinite; }
  .hbl-app .badge-processing { background: #eff6ff; color: #1e40af; border: 1px solid #93c5fd; }
  .hbl-app .badge-processing::before { background: var(--accent); animation: hbl-pulse 1s infinite; }
  .hbl-app .badge-done { background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }
  .hbl-app .badge-done::before { background: var(--green); }
  .hbl-app .badge-failed { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .hbl-app .badge-failed::before { background: var(--red); }
  .hbl-app .badge-job_created { background: #f0f9ff; color: #0369a1; border: 1px solid #7dd3fc; }
  .hbl-app .badge-job_created::before { background: #0ea5e9; animation: hbl-pulse 1.5s infinite; }
  .hbl-app .ft-tag { font-family: var(--mono); font-size: .6rem; font-weight: 700; border-radius: 3px; padding: 2px 6px; text-transform: uppercase; letter-spacing: .05em; }
  .hbl-app .ft-tag.hbl { background: rgba(124,58,237,.1); color: var(--hbl); border: 1px solid rgba(124,58,237,.25); }
  .hbl-app .ft-tag.mbl { background: rgba(8,145,178,.1); color: var(--mbl); border: 1px solid rgba(8,145,178,.25); }
  .hbl-app .ft-tag.unknown { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }
  .hbl-app .pdf-tag { font-family: var(--mono); font-size: .6rem; color: var(--muted); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; background: var(--surface2); }
  .hbl-app .cost-val { font-family: var(--mono); font-size: .72rem; color: var(--yellow); font-weight: 500; }
  .hbl-app .action-row { display: flex; gap: 5px; flex-wrap: wrap; }
  .hbl-app .act-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; color: var(--muted); padding: 3px 8px; font-size: .67rem; cursor: pointer; transition: all .15s; font-family: var(--sans); white-space: nowrap; }
  .hbl-app .act-btn:hover { color: var(--text); border-color: var(--border2); }
  .hbl-app .act-btn.view:hover { color: var(--accent); border-color: var(--accent); background: rgba(37,99,235,.06); }
  .hbl-app .act-btn.dl:hover { color: #065f46; border-color: var(--green); background: rgba(5,150,105,.06); }
  .hbl-app .act-btn.payload:hover { color: var(--mbl); border-color: var(--mbl); background: rgba(8,145,178,.06); }
  .hbl-app .pagination { display: flex; align-items: center; justify-content: space-between; padding: 12px 28px; border-top: 1px solid var(--border); background: var(--surface); border-radius: 0 0 1rem 1rem; flex-shrink: 0; }
  .hbl-app .pag-info { font-family: var(--mono); font-size: .68rem; color: var(--muted); }
  .hbl-app .pag-controls { display: flex; align-items: center; gap: 4px; }
  .hbl-app .pag-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 5px; color: var(--muted); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: .75rem; cursor: pointer; transition: all .15s; font-family: var(--sans); }
  .hbl-app .pag-btn:hover:not(:disabled) { color: var(--text); border-color: var(--border2); background: var(--surface2); }
  .hbl-app .pag-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
  .hbl-app .pag-btn:disabled { opacity: .3; cursor: not-allowed; }
  .hbl-app .state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; }
  .hbl-app .table-wrap > .state-box { flex: 1; min-height: 0; }
  .hbl-app .state-icon { font-size: 2.4rem; opacity: .4; }
  .hbl-app .state-text { font-size: .88rem; color: var(--text); font-weight: 600; }
  .hbl-app .state-sub { font-size: .75rem; color: var(--muted); }
  .hbl-app .spinner { width: 22px; height: 22px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: hbl-spin .7s linear infinite; }
  .hbl-app .action-bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px); background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.13); transition: transform .25s cubic-bezier(.34,1.56,.64,1); z-index: 50; white-space: nowrap; }
  .hbl-app .action-bar.visible { transform: translateX(-50%) translateY(0); animation: hbl-bar-up .25s cubic-bezier(.34,1.56,.64,1); }
  .hbl-app .bar-btn { padding: 6px 14px; border-radius: 6px; font-size: .78rem; font-weight: 600; font-family: var(--sans); cursor: pointer; border: 1px solid transparent; transition: all .15s; }
  .hbl-app .bar-btn.danger { background: #fef2f2; color: #991b1b; border-color: #fca5a5; }
  .hbl-app .bar-btn.danger:hover { background: var(--red); color: white; }
  .hbl-app .bar-btn.outline { background: transparent; color: var(--muted); border-color: var(--border); }
  .hbl-app .bar-btn.outline:hover { color: var(--text); background: var(--surface2); }
  .hbl-app .bar-btn.green { background: #ecfdf5; color: #065f46; border-color: #6ee7b7; }
  .hbl-app .bar-btn.green:hover { background: var(--green); color: white; }
  .hbl-app .toast { position: fixed; bottom: 80px; right: 24px; padding: 10px 16px; border-radius: 8px; font-size: .8rem; font-weight: 500; font-family: var(--sans); display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); z-index: 300; animation: hbl-toast-in .3s cubic-bezier(.34,1.56,.64,1); pointer-events: none; }
  .hbl-app .toast.success { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
  .hbl-app .toast.error { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
  .hbl-app .toast.info { background: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; }
  .hbl-app .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.3); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; }
  .hbl-app .modal { background: var(--surface); border: 1px solid var(--border2); border-radius: 14px; width: 90%; max-width: 600px; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.15); animation: hbl-modal-in .2s ease; }
  .hbl-app .modal-lg { max-width: 820px; }
  .hbl-app .modal-xl { max-width: 1100px; max-height: 92vh; width: 96%; }
  .hbl-app .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border); }
  .hbl-app .modal-head h2 { font-size: .92rem; font-weight: 700; }
  .hbl-app .modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; line-height: 1; }
  .hbl-app .modal-close:hover { color: var(--text); }
  .hbl-app .modal-body { padding: 20px 22px; overflow-y: auto; flex: 1; }
  .hbl-app .modal-foot { padding: 14px 22px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }
  .hbl-app .upload-zones { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .hbl-app .zone-label { display: flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
  .hbl-app .zone-label .dot { width: 7px; height: 7px; border-radius: 50%; }
  .hbl-app .zone-label.hbl { color: var(--hbl); }
  .hbl-app .zone-label.mbl { color: var(--mbl); }
  .hbl-app .drop-zone { border: 1.5px dashed var(--border2); border-radius: 10px; padding: 22px 12px; text-align: center; cursor: pointer; transition: all .2s; background: var(--surface2); }
  .hbl-app .drop-zone:hover, .hbl-app .drop-zone.over { border-color: var(--accent); background: rgba(37,99,235,.04); }
  .hbl-app .drop-zone.over-hbl { border-color: var(--hbl); background: rgba(124,58,237,.04); }
  .hbl-app .drop-zone.over-mbl { border-color: var(--mbl); background: rgba(8,145,178,.04); }
  .hbl-app .dz-icon { font-size: 1.6rem; margin-bottom: 6px; opacity: .6; }
  .hbl-app .drop-zone p { font-size: .75rem; color: var(--muted); }
  .hbl-app .drop-zone small { font-size: .65rem; color: var(--muted); opacity: .6; margin-top: 3px; display: block; }
  .hbl-app .zone-file-row { display: flex; align-items: center; justify-content: space-between; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; margin-top: 4px; }
  .hbl-app .zfname { font-size: .72rem; color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
  .hbl-app .zfsize { font-family: var(--mono); font-size: .62rem; color: var(--muted); }
  .hbl-app .zf-rm { background: none; border: none; color: var(--muted); cursor: pointer; font-size: .75rem; }
  .hbl-app .zf-rm:hover { color: var(--red); }
  .hbl-app .zone-empty { text-align: center; font-size: .7rem; color: var(--muted); opacity: .5; padding: 4px 0; }
  .hbl-app .progress-bar { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; margin-bottom: 12px; }
  .hbl-app .progress-fill { height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s; }
  .hbl-app .ur-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 7px; margin-bottom: 6px; font-size: .78rem; }
  .hbl-app .ur-item.ok { background: #ecfdf5; border: 1px solid #a7f3d0; }
  .hbl-app .ur-item.err { background: #fef2f2; border: 1px solid #fca5a5; }
  .hbl-app .ur-name { font-weight: 600; color: var(--text); }
  .hbl-app .ur-meta { color: var(--muted); font-size: .7rem; margin-top: 2px; }
  .hbl-app .ur-txn { display: inline-block; background: var(--accent); color: white; border-radius: 4px; padding: 1px 7px; font-family: var(--mono); font-size: .65rem; font-weight: 700; margin-top: 4px; }
  .hbl-app .tabs { display: flex; gap: 2px; padding: 10px 22px 0; border-bottom: 1px solid var(--border); background: var(--surface); }
  .hbl-app .tab-btn { padding: 8px 14px; font-size: .75rem; font-weight: 500; font-family: var(--sans); color: var(--muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all .15s; margin-bottom: -1px; }
  .hbl-app .tab-btn:hover { color: var(--text); }
  .hbl-app .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
  .hbl-app .tab-body { padding: 20px 22px; overflow-y: auto; flex: 1; }
  .hbl-app .detail-txn { font-family: var(--mono); font-size: .68rem; color: var(--accent); margin-bottom: 4px; }
  .hbl-app .detail-fname { font-size: .95rem; font-weight: 700; }
  .hbl-app .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hbl-app .info-cell { background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; }
  .hbl-app .ic-label { font-size: .6rem; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; font-weight: 700; }
  .hbl-app .ic-val { font-size: .82rem; color: var(--text); font-weight: 500; word-break: break-all; }
  .hbl-app .cost-strip { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .hbl-app .cost-cell-box { flex: 1; min-width: 100px; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; text-align: center; }
  .hbl-app .ccv { font-family: var(--mono); font-size: 1.1rem; font-weight: 500; color: var(--yellow); }
  .hbl-app .ccl { font-size: .62rem; color: var(--muted); margin-top: 2px; }
  .hbl-app .dl-btn-full { width: 100%; margin-top: 12px; padding: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 7px; color: #065f46; font-size: .8rem; font-weight: 600; font-family: var(--sans); cursor: pointer; }
  .hbl-app .dl-btn-full:hover { background: var(--green); color: white; }
  .hbl-app pre { background: #f8f9fc; border: 1px solid var(--border); border-radius: 7px; padding: 14px; font-family: var(--mono); font-size: .7rem; color: #374151; overflow: auto; max-height: 380px; white-space: pre-wrap; word-break: break-all; line-height: 1.6; }
  .hbl-app .diff-box { background: #f8f9fc; border: 1px solid var(--border); border-radius: 7px; padding: 14px; font-size: .75rem; color: #374151; line-height: 1.7; white-space: pre-wrap; max-height: 380px; overflow-y: auto; }
  .hbl-app .error-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 7px; padding: 14px; font-family: var(--mono); font-size: .7rem; color: #991b1b; white-space: pre-wrap; max-height: 380px; overflow-y: auto; line-height: 1.6; }
  .hbl-app .no-error { display: flex; align-items: center; gap: 8px; color: #065f46; font-size: .82rem; padding: 20px; }
  .hbl-app .form-body { padding: 20px 24px 32px; overflow-y: auto; }
  .hbl-app .fsec { margin-bottom: 22px; }
  .hbl-app .fsec-title { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .13em; color: var(--muted); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .hbl-app .fsec-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .hbl-app .fgrid { display: grid; gap: 7px; }
  .hbl-app .fgrid.c4 { grid-template-columns: repeat(4,1fr); }
  .hbl-app .fgrid.c3 { grid-template-columns: repeat(3,1fr); }
  .hbl-app .fgrid.c2 { grid-template-columns: repeat(2,1fr); }
  .hbl-app .ff { display: flex; flex-direction: column; gap: 3px; }
  .hbl-app .ff.s2 { grid-column: span 2; }
  .hbl-app .ff.s3 { grid-column: span 3; }
  .hbl-app .ff.s4 { grid-column: 1/-1; }
  .hbl-app .ff label { font-size: .57rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
  .hbl-app .fval { font-size: .78rem; color: var(--text); background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 5px 10px; min-height: 30px; word-break: break-word; line-height: 1.45; }
  .hbl-app .fval.mono { font-family: var(--mono); font-size: .7rem; color: var(--cyan); }
  .hbl-app .fval.empty { color: var(--muted); opacity: .4; font-style: italic; font-size: .75rem; }
  .hbl-app .hcard { border: 1px solid var(--border); border-radius: 9px; overflow: hidden; margin-bottom: 14px; }
  .hbl-app .hcard-head { background: rgba(124,58,237,.05); border-bottom: 1px solid rgba(124,58,237,.15); padding: 9px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .hbl-app .hcard-num { font-family: var(--mono); font-size: .62rem; font-weight: 700; color: var(--hbl); background: rgba(124,58,237,.12); border: 1px solid rgba(124,58,237,.2); border-radius: 3px; padding: 1px 7px; }
  .hbl-app .hcard-bl { font-family: var(--mono); font-size: .75rem; color: var(--text); font-weight: 600; }
  .hbl-app .hcard-shipper { font-size: .72rem; color: var(--muted); }
  .hbl-app .hcard-mode { margin-left: auto; font-family: var(--mono); font-size: .62rem; color: var(--muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; }
  .hbl-app .hcard-body { padding: 14px; }
  .hbl-app .sub-sec { margin-bottom: 12px; }
  .hbl-app .sub-sec-title { font-size: .56rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-bottom: 7px; display: flex; align-items: center; gap: 6px; }
  .hbl-app .sub-sec-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .hbl-app .ctable { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .hbl-app .ctable th { font-size: .57rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 700; padding: 5px 8px; background: var(--surface2); border: 1px solid var(--border); white-space: nowrap; }
  .hbl-app .ctable td { padding: 5px 8px; border: 1px solid var(--border); color: var(--text); font-family: var(--mono); font-size: .7rem; }
  .hbl-app .routing-pill { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 7px 12px; font-size: .75rem; flex-wrap: wrap; margin-bottom: 6px; }
  .hbl-app .rp { font-family: var(--mono); color: var(--text); font-weight: 600; }
  .hbl-app .ra { color: var(--muted); }
  .hbl-app .rm { color: var(--muted); font-size: .68rem; }
  .hbl-app .no-data { text-align: center; padding: 16px; font-size: .75rem; color: var(--muted); font-style: italic; }
  .hbl-app .upload-summary { display: flex; gap: 8px; margin-bottom: 12px; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; align-items: center; }
  .hbl-app .us-item { display: flex; align-items: center; gap: 5px; font-size: .75rem; color: var(--muted); }
  .hbl-app .us-count { font-family: var(--mono); font-weight: 700; font-size: .8rem; }
  .hbl-app .us-count.hbl { color: var(--hbl); }
  .hbl-app .us-count.mbl { color: var(--mbl); }
  .hbl-app .dirty-indicator { display: inline-flex; align-items: center; gap: 5px; font-size: .68rem; color: var(--yellow); font-family: var(--mono); padding: 3px 8px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; }
  @media(max-width:768px){
    .hbl-app .info-grid,.hbl-app .upload-zones{grid-template-columns:1fr}
    .hbl-app .fgrid.c4,.hbl-app .fgrid.c3{grid-template-columns:1fr 1fr}
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fv(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (Array.isArray(val)) return val.length ? val.join(", ") : null;
  return String(val);
}

function buildPageRange(cur: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (cur >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", cur - 1, cur, cur + 1, "...", total];
}

// ─── Primitive components ─────────────────────────────────────────────────────

interface FFProps {
  label: string;
  val?: unknown;
  cls?: string;
  span?: 1 | 2 | 3 | 4;
}

const FF: FC<FFProps> = ({ label, val, cls = "", span = 1 }) => {
  const v = fv(val);
  return (
    <div className={`ff${span > 1 ? ` s${span}` : ""}`}>
      <label>{label}</label>
      <div className={`fval ${v ? cls : "empty"}`}>{v ?? "—"}</div>
    </div>
  );
};

const Sec: FC<{ icon: string; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div className="fsec">
    <div className="fsec-title"><span>{icon}</span>{title}</div>
    {children}
  </div>
);

const SubSec: FC<{ icon: string; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div className="sub-sec">
    <div className="sub-sec-title"><span>{icon}</span>{title}</div>
    {children}
  </div>
);

const Badge: FC<{ status: FileStatus }> = ({ status }) => (
  <span className={`badge badge-${status}`}>{status}</span>
);

const FtTag: FC<{ type: FileType }> = ({ type }) => {
  const cls = type === "hbl" ? "hbl" : type === "mbl" ? "mbl" : "unknown";
  return <span className={`ft-tag ${cls}`}>{type || "—"}</span>;
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast: FC<{ toast: ToastState }> = ({ toast }) => (
  <div className={`toast ${toast.type}`}>{toast.msg}</div>
);

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
}

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg", ".jpeg", ".png", ".gif",
  ".webp", ".bmp", ".tiff", ".tif", ".svg",
];

const ALLOWED_ACCEPT = ALLOWED_EXTENSIONS.join(",");

const UploadModal: FC<UploadModalProps> = ({ onClose, onUploaded }) => {
  const [hblFiles, setHbl] = useState<File[]>([]);
  const [mblFiles, setMbl] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState<"hbl" | "mbl" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult | null>(null);

  const addFiles = (type: "hbl" | "mbl", files: FileList | null) => {
    if (!files) return;
    const allowed = Array.from(files).filter(f =>
      ALLOWED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
    );
    const setter = type === "hbl" ? setHbl : setMbl;
    setter(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...allowed.filter(f => !names.has(f.name))];
    });
  };

  const removeFile = (type: "hbl" | "mbl", i: number) => {
    if (type === "hbl") setHbl(p => p.filter((_, j) => j !== i));
    else setMbl(p => p.filter((_, j) => j !== i));
  };

  const submit = async () => {
    const total = hblFiles.length + mblFiles.length;
    if (!total) return;
    setUploading(true); setProgress(20); setResults(null);
    const fd = new FormData();
    hblFiles.forEach(f => fd.append("hbl_attachments", f));
    mblFiles.forEach(f => fd.append("mbl_attachments", f));
    try {
      setProgress(70);
      const { data } = await hblApi.post<UploadResult>("/upload/", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
      });
      setProgress(100);
      setHbl([]); setMbl([]);
      onUploaded();
      onClose();
    } catch {
      setResults({ uploaded: [], error: true });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const total = hblFiles.length + mblFiles.length;

  const Zone: FC<{ type: "hbl" | "mbl" }> = ({ type }) => {
    const files = type === "hbl" ? hblFiles : mblFiles;
    const color = type === "hbl" ? "#7c3aed" : "#0891b2";
    const label = type === "hbl" ? "HBL Attachments" : "MBL Attachments";
    const emoji = type === "hbl" ? "🟣" : "🔵";
    const isDrag = dragOver === type;
    return (
      <div>
        <div className={`zone-label ${type}`}>
          <span className="dot" style={{ background: color }} />{label}
        </div>
        <div
          className={`drop-zone${isDrag ? ` over-${type}` : ""}`}
          onClick={() => (document.getElementById(`fi-${type}`) as HTMLInputElement)?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(type); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={e => { e.preventDefault(); setDragOver(null); addFiles(type, e.dataTransfer.files); }}
        >
          <div className="dz-icon">{emoji}</div>
          <p>Drop or <span style={{ color, fontWeight: 700 }}>browse {type.toUpperCase()}</span></p>
          <small>
            {type === "hbl"
              ? "House Bill of Lading — PDF & Images"
              : "Master Bill of Lading — PDF & Images"}
          </small>
        </div>
        <input
          type="file"
          id={`fi-${type}`}
          accept={ALLOWED_ACCEPT}
          multiple
          onChange={e => addFiles(type, e.target.files)}
          style={{ display: "none" }}
        />
        {files.length
          ? files.map((f, i) => (
            <div className="zone-file-row" key={i}>
              <div>
                <div className="zfname" title={f.name}>
                  {f.type.startsWith("image/") ? "🖼️" : "📄"} {f.name}
                </div>
                <div className="zfsize">{(f.size / 1024).toFixed(1)} KB</div>
              </div>
              <button className="zf-rm" onClick={() => removeFile(type, i)}>✕</button>
            </div>
          ))
          : <div className="zone-empty">No files selected</div>}
      </div>
    );
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2>Upload Documents</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="upload-zones"><Zone type="hbl" /><Zone type="mbl" /></div>
          {total > 0 && (
            <div className="upload-summary">
              <div className="us-item">HBL: <span className="us-count hbl">{hblFiles.length}</span></div>
              <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 8px" }} />
              <div className="us-item">MBL: <span className="us-count mbl">{mblFiles.length}</span></div>
              <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 8px" }} />
              <div className="us-item" style={{ fontWeight: 700, color: "var(--text)" }}>Total: {total}</div>
            </div>
          )}
          {uploading && progress > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
          {results && (
            <div>
              {results.txn_id && (
                <div style={{ background: "rgba(37,99,235,.06)", border: "1px solid rgba(37,99,235,.2)", borderRadius: 7, padding: "8px 12px", marginBottom: 10, fontSize: ".75rem", color: "var(--muted)" }}>
                  🔖 Shared TXN: <span style={{ fontFamily: "var(--mono)", color: "var(--accent)", fontWeight: 700 }}>{results.txn_id}</span>
                </div>
              )}
              {results.uploaded.map((f, i) => (
                <div className="ur-item ok" key={i}>
                  <span>✅</span>
                  <div>
                    <div className="ur-name">{f.filename} <FtTag type={f.file_type} /></div>
                    <div className="ur-meta">{f.size_kb} KB · {f.pdf_type ?? "detecting..."} · Queued</div>
                    <div className="ur-txn">{f.txn_id}</div>
                  </div>
                </div>
              ))}
              {(results.errors ?? []).map((e, i) => (
                <div className="ur-item err" key={i}>
                  <span>❌</span>
                  <div>
                    <div className="ur-name">{e.filename}</div>
                    <div className="ur-meta">{e.error}</div>
                  </div>
                </div>
              ))}
              {results.error && (
                <div className="ur-item err">
                  <span>❌</span>
                  <div><div className="ur-name">Upload failed</div></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!total || uploading}>
            {uploading ? "⏳ Uploading…" : "Upload & Extract"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

type DetailTab = "payload" | "mbl_file" | "hbl_file" | "raw";

const DetailModal: FC<{ record: FileRecord; ports: PortOption[]; carriers: CarrierOption[]; containerTypes: ContainerTypeOption[]; onClose: () => void }> = ({ record, ports, carriers, containerTypes, onClose }) => {
  const isAdmin = useIsAdminUser();
  const [tab, setTab] = useState<DetailTab>("payload");
  const p = record.api_payload ?? record.extracted_data ?? {} as PayloadData;

  const tabs = useMemo(() => {
    const items: Array<{ key: DetailTab; label: string }> = [
      { key: "payload", label: "Payload Form" },
    ];
    if (record.mbl_file_url?.trim()) items.push({ key: "mbl_file", label: "MBL File" });
    if (record.hbl_file_url?.trim()) items.push({ key: "hbl_file", label: "HBL File" });
    if (isAdmin) items.push({ key: "raw", label: "Raw JSON" });
    return items;
  }, [record.mbl_file_url, record.hbl_file_url, isAdmin]);

  useEffect(() => {
    if (!tabs.some(t => t.key === tab)) setTab("payload");
  }, [tabs, tab]);

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-xl" style={{ display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <div>
            <div className="detail-txn">{record.txn_id}</div>
            <div className="detail-fname">{record.filename}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge status={record.status} />
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="tabs">
          {tabs.map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="tab-body" style={tab === "mbl_file" || tab === "hbl_file" ? { padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : undefined}>
          {tab === "payload" && <PayloadFormBody p={p} ports={ports} carriers={carriers} containerTypes={containerTypes} />}
          {tab === "mbl_file" && record.mbl_file_url?.trim() && (
            <FilePreviewFrame url={record.mbl_file_url.trim()} title={`MBL — ${record.filename}`} />
          )}
          {tab === "hbl_file" && record.hbl_file_url?.trim() && (
            <FilePreviewFrame url={record.hbl_file_url.trim()} title={`HBL — ${record.filename}`} />
          )}
          {tab === "raw" && (
            Object.keys(p).length
              ? <pre style={{ maxHeight: "calc(88vh - 200px)" }}>{JSON.stringify(p, null, 2)}</pre>
              : <div className="state-box"><div className="state-icon">📭</div><div className="state-text">No payload data</div></div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Editable Field ───────────────────────────────────────────────────────────

const EF: FC<{
  label: string;
  value?: unknown;
  cls?: string;
  span?: 1 | 2 | 3 | 4;
  onChange: (val: string) => void;
}> = ({ label, value, cls = "", span = 1, onChange }) => {
  const v = Array.isArray(value) ? value.join(", ") : value != null ? String(value) : "";
  return (
    <div className={`ff${span > 1 ? ` s${span}` : ""}`}>
      <label>{label}</label>
      <input
        value={v}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "var(--surface)", border: "1px solid var(--border2)",
          borderRadius: 5, padding: "5px 9px",
          fontFamily: cls === "mono" ? "var(--mono)" : "var(--sans)",
          fontSize: ".8rem", color: "var(--text)", outline: "none", transition: "border-color .15s",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={e => (e.currentTarget.style.borderColor = "var(--border2)")}
      />
    </div>
  );
};

// ─── Payload Form Body ────────────────────────────────────────────────────────

const PayloadFormBody: FC<{
  p: PayloadData;
  ports?: PortOption[];
  editPorts?: {
    ports: PortOption[];
    originCode: string; originText: string;
    destCode: string; destText: string;
    onOriginChange: (t: string) => void;
    onOriginSelect: (code: string, display: string) => void;
    onDestChange: (t: string) => void;
    onDestSelect: (code: string, display: string) => void;
  };
  editHousingPorts?: Array<{
    ports: PortOption[];
    originCode: string; originText: string;
    destCode: string; destText: string;
    onOriginChange: (t: string) => void;
    onOriginSelect: (code: string, display: string) => void;
    onDestChange: (t: string) => void;
    onDestSelect: (code: string, display: string) => void;
  }>;
  onFieldChange?: (field: keyof PayloadData, val: string) => void;
  onHousingFieldChange?: (idx: number, field: keyof HousingDetail, val: string) => void;
  onFixCode?: () => void;
  onFixHousingCode?: (idx: number) => void;
  carriers?: CarrierOption[];
  onFixCarrier?: () => void;
  containerTypes?: ContainerTypeOption[];
  onContainerDetailChange?: (idx: number, code: string) => void;
  onFixContainerType?: () => void;
}> = ({ p, ports = [], carriers = [], containerTypes = [], editPorts, editHousingPorts, onFieldChange, onHousingFieldChange, onFixCode, onFixHousingCode, onFixCarrier, onContainerDetailChange, onFixContainerType }) => {
  if (!p || !Object.keys(p).length)
    return <div className="state-box"><div className="state-icon">📭</div><div className="state-text">No payload data</div></div>;

  const housing = Array.isArray(p.housing_details) ? p.housing_details : [];

  const F = (label: string, val: unknown, field: keyof PayloadData, cls?: string, span?: 1 | 2 | 3 | 4) =>
    onFieldChange
      ? <EF label={label} value={val} cls={cls} span={span} onChange={v => onFieldChange(field, v)} />
      : <FF label={label} val={val} cls={cls} span={span} />;

  const HF = (idx: number, label: string, val: unknown, field: keyof HousingDetail, cls?: string, span?: 1 | 2 | 3 | 4) =>
    onHousingFieldChange
      ? <EF label={label} value={val} cls={cls} span={span} onChange={v => onHousingFieldChange(idx, field, v)} />
      : <FF label={label} val={val} cls={cls} span={span} />;

  const resolvePort = (code?: string) => ports.find(pt => pt.alias_code === code || pt.port_code === code);
  const resolveCarrier = (code?: string) => carriers.find(c => c.alias_code === code || c.carrier_code === code);
  const resolveContainerType = (code?: string) => containerTypes.find(ct => ct.alias_code === code || ct.container_code === code);

  const PortCodeView: FC<{ label: string; code?: string; span?: 1 | 2 | 3 | 4; onFix?: () => void }> = ({ label, code, span = 1, onFix }) => {
    const match = resolvePort(code as string | undefined);
    const isValid = !!match;
    return (
      <div className={`ff${span > 1 ? ` s${span}` : ""}`}>
        <label>{label}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div className={`fval mono`} style={{ color: code ? (isValid ? "var(--green)" : "var(--red)") : undefined }}>
            {code ?? "—"}
          </div>
          {code && (
            <div style={{ fontSize: ".68rem", color: isValid ? "var(--muted)" : "var(--red)", fontFamily: "var(--sans)", paddingLeft: 2 }}>
              {isValid ? `${match.port_name} · ${match.transport_mode}` : "⚠ Not found in port list"}
            </div>
          )}
          {!isValid && code && onFix && (
            <button
              onClick={onFix}
              style={{
                alignSelf: "flex-start", marginTop: 2, padding: "2px 8px",
                fontSize: ".6rem", fontWeight: 700, fontFamily: "var(--sans)",
                background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.35)",
                borderRadius: 4, color: "var(--red)", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 4,
              }}
            >
              🔧 Fix Alias
            </button>
          )}
        </div>
      </div>
    );
  };

  const CarrierCodeView: FC<{ label: string; code?: string }> = ({ label, code }) => {
    const match = resolveCarrier(code);
    const isValid = !!match;
    return (
      <div className="ff">
        <label>{label}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div className="fval mono" style={{ color: code ? (isValid ? "var(--green)" : "var(--red)") : undefined }}>
            {code ?? "—"}
          </div>
          {code && (
            <div style={{ fontSize: ".68rem", color: isValid ? "var(--muted)" : "var(--red)", fontFamily: "var(--sans)", paddingLeft: 2 }}>
              {isValid ? match.carrier_name : "⚠ Not found in carrier list"}
            </div>
          )}
          {!isValid && code && onFixCarrier && (
            <button
              onClick={onFixCarrier}
              style={{
                alignSelf: "flex-start", marginTop: 2, padding: "2px 8px",
                fontSize: ".6rem", fontWeight: 700, fontFamily: "var(--sans)",
                background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.35)",
                borderRadius: 4, color: "var(--red)", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 4,
              }}
            >
              🔧 Fix Alias
            </button>
          )}
        </div>
      </div>
    );
  };

  const ContainerTypeView: FC<{ code?: string; onFix?: () => void }> = ({ code, onFix }) => {
    const match = resolveContainerType(code);
    const isValid = !!match;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div className="fval mono" style={{ color: code ? (isValid ? "var(--green)" : "var(--red)") : undefined }}>
          {code ?? "—"}
        </div>
        {code && (
          <div style={{ fontSize: ".68rem", color: isValid ? "var(--muted)" : "var(--red)", fontFamily: "var(--sans)", paddingLeft: 2 }}>
            {isValid ? match.container_name : "⚠ Not found in container type list"}
          </div>
        )}
        {!isValid && code && onFix && (
          <button
            onClick={onFix}
            style={{
              alignSelf: "flex-start", marginTop: 2, padding: "2px 8px",
              fontSize: ".6rem", fontWeight: 700, fontFamily: "var(--sans)",
              background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.35)",
              borderRadius: 4, color: "var(--red)", cursor: "pointer", display: "flex",
              alignItems: "center", gap: 4,
            }}
          >
            🔧 Fix Alias
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="form-body">
      <Sec icon="📄" title="Document Header">
        <div className="fgrid c4">
          {F("MBL Number", p.mbl_number ?? p.bl_number, "mbl_number", "mono")}
          <CarrierCodeView label="Carrier Code" code={p.carrier_code as string | undefined} />
          {F("Carrier Name", p.carrier_name, "carrier_name")}
          {F("Service", p.service, "service")}
          {F("Service Type", p.service_type, "service_type")}
          {F("Freight Terms", p.freight_terms, "freight_terms")}
        </div>
      </Sec>

      <Sec icon="🗺️" title="Routing & Ports">
        <div className="fgrid c4">
          {F("Port of Loading", p.port_of_loading, "port_of_loading")}
          {F("Port of Discharge", p.port_of_discharge, "port_of_discharge")}
          {F("Place of Delivery", p.place_of_delivery, "place_of_delivery")}
          {editPorts ? (
            <>
              <div className="ff" style={{ overflow: "visible" }}>
                <PortSearch label="Origin Code" value={editPorts.originCode} inputText={editPorts.originText} ports={editPorts.ports} onChange={editPorts.onOriginChange} onSelect={editPorts.onOriginSelect} onFix={onFixCode} />
              </div>
              <div className="ff" style={{ overflow: "visible" }}>
                <PortSearch label="Destination Code" value={editPorts.destCode} inputText={editPorts.destText} ports={editPorts.ports} onChange={editPorts.onDestChange} onSelect={editPorts.onDestSelect} onFix={onFixCode} />
              </div>
            </>
          ) : (
            <>
              <PortCodeView label="Origin Code" code={p.origin_code as string | undefined} onFix={onFixCode} />
              <PortCodeView label="Destination Code" code={p.destination_code as string | undefined} onFix={onFixCode} />
            </>
          )}
          {F("Freight Payable At", p.freight_payable_at, "freight_payable_at")}
          {F("Export Reference", p.export_reference, "export_reference", "mono")}
        </div>
        {p.ocean_routings?.map((r, i) => (
          <div className="routing-pill" key={i}>
            <span className="rp">{r.from_port_code ?? "—"}</span>
            <span className="ra">→</span>
            <span className="rp">{r.to_port_code ?? "—"}</span>
            <span style={{ color: "var(--border2)" }}>|</span>
            <span className="rm">Vessel: {r.vessel ?? "—"} · Voyage: {r.voyage_number ?? "—"} · {r.transport_type ?? ""}</span>
          </div>
        ))}
      </Sec>

      <Sec icon="🚢" title="Vessel & Voyage">
        <div className="fgrid c4">
          {F("Vessel Name", p.vessel_name, "vessel_name")}
          {F("Voyage Number", p.voyage_number, "voyage_number", "mono")}
          {F("Date of Issue", p.date_of_issue, "date_of_issue")}
          {F("On Board Date", p.on_board_date ?? p.shipped_on_board_date, "on_board_date")}
          {F("Place of Issue", p.place_of_issue, "place_of_issue")}
          {F("Agent", p.agent, "agent")}
        </div>
      </Sec>

      {Array.isArray(p.container_details) && p.container_details.length > 0 && (
        <Sec icon="📦" title={`Container Details (${p.container_details.length})`}>
          <table className="ctable">
            <thead>
              <tr>
                <th>Container No.</th><th>Type</th><th>Seal No.</th>
              </tr>
            </thead>
            <tbody>
              {p.container_details.map((c, i) => (
                <tr key={i}>
                  <td>{c.container_no ?? "—"}</td>
                  <td style={{ overflow: "visible" }}>
                    {onContainerDetailChange ? (
                      <ContainerTypeSearch
                        value={c.container_type_input ?? c.container_type ?? ""}
                        containerTypes={containerTypes}
                        onChange={code => onContainerDetailChange(i, code)}
                        onFix={onFixContainerType}
                      />
                    ) : (
                      <ContainerTypeView code={c.container_type_input ?? c.container_type} onFix={onFixContainerType} />
                    )}
                  </td>
                  <td>{c.actual_seal_no ?? c.seal_no ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>
      )}

      {(onFieldChange || fv(p.special_clauses)) && (
        <Sec icon="📋" title="Special Clauses">
          <div className="fgrid c2">{F("Clause", p.special_clauses, "special_clauses", "", 2)}</div>
        </Sec>
      )}

      <Sec icon="🟣" title={`Housing Details — HBL Sub-bills (${housing.length})`}>
        {!housing.length ? (
          <div className="no-data">No HBL housing details linked.</div>
        ) : housing.map((hd, idx) => (
          <div className="hcard" key={idx}>
            <div className="hcard-head">
              <span className="hcard-num">HBL {idx + 1}</span>
              <span className="hcard-bl">{hd.hbl_number ?? "—"}</span>
              <span className="hcard-shipper">{hd.shipper_name ?? ""}</span>
              {hd.cargo_mode && <span className="hcard-mode">{hd.cargo_mode}</span>}
            </div>
            <div className="hcard-body">
              <div className="fgrid c4" style={{ marginBottom: 12 }}>
                {HF(idx, "HBL Number", hd.hbl_number, "hbl_number", "mono")}
                {HF(idx, "Trade", hd.trade, "trade")}
                {HF(idx, "Routed", hd.routed, "routed")}
                {HF(idx, "Freight Terms", hd.freight_terms, "freight_terms")}
                {HF(idx, "Marks No", hd.marks_no, "marks_no")}
                {editHousingPorts?.[idx] ? (
                  <>
                    <div className="ff" style={{ overflow: "visible" }}>
                      <PortSearch label="Origin Code" value={editHousingPorts[idx].originCode} inputText={editHousingPorts[idx].originText} ports={editHousingPorts[idx].ports} onChange={editHousingPorts[idx].onOriginChange} onSelect={editHousingPorts[idx].onOriginSelect} onFix={onFixHousingCode ? () => onFixHousingCode(idx) : undefined} />
                    </div>
                    <div className="ff" style={{ overflow: "visible" }}>
                      <PortSearch label="Destination Code" value={editHousingPorts[idx].destCode} inputText={editHousingPorts[idx].destText} ports={editHousingPorts[idx].ports} onChange={editHousingPorts[idx].onDestChange} onSelect={editHousingPorts[idx].onDestSelect} onFix={onFixHousingCode ? () => onFixHousingCode(idx) : undefined} />
                    </div>
                  </>
                ) : (
                  <>
                    <PortCodeView label="Origin Code" code={hd.origin_code as string | undefined} onFix={onFixHousingCode ? () => onFixHousingCode(idx) : undefined} />
                    <PortCodeView label="Destination Code" code={hd.destination_code as string | undefined} onFix={onFixHousingCode ? () => onFixHousingCode(idx) : undefined} />
                  </>
                )}
                {HF(idx, "Invoice No", hd.invoice_no, "invoice_no", "mono")}
                {HF(idx, "Date of Issue", hd.date_of_issue, "date_of_issue")}
              </div>

              {(hd.total_packages || hd.total_volume_cbm || hd.total_gross_weight_kgs) && (
                <div className="cost-strip" style={{ marginBottom: 12 }}>
                  {hd.total_packages && <div className="cost-cell-box"><div className="ccv" style={{ color: "var(--cyan)" }}>{hd.total_packages}</div><div className="ccl">Total Packages</div></div>}
                  {hd.total_volume_cbm && <div className="cost-cell-box"><div className="ccv" style={{ color: "var(--cyan)" }}>{hd.total_volume_cbm}</div><div className="ccl">Total Volume (CBM)</div></div>}
                  {hd.total_gross_weight_kgs && <div className="cost-cell-box"><div className="ccv" style={{ color: "var(--cyan)" }}>{hd.total_gross_weight_kgs}</div><div className="ccl">Gross Weight (KGS)</div></div>}
                </div>
              )}

              <SubSec icon="🏭" title="Shipper">
                <div className="fgrid c4">
                  {HF(idx, "Name", hd.shipper_name, "shipper_name", "", 3)}
                  {HF(idx, "Email", hd.shipper_email, "shipper_email")}
                  {HF(idx, "Address", hd.shipper_address, "shipper_address", "", 4)}
                  {HF(idx, "Tel", hd.shipper_tel, "shipper_tel", "mono")}
                  {HF(idx, "Fax", hd.shipper_fax, "shipper_fax", "mono")}
                  {HF(idx, "Phone", hd.shipper_phone, "shipper_phone", "mono")}
                </div>
              </SubSec>

              <SubSec icon="📦" title="Consignee">
                <div className="fgrid c4">
                  {HF(idx, "Name", hd.consignee_name, "consignee_name", "", 4)}
                  {HF(idx, "Address", hd.consignee_address, "consignee_address", "", 4)}
                  {HF(idx, "GST", hd.consignee_gst ?? hd.gst_no_consignee, "consignee_gst", "mono")}
                  {HF(idx, "PAN", hd.consignee_pan ?? hd.pan_no, "consignee_pan", "mono")}
                  {HF(idx, "Email", hd.consignee_email, "consignee_email")}
                </div>
              </SubSec>

              <SubSec icon="🔔" title="Notify Party 1">
                <div className="fgrid c4">
                  {HF(idx, "Name", hd.notify1_customer_name, "notify1_customer_name", "", 4)}
                  {HF(idx, "Address", hd.notify1_customer_address, "notify1_customer_address", "", 4)}
                  {HF(idx, "Email", hd.notify1_customer_email, "notify1_customer_email")}
                  {HF(idx, "Phone", hd.notify1_customer_phone, "notify1_customer_phone", "mono")}
                </div>
              </SubSec>

              {(hd.notify2_customer_name || hd.notify2_customer_address || onHousingFieldChange) && (
                <SubSec icon="🔔" title="Notify Party 2">
                  <div className="fgrid c4">
                    {HF(idx, "Name", hd.notify2_customer_name, "notify2_customer_name", "", 4)}
                    {HF(idx, "Address", hd.notify2_customer_address, "notify2_customer_address", "", 4)}
                    {HF(idx, "Email", hd.notify2_customer_email, "notify2_customer_email")}
                  </div>
                </SubSec>
              )}

              <SubSec icon="🏢" title="Agent">
                <div className="fgrid c4">
                  {HF(idx, "Name", hd.agent_name, "agent_name", "", 2)}
                  {HF(idx, "GST No", hd.agent_gst_no, "agent_gst_no", "mono")}
                  {HF(idx, "PAN No", hd.agent_pan_no, "agent_pan_no", "mono")}
                  {HF(idx, "Address", hd.agent_address, "agent_address", "", 4)}
                  {HF(idx, "Phone", fv(hd.agent_phone), "agent_phone", "mono")}
                  {HF(idx, "Mobile", hd.agent_mobile, "agent_mobile", "mono")}
                  {HF(idx, "Email", hd.agent_email, "agent_email")}
                </div>
              </SubSec>

              {(hd.issuing_agent || hd.issuing_agent_address || onHousingFieldChange) && (
                <SubSec icon="🏢" title="Issuing Agent">
                  <div className="fgrid c4">
                    {HF(idx, "Name", hd.issuing_agent, "issuing_agent", "", 2)}
                    {HF(idx, "Email", fv(hd.issuing_agent_email), "issuing_agent_email", "", 2)}
                    {HF(idx, "Address", hd.issuing_agent_address, "issuing_agent_address", "", 4)}
                  </div>
                </SubSec>
              )}

              {(fv(hd.commodity_description) || onHousingFieldChange) && (
                <SubSec icon="📋" title="Commodity">
                  <div className="fgrid c2">
                    {HF(idx, "Description", hd.commodity_description, "commodity_description", "", 2)}
                  </div>
                </SubSec>
              )}

              {Array.isArray(hd.cargo_details) && hd.cargo_details.length > 0 && (
                <SubSec icon="📫" title={`Cargo / Container Details (${hd.cargo_details.length})`}>
                  <table className="ctable">
                    <thead>
                      <tr>
                        <th>Container No.</th><th>Pkgs</th><th>Gross Wt (KG)</th>
                        <th>Volume (CBM)</th><th>Charg. Wt</th><th>HAZ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hd.cargo_details.map((c, ci) => (
                        <tr key={ci}>
                          <td>{c.container_no ?? c.container_number ?? "—"}</td>
                          <td>{c.no_of_packages ?? c.packages ?? "—"}</td>
                          <td>{c.gross_weight_kgs ?? c.gross_weight ?? "—"}</td>
                          <td>{c.volume_cbm ?? c.volume ?? "—"}</td>
                          <td>{c.chargeable_weight ?? "—"}</td>
                          <td>{c.haz ? "⚠️" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SubSec>
              )}
            </div>
          </div>
        ))}
      </Sec>
    </div>
  );
};

// ─── Payload Modal ────────────────────────────────────────────────────────────

interface PayloadModalProps {
  txn_id: string;
  record?: FileRecord;
  onClose: () => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
  onRefreshList?: () => void;
}

const PayloadModal: FC<PayloadModalProps> = ({ txn_id, record: inlineRecord, onClose, showToast, onRefreshList }) => {
  const isAdmin = useIsAdminUser();
  // ── FIX 1: Seed editData immediately from inlineRecord — no race condition ──
  const initPayload = useCallback((): PayloadData => {
    return inlineRecord?.api_payload ?? inlineRecord?.extracted_data ?? {};
  }, [inlineRecord]);

  const [rec, setRec] = useState<FileRecord | null>(inlineRecord ?? null);
  const [loading, setLoading] = useState(!inlineRecord);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [ptab, setPtab] = useState<"form" | "mbl_file" | "hbl_file" | "raw">("form");
  const [ports, setPorts] = useState<PortOption[]>([]);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerTypeOption[]>([]);
  const [fixTarget, setFixTarget] = useState<{ record: FileRecord } | null>(null);
  const [containerTypeFixTarget, setContainerTypeFixTarget] = useState<{ record: FileRecord } | null>(null);
  const [carrierFixTarget, setCarrierFixTarget] = useState<{ record: FileRecord } | null>(null);

  const payloadTabs = useMemo(() => {
    const tabs: Array<{ key: "form" | "mbl_file" | "hbl_file" | "raw"; label: string }> = [
      { key: "form", label: "Form View" },
    ];
    if (rec?.mbl_file_url?.trim()) tabs.push({ key: "mbl_file", label: "MBL File" });
    if (rec?.hbl_file_url?.trim()) tabs.push({ key: "hbl_file", label: "HBL File" });
    if (isAdmin) tabs.push({ key: "raw", label: "Raw JSON" });
    return tabs;
  }, [rec?.mbl_file_url, rec?.hbl_file_url, isAdmin]);

  useEffect(() => {
    if (!payloadTabs.some(t => t.key === ptab)) setPtab("form");
  }, [payloadTabs, ptab]);

  // Seed all state immediately from inlineRecord (avoids blank form on first render)
  const [editData, setEditData] = useState<PayloadData>(initPayload);
  const [originText, setOriginText] = useState<string>(
    () => (initPayload().origin_code as string) ?? ""
  );
  const [destText, setDestText] = useState<string>(
    () => (initPayload().destination_code as string) ?? ""
  );
  const [housingOriginTexts, setHousingOriginTexts] = useState<string[]>(() => {
    const h = initPayload().housing_details;
    return Array.isArray(h) ? (h as HousingDetail[]).map(hd => (hd.origin_code as string) ?? "") : [];
  });
  const [housingDestTexts, setHousingDestTexts] = useState<string[]>(() => {
    const h = initPayload().housing_details;
    return Array.isArray(h) ? (h as HousingDetail[]).map(hd => (hd.destination_code as string) ?? "") : [];
  });

  // ── FIX 2: Only fetch + re-seed when record was NOT passed inline ──
  useEffect(() => {
     if (inlineRecord) return ; // already seeded — skip
    hblApi
      .get<FileRecord>(`/files/${txn_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => {
        setRec(r.data);
        const pd: PayloadData = r.data.api_payload ?? r.data.extracted_data ?? {};
        setEditData(pd);
        setOriginText((pd.origin_code as string) ?? "");
        setDestText((pd.destination_code as string) ?? "");
        const housing = Array.isArray(pd.housing_details) ? (pd.housing_details as HousingDetail[]) : [];
        setHousingOriginTexts(housing.map(hd => (hd.origin_code as string) ?? ""));
        setHousingDestTexts(housing.map(hd => (hd.destination_code as string) ?? ""));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [txn_id, inlineRecord]);

  // Fetch port list
  useEffect(() => {
    hblApi
      .get<{ ports: PortOption[] }>("/ports", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => setPorts(r.data.ports ?? []))
      .catch(() => showToast("Failed to load ports", "error"));
  }, [showToast]);

  const reloadPorts = useCallback(() => {
    hblApi
      .get<{ ports: PortOption[] }>("/ports", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => { setPorts(r.data.ports ?? []); onRefreshList?.(); })
      .catch(() => {});
  }, [onRefreshList]);

  useEffect(() => {
    hblApi
      .get<{ carriers: CarrierOption[] }>("/carriers", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => setCarriers(r.data.carriers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    hblApi
      .get<{ container_codes: ContainerTypeOption[] }>("/container-codes", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => setContainerTypes(r.data.container_codes ?? []))
      .catch(() => {});
  }, []);

  const reloadCarriers = useCallback(() => {
    hblApi
      .get<{ carriers: CarrierOption[] }>("/carriers", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => { setCarriers(r.data.carriers ?? []); onRefreshList?.(); })
      .catch(() => {});
  }, [onRefreshList]);

  const reloadContainerTypes = useCallback(() => {
    hblApi
      .get<{ container_codes: ContainerTypeOption[] }>("/container-codes", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => { setContainerTypes(r.data.container_codes ?? []); onRefreshList?.(); })
      .catch(() => {});
  }, [onRefreshList]);

  const onFieldChange = useCallback((field: keyof PayloadData, val: string) => {
    setIsDirty(true);
    setEditData(prev => ({ ...prev, [field]: val }));
  }, []);

  const onHousingFieldChange = useCallback((idx: number, field: keyof HousingDetail, val: string) => {
    setIsDirty(true);
    setEditData(prev => {
      const housing = Array.isArray(prev.housing_details)
        ? [...(prev.housing_details as HousingDetail[])]
        : [];
      housing[idx] = { ...housing[idx], [field]: val };
      return { ...prev, housing_details: housing };
    });
  }, []);

  const onContainerDetailChange = useCallback((idx: number, code: string) => {
    setIsDirty(true);
    setEditData(prev => {
      const containers = Array.isArray(prev.container_details)
        ? [...(prev.container_details as ContainerDetail[])]
        : [];
      containers[idx] = { ...containers[idx], container_type: code, container_type_input: code };
      return { ...prev, container_details: containers };
    });
  }, []);

  // ── FIX 3: Safe housing array — no unsafe cast, no crash on undefined ──
  const editHousingPortsArr = (() => {
    const housing = Array.isArray(editData.housing_details)
      ? (editData.housing_details as HousingDetail[])
      : [];
    return housing.map((_, idx) => ({
      ports,
      originCode: housing[idx]?.origin_code as string ?? "",
      originText: housingOriginTexts[idx] ?? "",
      destCode: housing[idx]?.destination_code as string ?? "",
      destText: housingDestTexts[idx] ?? "",
      onOriginChange: (t: string) => {
        setHousingOriginTexts(prev => { const a = [...prev]; a[idx] = t; return a; });
        onHousingFieldChange(idx, "origin_code", "");
      },
      onOriginSelect: (code: string, display: string) => {
        setHousingOriginTexts(prev => { const a = [...prev]; a[idx] = display; return a; });
        onHousingFieldChange(idx, "origin_code", code);
      },
      onDestChange: (t: string) => {
        setHousingDestTexts(prev => { const a = [...prev]; a[idx] = t; return a; });
        onHousingFieldChange(idx, "destination_code", "");
      },
      onDestSelect: (code: string, display: string) => {
        setHousingDestTexts(prev => { const a = [...prev]; a[idx] = display; return a; });
        onHousingFieldChange(idx, "destination_code", code);
      },
    }));
  })();

  // ── FIX 4: Save payload to API ──
  const savePayload = async () => {
    setSaving(true);
    try {
      await hblApi.patch(
        `/files/${txn_id}/payload`,
        editData,
        { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } }
      );
      showToast("✅ Payload saved successfully", "success");
      setIsDirty(false);
      onClose();
    } catch {
      showToast("❌ Save failed — check server connection", "error");
    } finally {
      setSaving(false);
    }
  };

  const copy = () =>
    navigator.clipboard
      .writeText(JSON.stringify(editData, null, 2))
      .then(() => showToast("✅ JSON copied", "success"))
      .catch(() => showToast("❌ Copy failed", "error"));

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-xl" style={{ display: "flex", flexDirection: "column" }}>
        <div className="modal-head" style={{ padding: "16px 24px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
              <span className="ft-tag mbl">MBL</span>
              {rec && <Badge status={rec.status ?? "done"} />}
              {editData.document_type && <span className="pdf-tag">{editData.document_type}</span>}
              {/* Dirty indicator — shows when there are unsaved changes */}
              {/* {isDirty && ( */}
                {/* <span className="dirty-indicator">● Unsaved changes</span> */}
              {/* )} */}
            </div>
            <div style={{ fontSize: ".95rem", fontWeight: 700 }}>{rec?.filename ?? txn_id}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: ".65rem", color: "var(--muted)", marginTop: 2 }}>
              {txn_id} · MBL: {editData.mbl_number ?? editData.bl_number ?? "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="act-btn dl" style={{ padding: "5px 12px", fontSize: ".72rem" }} onClick={copy}>
              ⎘ Copy JSON
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="tabs" style={{ padding: "8px 24px 0" }}>
          {payloadTabs.map(t => (
            <button key={t.key} className={`tab-btn ${ptab === t.key ? "active" : ""}`} onClick={() => setPtab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div className="state-box"><div className="spinner" /></div>
          ) : ptab === "form" ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <PayloadFormBody
                p={editData}
                ports={ports}
                carriers={carriers}
                containerTypes={containerTypes}
                onContainerDetailChange={onContainerDetailChange}
                onFixContainerType={() => rec && setContainerTypeFixTarget({ record: rec })}
                onFixCarrier={() => rec && setCarrierFixTarget({ record: rec })}
                editPorts={{
                  ports,
                  originCode: editData.origin_code as string ?? "",
                  originText,
                  destCode: editData.destination_code as string ?? "",
                  destText,
                  onOriginChange: t => { setOriginText(t); onFieldChange("origin_code", ""); },
                  onOriginSelect: (code, display) => { setOriginText(display); onFieldChange("origin_code", code); },
                  onDestChange: t => { setDestText(t); onFieldChange("destination_code", ""); },
                  onDestSelect: (code, display) => { setDestText(display); onFieldChange("destination_code", code); },
                }}
                editHousingPorts={editHousingPortsArr}
                onFieldChange={onFieldChange}
                onHousingFieldChange={onHousingFieldChange}
                onFixCode={() => rec && setFixTarget({ record: rec })}
                onFixHousingCode={() => rec && setFixTarget({ record: rec })}
              />
            </div>
          ) : ptab === "mbl_file" && rec?.mbl_file_url?.trim() ? (
            <FilePreviewFrame url={rec.mbl_file_url.trim()} title={`MBL — ${rec.filename ?? txn_id}`} />
          ) : ptab === "hbl_file" && rec?.hbl_file_url?.trim() ? (
            <FilePreviewFrame url={rec.hbl_file_url.trim()} title={`HBL — ${rec.filename ?? txn_id}`} />
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <pre style={{ maxHeight: "calc(92vh - 220px)" }}>{JSON.stringify(rec?.api_payload ?? rec?.extracted_data ?? {}, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          
        </div>

      </div>

      {fixTarget && (
        <PortFixModal
          record={fixTarget.record}
          ports={ports}
          onClose={() => setFixTarget(null)}
          onSaved={reloadPorts}
          showToast={showToast}
        />
      )}
      {carrierFixTarget && (
        <CarrierFixModal
          record={carrierFixTarget.record}
          carriers={carriers}
          onClose={() => setCarrierFixTarget(null)}
          onSaved={reloadCarriers}
          showToast={showToast}
        />
      )}
      {containerTypeFixTarget && (
        <ContainerTypeFixModal
          record={containerTypeFixTarget.record}
          containerTypes={containerTypes}
          onClose={() => setContainerTypeFixTarget(null)}
          onSaved={reloadContainerTypes}
          showToast={showToast}
        />
      )}
    </div>
  );
};

// ─── Port Search ──────────────────────────────────────────────────────────────

const PortSearch: FC<{
  label: string;
  value: string;
  inputText: string;
  ports: PortOption[];
  onChange: (text: string) => void;
  onSelect: (code: string, display: string) => void;
  placeholder?: string;
  onFix?: () => void;
}> = ({ label, value, inputText, ports, onChange, onSelect, placeholder = "Search port code or name…", onFix }) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  const computePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  };

  const handleFocus = () => { computePos(); setOpen(true); };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    computePos();
    setOpen(true);
  };

  const filtered = useMemo(() => {
    if (inputText.length < 1) return [];
    const q = inputText.toLowerCase();
    return ports.filter(p =>
      p.port_code.toLowerCase().includes(q) ||
      p.port_name.toLowerCase().includes(q) ||
      p.alias_code.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [inputText, ports]);

  const matchesAlias = value ? ports.some(p => p.alias_code === value || p.port_code === value) : false;

  return (
    <div ref={wrapRef}>
      <label style={{ display: "block", fontSize: ".78rem", fontWeight: 600, marginBottom: 5 }}>
        {label} <span style={{ color: "var(--red)" }}>*</span>
      </label>
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={inputText}
        autoComplete="off"
        onChange={handleChange}
        onFocus={handleFocus}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 7,
          border: `1px solid ${matchesAlias ? "var(--green)" : "var(--border2)"}`,
          fontFamily: "var(--sans)", fontSize: ".8rem", outline: "none",
          background: "var(--surface)",
        }}
      />
      {value && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: ".7rem", color: matchesAlias ? "var(--green)" : "var(--red)", fontFamily: "var(--mono)" }}>
            {matchesAlias ? "✓" : "⚠"} {value}
          </span>
          {!matchesAlias && onFix && (
            <button
              onClick={onFix}
              style={{
                padding: "1px 7px", fontSize: ".6rem", fontWeight: 700,
                fontFamily: "var(--sans)", background: "rgba(220,38,38,.08)",
                border: "1px solid rgba(220,38,38,.35)", borderRadius: 4,
                color: "var(--red)", cursor: "pointer",
              }}
            >
              🔧 Fix Alias
            </button>
          )}
        </div>
      )}
      {open && filtered.length > 0 && (
        <div style={{
          position: "fixed",
          top: dropPos.top,
          left: dropPos.left,
          width: dropPos.width,
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          borderRadius: 7,
          boxShadow: "0 8px 28px rgba(0,0,0,.13)",
          zIndex: 9999,
          maxHeight: 240,
          overflowY: "auto",
        }}>
          {filtered.map(p => (
            <div
              key={p.port_code}
              onMouseDown={e => { e.preventDefault(); onSelect(p.port_code, `${p.port_code} – ${p.port_name}`); setOpen(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: ".78rem", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)", minWidth: 64 }}>{p.port_code}</span>
              <span style={{ flex: 1 }}>{p.port_name}</span>
              <span style={{ fontSize: ".68rem", color: "var(--muted)", fontFamily: "var(--mono)" }}>{p.transport_mode}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Container Type Search ────────────────────────────────────────────────────

const ContainerTypeSearch: FC<{
  value: string;
  containerTypes: ContainerTypeOption[];
  onChange: (code: string) => void;
  onFix?: () => void;
  placeholder?: string;
}> = ({ value, containerTypes, onChange, onFix, placeholder = "Search container type…" }) => {
  const [inputText, setInputText] = useState(value);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inputText && value) setInputText(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  const computePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
    }
  };

  const handleFocus = () => { computePos(); setOpen(true); };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    computePos();
    setOpen(true);
  };

  const filtered = useMemo(() => {
    if (inputText.length < 1) return [];
    const q = inputText.toLowerCase();
    return containerTypes.filter(ct =>
      ct.container_code.toLowerCase().includes(q) ||
      ct.container_name.toLowerCase().includes(q) ||
      (ct.alias_code ?? "").toLowerCase().includes(q)
    ).slice(0, 60);
  }, [inputText, containerTypes]);

  const isValid = !!containerTypes.find(ct => ct.alias_code === value || ct.container_code === value);

  return (
    <div ref={wrapRef}>
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={inputText}
        autoComplete="off"
        onChange={handleChange}
        onFocus={handleFocus}
        style={{
          width: "100%", padding: "5px 8px", borderRadius: 5,
          border: `1px solid ${value ? (isValid ? "var(--green)" : "var(--red)") : "var(--border2)"}`,
          fontFamily: "var(--mono)", fontSize: ".78rem", outline: "none",
          background: "var(--surface)",
        }}
      />
      {value && (
        <div style={{ fontSize: ".65rem", color: isValid ? "var(--green)" : "var(--red)", fontFamily: "var(--sans)", marginTop: 2 }}>
          {isValid ? `✓ ${containerTypes.find(ct => ct.alias_code === value || ct.container_code === value)?.container_name ?? ""}` : "⚠ Not found in container type list"}
        </div>
      )}
      {!isValid && value && onFix && (
        <button
          onClick={onFix}
          style={{
            marginTop: 3, padding: "2px 8px", fontSize: ".6rem", fontWeight: 700,
            fontFamily: "var(--sans)", background: "rgba(220,38,38,.08)",
            border: "1px solid rgba(220,38,38,.35)", borderRadius: 4,
            color: "var(--red)", cursor: "pointer",
          }}
        >
          🔧 Fix Alias
        </button>
      )}
      {open && filtered.length > 0 && (
        <div style={{
          position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 7,
          boxShadow: "0 8px 28px rgba(0,0,0,.13)", zIndex: 9999, maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map(ct => (
            <div
              key={ct.container_code}
              onMouseDown={e => {
                e.preventDefault();
                setInputText(ct.container_code);
                onChange(ct.container_code);
                setOpen(false);
              }}
              style={{ padding: "7px 12px", cursor: "pointer", fontSize: ".78rem", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)", minWidth: 56 }}>{ct.container_code}</span>
              <span style={{ flex: 1 }}>{ct.container_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Port Fix Modal ───────────────────────────────────────────────────────────

const PortFixModal: FC<{
  record: FileRecord;
  ports: PortOption[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
}> = ({ record, ports, onClose, onSaved, showToast }) => {
  const payload = record.api_payload ?? record.extracted_data ?? {} as PayloadData;
  const originCode = payload.origin_code as string | undefined;
  const destCode = payload.destination_code as string | undefined;

  const invalid = (code?: string) => !!code && !ports.some(p => p.alias_code === code);

  const lookupPortName = useCallback((code?: string) => {
    if (!code) return "";
    return ports.find(p => p.alias_code === code || p.port_code === code)?.port_name ?? "";
  }, [ports]);

  const [originFixed, setOriginFixed] = useState("");
  const [originText, setOriginText] = useState("");
  const [destFixed, setDestFixed] = useState("");
  const [destText, setDestText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ports.length) return;
    setOriginText(prev => prev || lookupPortName(originCode));
    setDestText(prev => prev || lookupPortName(destCode));
  }, [ports, originCode, destCode, lookupPortName]);

  const save = async () => {
    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` };
      const createAlias = async (aliasCode: string, portCode: string) => {
        const tm = ports.find(p => p.port_code === portCode)?.transport_mode ?? "SEA";
        await hblApi.post("/port-aliases/", {
          alias_code: aliasCode,
          port_code: portCode,
          transport_mode: tm,
          status: "ACTIVE",
        }, { headers });
      };
      if (invalid(originCode) && originFixed) await createAlias(originCode!, originFixed);
      if (invalid(destCode) && destFixed) await createAlias(destCode!, destFixed);
      showToast("✅ Port aliases created", "success");
      onSaved();
      onClose();
    } catch {
      showToast("❌ Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const PortFixRow: FC<{
    sectionLabel: string;
    aliasCode: string;
    fixedCode: string;
    inputText: string;
    onTextChange: (t: string) => void;
    onPortSelect: (code: string, display: string) => void;
  }> = ({ sectionLabel, aliasCode, fixedCode, inputText, onTextChange, onPortSelect }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: ".68rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
        {sectionLabel}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 130px" }}>
          <label style={{ fontSize: ".57rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)", display: "block", marginBottom: 3 }}>
            Alias Port Code
          </label>
          <input
            value={aliasCode}
            readOnly
            style={{
              width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 5, padding: "6px 9px", fontSize: ".8rem", color: "var(--muted)",
              fontFamily: "var(--mono)", cursor: "not-allowed",
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: "visible" }}>
          <PortSearch
            label="Select Port"
            value={fixedCode}
            inputText={inputText}
            ports={ports}
            onChange={t => { onTextChange(t); }}
            onSelect={onPortSelect}
            placeholder="Search by port name…"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-head">
          <h2>⚠ Fix Invalid Port Codes</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflow: "visible" }}>
          {invalid(originCode) && (
            <PortFixRow
              sectionLabel="Origin Code"
              aliasCode={originCode ?? ""}
              fixedCode={originFixed}
              inputText={originText}
              onTextChange={t => { setOriginText(t); setOriginFixed(""); }}
              onPortSelect={(code, display) => { setOriginFixed(code); setOriginText(display); }}
            />
          )}
          {invalid(destCode) && (
            <PortFixRow
              sectionLabel="Destination Code"
              aliasCode={destCode ?? ""}
              fixedCode={destFixed}
              inputText={destText}
              onTextChange={t => { setDestText(t); setDestFixed(""); }}
              onPortSelect={(code, display) => { setDestFixed(code); setDestText(display); }}
            />
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Carrier Fix Modal ────────────────────────────────────────────────────────

const CarrierFixModal: FC<{
  record: FileRecord;
  carriers: CarrierOption[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
}> = ({ record, carriers, onClose, onSaved, showToast }) => {
  const payload = record.api_payload ?? record.extracted_data ?? {} as PayloadData;
  const carrierCode = payload.carrier_code as string | undefined;

  const invalid = (code?: string) =>
    !!code && !carriers.some(c => c.alias_code === code || c.carrier_code === code);

  const lookupCarrierName = useCallback((code?: string) => {
    if (!code || !carriers.length) return "";
    return carriers.find(c => c.alias_code === code || c.carrier_code === code)?.carrier_name ?? "";
  }, [carriers]);

  const [fixedCode, setFixedCode] = useState("");
  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!carriers.length) return;
    setInputText(prev => prev || lookupCarrierName(carrierCode));
  }, [carriers, carrierCode, lookupCarrierName]);

  const filtered = useMemo(() => {
    if (inputText.length < 1) return [];
    const q = inputText.toLowerCase();
    return carriers.filter(c =>
      c.carrier_code.toLowerCase().includes(q) ||
      c.carrier_name.toLowerCase().includes(q) ||
      (c.alias_code ?? "").toLowerCase().includes(q)
    ).slice(0, 80);
  }, [inputText, carriers]);

  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const computePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  };

  const save = async () => {
    if (!fixedCode) return;
    setSaving(true);
    try {
      const tm = carriers.find(c => c.carrier_code === fixedCode)?.transport_mode ?? "SEA";
      await hblApi.post("/carrier-aliases/", {
        alias_code: carrierCode,
        carrier_code: fixedCode,
        transport_mode: tm,
        status: "ACTIVE",
      }, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
      showToast("✅ Carrier alias created", "success");
      onSaved();
      onClose();
    } catch {
      showToast("❌ Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!invalid(carrierCode)) return null;

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h2>🔧 Fix Invalid Carrier Code</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflow: "visible" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
              Carrier Code
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 130px" }}>
                <label style={{ fontSize: ".57rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)", display: "block", marginBottom: 3 }}>
                  Alias Code
                </label>
                <input
                  value={carrierCode ?? ""}
                  readOnly
                  style={{
                    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: 5, padding: "6px 9px", fontSize: ".8rem", color: "var(--muted)",
                    fontFamily: "var(--mono)", cursor: "not-allowed",
                  }}
                />
              </div>
              <div ref={wrapRef} style={{ flex: 1, overflow: "visible" }}>
                <label style={{ display: "block", fontSize: ".78rem", fontWeight: 600, marginBottom: 5 }}>
                  Select Carrier <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  ref={inputRef}
                  placeholder="Search by carrier name…"
                  value={inputText}
                  autoComplete="off"
                  onChange={e => { setInputText(e.target.value); setFixedCode(""); computePos(); setOpen(true); }}
                  onFocus={() => { computePos(); setOpen(true); }}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 7,
                    border: `1px solid ${fixedCode ? "var(--green)" : "var(--border2)"}`,
                    fontFamily: "var(--sans)", fontSize: ".8rem", outline: "none",
                    background: "var(--surface)",
                  }}
                />
                {fixedCode && (
                  <div style={{ fontSize: ".7rem", color: "var(--green)", marginTop: 3, fontFamily: "var(--mono)" }}>
                    ✓ {fixedCode}
                  </div>
                )}
                {open && filtered.length > 0 && (
                  <div style={{
                    position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
                    background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 7,
                    boxShadow: "0 8px 28px rgba(0,0,0,.13)", zIndex: 9999, maxHeight: 240, overflowY: "auto",
                  }}>
                    {filtered.map(c => (
                      <div
                        key={c.carrier_code}
                        onMouseDown={e => { e.preventDefault(); setFixedCode(c.carrier_code); setInputText(c.carrier_name); setOpen(false); }}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: ".78rem", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)", minWidth: 64 }}>{c.carrier_code}</span>
                        <span style={{ flex: 1 }}>{c.carrier_name}</span>
                        {c.transport_mode && <span style={{ fontSize: ".68rem", color: "var(--muted)", fontFamily: "var(--mono)" }}>{c.transport_mode}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !fixedCode}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Container Type Fix Modal ─────────────────────────────────────────────────

const ContainerTypeFixModal: FC<{
  record: FileRecord;
  containerTypes: ContainerTypeOption[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
}> = ({ record, containerTypes, onClose, onSaved, showToast }) => {
  const payload = record.api_payload ?? record.extracted_data ?? {} as PayloadData;
  const containers = Array.isArray(payload.container_details)
    ? (payload.container_details as ContainerDetail[])
    : [];

  const isInvalid = (code?: string) =>
    !!code && !containerTypes.some(ct => ct.alias_code === code || ct.container_code === code);

  const invalidContainers = containers
    .map((c, i) => ({ idx: i, code: c.container_type_input ?? c.container_type ?? "" }))
    .filter(x => isInvalid(x.code));

  const [fixes, setFixes] = useState<Record<number, string>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const setFix = (idx: number, code: string, display: string) => {
    setFixes(prev => ({ ...prev, [idx]: code }));
    setTexts(prev => ({ ...prev, [idx]: display }));
  };

  const save = async () => {
    const toSave = invalidContainers.filter(x => fixes[x.idx]);
    if (!toSave.length) return;
    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` };
      await Promise.all(toSave.map(x =>
        hblApi.post("/container-type-aliases/", {
          alias_code: x.code,
          container_code: fixes[x.idx],
          status: "ACTIVE",
        }, { headers })
      ));
      showToast("✅ Container type alias(es) created", "success");
      onSaved();
      onClose();
    } catch {
      showToast("❌ Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const canSave = invalidContainers.some(x => fixes[x.idx]);

  if (!invalidContainers.length) return null;

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h2>🔧 Fix Invalid Container Types</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: "auto", maxHeight: "60vh" }}>
          {invalidContainers.map(({ idx, code }) => (
            <div key={idx} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: ".68rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
                Container {idx + 1}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: "0 0 130px" }}>
                  <label style={{ fontSize: ".57rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)", display: "block", marginBottom: 3 }}>
                    Alias Code
                  </label>
                  <input
                    value={code}
                    readOnly
                    style={{
                      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 5, padding: "6px 9px", fontSize: ".8rem", color: "var(--muted)",
                      fontFamily: "var(--mono)", cursor: "not-allowed",
                    }}
                  />
                </div>
                <div style={{ flex: 1, overflow: "visible" }}>
                  <ContainerTypeSearch
                    value={fixes[idx] ?? ""}
                    containerTypes={containerTypes}
                    onChange={(ct_code) => setFix(idx, ct_code, ct_code)}
                    placeholder="Search container type…"
                  />
                  {texts[idx] && fixes[idx] && (
                    <div style={{ fontSize: ".7rem", color: "var(--green)", marginTop: 3, fontFamily: "var(--mono)" }}>
                      ✓ {fixes[idx]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !canSave}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const HBLDocumentManager: FC = () => {
  const [allFiles, setAllFiles] = useState<FileRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FileStatus | "">("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof FileRecord>("uploaded_at");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [ports, setPorts] = useState<PortOption[]>([]);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerTypeOption[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastState["type"] = "info") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const { data } = await hblApi.get<FilesResponse>("/files", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      });
      setAllFiles(data.files ?? []);
      setLoadState("ok");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!document.getElementById("hbl-doc-manager-styles")) {
      const s = document.createElement("style");
      s.id = "hbl-doc-manager-styles";
      s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const loadPorts = useCallback(() => {
    hblApi
      .get<{ ports: PortOption[] }>("/ports", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => setPorts(r.data.ports ?? []))
      .catch(() => {});
  }, []);

  const loadCarriers = useCallback(() => {
    hblApi
      .get<{ carriers: CarrierOption[] }>("/carriers", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => setCarriers(r.data.carriers ?? []))
      .catch(() => {});
  }, []);

  const loadContainerTypes = useCallback(() => {
    hblApi
      .get<{ container_codes: ContainerTypeOption[] }>("/container-codes", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      })
      .then(r => setContainerTypes(r.data.container_codes ?? []))
      .catch(() => {});
  }, []);

  const refreshAll = useCallback(() => {
    loadFiles();
    loadPorts();
    loadCarriers();
    loadContainerTypes();
  }, [loadFiles, loadPorts, loadCarriers, loadContainerTypes]);

  useEffect(() => { loadPorts(); }, [loadPorts]);
  useEffect(() => { loadCarriers(); }, [loadCarriers]);
  useEffect(() => { loadContainerTypes(); }, [loadContainerTypes]);

  const hasCodeValidationError = (f: FileRecord): boolean => {
    const payload = f.api_payload ?? f.extracted_data;
    if (!payload) return false;
    const origin = payload.origin_code as string | undefined;
    const dest = payload.destination_code as string | undefined;
    const carrier = payload.carrier_code as string | undefined;
    const invalidPort = (code?: string) => !!code && !ports.some(p => p.alias_code === code || p.port_code === code);
    const invalidCarrier = (code?: string) => !!code && !carriers.some(c => c.alias_code === code || c.carrier_code === code);
    const invalidContainerType = (code?: string) => !!code && !containerTypes.some(ct => ct.alias_code === code || ct.container_code === code);
    const containerIssue = Array.isArray(payload.container_details) &&
      (payload.container_details as ContainerDetail[]).some(c => {
        const code = c.container_type_input ?? c.container_type;
        return invalidContainerType(code);
      });
    return invalidPort(origin) || invalidPort(dest) || invalidCarrier(carrier) || containerIssue;
  };

  useEffect(() => {
    const inProgress = allFiles.some(f => f.status === "pending" || f.status === "processing");
    if (inProgress && !pollRef.current) {
      pollRef.current = setInterval(loadFiles, 4000);
    } else if (!inProgress && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [allFiles, loadFiles]);

  const getPortName = (code?: string) => {
    if (!code) return "";
    return ports.find(p => p.alias_code === code || p.port_code === code)?.port_name ?? "";
  };

  const filtered = allFiles
    .filter(f => {
      const matchStatus = !statusFilter || f.status === statusFilter;
      const q = search.toLowerCase();
      const payload = f.api_payload ?? f.extracted_data;
      const originCode = payload?.origin_code as string | undefined;
      const destCode = payload?.destination_code as string | undefined;
      const matchSearch = !q || [
        f.txn_id, f.filename, f.bl_number, f.shipper_name, f.consignee_name,
        originCode, destCode,
        getPortName(originCode), getPortName(destCode),
      ].some(v => v?.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageStart = (page - 1) * perPage;
  const pageRows = filtered.slice(pageStart, pageStart + perPage);

  const sortToggle = (key: keyof FileRecord) => {
    if (sortKey === key) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  };

  const filterSet = (s: FileStatus | "") => { setStatusFilter(s); setPage(1); setSelected(new Set()); };
  const searchSet = (v: string) => { setSearch(v); setPage(1); };
  const toggleRow = (txn: string, checked: boolean) => setSelected(prev => { const s = new Set(prev); checked ? s.add(txn) : s.delete(txn); return s; });
  const toggleAll = (checked: boolean) => setSelected(new Set(checked ? pageRows.map(f => f.txn_id) : []));
  const clearSel = () => setSelected(new Set());

  const deleteSelected = async () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} record(s)?`)) return;
    try {
      await hblApi.delete("/files/", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
        data: ids,
      });
      setSelected(new Set());
      loadFiles();
    } catch { showToast("Delete failed", "error"); }
  };

  const startJobs = async (ids: string[]) => {
    const invalid = ids.filter(id => {
      const f = allFiles.find(x => x.txn_id === id);
      return f ? hasCodeValidationError(f) : false;
    });
    if (invalid.length) {
      showToast(`❌ ${invalid.length} record(s) have invalid port/carrier/container type codes. Fix them before creating jobs.`, "error");
      return;
    }
    setJobLoading(true);
    try {
      await hblApi.post(
        "/start_creating_jobs/",
        { txn_ids: ids, transactions_id: ids },
        { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } }
      );
      showToast(`✅ Jobs started for ${ids.length} selected`, "success");
      setSelected(new Set());
      loadFiles();
    } catch {
      showToast("❌ Server unreachable", "error");
    } finally {
      setJobLoading(false);
    }
  };

  const selectedHasValidationError = Array.from(selected).some(id => {
    const f = allFiles.find(x => x.txn_id === id);
    return f ? hasCodeValidationError(f) : false;
  });

  const statuses: Array<FileStatus | ""> = ["", "pending", "processing", "done", "failed"];
  const statusLabels: Record<string, string> = { "": "All", pending: "Pending", processing: "Processing", done: "Done", failed: "Failed" };
  const sortCols: Array<[keyof FileRecord, string]> = [
    ["txn_id", "TXN ID"], ["filename", "Filename"],
    ["bl_number", "BL Number"],
    ["status", "Status"],
    ["created_by", "Created By"],
  ];

  const doneCount = allFiles.filter(f => f.status === "done").length;
  const failedCount = allFiles.filter(f => f.status === "failed").length;

  return (
    <div className="hbl-app">
      <div className="topbar">
        <div className="top-brand">
          <div className="top-brand-icon">🧾</div>
          <div>
            <div className="top-brand-text">Import Job</div>
            <div className="top-brand-sub">HBL · MBL · Upload · Review</div>
          </div>
        </div>
        <div className="top-divider" />
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search TXN ID, filename, BL number…" value={search} onChange={e => searchSet(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: ".68rem", color: "var(--muted)", display: "flex", gap: 12 }}>
            <span>Total <strong style={{ color: "var(--text)" }}>{allFiles.length}</strong></span>
            <span>Done <strong style={{ color: "var(--green)" }}>{doneCount}</strong></span>
            <span>Failed <strong style={{ color: "var(--red)" }}>{failedCount}</strong></span>
          </div>
          <button className="btn btn-ghost" onClick={loadFiles} title="Refresh">↻</button>
          {selected.size > 0 && (
            <button
              className="btn btn-green"
              onClick={() => startJobs(Array.from(selected))}
              disabled={jobLoading || selectedHasValidationError}
              title={selectedHasValidationError ? "Fix invalid port/carrier/container type codes before creating jobs" : undefined}
              style={selectedHasValidationError ? { opacity: .5, cursor: "not-allowed" } : undefined}
            >
              {jobLoading && (
                <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "hbl-spin .7s linear infinite", display: "inline-block" }} />
              )}
              {jobLoading ? "Starting…" : `▶ Start Jobs (${selected.size})`}
              {selectedHasValidationError && <span style={{ fontSize: ".65rem", marginLeft: 4 }}>⚠</span>}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setModal({ type: "upload" })}>＋ Upload</button>
        </div>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Filter:</span>
        {statuses.map(s => (
          <button key={s} className={`chip ${statusFilter === s ? "active" : ""}`} onClick={() => filterSet(s)}>
            {statusLabels[s]}
          </button>
        ))}
        <div className="filter-sep" />
        <select className="per-page" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <span className="records-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox"
                  checked={pageRows.length > 0 && pageRows.every(f => selected.has(f.txn_id))}
                  onChange={e => toggleAll(e.target.checked)}
                />
              </th>
              {sortCols.map(([k, l]) => (
                <th key={k} onClick={() => sortToggle(k)}>
                  {l} {sortKey === k ? (sortDir === 1 ? "↑" : "↓") : "↕"}
                </th>
              ))}
              <th>PDF Type</th>
              <th onClick={() => sortToggle("uploaded_at")}>Uploaded {sortKey === "uploaded_at" ? (sortDir === 1 ? "↑" : "↓") : "↓"}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadState !== "loading" && pageRows.map(f => (
              <tr key={f.txn_id} className={selected.has(f.txn_id) ? "selected" : ""} onClick={() => setModal({ type: "detail", record: f })}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(f.txn_id)} onChange={e => toggleRow(f.txn_id, e.target.checked)} />
                </td>
                <td className="td-txn">{f.txn_id}</td>
                <td>
                  <div className="td-filename" title={f.filename}>
                    {/\.(jpg|jpeg|png|gif|webp|bmp|tiff?|svg)$/i.test(f.filename) ? "🖼️" : "📄"} {f.filename}
                  </div>
                  <div style={{ fontSize: ".65rem", color: "var(--muted)", marginTop: 2, fontFamily: "var(--mono)" }}>{f.size_kb} KB</div>
                </td>
                <td className="td-bl">{f.bl_number ?? "—"}</td>
                <td><Badge status={f.status} /></td>
                <td>{f.created_by ?? "—"}</td>
                <td><span className="pdf-tag">{f.pdf_type ?? "—"}</span></td>
                <td className="td-date">{f.uploaded_at ? f.uploaded_at.slice(0, 16) : "—"}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="action-row">
                    {/* <button className="act-btn view" onClick={() => setModal({ type: "detail", record: f })}>View</button> */}
                    {/* {f.status === "done" && (
                      <button className="act-btn dl" onClick={() => window.open(`/files/${f.txn_id}/download`, "_blank")}>↓ JSON</button>
                    )} */}
                    <button
                      className="act-btn payload"
                      onClick={() => setModal({ type: "payload", txn_id: f.txn_id, record: f })}
                      style={hasCodeValidationError(f) ? { color: "var(--red)", borderColor: "var(--red)", background: "rgba(220,38,38,.06)" } : undefined}
                    >⊞ View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loadState === "loading" && <div className="state-box"><div className="spinner" /></div>}
        {loadState === "ok" && filtered.length === 0 && (
          <div className="state-box">
            <div className="state-icon">📭</div>
            <div className="state-text">No documents found</div>
            <div className="state-sub">Upload a file to get started</div>
          </div>
        )}
        {loadState === "error" && (
          <div className="state-box">
            <div className="state-icon">⚠️</div>
            <div className="state-text">Could not load documents</div>
            <div className="state-sub">Check server connection</div>
          </div>
        )}
      </div>

      <div className="pagination">
        <div className="pag-info">
          Showing <strong>{filtered.length ? pageStart + 1 : 0}</strong>–<strong>{Math.min(page * perPage, filtered.length)}</strong> of <strong>{filtered.length}</strong>
        </div>
        <div className="pag-controls">
          {totalPages > 1 && (
            <>
              <button className="pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {buildPageRange(page, totalPages).map((p_, i) =>
                p_ === "..."
                  ? <span key={i} style={{ color: "var(--muted)", padding: "0 4px", fontSize: ".75rem" }}>…</span>
                  : <button key={i} className={`pag-btn ${page === p_ ? "active" : ""}`} onClick={() => setPage(p_ as number)}>{p_}</button>
              )}
              <button className="pag-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </>
          )}
        </div>
      </div>

      <div className={`action-bar ${selected.size > 0 ? "visible" : ""}`}>
        <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>
          <strong style={{ color: "var(--text)" }}>{selected.size}</strong> selected
        </span>
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
        <button
          className="bar-btn green"
          onClick={() => startJobs(Array.from(selected))}
          disabled={jobLoading || selectedHasValidationError}
          title={selectedHasValidationError ? "Fix invalid port/carrier/container type codes before creating jobs" : undefined}
          style={selectedHasValidationError ? { opacity: .5, cursor: "not-allowed" } : undefined}
        >
          {jobLoading ? "Starting…" : "▶ Start Jobs"}
          {selectedHasValidationError && <span style={{ fontSize: ".65rem", marginLeft: 4 }}>⚠</span>}
        </button>
        <button className="bar-btn danger" onClick={deleteSelected}>🗑 Delete</button>
        <button className="bar-btn outline" onClick={clearSel}>✕ Clear</button>
      </div>

      {toast && <Toast toast={toast} />}

      {modal?.type === "upload" && <UploadModal onClose={() => setModal(null)} onUploaded={loadFiles} showToast={showToast} />}
      {modal?.type === "detail" && <DetailModal record={modal.record} ports={ports} carriers={carriers} containerTypes={containerTypes} onClose={() => setModal(null)} />}
      {modal?.type === "payload" && (
        <PayloadModal
          txn_id={modal.txn_id}
          record={modal.record}
          onClose={() => setModal(null)}
          showToast={showToast}
          onRefreshList={refreshAll}
        />
      )}
      {modal?.type === "fix_port" && (
        <PortFixModal
          record={modal.record}
          ports={ports}
          onClose={() => setModal(null)}
          onSaved={loadFiles}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default HBLDocumentManager;