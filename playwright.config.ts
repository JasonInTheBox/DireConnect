import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node e2e/start-web-server.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    stderr: "ignore",
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fake-publishable-key",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
