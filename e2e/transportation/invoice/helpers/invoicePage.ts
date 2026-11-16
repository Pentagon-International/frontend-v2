import { expect, type Page } from "@playwright/test";
import { seedAuth } from "../../../fixtures/auth";
import { mockInvoiceApis } from "../fixtures/invoiceMocks";

/** Open Invoice Create with auth + API mocks. */
export async function openCreateInvoice(page: Page, path = "/invoice") {
  await seedAuth(page);
  await mockInvoiceApis(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Create Invoice")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByPlaceholder("Type customer name")).toBeVisible({
    timeout: 30_000,
  });
}

/** Open a Mantine select/search field by placeholder and pick an option. */
export async function selectByPlaceholder(
  page: Page,
  placeholder: string | RegExp,
  optionLabel: string | RegExp,
) {
  const input = page.getByPlaceholder(placeholder).first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  // Daybook stays readOnly while masters load — wait until clickable
  await expect
    .poll(async () => !(await input.isDisabled()), { timeout: 20_000 })
    .toBeTruthy();
  await input.click({ force: true });
  const option = page.getByRole("option", { name: optionLabel }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
}

/** @deprecated Prefer selectByPlaceholder — kept for label-based callers. */
export async function selectDropdownOption(
  page: Page,
  fieldLabel: string,
  optionLabel: string,
) {
  const placeholderByLabel: Record<string, string> = {
    Daybook: "Select daybook",
    State: "Select state",
    Address: "Select address",
    "Billing Currency": "Select currency",
  };
  const placeholder = placeholderByLabel[fieldLabel];
  if (placeholder) {
    await selectByPlaceholder(page, placeholder, optionLabel);
    return;
  }
  const field = page
    .locator(".mantine-InputWrapper-root")
    .filter({ has: page.getByText(fieldLabel, { exact: true }) })
    .first();
  await field
    .locator("[role='textbox'], input, .mantine-Select-input")
    .first()
    .click();
  await page.getByRole("option", { name: optionLabel }).click();
}

/** Search and select Bill To customer. */
export async function fillBillTo(page: Page, searchText = "Acme") {
  const billTo = page.getByPlaceholder("Type customer name");
  await billTo.click();
  await billTo.fill(searchText);
  await expect(
    page.getByRole("option", { name: /Acme Logistics/i }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("option", { name: /Acme Logistics/i }).click();
  await expect(billTo).toHaveValue(/Acme Logistics/i, { timeout: 10_000 });
}

/** Ensure Address / State / GSTN are filled after Bill To selection. */
export async function ensureAddressAndState(page: Page) {
  const addressInput = page
    .getByPlaceholder(/Select address|Enter address/i)
    .first();
  await expect(addressInput).toBeVisible({ timeout: 15_000 });

  let addressValue = "";
  try {
    await expect
      .poll(async () => (await addressInput.inputValue()).trim(), {
        timeout: 8_000,
      })
      .not.toBe("");
    addressValue = (await addressInput.inputValue()).trim();
  } catch {
    addressValue = "";
  }

  if (!addressValue) {
    await addressInput.click();
    const addressOption = page.getByRole("option", {
      name: /12 Marine Drive, Mumbai/i,
    });
    if ((await addressOption.count()) > 0) {
      await addressOption.first().click();
    } else {
      await addressInput.fill("12 Marine Drive, Mumbai");
    }
  }

  const stateInput = page.getByPlaceholder("Select state").first();
  await expect(stateInput).toBeVisible({ timeout: 15_000 });
  const stateValue = await stateInput.inputValue().catch(() => "");
  const stateLooksFilled =
    /Maharashtra|Karnataka|\d+/i.test(stateValue) ||
    /Maharashtra|Karnataka/i.test(
      await stateInput.evaluate((el) => (el as HTMLInputElement).value || ""),
    );
  if (!stateLooksFilled) {
    await selectByPlaceholder(page, "Select state", "Maharashtra");
  }

  const gstn = page.getByPlaceholder("Enter GSTN");
  const gstnValue = await gstn.inputValue().catch(() => "");
  if (!gstnValue) {
    await gstn.fill("27AAAAA0000A1Z5");
  }
}

/** Select first charge row from charge master and enter a simple amount. */
export async function fillFirstChargeRow(page: Page) {
  const chargeInput = page.getByPlaceholder(/Search charge master/i).first();
  await expect(chargeInput).toBeVisible({ timeout: 15_000 });
  await chargeInput.click();
  await chargeInput.fill("Freight");
  const freightOption = page.getByRole("option", { name: /Freight/i }).first();
  await expect(freightOption).toBeVisible({ timeout: 15_000 });
  await freightOption.click();

  const unitInput = page.getByPlaceholder(/Select [Uu]nit/i).first();
  if (await unitInput.isVisible().catch(() => false)) {
    const unitValue = await unitInput.inputValue().catch(() => "");
    if (!unitValue) {
      await selectByPlaceholder(page, /Select [Uu]nit/i, /SHPT|Shipment|KG/i);
    }
  }

  const currencyInput = page
    .locator("form")
    .getByPlaceholder("Select Currency")
    .first();
  await expect(currencyInput).toBeVisible({ timeout: 10_000 });
  const currencyValue = await currencyInput.inputValue().catch(() => "");
  if (!/^INR$/i.test(currencyValue)) {
    await currencyInput.click();
    await page.getByRole("option", { name: /^INR$/i }).first().click();
  }

  const chargeRoe = page.getByPlaceholder("ROE").first();
  await chargeRoe.fill("1");

  const perUnit = page.getByPlaceholder("Per Unit").first();
  await perUnit.fill("1000");
  const noOfUnit = page.getByPlaceholder("No of Unit").first();
  await noOfUnit.fill("1");
}

/** Fill the minimum fields required to save a draft invoice. */
export async function fillMinimumValidInvoice(
  page: Page,
  shipmentNo: string,
) {
  await fillBillTo(page);
  await ensureAddressAndState(page);
  await page.getByPlaceholder("Enter shipment number").fill(shipmentNo);
  await selectByPlaceholder(page, "Select daybook", "Sales Invoice");
  await fillFirstChargeRow(page);
}
