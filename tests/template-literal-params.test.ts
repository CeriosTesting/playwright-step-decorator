import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - template literal in parameter list", () => {
	setupMockStep();

	test("should resolve other parameters when a parameter default is a template literal", async () => {
		class MyTestClass {
			@step("Value: {{first}}, {{last}}")
			async myMethod(first: string, middle = `a, (b) ${"c"}`, last = "z"): Promise<void> {
				void first;
				void middle;
				void last;
			}
		}

		await new MyTestClass().myMethod("x");
		expect(collectedSteps[0]).toBe("Value: x, z");
	});

	test("should print an explicitly passed argument for a template literal default", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val = `hello`): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod("passed");
		expect(collectedSteps[0]).toBe("Value: passed");
	});

	test("should reject when an omitted template literal default is printed", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val = `hello`): Promise<void> {
				void val;
			}
		}

		await expect(new MyTestClass().myMethod()).rejects.toThrow(
			"Unable to resolve the default value for parameter 'val'"
		);
		expect(collectedSteps).toEqual([]);
	});
});
