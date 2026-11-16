import type { Page, Route } from "@playwright/test";

const API_HOST = "127.0.0.1:8000";

const daybooks = [{ id: 1, name: "Sales Invoice" }];
const currencies = [
  { id: 1, currency_code: "INR", code: "INR" },
  { id: 2, currency_code: "USD", code: "USD" },
];
const states = [
  { id: 1, state_name: "Maharashtra" },
  { id: 2, state_name: "Karnataka" },
];
const charges = [
  {
    id: 10,
    charge_code: "FRT",
    charge_name: "Freight",
    name: "Freight",
  },
];
const units = [
  { id: 1, unit_code: "KG", code: "KG", name: "Kilogram" },
  { id: 2, unit_code: "SHPT", code: "SHPT", name: "Shipment" },
];

const customers = [
  {
    id: 100,
    customer_code: "CUST001",
    customer_name: "Acme Logistics Pvt Ltd",
    addresses_data: [
      {
        id: 501,
        address: "12 Marine Drive, Mumbai",
        state_id: 1,
        gstn: "27AAAAA0000A1Z5",
      },
    ],
  },
];

export const savedInvoice = {
  id: 55,
  customer_id: 100,
  document_no: "INV/2026/055",
  status: "UNPOSTED",
  bill_to: "CUST001",
  bill_to_name: "Acme Logistics Pvt Ltd",
  address: "12 Marine Drive, Mumbai",
  state_id: 1,
  gstn: "27AAAAA0000A1Z5",
  shipment_no: "AEJOB-1001",
  day_book_id: 1,
  day_book_name: "Sales Invoice",
  document_date: "15/11/2026",
  due_date: "30/11/2026",
  currency_code: "INR",
  currency_id: 1,
  roe: 1,
  narration: "E2E saved invoice",
  has_sez: false,
  charges: [
    {
      id: 901,
      charge_id: 10,
      charge_code: "FRT",
      charge_name: "Freight",
      unit_id: 2,
      unit_code: "SHPT",
      no_of_unit: 1,
      currency_id: 1,
      currency_code: "INR",
      roe: 1,
      amount_per_unit: 1000,
      amount: 1000,
      amount_in_local: 1000,
      amount_in_header: 1000,
      tax_code: "996521",
      Dr_Cr: "Cr",
      igst_rate: 0,
      cgst_rate: 9,
      sgst_rate: 9,
      igst: 0,
      cgst: 90,
      sgst: 90,
    },
  ],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") + "/";
  } catch {
    return url;
  }
}

/** Intercept backend API calls used by Invoice Create / Edit / View. */
export async function mockInvoiceApis(page: Page) {
  await page.route(`**://${API_HOST}/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();
    const path = pathOf(url);

    // Masters
    if (path.includes("/currency-master/") && method === "GET") {
      return json(route, currencies);
    }
    if (path.includes("/state/") && method === "GET") {
      return json(route, states);
    }
    if (path.includes("/filter/day-book-master/") && method === "POST") {
      // axios interceptor returns body; fetchDaybook uses body.data
      return json(route, { data: daybooks });
    }
    if (path.includes("/filter/charge-master/") && method === "POST") {
      return json(route, { data: charges });
    }
    // Charge SearchableSelect uses GET charge-master/?search=
    if (path.includes("/charge-master/") && method === "GET") {
      return json(route, { data: charges });
    }
    if (path.includes("/unit-master/filter/") && method === "POST") {
      return json(route, { data: units });
    }
    if (path.includes("/unit-master/") && method === "GET") {
      return json(route, { data: units });
    }
    if (path.includes("/exchange-rate-master/") && method === "GET") {
      return json(route, { sell_rate: 83.5 });
    }

    // Bill To search / conditional list
    if (
      (path.includes("/customer_master/conditional-list/") ||
        path.includes("/customer_master/customer-master/")) &&
      (method === "GET" || method === "POST")
    ) {
      return json(route, customers);
    }

    // SEZ / credit
    if (path.includes("/check-sez-status") || path.includes("sez")) {
      return json(route, {
        sez: false,
        credit_day: 15,
        credit_amount: 100000,
        sez_valid_date: null,
      });
    }

    // GST helpers
    if (path.includes("gst-rates-by-state-sac") && method === "POST") {
      return json(route, {
        data: {
          igst_percent: 0,
          cgst_percent: 9,
          sgst_percent: 9,
          same_state: true,
        },
      });
    }
    if (path.includes("get-effective-sac") && method === "POST") {
      return json(route, {
        data: [
          {
            charge_id: 10,
            service_id: 1,
            sac_code: "996521",
            sac_name: "Freight",
          },
        ],
      });
    }
    if (path.includes("calculate-gst-breakup") && method === "POST") {
      return json(route, { data: [] });
    }

    // Invoice CRUD
    if (path.match(/\/invoice\/\d+\/?$/) && method === "GET") {
      return json(route, { data: savedInvoice });
    }
    if (path.includes("/filter/invoice/") && method === "POST") {
      return json(route, { data: [savedInvoice] });
    }
    if (
      path.includes("/invoice/") &&
      method === "POST" &&
      !path.includes("gst") &&
      !path.includes("calculate") &&
      !path.includes("combined") &&
      !path.includes("revers")
    ) {
      return json(route, {
        id: 101,
        customer_id: 100,
        document_no: "INV/2026/101",
        status: "UNPOSTED",
        charges: [
          {
            id: 901,
            charge_id: 10,
            charge_name: "Freight",
          },
        ],
      });
    }
    if (path.includes("/invoice/") && method === "PUT") {
      const posted = url.includes("POSTED");
      let body: Record<string, unknown> = {};
      try {
        body = request.postDataJSON() as Record<string, unknown>;
      } catch {
        body = {};
      }
      const status =
        String(body.status ?? "").toUpperCase() === "POSTED"
          ? "POSTED"
          : "UNPOSTED";
      return json(route, {
        id: body.id ?? 101,
        customer_id: 100,
        document_no: "INV/2026/101",
        status,
        charges: body.charges ?? [],
        posted,
      });
    }

    // Token refresh / anything else → empty success
    if (path.includes("/token/refresh/")) {
      return json(route, {
        access: "e2e-access-token-refreshed",
        refresh: "e2e-refresh-token",
      });
    }

    return json(route, { data: [] });
  });
}
