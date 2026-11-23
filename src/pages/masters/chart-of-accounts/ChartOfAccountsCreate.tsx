import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Loader,
  Select,
  Text,
  TextInput,
  Center,
  CloseButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { FormTextInput, ToastNotification } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type ChartOfAccountsData = {
  id?: number;
  gl_head: string;
  group_code: string;
  group_name: string;
  subgroup_code: string;
  subgroup_name: string;
  account_name: string;
  gl_account_code: string;
  sl_code: string;
};

type GroupOption = { group_name: string; group_code: string };
type SubgroupOption = { subgroup_name: string; subgroup_code: string };

const PAIR_SEP = "|||";

const toPairValue = (name: string, code: string) =>
  `${name}${PAIR_SEP}${code}`;

const parsePairValue = (value: string | null) => {
  if (!value) return { name: "", code: "" };
  const idx = value.indexOf(PAIR_SEP);
  if (idx < 0) return { name: value, code: "" };
  return {
    name: value.slice(0, idx),
    code: value.slice(idx + PAIR_SEP.length),
  };
};

const selectStyles = {
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#495057",
    marginBottom: "6px",
    fontFamily: "Inter",
  },
  input: {
    fontSize: "13px",
    height: "36px",
    fontFamily: "Inter",
  },
};

const glHeadOptions = [
  { value: "ASSETS", label: "ASSETS" },
  { value: "LIABILITY", label: "LIABILITY" },
  { value: "INCOME", label: "INCOME" },
  { value: "EXPENDITURE", label: "EXPENDITURE" },
];

const schema = yup.object().shape({
  gl_head: yup.string().required("GL Head is required"),
  group_code: yup.string().required("Group Code is required"),
  group_name: yup.string().required("Group Name is required"),
  subgroup_code: yup.string().required("Subgroup Code is required"),
  subgroup_name: yup.string().required("Subgroup Name is required"),
  account_name: yup.string().required("Account Name is required"),
  gl_account_code: yup.string().required("GL Account Code is required"),
  sl_code: yup.string().required("SL Code is required"),
});

function ChartOfAccountsCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFormData = location.state as ChartOfAccountsData | undefined;
  const isEditMode = !!editFormData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [subgroupOptions, setSubgroupOptions] = useState<SubgroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubgroups, setLoadingSubgroups] = useState(false);
  const [groupIsCustom, setGroupIsCustom] = useState(false);
  const [subgroupIsCustom, setSubgroupIsCustom] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [subgroupSearch, setSubgroupSearch] = useState("");
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editFormData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.chartOfAccounts : undefined,
        recordId: editFormData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<ChartOfAccountsData>({
    mode: "controlled",
    initialValues: {
      id: editFormData?.id,
      gl_head: editFormData?.gl_head || "",
      group_code: editFormData?.group_code || "",
      group_name: editFormData?.group_name || "",
      subgroup_code: editFormData?.subgroup_code || "",
      subgroup_name: editFormData?.subgroup_name || "",
      account_name: editFormData?.account_name || "",
      gl_account_code: editFormData?.gl_account_code || "",
      sl_code: editFormData?.sl_code || "",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    const glHead = form.values.gl_head;
    if (!glHead) {
      setGroupOptions([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingGroups(true);
      try {
        const response = (await getAPICall(
          `${URL.chartOfAccountsDistinctGroups}?gl_head=${encodeURIComponent(glHead)}`,
          API_HEADER,
        )) as { data?: GroupOption[] };
        if (!cancelled) {
          setGroupOptions(Array.isArray(response?.data) ? response.data : []);
        }
      } catch {
        if (!cancelled) setGroupOptions([]);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [form.values.gl_head]);

  useEffect(() => {
    const { gl_head, group_name, group_code } = form.values;
    if (!gl_head || !group_name || !group_code) {
      setSubgroupOptions([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingSubgroups(true);
      try {
        const params = new URLSearchParams({
          gl_head,
          group_name,
          group_code,
        });
        const response = (await getAPICall(
          `${URL.chartOfAccountsDistinctSubgroups}?${params.toString()}`,
          API_HEADER,
        )) as { data?: SubgroupOption[] };
        if (!cancelled) {
          setSubgroupOptions(
            Array.isArray(response?.data) ? response.data : [],
          );
        }
      } catch {
        if (!cancelled) setSubgroupOptions([]);
      } finally {
        if (!cancelled) setLoadingSubgroups(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [form.values.gl_head, form.values.group_name, form.values.group_code]);

  // Edit/load: if saved pair is not in options, switch to custom inputs
  useEffect(() => {
    if (groupIsCustom || !form.values.group_name || loadingGroups) return;
    const match = groupOptions.some(
      (g) =>
        g.group_name === form.values.group_name &&
        g.group_code === form.values.group_code,
    );
    if (!match) setGroupIsCustom(true);
  }, [
    groupOptions,
    loadingGroups,
    groupIsCustom,
    form.values.group_name,
    form.values.group_code,
  ]);

  useEffect(() => {
    if (
      subgroupIsCustom ||
      !form.values.subgroup_name ||
      loadingSubgroups ||
      !form.values.group_name ||
      !form.values.group_code
    ) {
      return;
    }
    const match = subgroupOptions.some(
      (s) =>
        s.subgroup_name === form.values.subgroup_name &&
        s.subgroup_code === form.values.subgroup_code,
    );
    if (!match) setSubgroupIsCustom(true);
  }, [
    subgroupOptions,
    loadingSubgroups,
    subgroupIsCustom,
    form.values.subgroup_name,
    form.values.subgroup_code,
    form.values.group_name,
    form.values.group_code,
  ]);

  const groupNameData = groupOptions.map((g) => ({
    value: toPairValue(g.group_name, g.group_code),
    label: g.group_name,
  }));

  const subgroupNameData = subgroupOptions.map((s) => ({
    value: toPairValue(s.subgroup_name, s.subgroup_code),
    label: `${s.subgroup_name} (${s.subgroup_code})`,
  }));

  const groupPairValue =
    !groupIsCustom && form.values.group_name && form.values.group_code
      ? toPairValue(form.values.group_name, form.values.group_code)
      : null;

  const subgroupPairValue =
    !subgroupIsCustom &&
    form.values.subgroup_name &&
    form.values.subgroup_code
      ? toPairValue(form.values.subgroup_name, form.values.subgroup_code)
      : null;

  const isGroupSearchMatch = (query: string) =>
    groupOptions.some(
      (g) => g.group_name.toLowerCase() === query.toLowerCase(),
    );

  const isSubgroupSearchMatch = (query: string) =>
    subgroupOptions.some((s) => {
      const label = `${s.subgroup_name} (${s.subgroup_code})`;
      return (
        s.subgroup_name.toLowerCase() === query.toLowerCase() ||
        label.toLowerCase() === query.toLowerCase()
      );
    });

  const enterGroupCustom = (name: string) => {
    setGroupIsCustom(true);
    setSubgroupIsCustom(false);
    setGroupSearch("");
    setSubgroupSearch("");
    form.setValues({
      ...form.values,
      group_name: name,
      group_code: "",
      subgroup_name: "",
      subgroup_code: "",
    });
  };

  const enterSubgroupCustom = (name: string) => {
    setSubgroupIsCustom(true);
    setSubgroupSearch("");
    form.setFieldValue("subgroup_name", name);
    form.setFieldValue("subgroup_code", "");
  };

  const handleGlHeadChange = (value: string | null) => {
    setGroupIsCustom(false);
    setSubgroupIsCustom(false);
    setGroupSearch("");
    setSubgroupSearch("");
    form.setValues({
      ...form.values,
      gl_head: value || "",
      group_name: "",
      group_code: "",
      subgroup_name: "",
      subgroup_code: "",
    });
    setSubgroupOptions([]);
  };

  const handleGroupChange = (value: string | null) => {
    setGroupIsCustom(false);
    setSubgroupIsCustom(false);
    setGroupSearch("");
    setSubgroupSearch("");
    const { name, code } = parsePairValue(value);
    form.setValues({
      ...form.values,
      group_name: name,
      group_code: code,
      subgroup_name: "",
      subgroup_code: "",
    });
  };

  const handleSubgroupChange = (value: string | null) => {
    setSubgroupIsCustom(false);
    setSubgroupSearch("");
    const { name, code } = parsePairValue(value);
    form.setFieldValue("subgroup_name", name);
    form.setFieldValue("subgroup_code", code);
  };

  const tryCreateGroupFromSearch = () => {
    const q = groupSearch.trim();
    if (!q) return;
    if (isGroupSearchMatch(q)) {
      const match = groupOptions.find(
        (g) => g.group_name.toLowerCase() === q.toLowerCase(),
      );
      if (match) {
        handleGroupChange(toPairValue(match.group_name, match.group_code));
      }
      return;
    }
    enterGroupCustom(q);
  };

  const tryCreateSubgroupFromSearch = () => {
    const q = subgroupSearch.trim();
    if (!q) return;
    if (isSubgroupSearchMatch(q)) {
      const match = subgroupOptions.find((s) => {
        const label = `${s.subgroup_name} (${s.subgroup_code})`;
        return (
          s.subgroup_name.toLowerCase() === q.toLowerCase() ||
          label.toLowerCase() === q.toLowerCase()
        );
      });
      if (match) {
        handleSubgroupChange(
          toPairValue(match.subgroup_name, match.subgroup_code),
        );
      }
      return;
    }
    enterSubgroupCustom(q);
  };

  const handleSubmit = async (values: ChartOfAccountsData): Promise<void> => {
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const response = await putAPICall(
          URL.chartOfAccounts,
          values,
          API_HEADER,
        );
        applyAuditFromResponse(response);
        await refreshAuditFromDetail(editFormData?.id);
        ToastNotification({
          type: "success",
          message: "Chart of Accounts updated successfully",
        });
        navigate("/master/chart-of-accounts", { state: { refreshData: true } });
      } else {
        await postAPICall(URL.chartOfAccounts, values, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Chart of Accounts created successfully",
        });
        navigate("/master/chart-of-accounts", { state: { refreshData: true } });
      }
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while ${isEditMode ? "updating" : "creating"} Chart of Accounts: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasGlHead = !!form.values.gl_head;
  const hasGroup =
    !!form.values.gl_head &&
    !!form.values.group_name &&
    !!form.values.group_code;

  return (
    <Box
      component="form"
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
      onSubmit={form.onSubmit(handleSubmit)}
    >
      {isSubmitting && (
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
          {/* Vertical Sidebar */}
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <MasterAuditHeadingRow
                auditSource={auditSource}
                visible={isEditMode}
                justify="center"
              >
                <Text
                  size="md"
                  fw={600}
                  c="#105476"
                  style={{
                    fontFamily: "Inter",
                    fontStyle: "medium",
                    fontSize: "16px",
                    color: "#105476",
                    textAlign: "center",
                  }}
                >
                  {isEditMode
                    ? "Edit Chart of Accounts"
                    : "Create Chart of Accounts"}
                </Text>
              </MasterAuditHeadingRow>
            </Box>
          </Box>

          {/* Main Content Area */}
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
                {/* Account Information Section */}
                <Grid.Col span={12}>
                  <Box mb="md">
                    <Grid>
                      <Grid.Col span={6}>
                        <Select
                          label="GL Head"
                          placeholder="Select GL Head"
                          withAsterisk
                          searchable
                          data={glHeadOptions}
                          value={form.values.gl_head || null}
                          onChange={handleGlHeadChange}
                          error={form.errors.gl_head}
                          styles={selectStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Account Name"
                          placeholder="Enter Account Name"
                          {...form.getInputProps("account_name")}
                          withAsterisk
                          styles={selectStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="GL Account Code"
                          placeholder="Enter GL Account Code"
                          {...form.getInputProps("gl_account_code")}
                          withAsterisk
                          styles={selectStyles}
                        />
                      </Grid.Col>

                      <Grid.Col span={6}>
                        <TextInput
                          label="SL Code"
                          placeholder="Enter SL Code"
                          {...form.getInputProps("sl_code")}
                          withAsterisk
                          styles={selectStyles}
                        />
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>

                {/* Group Information Section */}
                <Grid.Col span={12} py={0}>
                  <Box mb="md">
                    <Grid>
                      <Grid.Col span={6}>
                        {groupIsCustom ? (
                          <FormTextInput
                            label="Group Name"
                            placeholder="Enter new Group Name"
                            withAsterisk
                            format="normal"
                            disabled={!hasGlHead}
                            value={form.values.group_name}
                            error={form.errors.group_name}
                            rightSectionPointerEvents="all"
                            rightSection={
                              form.values.group_name ? (
                                <CloseButton
                                  size="sm"
                                  aria-label="Clear group name"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setGroupIsCustom(false);
                                    setSubgroupIsCustom(false);
                                    setGroupSearch("");
                                    setSubgroupSearch("");
                                    form.setValues({
                                      ...form.values,
                                      group_name: "",
                                      group_code: "",
                                      subgroup_name: "",
                                      subgroup_code: "",
                                    });
                                  }}
                                />
                              ) : null
                            }
                            onChange={(e) => {
                              form.setValues({
                                ...form.values,
                                group_name: e.currentTarget.value,
                                subgroup_name: "",
                                subgroup_code: "",
                              });
                              setSubgroupIsCustom(false);
                            }}
                          />
                        ) : (
                          <Select
                            label="Group Name"
                            placeholder={
                              hasGlHead
                                ? "Select or type new Group Name"
                                : "Select GL Head first"
                            }
                            withAsterisk
                            searchable
                            clearable
                            disabled={!hasGlHead}
                            data={groupNameData}
                            value={groupPairValue}
                            onSearchChange={setGroupSearch}
                            onChange={handleGroupChange}
                            onBlur={tryCreateGroupFromSearch}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              const q = groupSearch.trim();
                              if (q && !isGroupSearchMatch(q)) {
                                e.preventDefault();
                                enterGroupCustom(q);
                              }
                            }}
                            nothingFoundMessage={
                              groupSearch.trim()
                                ? `No match — press Enter or leave field to create "${groupSearch.trim()}"`
                                : "No groups found"
                            }
                            error={form.errors.group_name}
                            rightSection={
                              loadingGroups ? <Loader size={14} /> : undefined
                            }
                            styles={selectStyles}
                          />
                        )}
                      </Grid.Col>
                      <Grid.Col span={6}>
                        {groupIsCustom ? (
                          <FormTextInput
                            label="Group Code"
                            placeholder="Enter new Group Code"
                            withAsterisk
                            format="normal"
                            disabled={!hasGlHead}
                            value={form.values.group_code}
                            error={form.errors.group_code}
                            onChange={(e) => {
                              form.setValues({
                                ...form.values,
                                group_code: e.currentTarget.value,
                                subgroup_name: "",
                                subgroup_code: "",
                              });
                              setSubgroupIsCustom(false);
                            }}
                          />
                        ) : (
                          <TextInput
                            label="Group Code"
                            placeholder={
                              hasGlHead
                                ? "Auto-selected from Group Name"
                                : "Select GL Head first"
                            }
                            withAsterisk
                            readOnly
                            disabled={!hasGlHead}
                            value={form.values.group_code}
                            error={form.errors.group_code}
                            styles={selectStyles}
                          />
                        )}
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>

                {/* Subgroup Information Section */}
                <Grid.Col span={12} py={0}>
                  <Box mb="md">
                    <Grid>
                      <Grid.Col span={6}>
                        {subgroupIsCustom ? (
                          <FormTextInput
                            label="Subgroup Name"
                            placeholder="Enter new Subgroup Name"
                            withAsterisk
                            format="normal"
                            disabled={!hasGroup}
                            value={form.values.subgroup_name}
                            error={form.errors.subgroup_name}
                            rightSectionPointerEvents="all"
                            rightSection={
                              form.values.subgroup_name ? (
                                <CloseButton
                                  size="sm"
                                  aria-label="Clear subgroup name"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setSubgroupIsCustom(false);
                                    setSubgroupSearch("");
                                    form.setFieldValue("subgroup_name", "");
                                    form.setFieldValue("subgroup_code", "");
                                  }}
                                />
                              ) : null
                            }
                            onChange={(e) =>
                              form.setFieldValue(
                                "subgroup_name",
                                e.currentTarget.value,
                              )
                            }
                          />
                        ) : (
                          <Select
                            label="Subgroup Name"
                            placeholder={
                              hasGroup
                                ? "Select or type new Subgroup Name"
                                : "Select Group first"
                            }
                            withAsterisk
                            searchable
                            clearable
                            disabled={!hasGroup}
                            data={subgroupNameData}
                            value={subgroupPairValue}
                            onSearchChange={setSubgroupSearch}
                            onChange={handleSubgroupChange}
                            onBlur={tryCreateSubgroupFromSearch}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              const q = subgroupSearch.trim();
                              if (q && !isSubgroupSearchMatch(q)) {
                                e.preventDefault();
                                enterSubgroupCustom(q);
                              }
                            }}
                            nothingFoundMessage={
                              subgroupSearch.trim()
                                ? `No match — press Enter or leave field to create "${subgroupSearch.trim()}"`
                                : "No subgroups found"
                            }
                            error={form.errors.subgroup_name}
                            rightSection={
                              loadingSubgroups ? (
                                <Loader size={14} />
                              ) : undefined
                            }
                            styles={selectStyles}
                          />
                        )}
                      </Grid.Col>
                      <Grid.Col span={6}>
                        {subgroupIsCustom ? (
                          <FormTextInput
                            label="Subgroup Code"
                            placeholder="Enter new Subgroup Code"
                            withAsterisk
                            format="normal"
                            disabled={!hasGroup}
                            value={form.values.subgroup_code}
                            error={form.errors.subgroup_code}
                            onChange={(e) =>
                              form.setFieldValue(
                                "subgroup_code",
                                e.currentTarget.value,
                              )
                            }
                          />
                        ) : (
                          <TextInput
                            label="Subgroup Code"
                            placeholder={
                              hasGroup
                                ? "Auto-selected from Subgroup Name"
                                : "Select Group first"
                            }
                            withAsterisk
                            readOnly
                            disabled={!hasGroup}
                            value={form.values.subgroup_code}
                            error={form.errors.subgroup_code}
                            styles={selectStyles}
                          />
                        )}
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>
              </Grid>
            </Box>

            {/* Footer Buttons */}
            <Box
              style={{
                padding: "20px 32px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
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
                        fontStyle: "medium",
                      },
                    }}
                    onClick={() => navigate("/master/chart-of-accounts")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </Group>

                <Group gap="sm">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    style={{
                      backgroundColor: isSubmitting ? "#105476BB" : "#105476",
                      fontSize: "13px",
                      fontFamily: "Inter",
                      fontStyle: "medium",
                    }}
                    rightSection={<IconCheck size={16} />}
                  >
                    {isEditMode ? "Update" : "Create"}
                  </Button>
                </Group>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

export default ChartOfAccountsCreate;
