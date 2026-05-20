import { branchDotColor } from "../accountsDashboardNormalize";
import { getLaneLabel, getSegmentLabel } from "../profitabilityTrillOne/data";
import { LANE_LABELS, REP_LABELS } from "../profitabilityTrillOne/constants";
import type { ProfitabilityJob, ProfitabilityJobSegment } from "../profitabilityTrillOne/types";
import type {
  JobLinkedDocument,
  JobMarginBridgeItem,
  JobPlLine,
  JobProfitabilityDetail,
} from "./types";

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function toLakhs(value: unknown): number {
  const n = safeNumber(value);
  if (!n) return 0;
  return Math.abs(n) >= 100000 ? n / 100000 : n;
}

function normalizePlLine(raw: unknown): JobPlLine {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    head: firstString(row.head, row.charge_head, row.cost_head, row.label, row.name),
    party: firstString(row.party, row.vendor, row.beneficiary, row.vendor_beneficiary),
    qty: firstString(row.qty, row.quantity, "1"),
    rate: firstString(row.rate, row.rate_type, row.unit),
    amountInr: safeNumber(row.amount ?? row.amount_inr ?? row.value),
  };
}

function statusLabel(status: string): string {
  const key = status.toLowerCase();
  if (key === "pending") return "Delivered · invoice pending";
  if (key === "invoiced") return "Invoiced";
  if (key === "transit") return "In transit";
  if (key === "delivered") return "Delivered";
  return status;
}

function segmentKeyFromLabel(label: string): ProfitabilityJobSegment | undefined {
  const lower = label.toLowerCase();
  if (lower.includes("ocean") && lower.includes("fcl")) return "ocean-fcl";
  if (lower.includes("ocean") && lower.includes("lcl")) return "ocean-lcl";
  if (lower.includes("air")) return "air";
  if (lower.includes("custom")) return "customs";
  if (lower.includes("road")) return "road";
  if (lower.includes("warehous")) return "warehousing";
  return undefined;
}

function perUnitLabel(
  segmentKey: ProfitabilityJobSegment | undefined,
  volume: string,
  gpL: number,
): string {
  if (segmentKey?.startsWith("ocean")) {
    const match = volume.match(/(\d+)/);
    if (match) {
      const unit = Math.round((gpL * 100000) / Number(match[1]));
      return `₹${unit.toLocaleString("en-IN")} /unit`;
    }
  }
  if (segmentKey === "air") {
    const match = volume.match(/([\d.]+)/);
    if (match) {
      const unit = Math.round((gpL * 100000) / Number(match[1]));
      return `₹${unit.toLocaleString("en-IN")} /ton`;
    }
  }
  return "—";
}

const BRANCH_LABELS: Record<string, string> = {
  mum: "Mumbai",
  del: "Delhi",
  blr: "Bangalore",
  maa: "Chennai",
  amd: "Ahmedabad",
  ccu: "Kolkata",
};

