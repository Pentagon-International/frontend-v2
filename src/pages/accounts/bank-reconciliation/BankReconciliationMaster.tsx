import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ActionIcon,
  Box,
  Button,
  Grid,
  MantineProvider,
  Select,
  TextInput,
} from "@mantine/core";
import {
  IconBuildingBank,
  IconCircleCheck,
  IconClock,
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableEmpty,
  SingleDateInput,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistRootTypography,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import FormTextInput from "../../../components/FormTextInput";

type Filters = {
  brs_no: string;
  bank_account_code: string;
  date_from: Date | null;
  date_to: Date | null;
  status: "" | "POSTED" | "UNPOSTED";
};

const DEFAULT_FILTERS: Filters = {
  brs_no: "",
  bank_account_code: "",
  date_from: null,
  date_to: null,
  status: "",
};

export default function BankReconciliationMaster() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  const erpTheme: ErpListTheme = {
    border,
    muted,
    fg,
    primary,
    headerBg: "#f8fafc",
    pageBg: "#F0F4F8",
    cardBg: "#ffffff",
    fontSans: "'Geist', sans-serif",
  };
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSearch("");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setShowFilters(false);
  };

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (appliedFilters.brs_no.trim()) parts.push(`BRS: ${appliedFilters.brs_no}`);
    if (appliedFilters.bank_account_code.trim())
      parts.push(`Bank: ${appliedFilters.bank_account_code}`);
    if (appliedFilters.status) parts.push(appliedFilters.status);
    return parts;
  }, [appliedFilters]);

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{
          ...erpListGeistRootTypography,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ERPListScreen
          theme={erpTheme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconBuildingBank size={14} color={primary} />}
                  value={0}
                  label="Total"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={0}
                  label="Posted"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconClock size={14} color="#d97706" />}
                  iconBackground="#fef3c7"
                  iconColor="#d97706"
                  value={0}
                  label="Unposted"
                />
              </>
            ),
            actions: (
              <>
                <TextInput
                  placeholder="Search…"
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    ) : null
                  }
                  w={260}
                  size="xs"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={{
                    input: {
                      fontFamily: erpTheme.fontSans,
                      fontSize: 12,
                      height: 32,
                      borderColor: border,
                    },
                  }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                  onClick={() => navigate("/bank-reconciliation/create")}
                >
                  Create New
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine by BRS no., bank account, date range, or status",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applyFilters}
              />
            ),
            children: (
              <Grid gutter="sm">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN} style={erpListFilterFieldCellStyle}>
                  <FormTextInput
                    label="BRS No"
                    placeholder="BRS number"
                    value={draftFilters.brs_no}
                    onChange={(e) =>
                      setDraftFilters((f) => ({
                        ...f,
                        brs_no: e.currentTarget.value,
                      }))
                    }
                    styles={filterFieldStyles}
                  />
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN} style={erpListFilterFieldCellStyle}>
                  <FormTextInput
                    label="Bank Account Code"
                    placeholder="Bank account code"
                    value={draftFilters.bank_account_code}
                    onChange={(e) =>
                      setDraftFilters((f) => ({
                        ...f,
                        bank_account_code: e.currentTarget.value,
                      }))
                    }
                    styles={filterFieldStyles}
                  />
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN} style={erpListFilterFieldCellStyle}>
                  <SingleDateInput
                    label="Date From"
                    value={draftFilters.date_from}
                    onChange={(date) =>
                      setDraftFilters((f) => ({ ...f, date_from: date }))
                    }
                    styles={filterFieldStyles}
                  />
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN} style={erpListFilterFieldCellStyle}>
                  <SingleDateInput
                    label="Date To"
                    value={draftFilters.date_to}
                    onChange={(date) =>
                      setDraftFilters((f) => ({ ...f, date_to: date }))
                    }
                    styles={filterFieldStyles}
                  />
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN} style={erpListFilterFieldCellStyle}>
                  <Select
                    label="Status"
                    placeholder="All"
                    clearable
                    data={[
                      { value: "POSTED", label: "Posted" },
                      { value: "UNPOSTED", label: "Unposted" },
                    ]}
                    value={draftFilters.status || null}
                    onChange={(v) =>
                      setDraftFilters((f) => ({
                        ...f,
                        status: (v as Filters["status"]) || "",
                      }))
                    }
                    styles={filterFieldStyles}
                  />
                </Grid.Col>
              </Grid>
            ),
          }}
          table={{
            emptyMessage: filterSummary.length
              ? `No bank reconciliations match ${filterSummary.join(", ")}`
              : "No bank reconciliations yet. Create one to get started.",
            loading: false,
            children: (
              <Box
                style={{
                  flex: 1,
                  minHeight: 280,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ERPListTableEmpty
                  theme={erpTheme}
                  icon={<IconBuildingBank size={24} color={muted} />}
                  title={
                    search.trim() || filterSummary.length
                      ? "No records found"
                      : "No bank reconciliations yet"
                  }
                  hint={
                    search.trim() || filterSummary.length
                      ? "Try adjusting your search or filters"
                      : "API integration pending — click Create New to open the form"
                  }
                />
              </Box>
            ),
          }}
          footer={
            <ERPListPaginationFooter
              theme={erpTheme}
              pageIndex={pagination.pageIndex}
              pageSize={pagination.pageSize}
              totalRecords={0}
              onPageIndexChange={(pageIndex) =>
                setPagination((p) => ({ ...p, pageIndex }))
              }
              onPageSizeChange={(pageSize) =>
                setPagination({ pageIndex: 0, pageSize })
              }
            />
          }
        />
      </Box>
    </MantineProvider>
  );
}
