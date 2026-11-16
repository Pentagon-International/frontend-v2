import { test, expect } from "@playwright/test";
import { seedAuth } from "../../fixtures/auth";
import { mockInvoiceApis, savedInvoice } from "./fixtures/invoiceMocks";

test.describe("Transportation / Invoice — edit & view modes", () => {
  test("edit mode shows Edit Invoice and Update Invoice", async ({ page }) => {
    await seedAuth(page);
    await mockInvoiceApis(page);
    await page.goto(`/invoice/edit/${savedInvoice.id}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("Edit Invoice")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(savedInvoice.document_no)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update Invoice" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Post Invoice" }),
    ).toBeVisible();
  });

  test("view mode shows View Invoice and hides Save/Post", async ({
    page,
  }) => {
    await seedAuth(page);
    await mockInvoiceApis(page);
    await page.goto(`/invoice/view/${savedInvoice.id}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("View Invoice")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(savedInvoice.document_no)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Invoice" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Post Invoice" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Update Invoice" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Back" }).first()).toBeVisible();
  });

  test("view mode loads bill-to and shipment from API", async ({ page }) => {
    await seedAuth(page);
    await mockInvoiceApis(page);
    await page.goto(`/invoice/view/${savedInvoice.id}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("View Invoice")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByPlaceholder("Type customer name")).toHaveValue(
      /Acme Logistics/i,
      { timeout: 15_000 },
    );
    await expect(
      page.getByPlaceholder("Enter shipment number"),
    ).toHaveValue(savedInvoice.shipment_no);
  });
});
