import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader } from "@mantine/core";
import { fetchContractDetail } from "./contractDetail/api";
import ContractDetailHeader from "./contractDetail/ContractDetailHeader";
import ContractDetailSummaryCards from "./contractDetail/ContractDetailSummaryCards";
import ContractTermsPanel from "./contractDetail/ContractTermsPanel";
import ContractRateLinesSection from "./contractDetail/ContractRateLinesSection";
import ContractSurchargesSection from "./contractDetail/ContractSurchargesSection";
import ContractAuditSection from "./contractDetail/ContractAuditSection";
import ContractVendorSection from "./contractDetail/ContractVendorSection";
import ContractDetailFooter from "./contractDetail/ContractDetailFooter";
import {
  buildAuditHistory,
  formatApiDateTime,
  getContractDisplayId,
} from "./contractDetail/utils";
import "./contractDetail/contractDetail.css";

export default function TariffContractsDetail() {
  const navigate = useNavigate();
  const { carrierCode = "", service = "" } = useParams<{
    carrierCode: string;
    service: string;
  }>();

  const closeDetail = () => navigate("/tariff/contracts");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["contract-detail", carrierCode, service],
    queryFn: () => fetchContractDetail(carrierCode, service),
    enabled: Boolean(carrierCode && service),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (!carrierCode || !service) return null;

  return (
    <>
      <button
        type="button"
        className="contract-detail-backdrop"
        aria-label="Close contract detail"
        onClick={closeDetail}
      />
      <aside className="contract-detail-panel-shell" aria-label="Contract detail">
        {isLoading ? (
          <div className="contract-detail-state">
            <Loader size="sm" color="#0b1f3a" />
          </div>
        ) : isError || !data?.contract_basics ? (
          <div className="contract-detail-state error">
            <ContractDetailHeader
              contractId="—"
              basics={{
                carrier_code: carrierCode,
                carrier_name: "—",
                vendor_reference: "—",
                service,
                coverage_description: "",
                currency_code: "",
                valid_from: "",
                valid_to: "",
                status: "UNKNOWN",
                country_code: "",
                auto_renew: false,
                auto_renew_days: null,
                created_by: "",
                approved_by: null,
              }}
              onClose={closeDetail}
            />
            <p>{(error as Error)?.message || "Unable to load contract detail."}</p>
          </div>
        ) : (
          <>
            <div className="contract-detail-scroll">
              <ContractDetailHeader
                contractId={getContractDisplayId(data)}
                basics={data.contract_basics}
                createdAt={data.created_at}
                updatedAt={data.updated_at}
                updatedBy={
                  data.updated_by ||
                  data.updated_by_name ||
                  data.contract_basics?.updated_by ||
                  data.contract_basics?.updated_by_name
                }
                onClose={closeDetail}
              />

              <ContractDetailSummaryCards data={data} />

              <div className="contract-detail-two-col">
                <ContractTermsPanel basics={data.contract_basics} />
                <ContractVendorSection
                  basics={data.contract_basics}
                  rateLineCount={data.rate_sheet.length}
                  laneCount={data.rate_sheet_summary.lane_count}
                  surchargeCount={data.surcharges_summary.applied_count}
                  updatedAtLabel={formatApiDateTime(data.updated_at)}
                />
              </div>

              <ContractRateLinesSection
                lines={data.rate_sheet}
                basics={data.contract_basics}
              />

              <ContractSurchargesSection
                surcharges={data.surcharges}
                appliedCount={data.surcharges_summary.applied_count}
                totalRows={data.surcharges_summary.total_rows}
              />

              {/* {data.internal_notes ? (
                <section className="contract-detail-section">
                  <div className="contract-detail-section-head">
                    <div>
                      <h3>Internal notes</h3>
                    </div>
                  </div>
                  <div className="contract-detail-notes">{data.internal_notes}</div>
                </section>
              ) : null} */}

              <div className="contract-detail-two-col">
                <ContractAuditSection items={buildAuditHistory(data)} />
              </div>
            </div>

            <ContractDetailFooter
              rateLineCount={data.rate_sheet.length}
              surchargeCount={data.surcharges_summary.applied_count}
              isEditable={data.is_editable}
              onClose={closeDetail}
            />
          </>
        )}
      </aside>
    </>
  );
}
