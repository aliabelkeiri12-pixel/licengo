import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "test/server-only-stub.ts") } },
  test: { include: ["test/**/*.test.ts"], fileParallelism: false, testTimeout: 30000, env: { DATABASE_URL: "postgresql://licengo:licengo@localhost:5432/licengo_test", NODE_ENV: "test" } },
});
