import { test, expect } from "@playwright/test";
import { openCreateInvoice } from "./helpers/invoicePage";

test.describe("Transportation / Invoice — validation", () => {
  test("empty submit shows required field errors", async ({ page }) => {
    await openCreateInvoice(page);
    await page.getByRole("button", { name: "Save Invoice" }).click();

    await expect(page.getByText("Bill To is required")).toBeVisible();
    await expect(page.getByText("Address is required")).toBeVisible();
    await expect(page.getByText("Shipment No is required")).toBeVisible();
    await expect(page.getByText("Daybook is required")).toBeVisible();
  });
});
