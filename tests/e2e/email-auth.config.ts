import { defineConfig } from "@playwright/test";

const port = 3293;
const external = process.env.EMAIL_AUTH_BASE_URL;
export default defineConfig({
  testDir: ".",
  testMatch: "email-auth.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: external || `http://127.0.0.1:${port}`, storageState: process.env.EMAIL_AUTH_STORAGE_STATE, trace: "off", screenshot: "off", video: "off" },
  webServer: external ? undefined : {
    cwd: process.cwd(),
    command: `node_modules/.bin/next dev --webpack --hostname 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}/signin`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MODELS_DISABLED: "1" },
  },
});
