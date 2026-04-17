import {
  Box,
  Flex,
  Group,
  Text,
  TextInput,
  ActionIcon,
  Popover,
  Stack,
  ScrollArea,
  Loader,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronRight,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLayoutStore } from "../store/useLayoutStore";
import useAuthStore from "../store/authStore";
import ProfileDrawer from "./ProfileDrawer";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { ToastNotification } from ".";

// interface HeaderProps {
//   title: string;
// }

function MainSectionHeader() {
  const title = useLayoutStore((state) => state.title);
  const [profileDrawerOpened, setProfileDrawerOpened] = useState(false);
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  // const logout = useAuthStore((state) => state.logout);

  const fullName = user?.full_name || "User";
  const email = user?.email || "";

  console.log("MainSectionHeader render:", { user, fullName, email });

  const [searchText, setSearchText] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(
    null,
  );

  type GlobalSearchItem = {
    id: string;
    display_id?: string | null;
    primary_code?: string | null;
    module: string;
    sub_module?: string | null;
    api_endpoint?: string | null;
    filter_id_key?: string | null;
    matched_field?: string | null;
  };

  type GlobalSearchResponse = {
    query?: string;
    total_results?: number;
    type?: "single" | "multiple";
    data?: GlobalSearchItem | GlobalSearchItem[];
  };

  const trimmedSearch = useMemo(() => searchText.trim(), [searchText]);
  const canSearch = trimmedSearch.length > 0 && !searchLoading;

  const parseJsonIfString = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const normalizeGlobalSearchResponse = (input: unknown): GlobalSearchResponse | null => {
    const parsed = parseJsonIfString(input);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const t =
      typeof obj.type === "string" ? obj.type.trim().toLowerCase() : null;
    if ((t === "single" || t === "multiple") && "data" in obj) {
      return { ...(obj as object), type: t } as GlobalSearchResponse;
    }
    // common wrappers
    const candidates = [obj.data, obj.results, obj.response, obj.payload];
    for (const c of candidates) {
      const n = normalizeGlobalSearchResponse(c);
      if (n) return n;
    }
    return null;
  };

  const fetchModuleRecord = async (item: GlobalSearchItem) => {
    const module = String(item.module ?? "").trim();
    const recordId = String(item.id ?? "").trim();
    const apiEndpoint = String(item.api_endpoint ?? "").trim();
    const filterIdKey = String(item.filter_id_key ?? "").trim();

    if (!module || !recordId || !apiEndpoint || !filterIdKey) {
      console.warn("[GlobalSearch] missing module fetch metadata", {
        module,
        recordId,
        apiEndpoint,
        filterIdKey,
      });
      return null;
    }

    const normalizedFilterValue =
      /^-?\d+$/.test(recordId) && Number.isSafeInteger(Number(recordId))
        ? Number(recordId)
        : recordId;

    const payload = {
      filters: {
        [filterIdKey]: normalizedFilterValue,
      },
    };

    console.log("[GlobalSearch] module fetch →", { apiEndpoint, payload, module, recordId });
    const res = await apiCallProtected.post(apiEndpoint, payload, API_HEADER);
    const raw = (res as { data?: unknown })?.data ?? res;

    const parsed =
      raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
        ? (raw as { data?: unknown }).data
        : raw;

    const record = Array.isArray(parsed)
      ? (parsed[0] as unknown)
      : parsed;

    if (!record || typeof record !== "object") {
      console.warn("[GlobalSearch] module fetch returned no object record", {
        module,
        recordId,
        apiEndpoint,
        raw,
      });
      return null;
    }

    return record as Record<string, unknown>;
  };

  const moduleToRoute = (
    module: string,
    sub: string | null,
    id: string,
  ): { path: string; needsState: boolean } | null => {
    switch (module) {
      case "enquiry":
        return { path: "/enquiry-create", needsState: true };
      case "quotation":
        return { path: "/quotation-create", needsState: true };
      case "booking":
        // Booking: air/ocean import/export edit pages
        if (sub === "air_export")
          return { path: "/air/export-booking/edit", needsState: true };
        if (sub === "air_import")
          return { path: "/air/import-booking/edit", needsState: true };
        if (sub === "ocean_export")
          return { path: "/SeaExport/export-booking/edit", needsState: true };
        if (sub === "ocean_import")
          return { path: "/SeaExport/import-booking/edit", needsState: true };
        return null;
      case "job":
        // Job: air/ocean import/export edit pages
        if (sub === "air_export")
          return { path: "/air/export-job/edit", needsState: true };
        if (sub === "ocean_export")
          return { path: "/SeaExport/export-job/edit", needsState: true };
        if (sub === "air_import")
          return { path: "/air/import-job/edit", needsState: true };
        if (sub === "ocean_import")
          return { path: "/SeaExport/import-job/edit", needsState: true };
        return null;
      case "invoice":
        // Invoice module in global search typically needs landing to invoice list/master
        return { path: "/invoice", needsState: false };
      case "journal_voucher":
        return { path: `/journal-voucher/edit/${id}`, needsState: false };
      case "receipt":
        return { path: "/receipt/edit", needsState: true };
      case "reverse_receipt":
        return { path: "/receipt/reversal/edit", needsState: true };
      case "overseas_receipt":
        return { path: "/overseas-receipt/edit", needsState: true };
      case "supplier_invoice":
        return { path: "/supplier-invoice/edit", needsState: true };
      case "reverse_supplier_invoice":
        return { path: "/supplier-invoice/reversal/edit", needsState: true };
      case "payment":
        return { path: "/payment/edit", needsState: true };
      case "overseas_payment":
        return { path: "/overseas-payment/edit", needsState: true };
      case "reverse_payment":
        return { path: "/payment/reversal/edit", needsState: true };
      default:
        return null;
    }
  };

  const openModuleEdit = async (item: GlobalSearchItem) => {
    const module = String(item.module ?? "").trim().toLowerCase();
    const subRaw = item.sub_module ?? null;
    const sub =
      subRaw == null ? null : String(subRaw).trim().toLowerCase() || null;
    const id = String(item.id ?? "").trim();
    if (!module || !id) return;

    setSearchLoading(true);
    setSearchError(null);
    try {
      const target = moduleToRoute(module, sub, id);
      console.log("[GlobalSearch] route resolved", { module, sub, id, target });

      if (!target) {
        // No toast here per requirement: just don't navigate if not configured.
        console.warn("[GlobalSearch] no route configured", {
          module,
          sub,
          id,
          display_id: item.display_id ?? null,
        });
        return;
      }

      if (!target.needsState) {
        setSearchOpen(false);
        setSearchText("");
        navigate(target.path);
        return;
      }

      const record = await fetchModuleRecord(item);
      console.log("[GlobalSearch] fetched record for navigation", { module, id, record });

      if (!record) {
        ToastNotification({
          type: "warning",
          message: `No ${module} record found for this search result.`,
        });
        return;
      }

      setSearchOpen(false);
      setSearchText("");
      const baseState = {
        actionType: "edit",
        fromGlobalSearch: true,
      };

      // Some edit pages expect a nested state shape (same as their list→edit flow).
      if (module === "job") {
        const jobId =
          (record as Record<string, unknown>)?.id ??
          (record as Record<string, unknown>)?.job_id ??
          id;
        navigate(target.path, {
          state: {
            ...baseState,
            job: record,
            jobId,
          },
        });
        return;
      }

      if (module === "booking") {
        const bookingId =
          (record as Record<string, unknown>)?.id ??
          (record as Record<string, unknown>)?.booking_id ??
          id;
        navigate(target.path, {
          state: {
            ...baseState,
            // Booking edit pages expect `job` in location.state (same as list→edit flow)
            job: record,
            bookingId,
          },
        });
        return;
      }

      navigate(target.path, {
        state: {
          ...(record as Record<string, unknown>),
          ...baseState,
        },
      });
    } catch (e) {
      console.error("[GlobalSearch] openModuleEdit failed", e);
      ToastNotification({
        type: "error",
        message: "Global search navigation failed.",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const runGlobalSearch = async (q?: string) => {
    const query = String(q ?? trimmedSearch).trim();
    if (!query) return;

    setSearchLoading(true);
    setSearchError(null);
    setSearchOpen(false);
    try {
      const res = await apiCallProtected.get(
        `${URL.globalSearch}?q=${encodeURIComponent(query)}`,
        API_HEADER,
      );

      const ax = res as {
        data?: unknown;
        request?: { response?: unknown; responseText?: unknown };
      };
      const normalized =
        normalizeGlobalSearchResponse(ax.data) ??
        normalizeGlobalSearchResponse(ax.request?.response) ??
        normalizeGlobalSearchResponse(ax.request?.responseText) ??
        normalizeGlobalSearchResponse(res);

      console.log("[GlobalSearch] normalized payload", normalized);
      setSearchResults(normalized);

      if (normalized?.type === "single" && normalized.data && !Array.isArray(normalized.data)) {
        await openModuleEdit(normalized.data);
      } else {
        setSearchOpen(true);
      }
    } catch (err: unknown) {
      console.error("[GlobalSearch] runGlobalSearch failed", err);
      setSearchError("Failed to search.");
      setSearchOpen(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const multipleItems = useMemo(() => {
    if (searchResults?.type !== "multiple") return [];
    return Array.isArray(searchResults.data) ? searchResults.data : [];
  }, [searchResults]);

  const handleProfileClick = () => {
    setProfileDrawerOpened(true);
  };

  const handleProfileDrawerClose = () => {
    setProfileDrawerOpened(false);
  };

  return (
    <>
      <Flex
        justify="space-between"
        align="center"
        bg="white"
        mih={30}
        style={{ padding: "0 24px" }}
        //   style={{ borderBottom: "1px solid #f0f0f0" }}
      >
        <Box
          style={{
            borderLeft: "3px solid #14597A", // Unique accent bar
            paddingLeft: 12,
          }}
        >
          <Text
            fw={700}
            fz={22}
            style={{
              color: "#2C3E50",
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
        </Box>
        {/* Right section */}

        <Group gap="xl" align="center" wrap="nowrap">
          <Popover
            opened={searchOpen}
            onChange={setSearchOpen}
            position="bottom-end"
            shadow="md"
            width={420}
          >
            <Popover.Target>
              <TextInput
                value={searchText}
                onChange={(e) => setSearchText(e.currentTarget.value)}
                placeholder="Search"
                w={360}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runGlobalSearch(e.currentTarget.value);
                  }
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                rightSectionPointerEvents="all"
                rightSection={
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => void runGlobalSearch(trimmedSearch)}
                    disabled={!canSearch}
                    aria-label="Global search"
                  >
                    {searchLoading ? <Loader size={16} /> : <IconSearch size={18} />}
                  </ActionIcon>
                }
              />
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                {searchError ? (
                  <Text size="sm" c="red">
                    {searchError}
                  </Text>
                ) : null}

                {searchResults?.type === "multiple" ? (
                  <>
                    <Text size="sm" fw={600}>
                      Results ({searchResults.total_results ?? multipleItems.length})
                    </Text>
                    <ScrollArea h={240} type="auto">
                      <Stack gap={6}>
                        {multipleItems.map((it) => (
                          <UnstyledButton
                            key={`${it.module}-${it.id}-${it.display_id ?? ""}`}
                            onClick={() => void openModuleEdit(it)}
                            style={{
                              padding: "10px 10px",
                              borderRadius: 10,
                              border: "1px solid #eef2f6",
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap">
                              <Box>
                                <Text fw={600} size="sm">
                                  {it.display_id ?? it.id}
                                  {it.primary_code ? ` (${it.primary_code})` : ""}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {it.module}
                                  {it.sub_module ? ` • ${it.sub_module}` : ""}
                                </Text>
                              </Box>
                              <IconChevronRight size={18} color="#105476" />
                            </Group>
                          </UnstyledButton>
                        ))}
                        {!multipleItems.length ? (
                          <Text size="sm" c="dimmed">
                            No results.
                          </Text>
                        ) : null}
                      </Stack>
                    </ScrollArea>
                  </>
                ) : searchResults?.type === "single" ? (
                  <Text size="sm" c="dimmed">
                    Opening result…
                  </Text>
                ) : searchLoading ? (
                  <Text size="sm" c="dimmed">
                    Searching…
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    Type something and press Enter.
                  </Text>
                )}
              </Stack>
            </Popover.Dropdown>
          </Popover>

          {/* User info */}
          <UnstyledButton onClick={handleProfileClick} px={0}>
            <Group gap="sm" align="center" wrap="nowrap">
              <Box style={{ lineHeight: 1 }}>
                <Text size="sm" ta="right" c="#212629ff" fw={500}>
                  {fullName}
                </Text>
                <Text size="xs" c="dimmed">
                  {email}
                </Text>
              </Box>
              <Flex
                justify="center"
                align="center"
                fw={400}
                style={{
                  fontFamily: "Outfit",
                  width: "36px",
                  height: "36px",
                  color: "white",
                  padding: "4px",
                  borderRadius: "50%",
                  backgroundColor: "#105476",
                }}
              >
                {fullName.slice(0, 1)}
              </Flex>
            </Group>
          </UnstyledButton>
        </Group>
      </Flex>

      <ProfileDrawer
        opened={profileDrawerOpened}
        onClose={handleProfileDrawerClose}
      />
    </>
  );
}

export default MainSectionHeader;
