import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedLocations, setupMockStep, withMockedErrorStack } from "./helpers";

test.describe("step decorator - bundler URL normalisation", () => {
	setupMockStep();

	test("should strip webpack:// prefix from captured location path", async () => {
		class MyTestClass {
			@step("Webpack step")
			async myMethod(): Promise<void> {}
		}

		await withMockedErrorStack(
			[
				"Error",
				"    at captureCallSiteLocation (webpack:///repo/src/playwright-step-decorator.ts:10:5)",
				"    at replacementMethod (webpack:///repo/src/playwright-step-decorator.ts:20:5)",
				"    at MyTestClass.myMethod (webpack:///repo/tests/example.spec.ts:30:7)",
			].join("\n"),
			async () => {
				await new MyTestClass().myMethod();
			}
		);

		expect(collectedLocations[0]).toEqual({
			file: "/repo/tests/example.spec.ts",
			line: 30,
			column: 7,
		});
	});

	test("should strip vite:// prefix from captured location path", async () => {
		class MyTestClass {
			@step("Vite step")
			async myMethod(): Promise<void> {}
		}

		await withMockedErrorStack(
			[
				"Error",
				"    at captureCallSiteLocation (vite:///repo/src/playwright-step-decorator.ts:10:5)",
				"    at replacementMethod (vite:///repo/src/playwright-step-decorator.ts:20:5)",
				"    at MyTestClass.myMethod (vite:///repo/tests/example.spec.ts:30:7)",
			].join("\n"),
			async () => {
				await new MyTestClass().myMethod();
			}
		);

		expect(collectedLocations[0]).toEqual({
			file: "/repo/tests/example.spec.ts",
			line: 30,
			column: 7,
		});
	});

	test("should strip rollup:// prefix from captured location path", async () => {
		class MyTestClass {
			@step("Rollup step")
			async myMethod(): Promise<void> {}
		}

		await withMockedErrorStack(
			[
				"Error",
				"    at captureCallSiteLocation (rollup:///repo/src/playwright-step-decorator.ts:10:5)",
				"    at replacementMethod (rollup:///repo/src/playwright-step-decorator.ts:20:5)",
				"    at MyTestClass.myMethod (rollup:///repo/tests/example.spec.ts:30:7)",
			].join("\n"),
			async () => {
				await new MyTestClass().myMethod();
			}
		);

		expect(collectedLocations[0]).toEqual({
			file: "/repo/tests/example.spec.ts",
			line: 30,
			column: 7,
		});
	});
});
