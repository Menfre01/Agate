import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/types": path.resolve(__dirname, "./src/types"),
      "@/services": path.resolve(__dirname, "./src/services"),
      "@/utils": path.resolve(__dirname, "./src/utils"),
      "@/middleware": path.resolve(__dirname, "./src/middleware"),
      "@/api": path.resolve(__dirname, "./src/api"),
      "@/db": path.resolve(__dirname, "./src/db"),
      "@test/helpers": path.resolve(__dirname, "./tests/functional/helpers"),
      "@test/integration": path.resolve(__dirname, "./tests/integration"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    },
  },
});
