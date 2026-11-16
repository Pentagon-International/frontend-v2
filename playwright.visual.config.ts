import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * Headed visual run — browser stays visible with slowed actions
 * so you can watch form fills and assertions.
 */
export default defineConfig({
  ...base,
  workers: 1,
  retries: 0,
  use: {
    ...base.use,
    headless: false,
    launchOptions: {
      slowMo: 450,
    },
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], headless: false },
    },
  ],
});
