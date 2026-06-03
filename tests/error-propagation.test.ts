import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { setupMockStep } from "./helpers";

test.describe("step decorator - error propagation", () => {
	setupMockStep();

	test("should propagate a thrown string unchanged", async () => {
		class MyTestClass {
			@step("Failing step")
			async myMethod(): Promise<void> {
				throw "a string error";
			}
		}

		let caught: unknown;
		try {
			await new MyTestClass().myMethod();
		} catch (error) {
			caught = error;
		}

		expect(caught).toBe("a string error");
	});

	test("should propagate a thrown number unchanged", async () => {
		class MyTestClass {
			@step("Failing step")
			async myMethod(): Promise<void> {
				throw 42;
			}
		}

		let caught: unknown;
		try {
			await new MyTestClass().myMethod();
		} catch (error) {
			caught = error;
		}

		expect(caught).toBe(42);
	});

	test("should propagate an Error with undefined stack without crashing the decorator", async () => {
		class MyTestClass {
			@step("Failing step")
			async myMethod(): Promise<void> {
				const error = new Error("boom");
				Object.defineProperty(error, "stack", { value: undefined, configurable: true, writable: true });
				throw error;
			}
		}

		let caught: Error | undefined;
		try {
			await new MyTestClass().myMethod();
		} catch (error) {
			caught = error as Error;
		}

		expect(caught).toBeInstanceOf(Error);
		expect(caught?.message).toBe("boom");
		expect(caught?.stack).toBeUndefined();
	});
});
