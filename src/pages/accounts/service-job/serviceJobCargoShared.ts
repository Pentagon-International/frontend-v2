import dayjs from "dayjs";
import {
  formatHouseCargoChargeableForPayload,
  formatHouseCargoWeightForPayload,
  importHouseCargoWeightFromApi,
  type HouseCargoWeightValue,
} from "../../../utils/houseCargoChargeableWeight";
import {
  normalizePackageTypeCode,
  pickPackageTypeCodeFromCargo,
} from "../../../utils/packageTypeOptions";

export type ServiceJobCargoMode = "AIR" | "FCL" | "LCL";

export type ServiceJobContainerDetail = {
  id?: number;
  container_type: string;
  container_no: string;
  actual_seal_no: string;
  customs_seal_no: string;
  loading_date: Date | null;
  unloading_date: Date | null;
};

export type ServiceJobCargoDetail = {
  id?: number;
  container_number: string;
  container_id?: number;
  package_type: string;
  no_of_packages: number | null;
  gross_weight: HouseCargoWeightValue;
  volume: HouseCargoWeightValue;
  chargeable_weight: HouseCargoWeightValue;
  haz: boolean | null;
};

export const EMPTY_SERVICE_JOB_CONTAINER: ServiceJobContainerDetail = {
  container_type: "",
  container_no: "",
  actual_seal_no: "",
  customs_seal_no: "",
  loading_date: null,
  unloading_date: null,
};

export const EMPTY_SERVICE_JOB_CARGO: ServiceJobCargoDetail = {
  container_number: "",
  package_type: "",
  no_of_packages: null,
  gross_weight: null,
  volume: null,
  chargeable_weight: null,
  haz: null,
};

export function isEmptyServiceJobContainer(
  container: ServiceJobContainerDetail,
): boolean {
  return (
    container.id == null &&
    String(container.container_type ?? "").trim() === "" &&
    String(container.container_no ?? "").trim() === "" &&
    String(container.actual_seal_no ?? "").trim() === "" &&
    String(container.customs_seal_no ?? "").trim() === "" &&
    container.loading_date == null &&
    container.unloading_date == null
  );
}

export function isEmptyServiceJobCargo(cargo: ServiceJobCargoDetail): boolean {
  return (
    cargo.id == null &&
    String(cargo.container_number ?? "").trim() === "" &&
    String(cargo.package_type ?? "").trim() === "" &&
    cargo.no_of_packages == null &&
    cargo.gross_weight == null &&
    cargo.volume == null &&
    cargo.haz == null
  );
}

/**
 * Pair container + cargo rows 1:1 for the combined UI.
 * Payload mapping still uses the two arrays independently.
 */
export function alignContainerAndCargoRows(
  containers: ServiceJobContainerDetail[],
  cargoDetails: ServiceJobCargoDetail[],
): {
  containers: ServiceJobContainerDetail[];
  cargoDetails: ServiceJobCargoDetail[];
} {
  const realContainers = containers.filter(
    (container) => !isEmptyServiceJobContainer(container),
  );
  const realCargo = cargoDetails.filter((cargo) => !isEmptyServiceJobCargo(cargo));

  if (realContainers.length === 0 && realCargo.length === 0) {
    return {
      containers: [{ ...EMPTY_SERVICE_JOB_CONTAINER }],
      cargoDetails: [{ ...EMPTY_SERVICE_JOB_CARGO }],
    };
  }

  const usedCargo = new Set<number>();
  const nextContainers: ServiceJobContainerDetail[] = [];
  const nextCargo: ServiceJobCargoDetail[] = [];

  for (const container of realContainers) {
    const containerNo = String(container.container_no ?? "").trim();
    const cargoIdx =
      containerNo === ""
        ? -1
        : realCargo.findIndex(
            (cargo, index) =>
              !usedCargo.has(index) &&
              String(cargo.container_number ?? "").trim() === containerNo,
          );

    nextContainers.push(container);
    if (cargoIdx >= 0) {
      usedCargo.add(cargoIdx);
      nextCargo.push({
        ...realCargo[cargoIdx],
        container_number: containerNo,
        container_id:
          realCargo[cargoIdx].container_id ??
          (container.id != null ? Number(container.id) : undefined),
      });
    } else {
      nextCargo.push({
        ...EMPTY_SERVICE_JOB_CARGO,
        container_number: containerNo,
        container_id: container.id != null ? Number(container.id) : undefined,
      });
    }
  }

  realCargo.forEach((cargo, index) => {
    if (usedCargo.has(index)) return;
    nextContainers.push({
      ...EMPTY_SERVICE_JOB_CONTAINER,
      container_no: cargo.container_number || "",
    });
    nextCargo.push(cargo);
  });

  return { containers: nextContainers, cargoDetails: nextCargo };
}

