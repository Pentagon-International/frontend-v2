import { useState } from "react";
import {
  Box,
  Button,
  Center,
  Flex,
  Grid,
  Group,
  Loader,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { SearchableSelect, ToastNotification } from "../../../components";

type CoaItem = {
  id?: number;
  gl_account_code?: string;
  sl_code?: string;
  account_name?: string;
};

type DocumentAllocationRow = {
  document_type?: string | null;
  document_no?: string | null;
  document_date?: string | null;
  day_book_code?: string | null;
  location?: string | null;
  currency_code?: string | null;
  amount?: number | null;
  local_amount?: number | null;
  balance?: number | null;
};

type DocumentAllocationResponse = {
  data?: DocumentAllocationRow[];
};

/** Editable field styling (aligned with PipelineCreate SearchableSelect / TextInput) */
const fieldInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
  },
};

/** Read-only display fields (aligned with PipelineCreate profile readOnly TextInput) */
const readOnlyInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
    backgroundColor: "#f8f9fa",
    cursor: "not-allowed",
  },
};

const formatAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fetchDocumentAllocation = async (payload: {
  account_code: string;
  sl_code: string;
}): Promise<DocumentAllocationResponse> => {
  try {
    const response = await postAPICall(
      URL.documentAllocation,
      { filters: payload },
      API_HEADER,
    );
    return (response as DocumentAllocationResponse) ?? {};
  } catch (error) {
    console.error("Error fetching document allocation:", error);
    throw error;
  }
};

