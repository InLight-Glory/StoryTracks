import { defineConfig } from "@playwright/test";
const baseURL = "http://127.0.0.1:5188";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  workers: 1,
  use: {
    channel: "msedge",
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: "storytracks-tutorial-v1", value: "completed" },
          ],
        },
      ],
    },
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 5188 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
  },
});
