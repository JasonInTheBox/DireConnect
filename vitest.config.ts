import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "**/dist/**", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