export default function DocumentAllocation() {
  const navigate = useNavigate();
  const [selectedAccount, setSelectedAccount] = useState<CoaItem | null>(null);
  const [rows, setRows] = useState<DocumentAllocationRow[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const selectedGlAccountCode = selectedAccount?.gl_account_code ?? "";
  const selectedSlCode = selectedAccount?.sl_code ?? "";

  const handleGet = async () => {
    if (!selectedAccount || !selectedGlAccountCode || !selectedSlCode) {
      ToastNotification({
        type: "error",
        message: "Please select an Account Name before fetching.",
      });
      return;
    }

    setIsFetching(true);
    try {
      const res = await fetchDocumentAllocation({
        account_code: selectedGlAccountCode,
        sl_code: selectedSlCode,
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list);
      if (list.length === 0) {
        ToastNotification({
          type: "info",
          message: "No documents found for the selected account.",
        });
      }
    } catch {
      ToastNotification({
        type: "error",
        message: "Failed to fetch document allocation data.",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleBack = () => {
    const historyLength = window.history.length;
    if (historyLength > 1) {
      navigate(-1);
    } else {
      navigate("/accounts");
    }
  };

  return (
    <Box
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {isFetching && (
        <Center
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 255, 255, 0.65)",
            zIndex: 15,
          }}
        >
          <Loader color="#105476" size="lg" />
        </Center>
      )}

      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Title sidebar — same pattern as PipelineCreate */}
          <Box
            style={{
              minWidth: 180,
              width: "100%",
              maxWidth: 220,
              height: "100%",
              alignSelf: "stretch",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
              position: "sticky",
              top: 0,
            }}
          >
            <Box
              style={{
                padding: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                size="md"
                fw={600}
                c="#105476"
                style={{
                  fontFamily: "Inter",
                  fontSize: "16px",
                  color: "#105476",
                  textAlign: "center",
                }}
              >
                Document Allocation
              </Text>
            </Box>
          </Box>

          {/* Main content — PipelineCreate main column */}
          <Box
            style={{
              flex: 1,
              width: "100%",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              gap: "8px",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                borderRadius: "8px",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Grid style={{ padding: "24px" }}>
                <Grid.Col span={12}>
                  <Text
                    fw={600}
                    c="#105476"
                    size="sm"
                    mb="md"
                    style={{ fontFamily: "Inter" }}
                  >
                    Selection
                  </Text>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6, md: 5 }}>
                  <SearchableSelect
                    label="Account Name"
                    placeholder="Search by account name"
                    apiEndpoint={URL.chartOfAccounts}
                    value={
                      selectedAccount ? String(selectedAccount.id ?? "") : null
                    }
                    dropdownZIndex={1100}
                    minSearchLength={1}
                    searchFields={["gl_account_code", "account_name", "id"]}
                    displayFormat={(item: Record<string, unknown>) => {
                      const id = String(item.id ?? "").trim();
                      const gl = String(item.gl_account_code ?? "").trim();
                      const name = String(item.account_name ?? "").trim();
                      return {
                        value: id,
                        label: name ? `${name}${gl ? ` - ${gl}` : ""}` : gl,
                      };
                    }}
                    displayValue={selectedAccount?.account_name ?? ""}
                    returnOriginalData
                    onChange={(value, _selectedData, originalData) => {
                      if (!value || !originalData) {
                        setSelectedAccount(null);
                        return;
                      }

                      const nextGl = originalData.gl_account_code;
                      const nextSl = originalData.sl_code;
                      const nextName = originalData.account_name;

                      setSelectedAccount({
                        id:
                          originalData.id !== undefined &&
                          originalData.id !== null
                            ? Number(originalData.id)
                            : undefined,
                        gl_account_code:
                          nextGl !== undefined && nextGl !== null
                            ? String(nextGl)
                            : undefined,
                        sl_code:
                          nextSl !== undefined && nextSl !== null
                            ? String(nextSl)
                            : undefined,
                        account_name:
                          nextName !== undefined && nextName !== null
                            ? String(nextName)
                            : undefined,
                      });
                    }}
                    styles={{
                      input: fieldInputStyles.input,
                      label: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        marginBottom: "4px",
                      },
                    }}
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
                  <TextInput
                    label="SL Code"
                    placeholder="SL Code"
                    value={selectedSlCode}
                    readOnly
                    styles={readOnlyInputStyles}
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 2, md: 2 }}>
                  <Box pt={22}>
                    <Button
                      fullWidth
                      size="sm"
                      leftSection={<IconSearch size={16} />}
                      onClick={handleGet}
                      disabled={isFetching}
                      style={{
                        backgroundColor: "#105476",
                        fontSize: "13px",
                        fontFamily: "Inter",
                      }}
                    >
                      Get
                    </Button>
                  </Box>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Text
                    fw={600}
                    c="#105476"
                    size="sm"
                    mt="lg"
                    mb="md"
                    style={{ fontFamily: "Inter" }}
                  >
                    Invoice / Receipt Details
                  </Text>
                </Grid.Col>

                {rows.length === 0 ? (
                  <Grid.Col span={12}>
                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      No data to display. Select an account and click Get.
                    </Text>
                  </Grid.Col>
                ) : (
                  rows.map((row, index) => (
                    <Grid.Col span={12} key={index}>
                      <Box
                        mb="md"
                        p="md"
                        style={{
                          border: "1px solid #dee2e6",
                          borderRadius: "8px",
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        <Text
                          fw={600}
                          c="#105476"
                          size="sm"
                          mb="md"
                          style={{
                            fontFamily: "Inter",
                            borderBottom: "2px solid #105476",
                            paddingBottom: "4px",
                            display: "inline-block",
                          }}
                        >
                          {row.document_type
                            ? `${row.document_type}${row.document_no ? ` — ${row.document_no}` : ""}`
                            : `Document ${index + 1}`}
                        </Text>
                        <Grid gutter="sm">
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Type"
                              value={row.document_type ?? ""}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Doc No"
                              value={row.document_no ?? ""}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Doc Date"
                              value={row.document_date ?? ""}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Day Book"
                              value={row.day_book_code ?? ""}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Location"
                              value={row.location ?? ""}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Currency"
                              value={row.currency_code ?? ""}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Amount"
                              value={formatAmount(row.amount)}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Local Amount"
                              value={formatAmount(row.local_amount)}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                            <TextInput
                              label="Balance"
                              value={formatAmount(row.balance)}
                              readOnly
                              styles={readOnlyInputStyles}
                            />
                          </Grid.Col>
                        </Grid>
                      </Box>
                    </Grid.Col>
                  ))
                )}
              </Grid>
            </Box>

            {/* Footer — PipelineCreate Cancel / Back pattern */}
            <Box
              style={{
                padding: "20px 32px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
              }}
            >
              <Group justify="space-between">
                <Button
                  variant="outline"
                  color="gray"
                  size="sm"
                  styles={{
                    root: {
                      borderColor: "#d0d0d0",
                      color: "#666",
                      fontSize: "13px",
                      fontFamily: "Inter",
                    },
                  }}
                  onClick={handleBack}
                >
                  Back
                </Button>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
