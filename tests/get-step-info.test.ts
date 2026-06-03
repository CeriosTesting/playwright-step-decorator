import { test, expect } from "@playwright/test";

import { getStepInfo } from "../src/playwright-step-decorator";

test.describe("getStepInfo - error path", () => {
	test("should throw when called outside a step context with no argument", () => {
		expect(() => getStepInfo()).toThrow(
			"No Playwright step context found. Make sure this method is decorated with @step."
		);
	});

	test("should throw when called outside a step context with an instance argument", () => {
		const instance = { someProperty: true };
		expect(() => getStepInfo(instance)).toThrow(
			"No Playwright step context found. Make sure this method is decorated with @step."
		);
	});
});
