/** CHA service fields to preserve across house-create navigation. */
export type ChaServiceFormFields = {
  service?: string;
  service_code?: string;
  service_id?: string;
};

export function pickChaServiceFormFields(
  values: ChaServiceFormFields,
): ChaServiceFormFields {
  return {
    service: values.service || "",
    service_code: values.service_code || "",
    service_id: values.service_id || "",
  };
}

export function readChaServiceFormFields(
  source: ChaServiceFormFields | null | undefined,
): ChaServiceFormFields {
  if (!source) {
    return { service: "", service_code: "", service_id: "" };
  }
  return {
    service: source.service || "",
    service_code: source.service_code || "",
    service_id:
      source.service_id != null ? String(source.service_id) : "",
  };
}

/** Read origin/destination agent from job API row (service or agent jobs). */
export function readChaMasterAgentFields(job: Record<string, unknown>): {
  origin_agent: string;
  origin_agent_name: string;
  agent_name: string;
  agent_code: string;
} {
  const code = String(
    job.agent_code ??
      job.origin_agent_code ??
      job.origin_agent ??
      job.agent ??
      "",
  );
  const name = String(job.agent_name ?? job.origin_agent_name ?? "");
  return {
    origin_agent: code,
    origin_agent_name: name,
    agent_name: name,
    agent_code: code,
  };
}

/** Master carrier / transport fields for CHA service-job payload. */
export function pickChaMasterTransportPayload(
  agentPayload: Record<string, unknown>,
  transportMode: "AIR" | "SEA",
): Record<string, unknown> {
  // CHA jobs do not keep an origin/destination agent. Explicit null clears it on update.
  const base: Record<string, unknown> = {
    agent: null,
    agent_name: null,
    carrier_code: agentPayload.carrier_code ?? null,
  };

  if (transportMode === "AIR") {
    return {
      ...base,
      flightno:
        agentPayload.flightno ??
        agentPayload.flight_number ??
        agentPayload.flight ??
        null,
    };
  }

  return {
    ...base,
    vessel_name:
      agentPayload.vessel_name ?? agentPayload.vessel ?? null,
    voyage_number: agentPayload.voyage_number ?? null,
  };
}

const CHA_HIDDEN_AGENT_KEYS = new Set(["origin_agent", "agent_code"]);

/** True when master validation should block save. CHA ignores the removed agent fields. */
export function masterFormHasBlockingErrors(
  isChaMode: boolean,
  validation: { hasErrors: boolean; errors?: object },
): boolean {
  if (!validation.hasErrors) return false;
  if (!isChaMode) return true;
  return Object.entries(validation.errors ?? {}).some(
    ([key, value]) => Boolean(value) && !CHA_HIDDEN_AGENT_KEYS.has(key),
  );
}