function branchLabel(code: string): string {
  return BRANCH_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

function marginCommentary(marginPct: number): string {
  if (marginPct >= 25) {
    return "Above-average margin — driven by favorable freight buy rate and minimal vendor surcharges. Worth flagging as case study for the sales team.";
  }
  if (marginPct >= 18) {
    return "In line with branch and segment averages. No anomalies in cost lines.";
  }
  if (marginPct >= 12) {
    return "Below segment average — review ocean freight buy rate vs benchmark and check if any cost lines should have been client-billable.";
  }
  return "Loss-making or near-breakeven job — escalate to finance review. Check missed invoiceables and vendor billing accuracy.";
}

function defaultMarginBridge(marginPct: number, segmentKey?: ProfitabilityJobSegment): JobMarginBridgeItem[] {
  const segAvg: Record<string, number> = {
    "ocean-fcl": 17.9,
    "ocean-lcl": 21.4,
    air: 26.8,
    customs: 31.2,
    road: 12.4,
    warehousing: 23.9,
  };
  const branchAvg = 21.6;
  const segmentAvg = (segmentKey && segAvg[segmentKey]) || 20;
  const repAvg = 24.5;
  return [
    { label: "vs Branch avg", deltaPp: marginPct - branchAvg },
    { label: "vs Segment avg", deltaPp: marginPct - segmentAvg },
    { label: "vs Salesperson", deltaPp: marginPct - repAvg },
    { label: "vs Customer YTD", deltaPp: marginPct - (segmentAvg + 1.2) },
  ];
}

function revenueLinesForSegment(
  segmentKey: ProfitabilityJobSegment,
  customer: string,
  volume: string,
): JobPlLine[] {
  const lines: JobPlLine[] = [];
  if (segmentKey === "ocean-fcl" || segmentKey === "ocean-lcl") {
    lines.push(
      { head: "Ocean Freight", party: customer, qty: volume, rate: "lump", amountInr: 600000 },
      { head: "THC – Origin", party: customer, qty: volume, rate: "per ctr", amountInr: 80000 },
      { head: "THC – Destination", party: customer, qty: volume, rate: "per ctr", amountInr: 90000 },
      { head: "B/L Fee", party: customer, qty: "1", rate: "flat", amountInr: 20000 },
      { head: "Documentation", party: customer, qty: "1", rate: "flat", amountInr: 15000 },
    );
    if (segmentKey === "ocean-lcl") {
      lines.push({ head: "CFS Handling", party: customer, qty: volume, rate: "per CBM", amountInr: 50000 });
    }
  } else if (segmentKey === "air") {
    lines.push(
      { head: "Air Freight", party: customer, qty: volume, rate: "per kg", amountInr: 700000 },
      { head: "Fuel Surcharge", party: customer, qty: volume, rate: "per kg", amountInr: 100000 },
      { head: "Security Charge", party: customer, qty: volume, rate: "per kg", amountInr: 30000 },
      { head: "AWB Fee", party: customer, qty: "1", rate: "flat", amountInr: 15000 },
      { head: "Handling Charge", party: customer, qty: "1", rate: "flat", amountInr: 20000 },
    );
  } else if (segmentKey === "customs") {
    lines.push(
      { head: "Customs Clearance Fee", party: customer, qty: volume, rate: "per entry", amountInr: 500000 },
      { head: "CHA Charges", party: customer, qty: "1", rate: "lump", amountInr: 180000 },
      { head: "Examination Charge", party: customer, qty: "1", rate: "flat", amountInr: 60000 },
    );
  } else if (segmentKey === "road") {
    lines.push(
      { head: "Trucking Charges", party: customer, qty: volume, rate: "per trip", amountInr: 550000 },
      { head: "Loading/Unloading", party: customer, qty: volume, rate: "per trip", amountInr: 80000 },
      { head: "Toll & Permit", party: customer, qty: "1", rate: "lump", amountInr: 50000 },
    );
  } else if (segmentKey === "warehousing") {
    lines.push(
      { head: "Storage Charges", party: customer, qty: volume, rate: "per sqm", amountInr: 500000 },
      { head: "Handling In/Out", party: customer, qty: "1", rate: "lump", amountInr: 120000 },
      { head: "Inventory Management", party: customer, qty: "1", rate: "flat", amountInr: 80000 },
    );
  }
  return lines;
}

function costLinesForSegment(
  segmentKey: ProfitabilityJobSegment,
  volume: string,
): JobPlLine[] {
  const lines: JobPlLine[] = [];
  if (segmentKey === "ocean-fcl" || segmentKey === "ocean-lcl") {
    lines.push(
      { head: "Ocean Freight", party: "Maersk / CMA CGM", qty: volume, rate: "lump", amountInr: 550000 },
      { head: "THC – Origin", party: "Terminal operator", qty: volume, rate: "per ctr", amountInr: 70000 },
      { head: "THC – Destination", party: "Overseas agent", qty: volume, rate: "per ctr", amountInr: 80000 },
      { head: "Inland Trucking", party: "VRL / GATI", qty: volume, rate: "per trip", amountInr: 60000 },
      { head: "Documentation", party: "Carrier", qty: "1", rate: "flat", amountInr: 12000 },
    );
    if (segmentKey === "ocean-lcl") {
      lines.push({ head: "CFS Handling", party: "Allcargo / NSCT", qty: volume, rate: "per CBM", amountInr: 40000 });
    }
  } else if (segmentKey === "air") {
    lines.push(
      { head: "Air Freight", party: "Emirates / Lufthansa", qty: volume, rate: "per kg", amountInr: 620000 },
      { head: "Fuel Surcharge", party: "Airline", qty: volume, rate: "per kg", amountInr: 90000 },
      { head: "Security Charge", party: "Airline", qty: volume, rate: "per kg", amountInr: 25000 },
      { head: "Ground Handling", party: "Cargo handler", qty: "1", rate: "lump", amountInr: 50000 },
      { head: "Pickup Charges", party: "Inland transporter", qty: "1", rate: "flat", amountInr: 30000 },
    );
  } else if (segmentKey === "customs") {
    lines.push(
      { head: "Duty Drawback Filing", party: "CHA partner", qty: "1", rate: "lump", amountInr: 320000 },
      { head: "CFS Charges", party: "CFS operator", qty: "1", rate: "lump", amountInr: 100000 },
      { head: "Examination/Other", party: "Customs / port", qty: "1", rate: "lump", amountInr: 40000 },
    );
  } else if (segmentKey === "road") {
    lines.push(
      { head: "Vehicle Hire", party: "Fleet partner", qty: volume, rate: "per trip", amountInr: 480000 },
      { head: "Fuel", party: "IOC / BPCL", qty: "1", rate: "lump", amountInr: 90000 },
      { head: "Driver & Permit", party: "Operator", qty: "1", rate: "lump", amountInr: 50000 },
    );
  } else if (segmentKey === "warehousing") {
    lines.push(
      { head: "Storage – Sub-let", party: "WH partner", qty: volume, rate: "per sqm", amountInr: 420000 },
      { head: "Labour Cost", party: "Manpower agency", qty: "1", rate: "lump", amountInr: 100000 },
      { head: "Power & Maintenance", party: "Utility / vendor", qty: "1", rate: "flat", amountInr: 60000 },
    );
  }
  return lines;
}

function scaleLines(lines: JobPlLine[], targetInr: number): JobPlLine[] {
  const total = lines.reduce((sum, line) => sum + line.amountInr, 0);
  if (!total || !targetInr) return lines;
  const scale = targetInr / total;
  return lines.map((line) => ({ ...line, amountInr: line.amountInr * scale }));
}

function defaultLinkedDocuments(job: ProfitabilityJob): JobLinkedDocument[] {
  const suffix = job.id.slice(-6);
  const docs: JobLinkedDocument[] = [
    {
      label: "Customer Invoice",
      id: `INV-26-02-${suffix.slice(-4)}`,
      date: job.delivered,
      invoiceId: `INV-26-02-${suffix.slice(-4)}`,
      actionLabel: "Open →",
    },
    {
      label: "Agent Payable",
      id: `AGN-26-02-${suffix.slice(-3)}`,
      date: job.delivered,
      invoiceId: `AGN-26-02-${suffix.slice(-3)}`,
      actionLabel: "Open →",
    },
    { label: "Job Sheet", id: `JS-${suffix}`, date: job.delivered, status: "Approved" },
    { label: "Costing Sheet", id: `CS-${suffix}`, date: job.delivered, status: "Locked" },
  ];
  if (job.segment === "warehousing" || job.segment === "road") {
    return docs.filter((doc) => doc.label !== "Agent Payable");
  }
  return docs;
}

export function buildJobDetailFromRow(job: ProfitabilityJob): JobProfitabilityDetail {
  const volume =
    job.segment.startsWith("ocean") ? "2× 40HC" :
    job.segment === "air" ? "8.4 t" :
    job.segment === "road" ? "4 trips" :
    job.segment === "warehousing" ? "180 sqm" :
    "8 entries";
  const revenueInr = job.revenueL * 100000;
  const costInr = job.costL * 100000;
  const gpInr = revenueInr - costInr;
  const marginPct = job.revenueL > 0 ? (gpInr / revenueInr) * 100 : 0;
  const revenueLines = scaleLines(revenueLinesForSegment(job.segment, job.customer, volume), revenueInr);
  const costLines = scaleLines(costLinesForSegment(job.segment, volume), costInr);

  return {
    jobId: job.id,
    customer: job.customer,
    lane: getLaneLabel(job.lane),
    segment: getSegmentLabel(job.segment),
    segmentKey: job.segment,
    status: "invoiced",
    statusLabel: "Invoiced",
    branch: {
      code: job.branch,
      label: branchLabel(job.branch),
    },
    salesperson: REP_LABELS[job.rep] ?? job.rep,
    delivered: job.delivered,
    volume,
    revenueL: job.revenueL,
    costL: job.costL,
    grossProfitL: job.revenueL - job.costL,
    marginPct,
    perUnitLabel: perUnitLabel(job.segment, volume, job.revenueL - job.costL),
    revenueLines,
    costLines,
    linkedDocuments: defaultLinkedDocuments(job),
    marginBridge: defaultMarginBridge(marginPct, job.segment),
    marginCommentary: marginCommentary(marginPct),
  };
}

export function normalizeJobProfitabilityDetail(raw: unknown, fallbackJob?: ProfitabilityJob | null): JobProfitabilityDetail {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root.result ?? root) as Record<string, unknown>;

  if (!firstString(data.job_id, data.jobId, data.id) && fallbackJob) {
    return buildJobDetailFromRow(fallbackJob);
  }

  const branchRaw = (data.branch ?? {}) as Record<string, unknown>;
  const summaryRaw = (data.summary ?? {}) as Record<string, unknown>;
  const revenueLinesRaw = Array.isArray(data.revenue_lines)
    ? data.revenue_lines
    : Array.isArray(data.revenueLines)
      ? data.revenueLines
      : [];
  const costLinesRaw = Array.isArray(data.cost_lines)
    ? data.cost_lines
    : Array.isArray(data.costLines)
      ? data.costLines
      : [];
  const docsRaw = Array.isArray(data.linked_documents)
    ? data.linked_documents
    : Array.isArray(data.linkedDocuments)
      ? data.linkedDocuments
      : [];
  const bridgeRaw = Array.isArray(data.margin_bridge)
    ? data.margin_bridge
    : Array.isArray(data.marginBridge)
      ? data.marginBridge
      : [];

  const revenueL = toLakhs(summaryRaw.revenue ?? summaryRaw.revenue_inr ?? data.revenue ?? data.revenue_inr);
  const costL = toLakhs(summaryRaw.direct_cost ?? summaryRaw.cost ?? data.direct_cost ?? data.cost_inr);
  const grossProfitL = toLakhs(
    summaryRaw.gross_profit ?? summaryRaw.gp ?? data.gross_profit ?? revenueL * 100000 - costL * 100000,
  ) || revenueL - costL;
  const marginPct = safeNumber(
    summaryRaw.margin_pct ?? summaryRaw.marginPct ?? data.margin_pct,
    revenueL > 0 ? (grossProfitL / revenueL) * 100 : 0,
  );

  const segment = firstString(data.segment, data.mode, data.service_type);
  const segmentKey = segmentKeyFromLabel(segment) ?? fallbackJob?.segment;
  const volume = firstString(data.volume, data.ctr, data.quantity, fallbackJob ? "—" : "");
  const status = firstString(data.status, "invoiced");

  const revenueLines = revenueLinesRaw.length
    ? revenueLinesRaw.map(normalizePlLine)
    : segmentKey
      ? scaleLines(revenueLinesForSegment(segmentKey, firstString(data.customer, data.customer_name), volume), revenueL * 100000)
      : [];
  const costLines = costLinesRaw.length
    ? costLinesRaw.map(normalizePlLine)
    : segmentKey
      ? scaleLines(costLinesForSegment(segmentKey, volume), costL * 100000)
      : [];

  const linkedDocuments: JobLinkedDocument[] = docsRaw.length
    ? docsRaw.map((doc) => {
        const row = (doc ?? {}) as Record<string, unknown>;
        return {
          label: firstString(row.label, row.name, row.type),
          id: firstString(row.id, row.document_id),
          date: firstString(row.date, row.document_date) || undefined,
          status: firstString(row.status) || undefined,
          invoiceId: firstString(row.invoice_id, row.invId, row.invoiceId) || undefined,
          actionLabel: firstString(row.action_label, row.actionLabel) || undefined,
        };
      })
    : fallbackJob
      ? defaultLinkedDocuments(fallbackJob)
      : [];

  const marginBridge: JobMarginBridgeItem[] = bridgeRaw.length
    ? bridgeRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          label: firstString(row.label, row.name),
          deltaPp: safeNumber(row.delta_pp ?? row.deltaPp ?? row.delta),
        };
      })
    : defaultMarginBridge(marginPct, segmentKey);

  const branchCode = firstString(branchRaw.code, branchRaw.branch_code, data.branch_code, fallbackJob?.branch).toLowerCase();

  return {
    jobId: firstString(data.job_id, data.jobId, data.id, fallbackJob?.id),
    customer: firstString(data.customer, data.customer_name, fallbackJob?.customer),
    lane: firstString(data.lane, data.tradelane, data.route, fallbackJob ? getLaneLabel(fallbackJob.lane) : ""),
    segment,
    segmentKey,
    status,
    statusLabel: firstString(data.status_label, data.statusLabel) || statusLabel(status),
    branch: {
      code: branchCode,
      label: firstString(branchRaw.label, branchRaw.name, branchLabel(branchCode)),
    },
    salesperson: firstString(data.salesperson, data.sales_person, data.rep_name, fallbackJob ? REP_LABELS[fallbackJob.rep] : ""),
    delivered: firstString(data.delivered, data.delivered_date, data.delivery_date, fallbackJob?.delivered),
    volume,
    revenueL,
    costL,
    grossProfitL,
    marginPct,
    perUnitLabel:
      firstString(summaryRaw.per_unit_label, summaryRaw.perUnitLabel, data.per_unit_label) ||
      perUnitLabel(segmentKey, volume, grossProfitL),
    revenueLines,
    costLines,
    linkedDocuments,
    marginBridge,
    marginCommentary:
      firstString(data.margin_commentary, data.marginCommentary) || marginCommentary(marginPct),
  };
}

export function branchChipDotColor(code: string): string {
  return branchDotColor(code);
}

export { LANE_LABELS };
