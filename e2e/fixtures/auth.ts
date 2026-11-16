import type { Page } from "@playwright/test";

/** Minimal authenticated user for Invoice Create E2E (India GST branch). */
export const e2eUser = {
  pulse_id: "E2E001",
  full_name: "E2E Tester",
  user_identifier: "e2e.tester@example.com",
  user_id: 9001,
  username: "e2etester",
  email: "e2e.tester@example.com",
  is_staff: true,
  is_manager: true,
  accounts: true,
  role_code: "ADMIN",
  role: "Admin",
  company: {
    company_id: 1,
    company_code: "PEN",
    company_name: "Pentagon Prime",
  },
  country: {
    country_id: 1,
    country_code: "IN",
    country_name: "India",
  },
  branches: [
    {
      user_branch_id: 1,
      branch_id: 1,
      branch_code: "BOM",
      branch_name: "Mumbai",
      is_default: true,
      main_default: true,
      currency: {
        currency_id: 1,
        currency_code: "INR",
      },
      country: {
        country_id: 1,
        country_code: "IN",
        country_name: "India",
      },
    },
  ],
  screen_permissions: {
    maker_checker: false,
    special_post: true,
    document_type: ["INV"],
  },
};

export const e2eAccessToken = "e2e-access-token";
export const e2eRefreshToken = "e2e-refresh-token";

/** Seed localStorage auth before the SPA boots (matches authStore). */
export async function seedAuth(page: Page) {
  await page.addInitScript(
    ({ user, accessToken, refreshToken }) => {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
    },
    {
      user: e2eUser,
      accessToken: e2eAccessToken,
      refreshToken: e2eRefreshToken,
    },
  );
}

/** Clear auth so the app shows the login screen. */
export async function clearAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}
