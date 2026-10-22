import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // edge-runtime matches the Convex function runtime and provides Web Crypto
    // (used by the SHA-256 integrity helpers).
    environment: "edge-runtime",
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