/**
 * Cargo UI/payload mode from service master.
 * SEA+FULL → FCL, SEA+GROUPAGE → LCL, AIR → AIR, NA/other → LCL.
 * Independent of isAirTransportMode (ports/units/AWB).
 */
export function resolveServiceJobCargoMode(
  transportMode?: string,
  fullGroupage?: string,
): ServiceJobCargoMode {
  const tm = String(transportMode ?? "")
    .trim()
    .toUpperCase();
  const fg = String(fullGroupage ?? "")
    .trim()
    .toUpperCase();

  if (tm === "AIR") return "AIR";
  if (tm === "SEA") {
    if (fg === "FULL") return "FCL";
    return "LCL";
  }
  return "LCL";
}

export function isSeaServiceJobCargoMode(mode: ServiceJobCargoMode): boolean {
  return mode === "FCL" || mode === "LCL";
}

function parseApiDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = dayjs(value as string | Date);
  return d.isValid() ? d.toDate() : null;
}

function mapHazFromApi(value: unknown): boolean | null {
  if (value === true || value === "Yes" || String(value).toLowerCase() === "yes") {
    return true;
  }
  if (value === false || value === "No" || String(value).toLowerCase() === "no") {
    return false;
  }
  return null;
}

export function mapContainersFromApi(
  raw: unknown,
): ServiceJobContainerDetail[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ ...EMPTY_SERVICE_JOB_CONTAINER }];
  }

  return raw.map((row) => {
    const container = (row ?? {}) as Record<string, unknown>;
    const typeDetails = container.container_type_details as
      | Record<string, unknown>
      | undefined;
    const containerType =
      typeDetails?.container_type_code != null
        ? String(typeDetails.container_type_code)
        : container.container_type_input != null
          ? String(container.container_type_input)
          : container.container_type != null
            ? String(container.container_type)
            : "";

    return {
      id: container.id != null ? Number(container.id) : undefined,
      container_type: containerType,
      container_no: container.container_no
        ? String(container.container_no)
        : "",
      actual_seal_no: container.actual_seal_no
        ? String(container.actual_seal_no)
        : "",
      customs_seal_no: container.customs_seal_no
        ? String(container.customs_seal_no)
        : "",
      loading_date: parseApiDate(container.loading_date),
      unloading_date: parseApiDate(
        container.unloading_date ?? container.uploading_date,
      ),
    };
  });
}

