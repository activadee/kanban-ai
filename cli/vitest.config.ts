import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "lcov"],
            include: ["src/**/*.ts"],
            thresholds: {
                statements: 85,
                branches: 60,
                lines: 85,
                functions: 80,
            },
        },
    },
});
