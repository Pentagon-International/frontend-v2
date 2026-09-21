import JobProfitVerificationMaster from "./JobProfitVerificationMaster";

/** Hold-only approval list — gated by screen_permissions.job_profit_approval. */
export default function JobProfitVerificationApprovalMaster() {
  return <JobProfitVerificationMaster mode="approval" />;
}
