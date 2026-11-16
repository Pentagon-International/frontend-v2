import { test, expect } from "@playwright/test";
import { clearAuth } from "../../fixtures/auth";

test.describe("Transportation / Invoice — auth gate", () => {
  test("unauthenticated user sees login instead of invoice page", async ({
    page,
  }) => {
    await clearAuth(page);
    await page.goto("/invoice", { waitUntil: "domcontentloaded" });

    // RootRouter keeps the URL but renders Login when there is no token
    await expect(
      page.getByRole("button", { name: /^Login$/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Create Invoice")).toHaveCount(0);
  });
});
