import { test, expect } from "@playwright/test";
import {
  fillBillTo,
  openCreateInvoice,
  selectByPlaceholder,
} from "./helpers/invoicePage";

test.describe("Transportation / Invoice — form interactions", () => {
  test.beforeEach(async ({ page }) => {
    await openCreateInvoice(page);
  });

  test("can enter shipment number", async ({ page }) => {
    const shipment = page.getByPlaceholder("Enter shipment number");
    await shipment.fill("SHP-E2E-001");
    await expect(shipment).toHaveValue("SHP-E2E-001");
  });

  test("can select daybook from dropdown", async ({ page }) => {
    await selectByPlaceholder(page, "Select daybook", "Sales Invoice");
    await expect(page.getByPlaceholder("Select daybook")).toHaveValue(
      /Sales Invoice/i,
    );
  });

  test("can search and select Bill To customer", async ({ page }) => {
    await fillBillTo(page);
    await expect(page.getByPlaceholder("Type customer name")).toHaveValue(
      /Acme Logistics/i,
    );
  });

  test("can add another charge row", async ({ page }) => {
    await expect(
      page.getByText("Charge", { exact: true }).first(),
    ).toBeVisible();

    const plusButtons = page.locator("button").filter({
      has: page.locator("svg.tabler-icon-plus, svg[class*='IconPlus']"),
    });
    const addBtn =
      (await plusButtons.count()) > 0
        ? plusButtons.last()
        : page.locator("form").locator("button[data-variant='light']").last();

    await addBtn.click();

    const trashButtons = page.locator("button").filter({
      has: page.locator("svg.tabler-icon-trash, svg[class*='IconTrash']"),
    });
    await expect(trashButtons.first()).toBeVisible({ timeout: 10_000 });
    await expect(trashButtons).not.toHaveCount(0);
  });
});
