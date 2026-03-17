import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Legacy aliases (for backward compatibility with existing tests)
      "@/types": path.resolve(__dirname, "./packages/shared/src/types"),
      "@/utils": path.resolve(__dirname, "./packages/shared/src/utils"),
      "@/db": path.resolve(__dirname, "./packages/shared/src/db"),
      "@/middleware": path.resolve(__dirname, "./packages/shared/src/middleware"),

      // Legacy service aliases (point to admin worker services)
      // More specific aliases must come first
      "@/api/proxy": path.resolve(__dirname, "./workers/proxy/src/api/proxy"),
      "@/api": path.resolve(__dirname, "./workers/admin/src/api"),
      "@/services": path.resolve(__dirname, "./workers/admin/src/services"),

      // New explicit aliases
      "@agate/shared": path.resolve(__dirname, "./packages/shared/src"),
      "@agate/shared/types": path.resolve(__dirname, "./packages/shared/src/types"),
      "@agate/shared/utils": path.resolve(__dirname, "./packages/shared/src/utils"),
      "@agate/shared/db": path.resolve(__dirname, "./packages/shared/src/db"),
      "@agate/shared/middleware": path.resolve(__dirname, "./packages/shared/src/middleware"),
      "@agate/shared/services": path.resolve(__dirname, "./packages/shared/src/services"),

      "@agate/proxy": path.resolve(__dirname, "./workers/proxy/src"),
      "@agate/admin": path.resolve(__dirname, "./workers/admin/src"),

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
      include: [
        "packages/shared/src/**/*.ts",
        "workers/proxy/src/**/*.ts",
        "workers/admin/src/**/*.ts"
      ],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
