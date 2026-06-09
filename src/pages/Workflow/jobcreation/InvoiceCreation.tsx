import { useState, useEffect, useRef, useCallback, FC, useMemo } from "react";
import axios from "axios";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import { FilePreviewFrame } from "./automationFilePreview";

const invoiceApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}ai-workflow`,
});

// ─── URLs ─────────────────────────────────────────────────────────────────────

const ALL_URL = {
  pending: "/document-upload-list/resource?status=pending",
  processing: "/document-upload-list/resource?status=processing",
  done: "/document-upload-list/resource?status=completed",
  failed: "/document-upload-list/resource?status=failed",
  job_created: "/document-upload-list/resource?status=INVOICE_CREATED",
  delete: "/document-upload-list/resource/",
  list: "/document-upload-list/resource",
  upload: "/upload-invoice/",
  start_job: "/start-creation-invoice/",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "processing" | "done" | "failed" | "job_created" | string;

interface ChargeRow {
  account_code?: string;
  hsn_sac_code?: string;
  subledger_code?: string;
  CRN?: string;
  narration?: string;
  shipment_no?: string;
  roe?: string;
  amount?: string;
  amount_in_local?: string;
  tax_code?: string;
  Dr_Cr?: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cgst_rate?: number;
  sgst_rate?: number;
  igst_rate?: number;
}

interface InvoicePayload {
  date?: string;
  prq_reference_no?: string;
  agent_name?: string;
  Inv_Crn_no?: string;
  customer_gst_no?: string;
  location_gst_no?: string;
  taxable_amount?: string;
  non_taxable_amount?: string;
  cgst_amount?: string;
  sgst_amount?: string;
  igst_amount?: string;
  Inv_crn_amount?: string;
  approved_amount?: string;
  difference_amount?: string;
  due_date?: string;
  status?: string;
  Dr_Cr?: string;
  charges_data?: ChargeRow[];
}

interface InvoiceRecord {
  id: number;
  file_name?: string;
  file_url?: string;
  status?: FileStatus;
  created_at?: string;
  updated_at?: string;
  failer_message?: string;
  extracted_data?: InvoicePayload;
}

interface FilesResponse {
  files: InvoiceRecord[];
}

interface UploadResult {
  uploaded: Array<{ filename: string; size_kb: number; id?: number }>;
  errors?: Array<{ filename: string; error: string }>;
  error?: boolean;
}

interface ToastState {
  msg: string;
  type: "success" | "error" | "info";
}

type ModalState =
  | { type: "upload" }
  | { type: "payload"; record: InvoiceRecord }
  | null;

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap');

  .inv-app {
    --bg: #ffffff;
    --surface: #ffffff;
    --surface2: #f0f9ff;
    --surface3: #e0f2fe;
    --border: #bae6fd;
    --border2: #7dd3fc;
    --text: #1a1916;
    --muted: #7a7570;
    --accent: #0ea5e9;
    --accent2: #0284c7;
    --accent-bg: rgba(14,165,233,0.08);
    --green: #2d7a4f;
    --green-bg: rgba(45,122,79,0.08);
    --yellow: #a07820;
    --yellow-bg: rgba(160,120,32,0.08);
    --red: #b83232;
    --red-bg: rgba(184,50,50,0.08);
    --blue: #2b5ea7;
    --blue-bg: rgba(43,94,167,0.08);
    --mono: 'IBM Plex Mono', monospace;
    --sans: 'Outfit', sans-serif;
    --radius: 6px;
    --radius-lg: 10px;
  }

  @keyframes inv-spin { to { transform: rotate(360deg); } }
  @keyframes inv-pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes inv-modal-in { from { opacity:0; transform:translateY(16px) scale(.98) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes inv-toast-in { from { opacity:0; transform:translateX(16px) } to { opacity:1; transform:translateX(0) } }
  @keyframes inv-bar-in { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
  @keyframes inv-fade { from{opacity:0} to{opacity:1} }

  .inv-app { width:100%; display:flex; flex-direction:column; font-family:var(--sans); background:var(--bg); color:var(--text); min-height:300px; margin:1rem 0; border-radius:1rem; box-shadow:0 4px 12px rgba(0,0,0,.05); max-height:calc(100vh - 88px); }
  .inv-app *, .inv-app *::before, .inv-app *::after { box-sizing:border-box; }

  /* Topbar */
  .inv-app .topbar { background:var(--surface); border-bottom:1px solid var(--border); padding:0 24px; display:flex; align-items:center; gap:12px; min-height:56px; flex-wrap:wrap; border-radius:1rem;}
  .inv-app .top-brand { display:flex; align-items:center; gap:10px; }
  .inv-app .top-brand-icon { width:32px; height:32px; background:var(--accent); border-radius:var(--radius); display:flex; align-items:center; justify-content:center; color:#fff; font-size:1rem; flex-shrink:0; }
  .inv-app .top-brand-text { font-size:.95rem; font-weight:700; letter-spacing:-.02em; color:var(--text); }
  .inv-app .top-brand-sub { font-size:.65rem; color:var(--muted); font-family:var(--mono); }
  .inv-app .top-divider { width:1px; height:24px; background:var(--border); }
  .inv-app .search-wrap { position:relative; flex:1; max-width:340px; }
  .inv-app .search-wrap input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:7px 12px 7px 32px; font-size:.8rem; font-family:var(--sans); color:var(--text); outline:none; transition:all .15s; }
  .inv-app .search-wrap input:focus { border-color:var(--accent); background:var(--surface); box-shadow:0 0 0 3px rgba(196,98,45,.1); }
  .inv-app .search-wrap input::placeholder { color:var(--muted); opacity:.6; }
  .inv-app .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:.75rem; pointer-events:none; }
  .inv-app .top-stats { display:flex; gap:16px; font-size:.72rem; font-family:var(--mono); color:var(--muted); }
  .inv-app .top-stats span strong { font-weight:600; }
  .inv-app .top-stats .s-total strong { color:var(--text); }
  .inv-app .top-stats .s-done strong { color:var(--green); }
  .inv-app .top-stats .s-failed strong { color:var(--red); }

  /* Buttons */
  .inv-app .btn { display:inline-flex; align-items:center; gap:6px; border-radius:var(--radius); font-size:.78rem; font-weight:600; font-family:var(--sans); cursor:pointer; transition:all .15s; border:none; white-space:nowrap; padding:7px 14px; }
  .inv-app .btn-primary { background:var(--accent); color:#fff; }
  .inv-app .btn-primary:hover { background:var(--accent2); }
  .inv-app .btn-ghost { background:var(--surface); border:1px solid var(--border); color:var(--muted); }
  .inv-app .btn-ghost:hover { color:var(--text); border-color:var(--border2); background:var(--surface2); }
  .inv-app .btn-outline { background:transparent; border:1px solid var(--border2); color:var(--text); }
  .inv-app .btn-outline:hover { background:var(--surface2); }
  .inv-app .btn:disabled { opacity:.45; cursor:not-allowed; }

  /* Filter bar */
  .inv-app .filter-bar { background:var(--surface); border-bottom:1px solid var(--border); padding:8px 24px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .inv-app .filter-label { font-size:.68rem; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.08em; }
  .inv-app .chip { padding:4px 12px; border-radius:99px; border:1px solid var(--border); background:transparent; color:var(--muted); font-size:.7rem; font-family:var(--sans); cursor:pointer; transition:all .15s; font-weight:500; }
  .inv-app .chip:hover { border-color:var(--border2); color:var(--text); }
  .inv-app .chip.active { background:var(--accent); border-color:var(--accent); color:#fff; }
  .inv-app .filter-sep { width:1px; height:16px; background:var(--border); margin:0 4px; }
  .inv-app .per-page { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); color:var(--muted); padding:4px 8px; font-size:.7rem; font-family:var(--sans); cursor:pointer; outline:none; transition:border-color .15s; }
  .inv-app .per-page:focus { border-color:var(--accent); }
  .inv-app .records-count { font-family:var(--mono); font-size:.65rem; color:var(--muted); margin-left:auto; }

  /* Table */
  .inv-app .table-wrap { background:var(--bg); overflow-x:auto; }
  .inv-app table { width:100%; border-collapse:collapse; background:var(--surface); }
  .inv-app thead tr { background:var(--surface2); position:sticky; top:0; z-index:5; }
  .inv-app th { text-align:left; padding:9px 14px; font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); border-bottom:1px solid var(--border); white-space:nowrap; cursor:pointer; user-select:none; }
  .inv-app th:first-child { padding-left:20px; width:36px; }
  .inv-app th:last-child { padding-right:20px; }
  .inv-app th:hover { color:var(--text); }
  .inv-app tbody {overflow-y:auto;}
  .inv-app tbody tr { border-bottom:1px solid var(--border); transition:background .1s; cursor:pointer; }
  .inv-app tbody tr:hover { background:#faf9f7; }
  .inv-app tbody tr.selected { background:var(--accent-bg); }
  .inv-app td { padding:10px 14px; font-size:.78rem; color:var(--muted); vertical-align:middle; }
  .inv-app td:first-child { padding-left:20px; }
  .inv-app td:last-child { padding-right:20px; }
  .inv-app td input[type=checkbox] { accent-color:var(--accent); width:14px; height:14px; cursor:pointer; }

  /* Table cell variants */
  .inv-app .td-id { font-family:var(--mono); font-size:.68rem; color:var(--accent); font-weight:600; }
  .inv-app .td-filename { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text); font-weight:600; font-size:.8rem; }
  .inv-app .td-date { font-family:var(--mono); font-size:.66rem; white-space:nowrap; }
  .inv-app .td-ref { font-family:var(--mono); font-size:.7rem; color:var(--blue); }
  .inv-app .td-amount { font-family:var(--mono); font-size:.75rem; color:var(--yellow); font-weight:600; }

  /* Badge */
  .inv-app .badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
  .inv-app .badge::before { content:''; width:5px; height:5px; border-radius:50%; display:inline-block; flex-shrink:0; }
  .inv-app .badge-pending { background:var(--yellow-bg); color:var(--yellow); border:1px solid rgba(160,120,32,.2); }
  .inv-app .badge-pending::before { background:var(--yellow); animation:inv-pulse 1.5s infinite; }
  .inv-app .badge-processing { background:var(--blue-bg); color:var(--blue); border:1px solid rgba(43,94,167,.2); }
  .inv-app .badge-processing::before { background:var(--blue); animation:inv-pulse 1s infinite; }
  .inv-app .badge-done { background:var(--green-bg); color:var(--green); border:1px solid rgba(45,122,79,.2); }
  .inv-app .badge-done::before { background:var(--green); }
  .inv-app .badge-failed { background:var(--red-bg); color:var(--red); border:1px solid rgba(184,50,50,.2); }
  .inv-app .badge-failed::before { background:var(--red); }
  .inv-app .badge-job_created { background:var(--blue-bg); color:var(--blue); border:1px solid rgba(43,94,167,.2); }
  .inv-app .badge-job_created::before { background:var(--blue); animation:inv-pulse 1.5s infinite; }

  /* Action buttons */
  .inv-app .act-row { display:flex; gap:4px; flex-wrap:wrap; }
  .inv-app .act-btn { background:var(--surface2); border:1px solid var(--border); border-radius:4px; color:var(--muted); padding:3px 9px; font-size:.65rem; cursor:pointer; transition:all .15s; font-family:var(--sans); font-weight:500; white-space:nowrap; }
  .inv-app .act-btn:hover { color:var(--text); border-color:var(--border2); }
  .inv-app .act-btn.view:hover { color:var(--accent); border-color:var(--accent); background:var(--accent-bg); }
  .inv-app .act-btn.dl:hover { color:var(--green); border-color:var(--green); background:var(--green-bg); }

  /* Pagination */
  .inv-app .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 24px; border-top:1px solid var(--border); background:var(--surface); border-radius:0 0 1rem 1rem; }
  .inv-app .pag-info { font-family:var(--mono); font-size:.66rem; color:var(--muted); }
  .inv-app .pag-controls { display:flex; align-items:center; gap:3px; }
  .inv-app .pag-btn { background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--muted); width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:.75rem; cursor:pointer; transition:all .15s; }
  .inv-app .pag-btn:hover:not(:disabled) { color:var(--text); border-color:var(--border2); background:var(--surface2); }
  .inv-app .pag-btn.active { background:var(--accent); border-color:var(--accent); color:#fff; }
  .inv-app .pag-btn:disabled { opacity:.3; cursor:not-allowed; }

  /* State boxes */
  .inv-app .state-box { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 20px; gap:10px; }
  .inv-app .state-icon { font-size:2rem; opacity:.35; }
  .inv-app .state-text { font-size:.85rem; color:var(--text); font-weight:600; }
  .inv-app .state-sub { font-size:.73rem; color:var(--muted); }
  .inv-app .spinner { width:20px; height:20px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:inv-spin .7s linear infinite; }

  /* Action bar */
  .inv-app .action-bar { position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(80px); background:var(--surface); border:1px solid var(--border2); border-radius:var(--radius-lg); padding:10px 16px; display:flex; align-items:center; gap:10px; box-shadow:0 8px 28px rgba(0,0,0,.12); transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .25s; z-index:50; white-space:nowrap; opacity:0; pointer-events:none; }
  .inv-app .action-bar.visible { transform:translateX(-50%) translateY(0); opacity:1; pointer-events:all; }
  .inv-app .bar-btn { padding:5px 12px; border-radius:var(--radius); font-size:.75rem; font-weight:600; font-family:var(--sans); cursor:pointer; border:1px solid transparent; transition:all .15s; }
  .inv-app .bar-btn.danger { background:var(--red-bg); color:var(--red); border-color:rgba(184,50,50,.25); }
  .inv-app .bar-btn.danger:hover { background:var(--red); color:#fff; }
  .inv-app .bar-btn.outline { background:transparent; color:var(--muted); border-color:var(--border); }
  .inv-app .bar-btn.outline:hover { color:var(--text); background:var(--surface2); }

  /* Toast */
  .inv-app .toast { position:fixed; bottom:80px; right:24px; padding:10px 16px; border-radius:var(--radius-lg); font-size:.78rem; font-weight:500; font-family:var(--sans); display:flex; align-items:center; gap:8px; box-shadow:0 4px 16px rgba(0,0,0,.1); z-index:300; animation:inv-toast-in .3s ease; pointer-events:none; }
  .inv-app .toast.success { background:#ecfdf5; border:1px solid #6ee7b7; color:#065f46; }
  .inv-app .toast.error { background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; }
  .inv-app .toast.info { background:#eff6ff; border:1px solid #93c5fd; color:#1e40af; }

  /* Modal */
  .inv-app .overlay { position:fixed; inset:0; background:rgba(26,25,22,.4); backdrop-filter:blur(4px); z-index:100; display:flex; align-items:center; justify-content:center; animation:inv-fade .2s ease; }
  .inv-app .modal { background:var(--surface); border:1px solid var(--border2); border-radius:14px; width:90%; max-width:580px; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 24px 64px rgba(0,0,0,.16); animation:inv-modal-in .22s cubic-bezier(.34,1.56,.64,1); }
  .inv-app .modal-xl { max-width:900px; max-height:92vh; width:96%; }
  .inv-app .modal-head { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .inv-app .modal-head h2 { font-size:.9rem; font-weight:700; letter-spacing:-.01em; }
  .inv-app .modal-close { background:none; border:none; color:var(--muted); cursor:pointer; font-size:1.1rem; line-height:1; padding:2px 6px; border-radius:4px; transition:all .15s; }
  .inv-app .modal-close:hover { color:var(--text); background:var(--surface2); }
  .inv-app .modal-body { padding:20px 22px; overflow-y:auto; flex:1; }
  .inv-app .modal-foot { padding:12px 22px; border-top:1px solid var(--border); display:flex; gap:8px; justify-content:flex-end; flex-shrink:0; }

  /* Upload zone */
  .inv-app .zone-label { display:flex; align-items:center; gap:6px; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; margin-bottom:8px; color:var(--accent); }
  .inv-app .zone-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); }
  .inv-app .drop-zone { border:1.5px dashed var(--border2); border-radius:var(--radius-lg); padding:28px 16px; text-align:center; cursor:pointer; transition:all .2s; background:var(--surface2); }
  .inv-app .drop-zone:hover,.inv-app .drop-zone.over { border-color:var(--accent); background:var(--accent-bg); }
  .inv-app .dz-icon { font-size:1.8rem; margin-bottom:8px; opacity:.55; }
  .inv-app .drop-zone p { font-size:.78rem; color:var(--muted); margin:0; }
  .inv-app .drop-zone small { font-size:.65rem; color:var(--muted); opacity:.55; margin-top:4px; display:block; }
  .inv-app .zone-file-row { display:flex; align-items:center; justify-content:space-between; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:6px 10px; margin-top:5px; }
  .inv-app .zf-name { font-size:.72rem; color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; }
  .inv-app .zf-size { font-family:var(--mono); font-size:.6rem; color:var(--muted); margin-top:1px; }
  .inv-app .zf-rm { background:none; border:none; color:var(--muted); cursor:pointer; font-size:.8rem; padding:0 4px; transition:color .15s; }
  .inv-app .zf-rm:hover { color:var(--red); }
  .inv-app .zone-empty { text-align:center; font-size:.7rem; color:var(--muted); opacity:.45; padding:6px 0; }
  .inv-app .progress-bar { height:3px; background:var(--border); border-radius:99px; overflow:hidden; margin-bottom:14px; }
  .inv-app .progress-fill { height:100%; background:var(--accent); border-radius:99px; transition:width .4s; }
  .inv-app .ur-item { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border-radius:var(--radius); margin-bottom:6px; font-size:.76rem; }
  .inv-app .ur-item.ok { background:var(--green-bg); border:1px solid rgba(45,122,79,.2); }
  .inv-app .ur-item.err { background:var(--red-bg); border:1px solid rgba(184,50,50,.2); }
  .inv-app .ur-name { font-weight:600; color:var(--text); }
  .inv-app .ur-meta { color:var(--muted); font-size:.68rem; margin-top:2px; }
  .inv-app .upload-summary { display:flex; align-items:center; gap:8px; padding:9px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:12px; font-size:.75rem; color:var(--muted); }
  .inv-app .us-total { font-family:var(--mono); font-weight:700; color:var(--text); font-size:.82rem; }

  /* Payload modal */
  .inv-app .tabs { display:flex; gap:0; padding:0 22px; border-bottom:1px solid var(--border); background:var(--surface); flex-shrink:0; }
  .inv-app .tab-btn { padding:10px 16px; font-size:.75rem; font-weight:500; font-family:var(--sans); color:var(--muted); background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:all .15s; margin-bottom:-1px; }
  .inv-app .tab-btn:hover { color:var(--text); }
  .inv-app .tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); font-weight:600; }
  .inv-app .tab-body { padding:22px; overflow-y:auto; flex:1; }

  /* Payload form */
  .inv-app .p-header { display:flex; align-items:center; gap:10px; padding:14px 0 18px; flex-wrap:wrap; }
  .inv-app .p-inv-no { font-family:var(--mono); font-size:.72rem; font-weight:600; color:var(--accent); background:var(--accent-bg); border:1px solid rgba(196,98,45,.2); border-radius:4px; padding:3px 10px; }
  .inv-app .p-status { font-family:var(--mono); font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; border-radius:4px; padding:3px 8px; }
  .inv-app .p-status.posted { background:var(--green-bg); color:var(--green); border:1px solid rgba(45,122,79,.2); }
  .inv-app .p-status.unposted { background:var(--yellow-bg); color:var(--yellow); border:1px solid rgba(160,120,32,.2); }
  .inv-app .p-dr-cr { font-size:.68rem; color:var(--muted); border:1px solid var(--border); border-radius:4px; padding:3px 8px; font-weight:600; }

  .inv-app .kv-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:18px; }
  .inv-app .kv-grid.c2 { grid-template-columns:1fr 1fr; }
  .inv-app .kv-grid.c4 { grid-template-columns:repeat(4,1fr); }
  .inv-app .kv-cell { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:9px 12px; }
  .inv-app .kv-label { font-size:.56rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:4px; }
  .inv-app .kv-val { font-size:.8rem; color:var(--text); font-weight:500; word-break:break-word; }
  .inv-app .kv-val.mono { font-family:var(--mono); font-size:.72rem; color:var(--blue); }
  .inv-app .kv-val.amount { font-family:var(--mono); font-size:.88rem; color:var(--accent); font-weight:600; }
  .inv-app .kv-val.empty { color:var(--muted); opacity:.4; font-style:italic; }

  .inv-app .sec-title { font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); margin-bottom:10px; display:flex; align-items:center; gap:8px; }
  .inv-app .sec-title::after { content:''; flex:1; height:1px; background:var(--border); }

  /* Tax summary strip */
  .inv-app .tax-strip { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:18px; }
  .inv-app .tax-cell { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:10px 10px; text-align:center; }
  .inv-app .tax-val { font-family:var(--mono); font-size:.9rem; font-weight:600; color:var(--accent); }
  .inv-app .tax-label { font-size:.58rem; color:var(--muted); margin-top:3px; text-transform:uppercase; letter-spacing:.06em; }

  /* Charges table */
  .inv-app .charges-table { width:100%; border-collapse:collapse; margin-top:6px; font-size:.72rem; }
  .inv-app .charges-table th { font-size:.58rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); font-weight:700; padding:6px 10px; background:var(--surface2); border:1px solid var(--border); white-space:nowrap; text-align:left; }
  .inv-app .charges-table td { padding:7px 10px; border:1px solid var(--border); color:var(--text); vertical-align:top; }
  .inv-app .charges-table tr:nth-child(even) td { background:var(--surface2); }
  .inv-app .charges-table .mono { font-family:var(--mono); font-size:.68rem; color:var(--blue); }
  .inv-app .charges-table .amt { font-family:var(--mono); font-weight:600; color:var(--accent); }
  .inv-app .charges-table .tax-num { font-family:var(--mono); font-size:.68rem; color:var(--green); }

  /* Error box */
  .inv-app .error-box { background:var(--red-bg); border:1px solid rgba(184,50,50,.2); border-radius:var(--radius); padding:12px 14px; font-family:var(--mono); font-size:.7rem; color:var(--red); white-space:pre-wrap; max-height:300px; overflow-y:auto; line-height:1.6; }

  @media(max-width:768px){
    .inv-app .kv-grid { grid-template-columns:1fr 1fr; }
    .inv-app .kv-grid.c4 { grid-template-columns:1fr 1fr; }
    .inv-app .tax-strip { grid-template-columns:repeat(3,1fr); }
    .inv-app .top-stats { display:none; }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fv(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (Array.isArray(val)) return val.length ? val.join(", ") : null;
  return String(val);
}

function fmt(dt?: string): string {
  if (!dt) return "—";
  return dt.slice(0, 16).replace("T", " ");
}

function buildPageRange(cur: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (cur >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", cur - 1, cur, cur + 1, "...", total];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Badge: FC<{ status: FileStatus }> = ({ status }) => (
  <span className={`badge badge-${status}`}>{status}</span>
);

const Toast: FC<{ toast: ToastState }> = ({ toast }) => (
  <div className={`toast ${toast.type}`}>{toast.msg}</div>
);

interface KVProps { label: string; val?: unknown; cls?: string; span?: number }
const KV: FC<KVProps> = ({ label, val, cls = "", span = 1 }) => {
  const v = fv(val);
  return (
    <div className="kv-cell" style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>
      <div className="kv-label">{label}</div>
      <div className={`kv-val ${v ? cls : "empty"}`}>{v ?? "—"}</div>
    </div>
  );
};

const SecTitle: FC<{ icon: string; title: string }> = ({ icon, title }) => (
  <div className="sec-title"><span>{icon}</span>{title}</div>
);

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
}

const UploadModal: FC<UploadModalProps> = ({ onClose, onUploaded }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult | null>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const allowed = /\.(pdf|jpg|jpeg|png|gif|bmp|webp|tiff?|svg)$/i;
    const pdfs = Array.from(fl).filter(f => allowed.test(f.name));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...pdfs.filter(f => !names.has(f.name))];
    });
  };

  const submit = async () => {
    if (!files.length) return;
    setUploading(true); setProgress(20); setResults(null);
    const fd = new FormData();
    files.forEach(f => fd.append("invoice_attachments", f));
    try {
      setProgress(70);
      const { data } = await invoiceApi.post<UploadResult>(ALL_URL.upload, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
      });
      setProgress(100);
      // setResults(data);
      setFiles([]);
      onUploaded();
      onClose();
    } catch {
      // setResults({ uploaded: [], error: true });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2>📤 Upload Invoices</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="zone-label"><div className="zone-dot" />Invoice Attachments</div>
          <div
            className={`drop-zone${dragOver ? " over" : ""}`}
            onClick={() => (document.getElementById("fi-inv") as HTMLInputElement)?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          >
            <div className="dz-icon">🧾</div>
            <p>Drop files or <span style={{ color: "var(--accent)", fontWeight: 700 }}>browse</span></p>
            <small>PDF or any image format (JPG, PNG, WEBP, etc.)</small>
          </div>
          <input type="file" id="fi-inv" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif,.svg,image/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: "none" }} />

          {files.length > 0
            ? files.map((f, i) => (
              <div className="zone-file-row" key={i}>
                <div>
                  <div className="zf-name" title={f.name}>📄 {f.name}</div>
                  <div className="zf-size">{(f.size / 1024).toFixed(1)} KB</div>
                </div>
                <button className="zf-rm" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))
            : <div className="zone-empty" style={{ marginTop: 8 }}>No files selected</div>
          }

          {files.length > 0 && (
            <div className="upload-summary" style={{ marginTop: 12 }}>
              Total selected: <span className="us-total">{files.length} file{files.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {uploading && progress > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}

          {results && (
            <div style={{ marginTop: 8 }}>
              {results.uploaded.map((f, i) => (
                <div className="ur-item ok" key={i}>
                  <span>✅</span>
                  <div>
                    <div className="ur-name">{f.filename}</div>
                    <div className="ur-meta">{f.size_kb} KB · Queued for processing</div>
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
                  <div><div className="ur-name">Upload failed. Please try again.</div></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!files.length || uploading}>
            {uploading ? "⏳ Uploading…" : "Upload & Extract"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Payload Modal ────────────────────────────────────────────────────────────

const PayloadModal: FC<{ record: InvoiceRecord; onClose: () => void; showToast: (m: string, t?: ToastState["type"]) => void }> = ({ record, onClose, showToast }) => {
  const isAdmin = useIsAdminUser();
  const [tab, setTab] = useState<"form" | "file" | "raw">("form");
  const p: InvoicePayload = record.extracted_data ?? {};

  const modalTabs = useMemo(() => {
    const tabs: Array<{ key: "form" | "file" | "raw"; label: string }> = [
      { key: "form", label: "Form View" },
    ];
    if (record.file_url?.trim()) {
      tabs.push({ key: "file", label: record.file_name?.trim() || "File" });
    }
    if (isAdmin) tabs.push({ key: "raw", label: "Raw JSON" });
    return tabs;
  }, [record.file_url, record.file_name, isAdmin]);

  useEffect(() => {
    if (!modalTabs.some(t => t.key === tab)) setTab("form");
  }, [modalTabs, tab]);

  const copy = () =>
    navigator.clipboard.writeText(JSON.stringify(p, null, 2))
      .then(() => showToast("✅ JSON copied", "success"))
      .catch(() => showToast("❌ Copy failed", "error"));

  const hasPayload = Object.keys(p).length > 0;
  const statusClass = p.status?.toUpperCase() === "POSTED" ? "posted" : "unposted";

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-xl" style={{ display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".7rem", color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 4 }}>
              ID #{record.id} · {record.file_name ?? "Invoice"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {p.Inv_Crn_no && <span className="p-inv-no">{p.Inv_Crn_no}</span>}
              {p.status && <span className={`p-status ${statusClass}`}>{p.status}</span>}
              {p.Dr_Cr && <span className="p-dr-cr">{p.Dr_Cr}</span>}
              {record.status && <Badge status={record.status} />}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && (
              <button className="act-btn dl" style={{ fontSize: ".72rem", padding: "5px 12px" }} onClick={copy}>⎘ Copy JSON</button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="tabs">
          {modalTabs.map((t) => {
            if (
              t.key === "file" &&
              (!record.file_url ||
                record.file_url.trim().startsWith("temp_uploads"))
            ) {
              return null;
            }

            return (
              <button
                key={t.key}
                className={`tab-btn ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "form" && (
          <div className="tab-body">
            {!hasPayload
              ? <div className="state-box"><div className="state-icon">📭</div><div className="state-text">No extracted data yet</div></div>
              : <>
                {/* Header fields */}
                <SecTitle icon="📋" title="Invoice Details" />
                <div className="kv-grid c4" style={{ marginBottom: 18 }}>
                  <KV label="Date" val={p.date} />
                  <KV label="Due Date" val={p.due_date} />
                  <KV label="PRQ Reference No." val={p.prq_reference_no} cls="mono" />
                  <KV label="Inv / CRN No." val={p.Inv_Crn_no} cls="mono" />
                  <KV label="Job No." val={p.job_no} />
                  <KV label="Master No." val={p.master_bl} />
                </div>

                <SecTitle icon="🏢" title="Parties" />
                <div className="kv-grid" style={{ marginBottom: 18 }}>
                  <KV label="Agent Name" val={p.agent_name} span={3} />
                  <KV label="Customer GST No." val={p.customer_gst_no} cls="mono" />
                  <KV label="Location GST No." val={p.location_gst_no} cls="mono" />
                </div>

                {/* Tax summary */}
                <SecTitle icon="🧮" title="Tax Summary" />
                <div className="tax-strip">
                  <div className="tax-cell">
                    <div className="tax-val">₹{p.taxable_amount ?? "—"}</div>
                    <div className="tax-label">Taxable</div>
                  </div>
                  <div className="tax-cell">
                    <div className="tax-val" style={{ color: "var(--muted)" }}>₹{p.non_taxable_amount ?? "0"}</div>
                    <div className="tax-label">Non-Taxable</div>
                  </div>
                  <div className="tax-cell">
                    <div className="tax-val" style={{ color: "var(--blue)" }}>₹{p.cgst_amount ?? "—"}</div>
                    <div className="tax-label">CGST</div>
                  </div>
                  <div className="tax-cell">
                    <div className="tax-val" style={{ color: "var(--blue)" }}>₹{p.sgst_amount ?? "—"}</div>
                    <div className="tax-label">SGST</div>
                  </div>
                  <div className="tax-cell">
                    <div className="tax-val" style={{ color: "var(--green)" }}>₹{p.igst_amount ?? "0"}</div>
                    <div className="tax-label">IGST</div>
                  </div>
                </div>

                <div className="kv-grid c4" style={{ marginBottom: 18 }}>
                  <KV label="Inv / CRN Amount" val={p.Inv_crn_amount ? `₹${p.Inv_crn_amount}` : undefined} cls="amount" />
                  <KV label="Approved Amount" val={p.approved_amount ? `₹${p.approved_amount}` : undefined} cls="amount" />
                  <KV label="Difference Amount" val={p.difference_amount ? `₹${p.difference_amount}` : undefined} cls="amount" />
                </div>

                {/* Charges table */}
                {Array.isArray(p.charges_data) && p.charges_data.length > 0 && (
                  <>
                    <SecTitle icon="📑" title={`Charge Lines (${p.charges_data.length})`} />
                    <div style={{ overflowX: "auto" }}>
                      <table className="charges-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Narration</th>
                            <th>Shipment No.</th>
                            {/* <th>Subledger</th> */}
                            <th>HSN/SAC Code</th>
                            <th>Dr/Cr</th>
                            <th>Amount</th>
                            <th>Local Amt</th>
                            <th>ROE</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>IGST</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.charges_data.map((c, i) => (
                            <tr key={i}>
                              <td style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: ".65rem" }}>{i + 1}</td>
                              <td style={{ maxWidth: 200, minWidth: 140, wordBreak: "break-word", fontSize: ".72rem" }}>{c.narration ?? "—"}</td>
                              <td className="mono">{c.shipment_no ?? "—"}</td>
                              {/* <td style={{ maxWidth: 180, fontSize: ".68rem", color: "var(--muted)", wordBreak: "break-word" }}>{c.subledger_code ?? "—"}</td> */}
                              <td className="mono">{c.hsn_sac_code ?? "—"}</td>
                              <td>
                                <span style={{
                                  fontFamily: "var(--mono)", fontSize: ".65rem", fontWeight: 700,
                                  color: c.Dr_Cr === "Cr" ? "var(--green)" : "var(--red)",
                                  background: c.Dr_Cr === "Cr" ? "var(--green-bg)" : "var(--red-bg)",
                                  border: `1px solid ${c.Dr_Cr === "Cr" ? "rgba(45,122,79,.2)" : "rgba(184,50,50,.2)"}`,
                                  borderRadius: 4, padding: "1px 6px"
                                }}>{c.Dr_Cr ?? "—"}</span>
                              </td>
                              <td className="amt">₹{c.amount ?? "—"}</td>
                              <td className="amt" style={{ color: "var(--yellow)" }}>₹{c.amount_in_local ?? "—"}</td>
                              <td className="mono" style={{ fontSize: ".66rem", color: "var(--muted)" }}>{c.roe ?? "—"}</td>
                              <td className="tax-num">{c.cgst != null ? `₹${c.cgst} (${c.cgst_rate}%)` : "—"}</td>
                              <td className="tax-num">{c.sgst != null ? `₹${c.sgst} (${c.sgst_rate}%)` : "—"}</td>
                              <td className="tax-num">{c.igst != null ? `₹${c.igst} (${c.igst_rate}%)` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Failure message if any */}
                {record.failer_message && (
                  <div style={{ marginTop: 16 }}>
                    <SecTitle icon="⚠️" title="Error Details" />
                    <div className="error-box">{record.failer_message}</div>
                  </div>
                )}
              </>
            }
          </div>
        )}

        {tab === "file" && record.file_url?.trim() && !record.file_url?.trim().startsWith("temp_uploads") && (
          <FilePreviewFrame
            url={record.file_url.trim()}
            title={record.file_name?.trim() || `Invoice #${record.id}`}
          />
        )}

        {tab === "raw" && (
          <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
            <pre style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, fontFamily: "var(--mono)", fontSize: ".7rem", color: "#374151", maxHeight: "calc(92vh - 200px)", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>
              {JSON.stringify(p, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Invoice: FC = () => {
  const [allFiles, setAllFiles] = useState<InvoiceRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FileStatus | "">("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof InvoiceRecord>("created_at");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastState["type"] = "info") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await invoiceApi.get<any>(ALL_URL.list, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
      });
      // Handle multiple possible response shapes:
      //   { files: [...] }  |  { data: { rows: [...] } }  |  { data: [...] }  |  [...]
      const rows: InvoiceRecord[] =
        data?.files ??
        data?.data?.rows ??
        (Array.isArray(data?.data) ? data.data : null) ??
        (Array.isArray(data) ? data : []);
      setAllFiles(rows);
      setLoadState("ok");
    } catch (err) {
      console.error("loadFiles error:", err);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!document.getElementById("inv-page-styles")) {
      const s = document.createElement("style");
      s.id = "inv-page-styles";
      s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    if (!pollRef.current) {
      pollRef.current = setInterval(loadFiles, 5000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [loadFiles]);

  const filtered = allFiles
    .filter(f => {
      const matchStatus = !statusFilter || f.status === statusFilter;
      const q = search.toLowerCase();
      const p = f.extracted_data ?? {};
      const matchSearch = !q || [
        String(f.id),
        f.file_name,
        f.status,
        p.Inv_Crn_no,
        p.prq_reference_no,
        p.agent_name,
      ].some(v => v?.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey as string] ?? "");
      const bv = String((b as Record<string, unknown>)[sortKey as string] ?? "");
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageStart = (page - 1) * perPage;
  const pageRows = filtered.slice(pageStart, pageStart + perPage);

  const sortToggle = (key: keyof InvoiceRecord) => {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  };

  const toggleRow = (id: number, checked: boolean) =>
    setSelected(prev => { const s = new Set(prev); checked ? s.add(id) : s.delete(id); return s; });
  const toggleAll = (checked: boolean) =>
    setSelected(new Set(checked ? pageRows.map(f => f.id) : []));

  const deleteSelected = async () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} record(s)?`)) return;
    try {
      await invoiceApi.delete(ALL_URL.delete, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
        data: { ids: ids },
      });
      setSelected(new Set());
      loadFiles();
      showToast(`Deleted ${ids.length} record(s)`, "success");
    } catch { showToast("Delete failed", "error"); }
  };

  const [jobLoading, setJobLoading] = useState(false);

  const startJobs = async () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    setJobLoading(true);
    try {
      await invoiceApi.post(
        ALL_URL.start_job,
        { record_ids: ids },
        { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } }
      );
      showToast(`✅ Job started for ${ids.length} invoice(s)`, "success");
      setSelected(new Set());
      loadFiles();
    } catch {
      showToast("❌ Failed to start job", "error");
    } finally {
      setJobLoading(false);
    }
  };

  const statuses: Array<FileStatus | ""> = ["", "pending", "processing", "done", "failed"];
  const statusLabels: Record<string, string> = { "": "All", pending: "Pending", processing: "Processing", done: "Done", failed: "Failed" };

  const doneCount = allFiles.filter(f => f.status === "done").length;
  const failedCount = allFiles.filter(f => f.status === "failed").length;

  const sortIcon = (key: keyof InvoiceRecord) => sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : " ↕";

  return (
    <div className="inv-app">
      {/* Topbar */}
      <div className="topbar">
        <div className="top-brand">
          <div className="top-brand-icon">🧾</div>
          <div>
            <div className="top-brand-text">Vendor Invoice</div>
            <div className="top-brand-sub">PDF · Extraction · Review</div>
          </div>
        </div>
        <div className="top-divider" />
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search ID, filename, inv. no, agent…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="top-stats" style={{ marginLeft: "auto" }}>
          <span className="s-total">Total <strong>{allFiles.length}</strong></span>
          <span className="s-done">Done <strong>{doneCount}</strong></span>
          <span className="s-failed">Failed <strong>{failedCount}</strong></span>
        </div>
        <button className="btn btn-ghost" onClick={loadFiles} title="Refresh">↻ Refresh</button>
        {selected.size > 0 && (
          <button
            className="btn btn-outline"
            onClick={startJobs}
            disabled={jobLoading}
            style={{ borderColor: "var(--green)", color: "var(--green)", background: "var(--green-bg)" }}
          >
            {jobLoading
              ? <><span style={{ width: 13, height: 13, border: "2px solid rgba(45,122,79,.3)", borderTopColor: "var(--green)", borderRadius: "50%", animation: "inv-spin .7s linear infinite", display: "inline-block" }} /> Starting…</>
              : <>▶ Start Job ({selected.size})</>
            }
          </button>
        )}
        <button className="btn btn-primary" onClick={() => setModal({ type: "upload" })}>＋ Upload PDFs</button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <span className="filter-label">Status:</span>
        {statuses.map(s => (
          <button key={s} className={`chip ${statusFilter === s ? "active" : ""}`}
            onClick={() => { setStatusFilter(s); setPage(1); setSelected(new Set()); }}>
            {statusLabels[s]}
          </button>
        ))}
        <div className="filter-sep" />
        <select className="per-page" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <span className="records-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox"
                  checked={pageRows.length > 0 && pageRows.every(f => selected.has(f.id))}
                  onChange={e => toggleAll(e.target.checked)}
                />
              </th>
              <th onClick={() => sortToggle("id")}>ID{sortIcon("id")}</th>
              <th onClick={() => sortToggle("file_name")}>File Name{sortIcon("file_name")}</th>
              <th>Inv / CRN No.</th>
              <th>PRQ Ref.</th>
              <th>Agent</th>
              <th>Inv Amount</th>
              <th onClick={() => sortToggle("status")}>Status{sortIcon("status")}</th>
              <th onClick={() => sortToggle("created_at")}>Created{sortIcon("created_at")}</th>
              <th onClick={() => sortToggle("updated_at")}>Updated{sortIcon("updated_at")}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadState !== "loading" && pageRows.map(f => {
              const p = f.extracted_data ?? {};
              return (
                <tr key={f.id} className={selected.has(f.id) ? "selected" : ""}
                  onClick={() => p && Object.keys(p).length && setModal({ type: "payload", record: f })}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(f.id)}
                      onChange={e => toggleRow(f.id, e.target.checked)} />
                  </td>
                  <td className="td-id">#{f.id}</td>
                  <td>
                    <div className="td-filename" title={f.file_name}>📄 {f.file_name ?? "—"}</div>
                    {f.file_url && (
                      <div style={{ fontSize: ".6rem", color: "var(--muted)", marginTop: 2, fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                        {f.file_url}
                      </div>
                    )}
                  </td>
                  <td className="td-ref">{p.Inv_Crn_no ?? "—"}</td>
                  <td className="td-ref">{p.prq_reference_no ?? "—"}</td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".75rem" }} title={p.agent_name}>
                    {p.agent_name ?? "—"}
                  </td>
                  <td className="td-amount">{p.Inv_crn_amount ? `₹${p.Inv_crn_amount}` : "—"}</td>
                  <td><Badge status={f.status ?? "pending"} /></td>
                  <td className="td-date">{fmt(f.created_at)}</td>
                  <td className="td-date">{fmt(f.updated_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="act-row">
                      {p && Object.keys(p).length > 0 && (
                        <button className="act-btn view"
                          onClick={() => setModal({ type: "payload", record: f })}>
                          ⊞ View
                        </button>
                      )}
                      {f.file_url && (
                        <button className="act-btn dl"
                          onClick={() => window.open(f.file_url, "_blank")}>
                          ↓ PDF
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {loadState === "loading" && (
          <div className="state-box"><div className="spinner" /></div>
        )}
        {loadState === "ok" && filtered.length === 0 && (
          <div className="state-box">
            <div className="state-icon">🧾</div>
            <div className="state-text">No invoices found</div>
            <div className="state-sub">Upload invoice PDFs to get started</div>
          </div>
        )}
        {loadState === "error" && (
          <div className="state-box">
            <div className="state-icon">⚠️</div>
            <div className="state-text">Could not load records</div>
            <div className="state-sub">Check server connection and try again</div>
          </div>
        )}
      </div>

      {/* Pagination */}
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

      {/* Bulk action bar */}
      <div className={`action-bar ${selected.size > 0 ? "visible" : ""}`}>
        <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>
          <strong style={{ color: "var(--text)" }}>{selected.size}</strong> selected
        </span>
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
        <button className="bar-btn danger" onClick={deleteSelected}>🗑 Delete</button>
        <button
          className="bar-btn"
          onClick={startJobs}
          disabled={jobLoading}
          style={{ background: "var(--green-bg)", color: "var(--green)", borderColor: "rgba(45,122,79,.25)" }}
        >
          {jobLoading ? "Starting…" : "▶ Start Job"}
        </button>
        <button className="bar-btn outline" onClick={() => setSelected(new Set())}>✕ Clear</button>
      </div>

      {toast && <Toast toast={toast} />}

      {modal?.type === "upload" && (
        <UploadModal onClose={() => setModal(null)} onUploaded={loadFiles} showToast={showToast} />
      )}
      {modal?.type === "payload" && (
        <PayloadModal record={modal.record} onClose={() => setModal(null)} showToast={showToast} />
      )}
    </div>
  );
};

export default Invoice;