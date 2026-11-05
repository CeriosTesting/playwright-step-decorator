import { defineConfig } from "@playwright/test";

/**
 * Runs the smoke tests against the built package in `dist`. No browser is needed. Use `npm run test:dist`.
 */
export default defineConfig({
	testDir: "./tests-dist",
	forbidOnly: !!process.env.CI,
	reporter: "line",
	outputDir: "test-results/dist",
});
