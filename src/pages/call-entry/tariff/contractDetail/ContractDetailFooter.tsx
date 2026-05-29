import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ToastNotification } from "../../../../components";
import type { ContractDetailResponse } from "./types";
import {
  CONTRACT_EDIT_STATE_KEY,
  stashContractForEdit,
} from "./contractEditSession";

type ContractDetailFooterProps = {
  rateLineCount: number;
  surchargeCount: number;
  isEditable?: boolean;
  onClose: () => void;
};

export default function ContractDetailFooter({
  rateLineCount,
  surchargeCount,
  isEditable,
  onClose,
}: ContractDetailFooterProps) {
  const navigate = useNavigate();
  const { carrierCode = "", service = "" } = useParams<{
    carrierCode: string;
    service: string;
  }>();
  const queryClient = useQueryClient();

  const handleEdit = () => {
    const detail = queryClient.getQueryData<ContractDetailResponse>([
      "contract-detail",
      carrierCode,
      service,
    ]);

    if (!detail?.contract_basics) {
      ToastNotification({
        type: "error",
        message: "Unable to load contract details for editing.",
      });
      return;
    }

    stashContractForEdit(detail);
    navigate("/tariff/contracts/create", {
      state: {
        [CONTRACT_EDIT_STATE_KEY]: detail,
      },
    });
  };

  return (
    <div className="contract-detail-footer">
      <div className="contract-detail-footer-checks">
        <span className={rateLineCount > 0 ? "ok" : ""}>
          {rateLineCount > 0 ? "✓" : "○"} {rateLineCount} rate lines
        </span>
        <span className={surchargeCount > 0 ? "ok" : ""}>
          {surchargeCount > 0 ? "✓" : "○"} {surchargeCount} surcharges
        </span>
      </div>
      <div className="contract-detail-footer-actions">
        <button type="button" className="contract-detail-outline-btn" onClick={onClose}>
          Close
        </button>
        {/* <button type="button" className="contract-detail-outline-btn" disabled={!isEditable}>
          Upload rate sheet
        </button>
        <button type="button" className="contract-detail-outline-btn">
          Export PDF
        </button> */}
        <button
          type="button"
          className="contract-detail-primary-btn"
          disabled={!isEditable}
          onClick={handleEdit}
          style={{marginRight:"50px"}}
        >
          Edit contract
        </button>
        {/* <button type="button" className="contract-detail-danger-btn" disabled={!isEditable}>
          Suspend
        </button> */}
      </div>
    </div>
  );
}
