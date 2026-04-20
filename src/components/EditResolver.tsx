import { Box, Flex, Loader, Text } from "@mantine/core";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import ToastNotification from "./ToastNotification";

type ResolverState = {
  id?: string | number | null;
  module?: string | null;
  sub_module?: string | null;
  display_id?: string | null;
  api_endpoint?: string | null;
  filter_id_key?: string | null;
  actionType?: string;
  fromGlobalSearch?: boolean;
  globalSearchResolved?: boolean;
};

type EditResolverProps = {
  children: ReactNode;
};

const moduleToDetailEndpoint = (
  module: string,
  _subModule: string | null,
  recordId: string,
) => {
  switch (module) {
    case "enquiry":
      return `${URL.enquiry}${recordId}/`;
    case "quotation":
      return `${URL.quotation}${recordId}/`;
    case "booking":
      return `${URL.booking}${recordId}/`;
    case "job":
      return `${URL.jobCreate}${recordId}/`;
    case "invoice":
      return `${URL.invoice}${recordId}/`;
    case "journal_voucher":
      return `${URL.journalVoucher}${recordId}/`;
    case "receipt":
      return `${URL.receipt}${recordId}/`;
    case "reverse_receipt":
      return `${URL.reverseReceipt}${recordId}/`;
    case "overseas_receipt":
      return `${URL.receipt}${recordId}/`;
    case "supplier_invoice":
      return `${URL.supplierInvoice}${recordId}/`;
    case "reverse_supplier_invoice":
      return `${URL.reverseSupplierInvoice}${recordId}/`;
    case "payment":
      return `${URL.payment}${recordId}/`;
    case "reverse_payment":
      return `${URL.reversePayment}${recordId}/`;
    case "overseas_payment":
      return `${URL.payment}${recordId}/`;
    default:
      return null;
  }
};

function EditResolver({ children }: EditResolverProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as ResolverState | null) ?? null;
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const shouldResolve = useMemo(() => {
    return Boolean(state?.fromGlobalSearch && !state?.globalSearchResolved);
  }, [state]);

  useEffect(() => {
    if (!shouldResolve) {
      setStatus("idle");
      return;
    }

    const recordId = String(state?.id ?? "").trim();
    const module = String(state?.module ?? "").trim();
    const subModule = state?.sub_module ?? null;

    if (!recordId || !module) {
      console.warn("[EditResolver] Missing resolver metadata", state);
      setStatus("error");
      return;
    }

    const endpoint = moduleToDetailEndpoint(module, subModule, recordId);
    if (!endpoint) {
      console.warn("[EditResolver] Unsupported module", {
        module,
        subModule,
        state,
      });
      setStatus("error");
      ToastNotification({
        type: "warning",
        message: `Global search is not configured for module "${module}".`,
      });
      return;
    }

    let isMounted = true;

    const resolveRecord = async () => {
      try {
        setStatus("loading");
        console.log("[EditResolver] start", {
          pathname: location.pathname,
          module,
          sub_module: subModule,
          id: recordId,
          api_endpoint: state?.api_endpoint ?? null,
          filter_id_key: state?.filter_id_key ?? null,
          detailEndpoint: endpoint,
        });

        const response = await apiCallProtected.get(endpoint);
        const rawData = (response as { data?: unknown })?.data ?? response;
        const resolvedRecord =
          rawData &&
          typeof rawData === "object" &&
          "data" in (rawData as Record<string, unknown>) &&
          (rawData as { data?: unknown }).data &&
          typeof (rawData as { data?: unknown }).data === "object"
            ? ((rawData as { data?: Record<string, unknown> }).data ?? null)
            : rawData && typeof rawData === "object"
              ? (rawData as Record<string, unknown>)
              : null;

        if (!resolvedRecord || typeof resolvedRecord !== "object") {
          throw new Error("Resolver did not receive an object payload.");
        }

        console.log("[EditResolver] fetched record", {
          pathname: location.pathname,
          module,
          id: recordId,
          keys: Object.keys(resolvedRecord).slice(0, 30),
        });

        if (!isMounted) return;

        navigate(location.pathname, {
          replace: true,
          state: {
            ...(resolvedRecord as Record<string, unknown>),
            actionType: state?.actionType ?? "edit",
            fromGlobalSearch: true,
            globalSearchResolved: true,
            globalSearchMeta: {
              id: recordId,
              module,
              sub_module: subModule,
              display_id: state?.display_id ?? null,
              api_endpoint: state?.api_endpoint ?? null,
              filter_id_key: state?.filter_id_key ?? null,
            },
          },
        });
      } catch (error) {
        console.error("[EditResolver] failed", error);
        if (!isMounted) return;
        setStatus("error");
        ToastNotification({
          type: "error",
          message: "Failed to load record details from global search.",
        });
      }
    };

    void resolveRecord();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, navigate, shouldResolve, state]);

  if (!shouldResolve) return <>{children}</>;

  if (status === "error") {
    return (
      <Flex justify="center" align="center" mih={240}>
        <Box>
          <Text fw={600}>Unable to load record details.</Text>
          <Text size="sm" c="dimmed">
            Check the console logs for `EditResolver` details.
          </Text>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex justify="center" align="center" mih={240} direction="column" gap="sm">
      <Loader size="lg" />
      <Text size="sm" c="dimmed">
        Loading record details...
      </Text>
    </Flex>
  );
}

export default EditResolver;
