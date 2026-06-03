import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - description formatting edge cases", () => {
	setupMockStep();

	test("should replace a repeated placeholder multiple times in the same description", async () => {
		class MyTestClass {
			@step("{{x}} and {{x}}")
			async myMethod(x: string): Promise<void> {
				void x;
			}
		}

		await new MyTestClass().myMethod("foo");
		expect(collectedSteps[0]).toBe("foo and foo");
	});

	test("should format rest parameter as '[]' when called with zero variadic arguments", async () => {
		class MyTestClass {
			@step("Items: {{items}}")
			async myMethod(...items: string[]): Promise<void> {
				void items;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Items: []");
	});

	test("should format explicit undefined passed for a named parameter with no default as 'undefined'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod(undefined);
		expect(collectedSteps[0]).toBe("Value: undefined");
	});
});
