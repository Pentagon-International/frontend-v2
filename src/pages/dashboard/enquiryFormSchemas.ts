import * as yup from "yup";

export const customerFormSchema = yup.object({
  customer_code: yup.string().required("Customer code is required"),
  enquiry_received_date: yup
    .string()
    .required("Enquiry received date is required"),
  sales_person: yup.string().required("Sales person is required"),
  sales_coordinator: yup.string().nullable().optional(),
  customer_services: yup.string().nullable().optional(),
  reference_no: yup
    .string()
    .nullable()
    .optional()
    .max(100, "Reference number cannot exceed 100 characters"),
  customer_address: yup.string().nullable().optional(),
  network_id: yup.string().nullable().optional(),
  network_name: yup.string().nullable().optional(),
});

/** Customer fields required for direct quotation create. */
export const directQuoteCustomerSchema = yup.object({
  customer_code: yup.string().required("Customer code is required"),
  enquiry_received_date: yup
    .string()
    .required("Enquiry received date is required"),
  sales_person: yup.string().required("Sales person is required"),
});

export const serviceFormSchema = yup.object({
  service_details: yup
    .array()
    .of(
      yup.object({
        id: yup.string().optional(),
        service: yup
          .string()
          .required("Service is required")
          .oneOf(["AIR", "FCL", "LCL", "OTHERS"], "Select service"),
        trade: yup.string().when("service", {
          is: (service: string) => service !== "OTHERS",
          then: (schema) => schema.required("Trade is required"),
          otherwise: (schema) => schema.nullable(),
        }),
        service_code: yup.string().when("service", {
          is: "OTHERS",
          then: (schema) => schema.required("Service name is required"),
          otherwise: (schema) => schema.nullable(),
        }),
        service_name: yup.string().when("service", {
          is: "OTHERS",
          then: (schema) => schema.optional(),
          otherwise: (schema) => schema.nullable(),
        }),
        origin_code: yup.string().required("Origin is required"),
        origin_name: yup.string().optional(),
        destination_code: yup.string().required("Destination is required"),
        destination_name: yup.string().optional(),
        pickup: yup.string().oneOf(["true", "false"]),
        delivery: yup.string().oneOf(["true", "false"]),
        service_remark: yup.string().optional(),
        commodity: yup.string().optional(),
        shipment_terms_code: yup
          .string()
          .required("Shipment terms are required"),
        icd: yup.string().optional(),
        pickup_location: yup.string().when("pickup", {
          is: "true",
          then: (schema) => schema.required("Pickup location is required"),
          otherwise: (schema) => schema.optional(),
        }),
        delivery_location: yup.string().when("delivery", {
          is: "true",
          then: (schema) => schema.required("Delivery location is required"),
          otherwise: (schema) => schema.optional(),
        }),
        cargo_details: yup
          .array()
          .of(
            yup.object({
              no_of_packages: yup.number().when("$service", {
                is: (service: string) => service === "AIR" || service === "LCL",
                then: (schema) =>
                  schema
                    .required("Number of packages is required")
                    .min(1, "Must be at least 1")
                    .integer("No decimals allowed")
                    .typeError("Must be a whole number")
                    .test(
                      "max-digits",
                      "Maximum 10 digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value),
                        ).toString();
                        return integerPart.length <= 10;
                      },
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              gross_weight: yup.number().when("$service", {
                is: (service: string) =>
                  service === "AIR" || service === "LCL" || service === "FCL",
                then: (schema) =>
                  schema
                    .required("Gross weight is required")
                    .min(0.01, "Must be greater than 0")
                    .test(
                      "decimal-places",
                      "Maximum 3 decimal places allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const decimalPart = String(value).split(".")[1];
                        return !decimalPart || decimalPart.length <= 3;
                      },
                    )
                    .test(
                      "max-digits",
                      "Maximum 8 integer digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value),
                        ).toString();
                        return integerPart.length <= 8;
                      },
                    )
                    .test(
                      "max-total-digits",
                      "Maximum 10 digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const valueStr = String(value).replace(/[^0-9]/g, "");
                        return valueStr.length <= 10;
                      },
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              volume_weight: yup.number().when("$service", {
                is: (service: string) => service === "AIR",
                then: (schema) =>
                  schema
                    .required("Volume weight is required")
                    .min(0.01, "Must be greater than 0")
                    .test(
                      "decimal-places",
                      "Maximum 3 decimal places allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const decimalPart = String(value).split(".")[1];
                        return !decimalPart || decimalPart.length <= 3;
                      },
                    )
                    .test(
                      "max-digits",
                      "Maximum 8 integer digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value),
                        ).toString();
                        return integerPart.length <= 8;
                      },
                    )
                    .test(
                      "max-total-digits",
                      "Maximum 10 digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const valueStr = String(value).replace(/[^0-9]/g, "");
                        return valueStr.length <= 10;
                      },
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              chargable_weight: yup.number().nullable().optional(),
              volume: yup.number().when("$service", {
                is: (service: string) => service === "LCL",
                then: (schema) =>
                  schema
                    .required("Volume is required")
                    .min(0.01, "Must be greater than 0")
                    .test(
                      "decimal-places",
                      "Maximum 3 decimal places allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const decimalPart = String(value).split(".")[1];
                        return !decimalPart || decimalPart.length <= 3;
                      },
                    )
                    .test(
                      "max-integer-digits",
                      "Maximum 7 integer digits allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const integerPart = Math.floor(
                          Math.abs(value),
                        ).toString();
                        return integerPart.length <= 7;
                      },
                    )
                    .test(
                      "max-total-digits",
                      "Maximum 10 digits in total allowed",
                      (value) => {
                        if (value === undefined || value === null) return true;
                        const valueStr = String(value).replace(".", "");
                        return valueStr.length <= 10;
                      },
                    ),
                otherwise: (schema) => schema.nullable(),
              }),
              chargable_volume: yup.number().nullable().optional(),
              container_type_code: yup.string().when("$service", {
                is: (service: string) => service === "FCL",
                then: (schema) => schema.required("Container type is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              no_of_containers: yup.number().when("$service", {
                is: (service: string) => service === "FCL",
                then: (schema) =>
                  schema
                    .required("Number of containers is required")
                    .min(1, "Must be at least 1")
                    .typeError("Must be a whole number"),
                otherwise: (schema) => schema.nullable(),
              }),
              hazardous_cargo: yup
                .string()
                .required("Hazardous cargo is required"),
              un_no: yup.string().when("hazardous_cargo", {
                is: (value: string) => value === "Yes",
                then: (schema) => schema.required("UN no is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              class: yup.string().when("hazardous_cargo", {
                is: (value: string) => value === "Yes",
                then: (schema) => schema.required("Class is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              pkg_group: yup.string().when("hazardous_cargo", {
                is: (value: string) => value === "Yes",
                then: (schema) => schema.required("PKG Group is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              stackable: yup.string().required("Stackable cargo is required"),
            }),
          )
          .min(1, "At least one cargo detail is required"),
      }),
    )
    .min(1, "At least one service detail is required"),
});
