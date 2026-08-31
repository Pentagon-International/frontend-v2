import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChaJobConfig } from "./chaJobContext";
import {
  fetchChaServices,
  resolveChaServicePayload,
  type ChaServiceMasterItem,
} from "./chaJobService";

type ServiceFormApi = {
  values: { service?: string; service_code?: string; service_id?: string };
  setFieldValue: (field: string, value: string) => void;
};

export function useChaJobServiceField(
  defaultOptions: string[],
  form: ServiceFormApi,
) {
  const chaConfig = useChaJobConfig();
  const isChaMode = Boolean(chaConfig);

  const { data: chaServices = [] } = useQuery({
    queryKey: ["chaJobServices", chaConfig?.variant, chaConfig?.serviceCodes],
    queryFn: () => fetchChaServices(chaConfig!.serviceCodes),
    enabled: isChaMode && Boolean(chaConfig),
  });

  const serviceDropdownData = useMemo(() => {
    if (!isChaMode) return defaultOptions;
    return chaServices.map((item) => item.service_name);
  }, [chaServices, defaultOptions, isChaMode]);

  const selectedChaService = useMemo((): ChaServiceMasterItem | null => {
    if (!isChaMode || !chaServices.length) return null;
    const serviceId = form.values.service_id?.trim();
    if (serviceId) {
      return (
        chaServices.find((item) => String(item.id) === serviceId) ?? null
      );
    }
    const code = form.values.service_code?.trim();
    if (code) {
      return (
        chaServices.find((item) => String(item.service_code) === code) ?? null
      );
    }
    const service = form.values.service?.trim().toUpperCase();
    if (!service) return null;
    return (
      chaServices.find((item) => {
        const payload = resolveChaServicePayload(
          item,
          chaConfig!.serviceType,
        );
        return payload.service.toUpperCase() === service;
      }) ?? null
    );
  }, [
    chaConfig,
    chaServices,
    form.values.service,
    form.values.service_code,
    form.values.service_id,
    isChaMode,
  ]);

  const serviceDropdownValue = isChaMode
    ? (selectedChaService?.service_name ?? null)
    : (form.values.service ?? null);

  const applyChaService = useCallback(
    (item: ChaServiceMasterItem) => {
      if (!chaConfig) return;
      const payload = resolveChaServicePayload(item, chaConfig.serviceType);
      form.setFieldValue("service", payload.service);
      form.setFieldValue("service_code", payload.service_code);
      form.setFieldValue("service_id", payload.service_id);
    },
    [chaConfig, form],
  );

  const handleServiceChange = useCallback(
    (value: string | null) => {
      if (!isChaMode) {
        form.setFieldValue("service", value || "");
        return;
      }
      const item = chaServices.find((row) => row.service_name === value);
      if (item) applyChaService(item);
    },
    [applyChaService, chaServices, form, isChaMode],
  );

  useEffect(() => {
    if (!isChaMode || !chaConfig || chaServices.length === 0) return;
    if (
      form.values.service?.trim() ||
      form.values.service_code?.trim() ||
      form.values.service_id?.trim()
    ) {
      return;
    }
    applyChaService(chaServices[0]);
  }, [
    applyChaService,
    chaConfig,
    chaServices,
    form.values.service,
    form.values.service_code,
    form.values.service_id,
    isChaMode,
  ]);

  return {
    isChaMode,
    serviceDropdownData,
    serviceDropdownValue,
    handleServiceChange,
  };
}
