import { Box, Button, Card, Grid, Group, Select, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useMemo, useRef, useState } from "react";
import SingleDateInput from "../../../components/SingleDateInput";
import Dropdown from "../../../components/Dropdown";
import ToastNotification from "../../../components/ToastNotification";
import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";
import useAuthStore from "../../../store/authStore";

interface BranchWithCountry {
  user_branch_id: number;
  branch_code: string;
  branch_name: string;
  is_default: boolean;
  main_default?: boolean;
  country?: {
    country_id: number;
    country_code: string;
    country_name: string;
  };
}

type TrialBalanceFormValues = {
  from_date: Date | null;
  to_date: Date | null;
  format: string | null;
  account_code: string | null;
  is_last_year_income: string | null;
  currency_code: string | null;
  country_id: string | null;
  branch_code: string | null;
};

function extensionForFormat(
  format: string | null,
  contentType: string | undefined,
): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("text/csv")) return "csv";
  if (ct.includes("spreadsheet") || ct.includes("officedocument")) {
    return "xlsx";
  }
  if (format === "csv") return "csv";
  if (format === "xlsx") return "xlsx";
  return "pdf";
}

/** Group branches by country (same idea as ProfileDrawer getBranchData / admin grouping). */
function buildCountryBranchMap(
  branches: BranchWithCountry[],
  fallbackCountry: { country_id: number; country_name: string },
) {
  const countryMap = new Map<
    number,
    { countryName: string; branches: BranchWithCountry[] }
  >();

  branches.forEach((branch) => {
    const countryId = branch.country?.country_id ?? fallbackCountry.country_id;
    const countryName =
      branch.country?.country_name ?? fallbackCountry.country_name;
    if (!countryMap.has(countryId)) {
      countryMap.set(countryId, { countryName, branches: [] });
    }
    countryMap.get(countryId)!.branches.push(branch);
  });

  return countryMap;
}

/** Same scoping as SubledgerEnquiry / dashboard: branches for ProfileDrawer active country (`user.country`). */
function branchesForProfileCountry(
  branches: BranchWithCountry[],
  activeCountryId: number | null | undefined,
): BranchWithCountry[] {
  if (!branches.length) return [];

  const activeCountryIdStr =
    activeCountryId !== null && activeCountryId !== undefined
      ? String(activeCountryId)
      : null;

  const activeBranches = activeCountryIdStr
    ? branches.filter((b) => {
        const branchCountryId = b.country?.country_id;
        if (branchCountryId === null || branchCountryId === undefined) {
          return false;
        }
        return String(branchCountryId) === activeCountryIdStr;
      })
    : [];

  const defaultOnly = branches.filter((b) => b.is_default);
  const effectiveBranches =
    activeBranches.length > 0
      ? activeBranches
      : defaultOnly.length > 0
        ? defaultOnly
        : branches;

  return effectiveBranches;
}

type BranchScopeMode = "initial" | "country" | "branch";

