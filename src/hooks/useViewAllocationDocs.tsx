import { useCallback, useMemo, useState } from "react";
import {
  Anchor,
  Box,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { postAPICall } from "../service/postApiCall";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { ToastNotification } from "../components";
import { openAllocationSourceDocumentInNewTab } from "../utils/openAllocationSourceDocument";

export type AllocationByDocumentRow = {
  document_no?: string;
  source_no?: string;
  source?: string;
  source_date?: string;
  currency?: string;
  amount?: string | number;
  local_amount?: string | number;
};

type AllocationsByDocumentResponse = {
  status?: boolean;
  message?: string;
  document_no?: string;
  total?: number;
  data?: AllocationByDocumentRow[];
};

function formatAmount(value: string | number | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  // Already DD/MM/YYYY or similar display form
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function useViewAllocationDocs() {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingDoc, setOpeningDoc] = useState(false);
  const [rows, setRows] = useState<AllocationByDocumentRow[]>([]);
  const [queriedDocumentNo, setQueriedDocumentNo] = useState("");

  const openViewAllocationDocs = useCallback(async (documentNo: string) => {
    const trimmed = documentNo.trim();
    if (!trimmed) {
      ToastNotification({
        type: "warning",
        message: "Document number is not available.",
      });
      return;
    }

    setLoading(true);
    setQueriedDocumentNo(trimmed);
    try {
      const axiosRes = (await postAPICall(
        URL.allocationsByDocument,
        { document_no: trimmed },
        API_HEADER,
      )) as { data?: AllocationsByDocumentResponse } | AllocationsByDocumentResponse;

      const body =
        axiosRes &&
        typeof axiosRes === "object" &&
        "data" in axiosRes &&
        axiosRes.data &&
        typeof axiosRes.data === "object" &&
        ("data" in axiosRes.data || "status" in axiosRes.data)
          ? (axiosRes.data as AllocationsByDocumentResponse)
          : (axiosRes as AllocationsByDocumentResponse);

      const list = Array.isArray(body?.data) ? body.data : [];
      setRows(list);
      setOpened(true);
    } catch (e) {
      console.error("Failed to fetch allocations by document", e);
      ToastNotification({
        type: "error",
        message: "Failed to load allocation documents.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenSource = useCallback(async (row: AllocationByDocumentRow) => {
    const sourceNo = String(row.source_no ?? "").trim();
    if (!sourceNo) return;
    setOpeningDoc(true);
    try {
      await openAllocationSourceDocumentInNewTab(sourceNo, row.source);
    } finally {
      setOpeningDoc(false);
    }
  }, []);

  const viewAllocationDocsUi = useMemo(
    () => (
      <>
        {loading && (
          <Box
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
          >
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text size="sm" c="#105476" fw={500}>
                Loading allocation documents…
              </Text>
            </Stack>
          </Box>
        )}

        <Modal
          opened={opened}
          onClose={() => setOpened(false)}
          title={
            <Text fw={600} c="#105476">
              Allocation Documents
              {queriedDocumentNo ? ` — ${queriedDocumentNo}` : ""}
            </Text>
          }
          size="90%"
          centered
          styles={{
            content: { maxWidth: "1100px" },
            body: { position: "relative" },
          }}
        >
          {openingDoc && (
            <Box
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255,255,255,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <GroupLoader />
            </Box>
          )}

          {rows.length === 0 ? (
            <Text size="sm" c="dimmed" py="md">
              No posted allocations found for this document.
            </Text>
          ) : (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Document No</Table.Th>
                  <Table.Th>Doc Type</Table.Th>
                  <Table.Th>Doc Date</Table.Th>
                  <Table.Th>Currency</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Local Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, idx) => {
                  const sourceNo = String(row.source_no ?? "").trim();
                  return (
                    <Table.Tr
                      key={`${sourceNo}-${row.source ?? ""}-${idx}`}
                    >
                      <Table.Td>
                        {sourceNo ? (
                          <Anchor
                            component="button"
                            type="button"
                            c="#105476"
                            fw={600}
                            underline="always"
                            onClick={() => void handleOpenSource(row)}
                            style={{ fontSize: 13 }}
                          >
                            {sourceNo}
                          </Anchor>
                        ) : (
                          "—"
                        )}
                      </Table.Td>
                      <Table.Td>{row.source?.trim() || "—"}</Table.Td>
                      <Table.Td>{formatDate(row.source_date)}</Table.Td>
                      <Table.Td>{row.currency?.trim() || "—"}</Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        {formatAmount(row.amount)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        {formatAmount(row.local_amount)}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Modal>
      </>
    ),
    [
      handleOpenSource,
      loading,
      opened,
      openingDoc,
      queriedDocumentNo,
      rows,
    ],
  );

  return {
    openViewAllocationDocs,
    viewAllocationDocsUi,
    isLoadingAllocationDocs: loading,
  };
}

function GroupLoader() {
  return (
    <Stack align="center" gap="sm">
      <Loader size="sm" color="#105476" />
      <Text size="sm" c="#105476" fw={600}>
        Opening document…
      </Text>
    </Stack>
  );
}
