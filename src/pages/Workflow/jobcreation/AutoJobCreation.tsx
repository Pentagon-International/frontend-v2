import { useState, useEffect, useRef, useCallback, FC, ReactNode } from "react";
import axios from "axios";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";

const hblApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}workflow`,
});

// hblApi.interceptors.request.use((config) => {
//   Object.assign(config.headers, API_HEADER.headers);
//   return config;
// });

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
  container_type_input?: string;
  actual_seal_no?: string;
  container_type?: string;
  seal_no?: string;
  no_of_packages?: number;
  package_type?: string;
  gross_weight?: string;
  gross_weight_kgs?: number;
  volume?: string;
  volume_cbm?: number;
  tare_weight_kgs?: number;
  chargeable_weight?: string;
  haz?: boolean;
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

type ModalState =
  | { type: "upload" }
  | { type: "detail"; record: FileRecord }
  | { type: "payload"; txn_id: string; record?: FileRecord }
  | null;

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;500;600;700;800&display=swap');
  .hbl-app {
    --bg: #f0f1f5; --surface: #ffffff; --surface2: #f4f5f8;
    --border: #e3e6ed; --border2: #c8cdd9; --text: #111827; --muted: #6b7280;
    --accent: #2563eb; --accent2: #1d4ed8; --green: #059669; --yellow: #d97706;
    --red: #dc2626; --cyan: #0891b2; --hbl: #7c3aed; --mbl: #0891b2;
    --mono: 'JetBrains Mono', monospace; --sans: 'Syne', sans-serif;
  }
  @keyframes hbl-spin { to { transform: rotate(360deg); } }
  @keyframes hbl-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes hbl-modal-in { from { opacity:0; transform:scale(.96) translateY(8px) } }
  @keyframes hbl-bar-up { from { transform:translateX(-50%) translateY(80px) } to { transform:translateX(-50%) translateY(0) } }
  @keyframes hbl-toast-in { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
  .hbl-app { width: 100%; display: flex; flex-direction: column; font-family: var(--sans); background: var(--bg); color: var(--text); }
  .hbl-app *, .hbl-app *::before, .hbl-app *::after { box-sizing: border-box; }
  .hbl-app .topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 20px; display: flex; align-items: center; gap: 14px; min-height: 54px; flex-wrap: wrap; border-radius: 8px 8px 0 0; }
  .hbl-app .logo-mark { font-family: var(--mono); font-size: .6rem; color: var(--accent); letter-spacing: .2em; text-transform: uppercase; }
  .hbl-app .logo-name { font-size: 1.05rem; font-weight: 800; letter-spacing: -.03em; color: var(--text); }
  .hbl-app .logo-sep { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }
  .hbl-app .search-wrap { position: relative; flex: 1; max-width: 380px; }
  .hbl-app .search-wrap input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px 8px 34px; font-size: .8rem; font-family: var(--sans); color: var(--text); outline: none; transition: border-color .15s; }
  .hbl-app .search-wrap input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,.1); background: var(--surface); }
  .hbl-app .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .75rem; pointer-events: none; }
  .hbl-app .btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 7px; font-size: .8rem; font-weight: 600; font-family: var(--sans); cursor: pointer; transition: all .15s; border: none; white-space: nowrap; padding: 8px 14px; }
  .hbl-app .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(37,99,235,.3); }
  .hbl-app .btn-primary:hover { background: var(--accent2); }
  .hbl-app .btn-green { background: var(--green); color: #fff; box-shadow: 0 1px 3px rgba(5,150,105,.3); }
  .hbl-app .btn-green:hover:not(:disabled) { background: #047857; }
  .hbl-app .btn-green:disabled { opacity: .5; cursor: not-allowed; }
  .hbl-app .btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--muted); }
  .hbl-app .btn-ghost:hover { color: var(--text); border-color: var(--border2); background: var(--surface2); }
  .hbl-app .filter-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 8px 28px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .hbl-app .filter-label { font-size: .72rem; color: var(--muted); font-weight: 600; }
  .hbl-app .chip { padding: 4px 12px; border-radius: 99px; border: 1px solid var(--border); background: transparent; color: var(--muted); font-size: .72rem; font-family: var(--sans); cursor: pointer; transition: all .15s; }
  .hbl-app .chip:hover { border-color: var(--border2); color: var(--text); background: var(--surface2); }
  .hbl-app .chip.active { background: var(--accent); border-color: var(--accent); color: white; }
  .hbl-app .filter-sep { width: 1px; height: 16px; background: var(--border); margin: 0 4px; }
  .hbl-app .per-page { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; color: var(--muted); padding: 4px 8px; font-size: .72rem; font-family: var(--sans); cursor: pointer; outline: none; }
  .hbl-app .records-count { font-family: var(--mono); font-size: .68rem; color: var(--muted); margin-left: auto; }
  .hbl-app .table-wrap { background: var(--bg); }
  .hbl-app table { width: 100%; border-collapse: collapse; background: var(--surface); }
  .hbl-app thead tr { background: var(--surface2); position: sticky; top: 0; z-index: 5; }
  .hbl-app th { text-align: left; padding: 10px 14px; font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; cursor: pointer; user-select: none; }
  .hbl-app th:first-child { padding-left: 24px; width: 36px; }
  .hbl-app th:last-child { padding-right: 24px; }
  .hbl-app th:hover { color: var(--text); }
  .hbl-app tbody tr { border-bottom: 1px solid var(--border); transition: background .1s; cursor: pointer; }
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
  .hbl-app .pagination { display: flex; align-items: center; justify-content: space-between; padding: 12px 28px; border-top: 1px solid var(--border); background: var(--surface); }
  .hbl-app .pag-info { font-family: var(--mono); font-size: .68rem; color: var(--muted); }
  .hbl-app .pag-controls { display: flex; align-items: center; gap: 4px; }
  .hbl-app .pag-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 5px; color: var(--muted); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: .75rem; cursor: pointer; transition: all .15s; font-family: var(--sans); }
  .hbl-app .pag-btn:hover:not(:disabled) { color: var(--text); border-color: var(--border2); background: var(--surface2); }
  .hbl-app .pag-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
  .hbl-app .pag-btn:disabled { opacity: .3; cursor: not-allowed; }
  .hbl-app .state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; }
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

const UploadModal: FC<UploadModalProps> = ({ onClose, onUploaded }) => {
  const [hblFiles, setHbl] = useState<File[]>([]);
  const [mblFiles, setMbl] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState<"hbl" | "mbl" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult | null>(null);

  const addFiles = (type: "hbl" | "mbl", files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".pdf"));
    const setter = type === "hbl" ? setHbl : setMbl;
    setter(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...pdfs.filter(f => !names.has(f.name))];
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
      const { data} = await    hblApi.post<UploadResult>("/upload/", fd, {
        headers: { "Content-Type": "multipart/form-data" ,
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`
        },
      });
   
      
      
    
      setProgress(100);
      setResults(data);
      setHbl([]); setMbl([]);
      onUploaded();
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
          <small>{type === "hbl" ? "House Bill of Lading PDFs" : "Master Bill of Lading PDFs"}</small>
        </div>
        <input type="file" id={`fi-${type}`} accept=".pdf" multiple onChange={e => addFiles(type, e.target.files)} style={{ display: "none" }} />
        {files.length
          ? files.map((f, i) => (
            <div className="zone-file-row" key={i}>
              <div>
                <div className="zfname" title={f.name}>📄 {f.name}</div>
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

type DetailTab = "payload" | "raw";

const DetailModal: FC<{ record: FileRecord; onClose: () => void }> = ({ record, onClose }) => {
  const [tab, setTab] = useState<DetailTab>("payload");
  const p = record.api_payload ?? record.extracted_data ?? {} as PayloadData;

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: "payload", label: "Payload Form" },
    { key: "raw", label: "Raw JSON" },
  ];

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
        <div className="tab-body">
          {tab === "payload" && <PayloadFormBody p={p} />}
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

// ─── Payload Form Body ────────────────────────────────────────────────────────

const PayloadFormBody: FC<{ p: PayloadData }> = ({ p }) => {
  if (!p || !Object.keys(p).length)
    return <div className="state-box"><div className="state-icon">📭</div><div className="state-text">No payload data</div></div>;

  const housing = Array.isArray(p.housing_details) ? p.housing_details : [];

  return (
    <div className="form-body">

      <Sec icon="📄" title="Document Header">
        <div className="fgrid c4">
          <FF label="MBL Number" val={p.mbl_number ?? p.bl_number} cls="mono" />
          <FF label="Document Type" val={p.document_type} span={2} />
          <FF label="Carrier Code" val={p.carrier_code} cls="mono" />
          <FF label="Service" val={p.service} />
          <FF label="Service Type" val={p.service_type} />
          <FF label="Freight Terms" val={p.freight_terms} />
          <FF label="No. of Original Waybills" val={p.number_of_original_waybills} />
          <FF label="Signed By" val={(p as any).signed_by} span={4} />
          <FF label="Carrier Full Name" val={p.carrier_full_name} span={3} />
          <FF label="Head Office" val={p.carrier_head_office} span={4} />
        </div>
      </Sec>

      <Sec icon="🗺️" title="Routing & Ports">
        <div className="fgrid c4">
          <FF label="Port of Loading" val={p.port_of_loading} />
          <FF label="Port of Discharge" val={p.port_of_discharge} />
          <FF label="Place of Receipt" val={p.place_of_receipt} />
          <FF label="Place of Delivery" val={p.place_of_delivery} />
          <FF label="Origin Code" val={p.origin_code} cls="mono" />
          <FF label="Destination Code" val={p.destination_code} cls="mono" />
          <FF label="Freight Payable At" val={p.freight_payable_at} />
          <FF label="Export Reference" val={p.export_reference} cls="mono" />
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
          <FF label="Vessel Name" val={p.vessel_name} />
          <FF label="Voyage Number" val={p.voyage_number} cls="mono" />
          <FF label="Date of Issue" val={p.date_of_issue} />
          <FF label="On Board Date" val={p.on_board_date ?? p.shipped_on_board_date} />
          <FF label="Place of Issue" val={p.place_of_issue} />
          <FF label="Agent" val={p.agent} />
        </div>
      </Sec>

      {Array.isArray(p.container_details) && p.container_details.length > 0 && (
        <Sec icon="📦" title={`Container Details (${p.container_details.length})`}>
          <table className="ctable">
            <thead>
              <tr>
                <th>Container No.</th><th>Type</th><th>Seal No.</th><th>Pkgs</th>
                <th>Pkg Type</th><th>Gross Wt (KG)</th><th>Tare Wt (KG)</th><th>Volume (CBM)</th>
              </tr>
            </thead>
            <tbody>
              {p.container_details.map((c, i) => (
                <tr key={i}>
                  <td>{c.container_no ?? "—"}</td>
                  <td>{c.container_type_input ?? c.container_type ?? "—"}</td>
                  <td>{c.actual_seal_no ?? c.seal_no ?? "—"}</td>
                  <td>{c.no_of_packages ?? "—"}</td>
                  <td>{c.package_type ?? "—"}</td>
                  <td>{c.gross_weight_kgs ?? c.gross_weight ?? "—"}</td>
                  <td>{c.tare_weight_kgs ?? "—"}</td>
                  <td>{c.volume_cbm ?? c.volume ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>
      )}

      {fv(p.special_clauses) && (
        <Sec icon="📋" title="Special Clauses">
          <div className="fgrid c2"><FF label="Clause" val={p.special_clauses} span={2} /></div>
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
                <FF label="HBL Number" val={hd.hbl_number} cls="mono" />
                <FF label="Trade" val={hd.trade} />
                <FF label="Routed" val={hd.routed} />
                <FF label="Freight Terms" val={hd.freight_terms} />
                <FF label="HS Code" val={hd.hs_code} cls="mono" />
                <FF label="Marks No" val={hd.marks_no} />
                <FF label="Origin Code" val={hd.origin_code} cls="mono" />
                <FF label="Destination Code" val={hd.destination_code} cls="mono" />
                <FF label="Invoice No" val={hd.invoice_no} cls="mono" />
                <FF label="Invoice Date" val={hd.invoice_date} />
                <FF label="PO No" val={hd.po_no} cls="mono" />
                <FF label="PI No" val={hd.pi_no} cls="mono" />
                <FF label="LC Number" val={hd.lc_number} cls="mono" />
                <FF label="LC Date" val={hd.lc_date} />
                <FF label="Date of Issue" val={hd.date_of_issue} />
                <FF label="On Board Date" val={hd.on_board_date ?? hd.shipped_on_board_date} />
                <FF label="No. of Originals" val={hd.no_of_originals ?? hd.number_of_originals} />
                <FF label="Place of Issue" val={hd.place_of_issue} />
                <FF label="Place of Acceptance" val={hd.place_of_acceptance} />
                <FF label="Place of Delivery" val={hd.place_of_delivery} />
                <FF label="Shipment Terms" val={hd.shipment_terms_code} />
                <FF label="Shipment Ref No" val={hd.shipment_reference_no} cls="mono" />
                <FF label="Free Time at Dest." val={hd.free_time_at_destination} />
                <FF label="Package Type" val={hd.package_type} />
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
                  <FF label="Name" val={hd.shipper_name} span={3} />
                  <FF label="Email" val={hd.shipper_email} />
                  <FF label="Address" val={hd.shipper_address} span={4} />
                  <FF label="Tel" val={hd.shipper_tel} cls="mono" />
                  <FF label="Fax" val={hd.shipper_fax} cls="mono" />
                  <FF label="Phone" val={hd.shipper_phone} cls="mono" />
                </div>
              </SubSec>

              <SubSec icon="📦" title="Consignee">
                <div className="fgrid c4">
                  <FF label="Name" val={hd.consignee_name} span={4} />
                  <FF label="Address" val={hd.consignee_address} span={4} />
                  <FF label="GST" val={hd.consignee_gst ?? hd.gst_no_consignee} cls="mono" />
                  <FF label="IEC" val={hd.consignee_iec ?? hd.iec_no} cls="mono" />
                  <FF label="PAN" val={hd.consignee_pan ?? hd.pan_no} cls="mono" />
                  <FF label="Email" val={hd.consignee_email} />
                </div>
              </SubSec>

              <SubSec icon="🔔" title="Notify Party 1">
                <div className="fgrid c4">
                  <FF label="Name" val={hd.notify1_customer_name} span={4} />
                  <FF label="Address" val={hd.notify1_customer_address} span={4} />
                  <FF label="Email" val={hd.notify1_customer_email} />
                  <FF label="Phone" val={hd.notify1_customer_phone} cls="mono" />
                </div>
              </SubSec>

              {(hd.notify2_customer_name || hd.notify2_customer_address) && (
                <SubSec icon="🔔" title="Notify Party 2">
                  <div className="fgrid c4">
                    <FF label="Name" val={hd.notify2_customer_name} span={4} />
                    <FF label="Address" val={hd.notify2_customer_address} span={4} />
                    <FF label="Email" val={hd.notify2_customer_email} />
                  </div>
                </SubSec>
              )}

              <SubSec icon="🏢" title="Agent">
                <div className="fgrid c4">
                  <FF label="Name" val={hd.agent_name} span={2} />
                  <FF label="GST No" val={hd.agent_gst_no} cls="mono" />
                  <FF label="PAN No" val={hd.agent_pan_no} cls="mono" />
                  <FF label="Address" val={hd.agent_address} span={4} />
                  <FF label="Phone" val={fv(hd.agent_phone)} cls="mono" />
                  <FF label="Mobile" val={hd.agent_mobile} cls="mono" />
                  <FF label="Email" val={hd.agent_email} />
                </div>
              </SubSec>

              {(hd.issuing_agent || hd.issuing_agent_address) && (
                <SubSec icon="🏢" title="Issuing Agent">
                  <div className="fgrid c4">
                    <FF label="Name" val={hd.issuing_agent} span={2} />
                    <FF label="Email" val={fv(hd.issuing_agent_email)} span={2} />
                    <FF label="Address" val={hd.issuing_agent_address} span={4} />
                  </div>
                </SubSec>
              )}

              {fv(hd.commodity_description) && (
                <SubSec icon="📋" title="Commodity">
                  <div className="fgrid c2">
                    <FF label="Description" val={hd.commodity_description} span={2} />
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
                          <td>{c.container_no ?? "—"}</td>
                          <td>{c.no_of_packages ?? "—"}</td>
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
}

const PayloadModal: FC<PayloadModalProps> = ({ txn_id, record: inlineRecord, onClose, showToast }) => {
  const [rec, setRec] = useState<FileRecord | null>(inlineRecord ?? null);
  const [loading, setLoading] = useState(!inlineRecord);
  const [ptab, setPtab] = useState<"form" | "raw">("form");

  useEffect(() => {
    if (inlineRecord) return;
    hblApi.get<FileRecord>(`/files/${txn_id}`, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } })
      .then(r => { setRec(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [txn_id, inlineRecord]);

  const p: PayloadData = rec?.api_payload ?? rec?.extracted_data ?? {};

  const copy = () =>
    navigator.clipboard
      .writeText(JSON.stringify(p, null, 2))
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
              {p.document_type && <span className="pdf-tag">{p.document_type}</span>}
            </div>
            <div style={{ fontSize: ".95rem", fontWeight: 700 }}>{rec?.filename ?? txn_id}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: ".65rem", color: "var(--muted)", marginTop: 2 }}>
              {txn_id} · MBL: {p.mbl_number ?? p.bl_number ?? "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="act-btn dl" style={{ padding: "5px 12px", fontSize: ".72rem" }} onClick={copy}>⎘ Copy JSON</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="tabs" style={{ padding: "8px 24px 0" }}>
          {(["form", "raw"] as const).map(t => (
            <button key={t} className={`tab-btn ${ptab === t ? "active" : ""}`} onClick={() => setPtab(t)}>
              {t === "form" ? "Form View" : "Raw JSON"}
            </button>
          ))}
        </div>
        {loading
          ? <div className="state-box"><div className="spinner" /></div>
          : ptab === "form"
            ? <PayloadFormBody p={p} />
            : <div style={{ padding: 16, overflow: "auto" }}><pre style={{ maxHeight: "calc(92vh - 180px)" }}>{JSON.stringify(p, null, 2)}</pre></div>
        }
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastState["type"] = "info") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const { data } = await hblApi.get<FilesResponse>("/files", { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
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

  const filtered = allFiles
    .filter(f => {
      const matchStatus = !statusFilter || f.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || [f.txn_id, f.filename, f.bl_number, f.shipper_name, f.consignee_name].some(v => v?.toLowerCase().includes(q));
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
  headers: {
    Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
  },
  data: ids,
});

setSelected(new Set());
loadFiles();
    } catch { showToast("Delete failed", "error"); }
  };

  const startJobs = async () => {
    setJobLoading(true);
    try {
      await hblApi.post("/start_creating_jobs/", {}, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
      showToast("✅ Jobs started", "success");
      loadFiles();
    } catch { showToast("❌ Server unreachable", "error"); }
    finally { setJobLoading(false); }
  };

  const statuses: Array<FileStatus | ""> = ["", "pending", "processing", "done", "failed"];
  const statusLabels: Record<string, string> = { "": "All", pending: "Pending", processing: "Processing", done: "Done", failed: "Failed" };
  const sortCols: Array<[keyof FileRecord, string]> = [
    ["txn_id", "TXN ID"], ["filename", "Filename"], ["bl_number", "BL Number"],
    ["shipper_name", "Shipper"], ["port_of_loading", "Route"], ["status", "Status"], ["file_type", "File Type"],
  ];

  const doneCount = allFiles.filter(f => f.status === "done").length;
  const failedCount = allFiles.filter(f => f.status === "failed").length;

  return (
    <div className="hbl-app">
      <div className="topbar">
        <div className="logo-sep" />
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
          <button className="btn btn-green" onClick={startJobs} disabled={jobLoading}>
            {jobLoading && (
              <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "hbl-spin .7s linear infinite", display: "inline-block" }} />
            )}
            {jobLoading ? "Starting…" : "▶ Start Jobs"}
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ type: "upload" })}>＋ Upload PDFs</button>
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
              <th onClick={() => sortToggle("cost_usd")}>Cost {sortKey === "cost_usd" ? (sortDir === 1 ? "↑" : "↓") : "↕"}</th>
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
                  <div className="td-filename" title={f.filename}>📄 {f.filename}</div>
                  <div style={{ fontSize: ".65rem", color: "var(--muted)", marginTop: 2, fontFamily: "var(--mono)" }}>{f.size_kb} KB</div>
                </td>
                <td className="td-bl">{f.bl_number ?? "—"}</td>
                <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.shipper_name ?? ""}>
                  {f.shipper_name ?? "—"}
                </td>
                <td style={{ fontSize: ".75rem", whiteSpace: "nowrap" }}>
                  {f.port_of_loading
                    ? <>{f.port_of_loading}<span style={{ color: "var(--muted)", margin: "0 4px" }}>→</span>{f.port_of_discharge ?? "—"}</>
                    : "—"}
                </td>
                <td><Badge status={f.status} /></td>
                <td><FtTag type={f.file_type ?? ""} /></td>
                <td><span className="pdf-tag">{f.pdf_type ?? "—"}</span></td>
                <td className="cost-val">{f.cost_usd ? `$${f.cost_usd}` : "—"}</td>
                <td className="td-date">{f.uploaded_at ? f.uploaded_at.slice(0, 16) : "—"}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="action-row">
                    <button className="act-btn view" onClick={() => setModal({ type: "detail", record: f })}>View</button>
                    {f.status === "done" && (
                      <button className="act-btn dl" onClick={() => window.open(`/files/${f.txn_id}/download`, "_blank")}>↓ JSON</button>
                    )}
                    {f.file_type === "mbl" && (f.status === "done" || f.status === "job_created") && (
                      <button className="act-btn payload" onClick={() => setModal({ type: "payload", txn_id: f.txn_id, record: f })}>⊞ Payload</button>
                    )}
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
            <div className="state-sub">Upload a PDF to get started</div>
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
        <button className="bar-btn danger" onClick={deleteSelected}>🗑 Delete</button>
        <button className="bar-btn outline" onClick={clearSel}>✕ Clear</button>
      </div>

      {toast && <Toast toast={toast} />}

      {modal?.type === "upload" && <UploadModal onClose={() => setModal(null)} onUploaded={loadFiles} showToast={showToast} />}
      {modal?.type === "detail" && <DetailModal record={modal.record} onClose={() => setModal(null)} />}
      {modal?.type === "payload" && <PayloadModal txn_id={modal.txn_id} record={modal.record} onClose={() => setModal(null)} showToast={showToast} />}
    </div>
  );
};

export default HBLDocumentManager;