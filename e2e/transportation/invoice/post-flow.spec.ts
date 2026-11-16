import { test, expect } from "@playwright/test";
import {
  fillMinimumValidInvoice,
  openCreateInvoice,
} from "./helpers/invoicePage";

test.describe("Transportation / Invoice — post flow", () => {
  test("Post Invoice marks document as POSTED and locks form", async ({
    page,
  }) => {
    await openCreateInvoice(page);
    await fillMinimumValidInvoice(page, "SHP-E2E-POST");

    await page.getByRole("button", { name: "Save Invoice" }).click();
    await expect(
      page.getByRole("button", { name: "Post Invoice" }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Post Invoice" }).click();

    await expect(page.getByText("POSTED", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Post Invoice" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save Invoice" }),
    ).toHaveCount(0);
  });
});
