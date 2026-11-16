import { test, expect } from "@playwright/test";
import {
  fillMinimumValidInvoice,
  openCreateInvoice,
} from "./helpers/invoicePage";

test.describe("Transportation / Invoice — save draft", () => {
  test("saving a valid invoice shows draft number and Post button", async ({
    page,
  }) => {
    await openCreateInvoice(page);
    await fillMinimumValidInvoice(page, "SHP-E2E-SAVE");

    await page.getByRole("button", { name: "Save Invoice" }).click();

    await expect(page.getByText("Draft Invoice Number")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("INV/2026/101")).toBeVisible();
    await expect(page.getByText("UNPOSTED")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Post Invoice" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update Invoice" }),
    ).toBeVisible();
  });
});
