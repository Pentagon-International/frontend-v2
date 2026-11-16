import { test, expect } from "@playwright/test";
import { seedAuth } from "../../fixtures/auth";
import { mockInvoiceApis } from "./fixtures/invoiceMocks";

test.describe("Transportation / Invoice — module routes", () => {
  test("air export job invoice route opens Create Invoice", async ({
    page,
  }) => {
    await seedAuth(page);
    await mockInvoiceApis(page);
    await page.goto("/air/export-job/invoice", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Create Invoice")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("sea export job invoice route opens Create Invoice", async ({
    page,
  }) => {
    await seedAuth(page);
    await mockInvoiceApis(page);
    await page.goto("/SeaExport/export-job/invoice", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Create Invoice")).toBeVisible({
      timeout: 30_000,
    });
  });
});
