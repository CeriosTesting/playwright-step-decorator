import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - literal default values", () => {
	setupMockStep();

	test("should show number default when argument is omitted", async () => {
		class MyTestClass {
			@step("Count: {{count}}")
			async myMethod(count = 42): Promise<void> {
				void count;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Count: 42");
	});

	test("should show boolean true default when argument is omitted", async () => {
		class MyTestClass {
			@step("Enabled: {{enabled}}")
			async myMethod(enabled = true): Promise<void> {
				void enabled;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Enabled: true");
	});

	test("should show boolean false default when argument is omitted", async () => {
		class MyTestClass {
			@step("Enabled: {{enabled}}")
			async myMethod(enabled = false): Promise<void> {
				void enabled;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Enabled: false");
	});

	test("should show null default when argument is omitted", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any = null): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: null");
	});

	test("should show undefined default when argument is omitted", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any, no-useless-default-assignment
			async myMethod(val: any = undefined): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: undefined");
	});

	test("should show bigint default when argument is omitted", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// @ts-expect-error TS2737 -- BigInt literal required to test parseLiteralDefaultValue source parsing
			async myMethod(val = 42n): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: 42");
	});

	test("should resolve \\n escape sequence in string default", async () => {
		class MyTestClass {
			// The default value source contains the two chars \n which parseLiteralDefaultValue
			// should decode into an actual newline character.
			@step("Value: {{val}}")
			async myMethod(val = "hello\nworld"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: hello\nworld");
	});

	test("should resolve \\uXXXX escape sequence in string default", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val = "\u0041"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: A");
	});

	test("should resolve \\xXX escape sequence in string default", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val = "\x41"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: A");
	});
});
