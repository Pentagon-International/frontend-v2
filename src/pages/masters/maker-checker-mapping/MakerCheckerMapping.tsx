import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from "mantine-react-table";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  Menu,
  MultiSelect,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { Dropdown, SearchableSelect } from "../../../components";
import {
  buildMakerCheckerFilterPayload,
  documentTypeCodesLabel,
  fetchBranchMasterOptions,
  fetchDocumentTypeMasterIdOptions,
  formatUserMasterSelectOption,
  type MakerCheckerListFilters,
  type MakerCheckerMappingRecord,
} from "./makerCheckerMappingShared";

type MakerCheckerMappingRow = MakerCheckerMappingRecord;

type MakerCheckerFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  data?: MakerCheckerMappingRow[];
};

const DEFAULT_FILTERS: MakerCheckerListFilters = {
  maker_id: "",
  checker_id: "",
  document_type_ids: [],
  branch_code: "",
};

export default function MakerCheckerMapping() {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [draftFilters, setDraftFilters] =
    useState<MakerCheckerListFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<MakerCheckerListFilters>(DEFAULT_FILTERS);

  const currentPage = pagination.pageIndex + 1;

  const { data: docTypeOptions = [], isLoading: docTypesLoading } = useQuery({
    queryKey: ["documentTypeMasterIdOptions"],
    queryFn: fetchDocumentTypeMasterIdOptions,
    staleTime: Infinity,
  });

  const { data: branchOptions = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branchMasterOptions"],
    queryFn: fetchBranchMasterOptions,
    staleTime: Infinity,
  });

  const docTypeSelectData = useMemo(
    () => docTypeOptions.map((opt) => ({ value: opt.value, label: opt.label })),
    [docTypeOptions],
  );

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, appliedFilters]);

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSearch("");
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const {
    data: tableRows = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: [
      "maker-checker-master",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      const index = pagination.pageIndex * pagination.pageSize;
      const payload = buildMakerCheckerFilterPayload(
        appliedFilters,
        debouncedSearch,
      );

      const response = (await apiCallProtected.post(
        `${URL.makerCheckerMasterFilter}?index=${index}&limit=${pagination.pageSize}`,
        payload,
      )) as MakerCheckerFilterResponse;

      const rows = Array.isArray(response?.data) ? response.data : [];
      setTotalRecords(response?.total ?? rows.length);
      return rows;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });

  const columns = useMemo<MRT_ColumnDef<MakerCheckerMappingRow>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "maker_name",
        header: "Maker",
        size: 200,
      },
      {
        accessorKey: "checker_name",
        header: "Checker",
        size: 200,
      },
      {
        id: "document_types",
        header: "Doc Type",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: "Inter" }}>
            {documentTypeCodesLabel(row.original)}
          </Text>
        ),
      },
      {
        accessorKey: "limit_amount",
        header: "Limit",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: "Inter" }}>
            {row.original.limit_amount != null &&
            String(row.original.limit_amount).trim() !== ""
              ? String(row.original.limit_amount)
              : "-"}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate(
                      `/master/maker-checker-mapping/edit/${row.original.id}`,
                      { state: row.original },
                    )
                  }
                >
                  <Group gap="sm">
                    <IconEdit size={16} color="#105476" />
                    <Text size="sm" style={{ fontFamily: "Inter" }}>
                      Edit
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate],
  );

  const table = useMantineReactTable({
    columns,
    data: tableRows,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableSorting: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    mantineTableProps: {
      highlightOnHover: true,
      withTableBorder: false,
    },
    mantineTableHeadCellProps: {
      style: {
        fontFamily: "Inter",
        fontSize: "12px",
        fontWeight: 600,
        color: "#475569",
        backgroundColor: "#F8FAFC",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        fontFamily: "Inter",
        fontSize: "13px",
        color: "#334155",
      },
    },
  });

  const listLoading = isLoading || isFetching;

  return (
    <Card
      shadow="sm"
      pt="md"
      pb="sm"
      px="md"
      radius="md"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <Box>
        <Group justify="space-between" align="center" pb="sm">
          <Text
            size="md"
            fw={600}
            c="#1E293B"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Maker & Checker Mapping
          </Text>

          <Group gap="xs" wrap="nowrap">
            <TextInput
              placeholder="Search..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                search ? (
                  <ActionIcon
                    variant="transparent"
                    size="sm"
                    onClick={() => setSearch("")}
                    style={{ cursor: "pointer" }}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                ) : null
              }
              w={248}
              size="sm"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              styles={{
                input: {
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  color: "#334155",
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  "&:focus": {
                    border: "1px solid #105476",
                  },
                },
              }}
            />
            <ActionIcon
              variant={showFilters ? "filled" : "outline"}
              size={36}
              color={showFilters ? "#E0F5FF" : "gray"}
              onClick={() => setShowFilters(!showFilters)}
              styles={{
                root: {
                  borderRadius: "4px",
                  backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                  border: showFilters
                    ? "1px solid #105476"
                    : "1px solid #737780",
                  color: showFilters ? "#105476" : "#737780",
                },
              }}
            >
              <IconFilter size={18} />
            </ActionIcon>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              styles={{
                root: {
                  backgroundColor: "#105476",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  "&:hover": {
                    backgroundColor: "#105476",
                  },
                },
              }}
              onClick={() => navigate("/master/maker-checker-mapping/create")}
            >
              Create New
            </Button>
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box
          mb="sm"
          p="sm"
          style={{
            borderRadius: "8px",
            border: "1px solid #E0E0E0",
            flexShrink: 0,
          }}
        >
          <Group
            justify="space-between"
            align="center"
            mb="sm"
            px="md"
            style={{ backgroundColor: "#F8FAFC", padding: "4px 8px" }}
          >
            <Text
              size="sm"
              fw={600}
              c="#1E293B"
              style={{ fontFamily: "Inter", fontSize: "14px" }}
            >
              Filter
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setShowFilters(false)}
              aria-label="Close filters"
              size="sm"
            >
              <IconX size={18} />
            </ActionIcon>
          </Group>

          <Grid gutter="sm" px="md" pt="xs" pb="sm">
            <Grid.Col span={2.4}>
              <SearchableSelect
                size="xs"
                label="Maker"
                placeholder="Search maker..."
                apiEndpoint={URL.user}
                searchFields={["user_name", "employee_id", "emp_name"]}
                displayFormat={formatUserMasterSelectOption}
                value={draftFilters.maker_id || null}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    maker_id: val || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                size="xs"
                label="Checker"
                placeholder="Search checker..."
                apiEndpoint={URL.user}
                searchFields={["user_name", "employee_id", "emp_name"]}
                displayFormat={formatUserMasterSelectOption}
                value={draftFilters.checker_id || null}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    checker_id: val || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <MultiSelect
                size="xs"
                label="Doc Type"
                placeholder={
                  docTypesLoading ? "Loading..." : "Select doc type(s)"
                }
                data={docTypeSelectData}
                value={draftFilters.document_type_ids}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    document_type_ids: value,
                  }))
                }
                searchable
                clearable
                disabled={docTypesLoading}
                styles={{
                  label: {
                    fontSize: "12px",
                    fontFamily: "Inter",
                    fontWeight: 500,
                  },
                }}
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Branch"
                placeholder={
                  branchesLoading ? "Loading..." : "Select branch"
                }
                data={branchOptions}
                value={draftFilters.branch_code || null}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    branch_code: val || "",
                  }))
                }
                clearable
                disabled={branchesLoading}
                dropdownZIndex={1000}
                styles={{
                  label: {
                    fontSize: "12px",
                    fontFamily: "Inter",
                    fontWeight: 500,
                  },
                }}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
            <Button
              size="sm"
              variant="default"
              onClick={clearAllFilters}
              leftSection={<IconX size={16} />}
              styles={{
                root: {
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 600,
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  color: "#1E293B",
                },
              }}
            >
              Clear Filters
            </Button>
            <Button
              size="sm"
              onClick={applyFilters}
              loading={listLoading}
              disabled={listLoading}
              leftSection={<IconFilter size={16} />}
              styles={{
                root: {
                  backgroundColor: "#105476",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 600,
                  height: "36px",
                  "&:hover": {
                    backgroundColor: "#0d4261",
                  },
                },
              }}
            >
              Apply Filters
            </Button>
          </Group>
        </Box>
      )}

      <Box
        style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}
      >
        {listLoading ? (
          <Center py="xl">
            <Loader color="#105476" />
          </Center>
        ) : error ? (
          <Center py="xl">
            <Text c="red" size="sm" style={{ fontFamily: "Inter" }}>
              Failed to load maker & checker mappings.
            </Text>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />
            {tableRows.length === 0 && (
              <Center py="lg">
                <Text c="dimmed" size="sm" style={{ fontFamily: "Inter" }}>
                  No mappings found.
                </Text>
              </Center>
            )}
          </>
        )}
      </Box>

      <Stack gap={0}>
        <PaginationBar
          pageSize={pagination.pageSize}
          currentPage={currentPage}
          totalRecords={totalRecords}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={handlePageChange}
        />
      </Stack>
    </Card>
  );
}
