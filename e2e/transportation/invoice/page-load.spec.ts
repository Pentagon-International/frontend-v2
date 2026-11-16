import { test, expect } from "@playwright/test";
import { openCreateInvoice } from "./helpers/invoicePage";

test.describe("Transportation / Invoice — page load", () => {
  test.beforeEach(async ({ page }) => {
    await openCreateInvoice(page);
  });

  test("shows Create Invoice title and Back button", async ({ page }) => {
    await expect(page.getByText("Create Invoice")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" }).first()).toBeVisible();
  });

  test("renders required header fields", async ({ page }) => {
    await expect(page.getByPlaceholder("Type customer name")).toBeVisible();
    await expect(page.getByPlaceholder("Select state")).toBeVisible();
    await expect(page.getByPlaceholder("Enter GSTN")).toBeVisible();
    await expect(
      page.getByPlaceholder("Enter shipment number"),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Select daybook")).toBeVisible();
    await expect(
      page.getByPlaceholder("Select document date"),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Select due date")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /Billing Currency/i }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Enter rate of exchange"),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/Select address|Enter address/i).first(),
    ).toBeVisible();
    await expect(page.getByPlaceholder("IRN No")).toBeVisible();
  });

  test("shows Save Invoice and Cancel actions", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Save Invoice" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("seeds one charge row with add-charge control", async ({ page }) => {
    await expect(page.getByText("Charge", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("button").filter({ has: page.locator("svg") }).last(),
    ).toBeVisible();
  });
});
