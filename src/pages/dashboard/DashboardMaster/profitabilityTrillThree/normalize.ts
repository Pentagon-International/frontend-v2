import { branchDotColor } from "../accountsDashboardNormalize";
import { formatMoneyAmountForUi } from "../../../../utils/nonDecimalMoneyAmount";
import type { JobProfitabilityDetail, JobPlLine } from "../profitabilityTrillTwo/types";
import type { JobLinkedDocument } from "../profitabilityTrillTwo/types";
import type {
  FollowUpAction,
  InvoiceChargeLine,
  InvoiceOpenContext,
  InvoiceProfitabilityDetail,
  PaymentTimelineEvent,
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

function formatInrFull(value: number): string {
  return `₹${formatMoneyAmountForUi(value)}`;
}

function formatLakhsDisplay(valueL: number): string {
  const abs = Math.abs(valueL);
  if (abs >= 100) return `${(abs / 100).toFixed(1)} Cr`;
  return `${abs.toFixed(1)} L`;
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

function plLineToCharge(line: JobPlLine): InvoiceChargeLine {
  return {
    head: line.head,
    qty: line.qty,
    rate: line.rate,
    amountInr: line.amountInr,
  };
}

function scaleChargeLines(lines: InvoiceChargeLine[], targetInr: number): InvoiceChargeLine[] {
  const total = lines.reduce((sum, line) => sum + line.amountInr, 0);
  if (!total || !targetInr) return lines;
  const scale = targetInr / total;
  return lines.map((line) => ({ ...line, amountInr: line.amountInr * scale }));
}

function addDaysLabel(dateStr: string, days: number): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(from: string, to: Date): number {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function buildTimeline(
  invoiceDate: string,
  dueDate: string,
  invoiceId: string,
  customer: string,
  grossL: number,
  paidL: number,
  overdueDays: number,
): PaymentTimelineEvent[] {
  const events: PaymentTimelineEvent[] = [
    {
      state: "done",
      when: invoiceDate,
      what: `Invoice raised · ${invoiceId}`,
      amountLabel: formatLakhsDisplay(grossL),
    },
    {
      state: "done",
      when: addDaysLabel(invoiceDate, 2),
      what: `Sent to ${customer} AP team`,
    },
    {
      state: "done",
      when: addDaysLabel(invoiceDate, 4),
      what: "Acknowledged · PO matched",
    },
  ];

  if (paidL > 0) {
    events.push({
      state: "done",
      when: addDaysLabel(invoiceDate, 22),
      what: "Part-payment received",
      amountLabel: formatLakhsDisplay(paidL),
    });
  }

  const balanceL = grossL - paidL;
  if (overdueDays > 0) {
    events.push({
      state: "alert",
      when: dueDate,
      what: `Overdue · ${overdueDays} days past due`,
      amountLabel: formatLakhsDisplay(balanceL),
    });
    events.push({ state: "done", when: addDaysLabel(dueDate, 7), what: "Reminder 1 sent" });
    if (overdueDays > 30) {
      events.push({
        state: "done",
        when: addDaysLabel(dueDate, 21),
        what: "Reminder 2 sent · phone call logged",
      });
    }
  } else {
    events.push({
      state: "pending",
      when: dueDate,
      what: paidL > 0 ? "Payment due (balance)" : "Payment due",
      amountLabel: formatLakhsDisplay(balanceL),
    });
  }

  return events.reverse();
}

function buildFollowUpActions(overdueDays: number, isPayable: boolean): FollowUpAction[] {
  const actions: FollowUpAction[] = [];
  if (overdueDays > 30 && !isPayable) {
    actions.push({ label: "Schedule collection call", owner: "Collections", urgent: overdueDays > 45 });
  }
  if (overdueDays > 60) {
    actions.push({ label: "Initiate legal notice review", owner: "Legal", urgent: true });
  }
  if (overdueDays === 0 && !isPayable) {
    actions.push({
      label: "Send statement-of-account reminder before due",
      owner: "AR team",
      urgent: false,
    });
  }
  if (isPayable && overdueDays > 0) {
    actions.push({
      label: "Verify documentation & release payment",
      owner: "AP team",
      urgent: overdueDays > 30,
    });
  }
  if (!actions.length) {
    actions.push({ label: "No action required · monitor", owner: "—", urgent: false });
  }
  return actions;
}

export function buildInvoiceDetailFromContext(
  context: InvoiceOpenContext,
  jobDetail?: JobProfitabilityDetail | null,
  document?: JobLinkedDocument | null,
): InvoiceProfitabilityDetail {
  const grossL = jobDetail?.revenueL ?? 8.8;
  const paidL = document?.label?.toLowerCase().includes("agent") ? 0 : grossL > 12 ? grossL / 2 : 0;
  const isPayable = document?.label?.toLowerCase().includes("agent") ?? false;
  const invoiceDate = document?.date ?? jobDetail?.delivered ?? "14 Mar 2026";
  const dueDate = addDaysLabel(invoiceDate, isPayable ? 30 : 45);
  const today = new Date();
  const overdueDays = today > new Date(dueDate) ? daysBetween(dueDate, today) : 0;
  const balanceL = grossL - paidL;
  const totalInr = grossL * 100000;
  const subtotalInr = totalInr / 1.18;
  const gstInr = totalInr - subtotalInr;

  const baseLines = jobDetail?.revenueLines?.length
    ? jobDetail.revenueLines.map(plLineToCharge)
    : [
        { head: "Ocean Freight", qty: "1× 40HC", rate: "lump", amountInr: 655900 },
        { head: "THC – Origin", qty: "1× 40HC", rate: "per ctr", amountInr: 87453 },
        { head: "THC – Destination", qty: "1× 40HC", rate: "per ctr", amountInr: 98385 },
        { head: "B/L Fee", qty: "1", rate: "flat", amountInr: 21863 },
        { head: "Documentation", qty: "1", rate: "flat", amountInr: 16397 },
      ];

  const chargeLines = scaleChargeLines(baseLines, subtotalInr);
  const branchCode = jobDetail?.branch.code ?? "mum";

  return {
    invoiceId: context.invoiceId,
    customer: context.customer,
    jobRef: context.jobId,
    branch: { code: branchCode, label: branchLabel(branchCode) },
    terms: isPayable ? "Net 30" : "Net 45",
    currency: "INR",
    isPayable,
    receivableLabel: isPayable ? "Payable" : "Receivable",
    balanceL,
    grossAmountL: grossL,
    paidL,
    invoiceDate,
    dueDate,
    statusText:
      overdueDays > 0
        ? `Overdue ${overdueDays} days`
        : `Due in ${Math.max(1, daysBetween(today.toISOString(), new Date(dueDate)))} days`,
    statusTone: overdueDays > 0 ? "bad" : "ok",
    chargeLines,
    subtotalInr,
    gstInr,
    totalInr,
    gstPct: 18,
    timeline: buildTimeline(invoiceDate, dueDate, context.invoiceId, context.customer, grossL, paidL, overdueDays),
    followUpActions: buildFollowUpActions(overdueDays, isPayable),
  };
}

export function normalizeInvoiceProfitabilityDetail(
  raw: unknown,
  context: InvoiceOpenContext,
  jobDetail?: JobProfitabilityDetail | null,
  document?: JobLinkedDocument | null,
): InvoiceProfitabilityDetail {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root.result ?? root) as Record<string, unknown>;

  if (!firstString(data.invoice_id, data.invoiceId, data.id)) {
    return buildInvoiceDetailFromContext(context, jobDetail, document);
  }

  const linesRaw = Array.isArray(data.charge_lines)
    ? data.charge_lines
    : Array.isArray(data.chargeLines)
      ? data.chargeLines
      : [];
  const timelineRaw = Array.isArray(data.payment_timeline)
    ? data.payment_timeline
    : Array.isArray(data.timeline)
      ? data.timeline
      : [];
  const actionsRaw = Array.isArray(data.follow_up_actions)
    ? data.follow_up_actions
    : Array.isArray(data.followUpActions)
      ? data.followUpActions
      : [];

  const grossL = toLakhs(data.gross_amount ?? data.amount ?? data.grossAmount);
  const paidL = toLakhs(data.received_paid ?? data.paid ?? data.receivedPaid);
  const balanceL = toLakhs(data.balance ?? data.receivable ?? grossL - paidL) || grossL - paidL;
  const isPayable = Boolean(data.is_payable ?? data.isPayable ?? data.party_type === "agent");
  const branchCode = firstString(
    (data.branch as Record<string, unknown> | undefined)?.code,
    data.branch_code,
    jobDetail?.branch.code,
  ).toLowerCase();
  const invoiceDate = firstString(data.invoice_date, data.invoiceDate, document?.date);
  const dueDate = firstString(data.due_date, data.dueDate);
  const overdueDays = safeNumber(data.overdue_days ?? data.overdueDays);
  const totalInr = safeNumber(data.total_inr ?? data.totalInr, grossL * 100000);
  const subtotalInr = safeNumber(data.subtotal_inr ?? data.subtotalInr, totalInr / 1.18);
  const gstInr = safeNumber(data.gst_inr ?? data.gstInr, totalInr - subtotalInr);
  const gstPct = safeNumber(data.gst_pct ?? data.gstPct, 18);

  const chargeLines: InvoiceChargeLine[] = linesRaw.length
    ? linesRaw.map((line) => {
        const row = (line ?? {}) as Record<string, unknown>;
        return {
          head: firstString(row.head, row.charge_head, row.label),
          qty: firstString(row.qty, row.quantity, "1"),
          rate: firstString(row.rate, row.rate_type, "lump"),
          amountInr: safeNumber(row.amount ?? row.amount_inr ?? row.value),
        };
      })
    : buildInvoiceDetailFromContext(context, jobDetail, document).chargeLines;

  const timeline: PaymentTimelineEvent[] = timelineRaw.length
    ? timelineRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const stateRaw = firstString(row.state, row.status, "done").toLowerCase();
        const state =
          stateRaw === "alert" || stateRaw === "pending" ? stateRaw : ("done" as const);
        return {
          state,
          when: firstString(row.when, row.date, row.event_date),
          what: firstString(row.what, row.description, row.label),
          amountLabel: firstString(row.amount_label, row.amountLabel, row.amount) || undefined,
        };
      })
    : buildInvoiceDetailFromContext(context, jobDetail, document).timeline;

  const followUpActions: FollowUpAction[] = actionsRaw.length
    ? actionsRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          label: firstString(row.label, row.action),
          owner: firstString(row.owner, row.team, "—"),
          urgent: Boolean(row.urgent),
        };
      })
    : buildInvoiceDetailFromContext(context, jobDetail, document).followUpActions;

  const statusText =
    firstString(data.status_text, data.statusText) ||
    (overdueDays > 0 ? `Overdue ${overdueDays} days` : `Due in 5 days`);
  const statusToneRaw = firstString(data.status_tone, data.statusTone).toLowerCase();
  const statusTone =
    statusToneRaw === "bad" || statusToneRaw === "warn"
      ? statusToneRaw
      : overdueDays > 0
        ? "bad"
        : "ok";

  return {
    invoiceId: firstString(data.invoice_id, data.invoiceId, context.invoiceId),
    customer: firstString(data.customer, data.customer_name, context.customer),
    jobRef: firstString(data.job_ref, data.job_id, data.jobRef, context.jobId),
    branch: {
      code: branchCode,
      label: firstString(
        (data.branch as Record<string, unknown> | undefined)?.label,
        branchLabel(branchCode),
      ),
    },
    terms: firstString(data.terms, "Net 30"),
    currency: firstString(data.currency, "INR"),
    isPayable,
    receivableLabel: isPayable ? "Payable" : "Receivable",
    balanceL,
    grossAmountL: grossL,
    paidL,
    invoiceDate,
    dueDate,
    statusText,
    statusTone,
    chargeLines,
    subtotalInr,
    gstInr,
    totalInr,
    gstPct,
    timeline,
    followUpActions,
  };
}

export function branchChipDotColor(code: string): string {
  return branchDotColor(code);
}

export function formatInrAmount(value: number): string {
  return formatInrFull(value);
}