export default function TrialBalance() {
  const [printing, setPrinting] = useState(false);
  const [branchScopeMode, setBranchScopeMode] =
    useState<BranchScopeMode>("initial");
  const user = useAuthStore((s) => s.user);

  const {
    countryOptions,
    allBranchOptions,
    branchCodesForCountry,
    scopedDefaultBranchCode,
  } = useMemo(() => {
    const emptyBranches = () =>
      [] as { value: string; label: string }[];

    if (!user) {
      return {
        countryOptions: [] as { value: string; label: string }[],
        allBranchOptions: emptyBranches(),
        branchCodesForCountry: (_countryId: string | null) => [] as string[],
        scopedDefaultBranchCode: null as string | null,
      };
    }

    const profileCountryOption = {
      value: String(user.country.country_id),
      label: user.country.country_name,
    };

    if (!user.branches?.length) {
      return {
        countryOptions: [profileCountryOption],
        allBranchOptions: emptyBranches(),
        branchCodesForCountry: (_countryId: string | null) => [] as string[],
        scopedDefaultBranchCode: null as string | null,
      };
    }

    const branches = user.branches as BranchWithCountry[];
    const scopedBranches = branchesForProfileCountry(
      branches,
      user.country.country_id,
    );

    const countryMap = buildCountryBranchMap(scopedBranches, {
      country_id: user.country.country_id,
      country_name: user.country.country_name,
    });

    const allBranchOpts = scopedBranches.map((b) => ({
      value: b.branch_code,
      label: b.branch_name,
    }));

    const branchCodesForCountryFn = (countryIdStr: string | null): string[] => {
      if (!countryIdStr) return [];
      const id = Number.parseInt(countryIdStr, 10);
      const entry = countryMap.get(id);
      return entry ? entry.branches.map((b) => b.branch_code) : [];
    };

    const def =
      scopedBranches.find((b) => b.is_default) || scopedBranches[0] || null;

    return {
      countryOptions: [profileCountryOption],
      allBranchOptions: allBranchOpts,
      branchCodesForCountry: branchCodesForCountryFn,
      scopedDefaultBranchCode: def?.branch_code ?? null,
    };
  }, [user]);

  const defaultBranchCodeRef = useRef(scopedDefaultBranchCode);
  defaultBranchCodeRef.current = scopedDefaultBranchCode;

  const form = useForm<TrialBalanceFormValues>({
    initialValues: {
      from_date: null,
      to_date: null,
      format: "pdf",
      account_code: "false",
      is_last_year_income: "true",
      currency_code: "INR",
      country_id: null,
      branch_code: scopedDefaultBranchCode,
    },
  });

  const handleCountryChange = (v: string | null) => {
    if (v) {
      setBranchScopeMode("country");
      form.setFieldValue("country_id", v);
      form.setFieldValue("branch_code", null);
    } else {
      setBranchScopeMode("initial");
      form.setFieldValue("country_id", null);
      form.setFieldValue("branch_code", defaultBranchCodeRef.current);
    }
  };

  const handleBranchChange = (v: string | null) => {
    if (v) {
      // Dropdown blurs can fire onChange with the existing value before internal state syncs;
      // that must not flip to branch mode or Country stays disabled and cannot be selected.
      if (branchScopeMode === "initial" && v === form.values.branch_code) {
        return;
      }
      setBranchScopeMode("branch");
      form.setFieldValue("branch_code", v);
      form.setFieldValue("country_id", null);
    } else {
      setBranchScopeMode("initial");
      form.setFieldValue("country_id", null);
      form.setFieldValue("branch_code", defaultBranchCodeRef.current);
    }
  };

  const handlePrint = async () => {
    if (!form.values.from_date) {
      ToastNotification({ type: "error", message: "From date is required" });
      return;
    }
    if (!form.values.to_date) {
      ToastNotification({ type: "error", message: "To date is required" });
      return;
    }
    const fmt = (form.values.format ?? "").trim();
    if (!fmt) {
      ToastNotification({ type: "error", message: "Report format is required" });
      return;
    }

    if (branchScopeMode === "country") {
      if (!form.values.country_id?.trim()) {
        ToastNotification({ type: "error", message: "Country is required" });
        return;
      }
    } else if (!form.values.branch_code?.trim()) {
      ToastNotification({ type: "error", message: "Branch code is required" });
      return;
    }

    const filters: Record<string, unknown> = {
      from_date: dayjs(form.values.from_date).format("YYYY-MM-DD"),
      to_date: dayjs(form.values.to_date).format("YYYY-MM-DD"),
      currency_code: form.values.currency_code || "INR",
      is_last_year_income: form.values.is_last_year_income === "true",
      account_code: form.values.account_code === "true",
    };

    if (branchScopeMode === "country" && form.values.country_id) {
      const codes = branchCodesForCountry(form.values.country_id);
      if (!codes.length) {
        ToastNotification({
          type: "error",
          message: "No branches found for the selected country.",
        });
        return;
      }
      filters.branch_codes = codes;
    } else {
      filters.branch_code = form.values.branch_code?.trim() ?? "";
    }

    const uiFormat = fmt.toLowerCase();

    const body = {
      report_type: "trial_balance",
      format: uiFormat,
      filters,
    };

    setPrinting(true);
    try {
      const response = (await postAPICall(URL.reportsGenerate, body, {
        responseType: "blob",
      })) as { data?: Blob; headers?: { "content-type"?: string } };

      const blob =
        response?.data instanceof Blob ? response.data : (response as unknown as Blob);
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty response from server");
      }

      const head = await blob.slice(0, 256).text();
      const headTrim = head.trimStart();
      if (headTrim.startsWith("{") || headTrim.startsWith("[")) {
        const fullText = await blob.text();
        let parsed: {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
        };
        try {
          parsed = JSON.parse(fullText) as typeof parsed;
        } catch {
          throw new Error(fullText.slice(0, 500) || "Invalid response from server");
        }
        const raw = parsed.detail ?? parsed.message ?? parsed.error ?? fullText;
        const msg = Array.isArray(raw)
          ? raw.map(String).join(", ")
          : typeof raw === "string"
            ? raw
            : JSON.stringify(raw);
        throw new Error(msg || "Report generation failed");
      }

      const contentType =
        response.headers?.["content-type"] ?? response.headers?.["Content-Type"];
      const ext = extensionForFormat(uiFormat, contentType);
      const stamp = dayjs().format("YYYYMMDD-HHmmss");
      const fileName = `trial-balance-${stamp}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      ToastNotification({ type: "success", message: "Report downloaded" });
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: Blob; status?: number };
        message?: string;
      };
      let message = err?.message || "Failed to generate report";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text) as { detail?: string; message?: string };
          message = parsed.detail || parsed.message || text || message;
        } catch {
          /* keep default message */
        }
      }
      ToastNotification({ type: "error", message });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Title order={4} style={{ color: "#105476" }}>
          Trial Balance
        </Title>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="From Date"
              value={form.values.from_date}
              onChange={(d) => form.setFieldValue("from_date", d)}
              withAsterisk
              allowDeselection={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="To Date"
              value={form.values.to_date}
              onChange={(d) => form.setFieldValue("to_date", d)}
              withAsterisk
              allowDeselection={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Account Code"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={form.values.account_code}
              onChange={(v) => form.setFieldValue("account_code", v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="C/F Last Year Income/Exp"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={form.values.is_last_year_income}
              onChange={(v) => form.setFieldValue("is_last_year_income", v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Currency Code"
              data={[
                { value: "INR", label: "INR" },
                { value: "USD", label: "USD" },
              ]}
              value={form.values.currency_code}
              onChange={(v) => form.setFieldValue("currency_code", v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Country"
              placeholder="Select country"
              data={countryOptions}
              value={form.values.country_id}
              onChange={handleCountryChange}
              disabled={!countryOptions.length || branchScopeMode === "branch"}
              clearable={branchScopeMode === "country"}
              withAsterisk
              size="sm"
              comboboxProps={{ zIndex: 400 }}
              styles={{
                input: {
                  fontSize: "13px",
                  height: "36px",
                  fontFamily: "Inter",
                },
                label: {
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#424242",
                  marginBottom: "4px",
                  fontFamily: "Inter",
                },
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Branch Code"
              placeholder="Select branch"
              data={branchScopeMode === "country" ? [] : allBranchOptions}
              value={
                branchScopeMode === "country"
                  ? null
                  : (form.values.branch_code ?? null)
              }
              onChange={handleBranchChange}
              disabled={branchScopeMode === "country" || !allBranchOptions.length}
              clearable={branchScopeMode === "branch"}
              withAsterisk
              size="sm"
              comboboxProps={{ zIndex: 400 }}
              styles={{
                input: {
                  fontSize: "13px",
                  height: "36px",
                  fontFamily: "Inter",
                },
                label: {
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#424242",
                  marginBottom: "4px",
                  fontFamily: "Inter",
                },
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Report Format"
              data={[
                { value: "pdf", label: "PDF" },
                { value: "csv", label: "Excel" },
              ]}
              value={form.values.format}
              onChange={(v) => form.setFieldValue("format", v)}
              withAsterisk
              clearable={false}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Group justify="flex-end" mt="xs">
              <Button loading={printing} onClick={handlePrint}>
                Print
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
    </Box>
  );
}