export function mapCargoDetailsFromApi(
  raw: unknown,
  containers: ServiceJobContainerDetail[],
): ServiceJobCargoDetail[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ ...EMPTY_SERVICE_JOB_CARGO }];
  }

  return raw.map((row) => {
    const cargo = (row ?? {}) as Record<string, unknown>;
    const containerNumber = cargo.container_no
      ? String(cargo.container_no)
      : "";
    const matched = containers.find((c) => c.container_no === containerNumber);
    const containerId =
      cargo.container_id != null
        ? Number(cargo.container_id)
        : matched?.id != null
          ? Number(matched.id)
          : undefined;

    return {
      id: cargo.id != null ? Number(cargo.id) : undefined,
      container_number: containerNumber,
      container_id: containerId,
      package_type: pickPackageTypeCodeFromCargo(cargo),
      no_of_packages:
        cargo.no_of_packages != null && cargo.no_of_packages !== ""
          ? Number(cargo.no_of_packages)
          : null,
      gross_weight: importHouseCargoWeightFromApi(cargo.gross_weight),
      volume: importHouseCargoWeightFromApi(
        cargo.volume ?? cargo.volume_weight,
      ),
      chargeable_weight: importHouseCargoWeightFromApi(cargo.chargeable_weight),
      haz: mapHazFromApi(cargo.haz),
    };
  });
}

export function mapContainersForPayload(
  containers: ServiceJobContainerDetail[],
  mode: "create" | "edit",
  cargoMode: ServiceJobCargoMode,
): Record<string, unknown>[] {
  if (!isSeaServiceJobCargoMode(cargoMode)) return [];

  return containers
    .filter(
      (c) =>
        String(c.container_type ?? "").trim() !== "" ||
        String(c.container_no ?? "").trim() !== "" ||
        String(c.actual_seal_no ?? "").trim() !== "" ||
        String(c.customs_seal_no ?? "").trim() !== "" ||
        c.loading_date != null ||
        c.unloading_date != null,
    )
    .map((container) => ({
      ...(mode === "edit" &&
        container.id != null && { id: Number(container.id) }),
      container_type_input: container.container_type || null,
      container_no: container.container_no || null,
      actual_seal_no: container.actual_seal_no || null,
      customs_seal_no: container.customs_seal_no || null,
      loading_date: container.loading_date
        ? dayjs(container.loading_date).format("YYYY-MM-DD")
        : null,
      uploading_date: container.unloading_date
        ? dayjs(container.unloading_date).format("YYYY-MM-DD")
        : null,
    }));
}

export function mapCargoDetailsForPayload(
  cargoDetails: ServiceJobCargoDetail[],
  containers: ServiceJobContainerDetail[],
  mode: "create" | "edit",
  cargoMode: ServiceJobCargoMode,
): Record<string, unknown>[] {
  const weightUnit = cargoMode === "AIR" ? "air" : "ocean";
  const sea = isSeaServiceJobCargoMode(cargoMode);

  return cargoDetails
    .filter((cargo) => {
      return (
        String(cargo.container_number ?? "").trim() !== "" ||
        String(cargo.package_type ?? "").trim() !== "" ||
        cargo.no_of_packages != null ||
        cargo.gross_weight != null ||
        cargo.volume != null ||
        cargo.haz != null
      );
    })
    .map((cargo) => {
      const packageCode = normalizePackageTypeCode(cargo.package_type) || null;
      const matched = containers.find(
        (c) => c.container_no === cargo.container_number,
      );
      const resolvedContainerId =
        cargo.container_id != null
          ? Number(cargo.container_id)
          : matched?.id != null
            ? Number(matched.id)
            : undefined;

      const payload: Record<string, unknown> = {
        ...(mode === "edit" && cargo.id != null && { id: Number(cargo.id) }),
        no_of_packages: cargo.no_of_packages ?? null,
        gross_weight: formatHouseCargoWeightForPayload(cargo.gross_weight),
        volume: formatHouseCargoWeightForPayload(cargo.volume),
        chargeable_weight: formatHouseCargoChargeableForPayload(
          cargo.gross_weight,
          cargo.volume,
          weightUnit,
        ),
        haz: cargo.haz,
        package_type: packageCode || "",
        package_type_code: packageCode,
      };

      if (sea && cargo.container_number) {
        payload.container_no = String(cargo.container_number);
      }
      if (sea && resolvedContainerId != null) {
        payload.container_id = resolvedContainerId;
      }

      return payload;
    });
}
