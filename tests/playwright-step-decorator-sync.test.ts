import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

const collectedSteps: string[] = [];

const mockTestStep = async (
	desc: string,
	fn: () => Promise<unknown>,
	options?: { location?: { file: string; line: number; column: number } }
) => {
	collectedSteps.push(desc);
	void options;
	return await fn();
};

test.describe("step decorator - sync methods", () => {
	let originalStep: typeof test.step;

	test.beforeAll(() => {
		originalStep = (test as { step: typeof test.step }).step;
		// oxlint-disable-next-line typescript-eslint/no-explicit-any
		(test as any).step = mockTestStep;
	});

	test.afterAll(() => {
		// oxlint-disable-next-line typescript-eslint/no-explicit-any
		(test as any).step = originalStep;
	});

	test.beforeEach(() => {
		collectedSteps.length = 0;
	});

	test("should support sync void method with default description", async () => {
		const sideEffects: string[] = [];
		class MyTestClass {
			@step()
			doWork(): void {
				sideEffects.push("done");
			}
		}
		const instance = new MyTestClass();
		instance.doWork();
		expect(sideEffects).toEqual(["done"]);
		expect(collectedSteps[0]).toBe("MyTestClass.doWork");
	});

	test("should support sync void method with static description", async () => {
		const sideEffects: string[] = [];
		class MyTestClass {
			@step("Click the button")
			clickButton(): void {
				sideEffects.push("clicked");
			}
		}
		const instance = new MyTestClass();
		instance.clickButton();
		expect(sideEffects).toEqual(["clicked"]);
		expect(collectedSteps[0]).toBe("Click the button");
	});

	test("should support sync void method with placeholder in description", async () => {
		const sideEffects: string[] = [];
		class MyTestClass {
			@step("Set value to {{value}}")
			setValue(value: string): void {
				sideEffects.push(value);
			}
		}
		const instance = new MyTestClass();
		instance.setValue("hello");
		expect(sideEffects).toEqual(["hello"]);
		expect(collectedSteps[0]).toBe("Set value to hello");
	});

	test("should support sync method returning a string", async () => {
		class MyTestClass {
			@step("Get greeting for {{name}}")
			getGreeting(name: string): string {
				return `Hello ${name}`;
			}
		}
		const instance = new MyTestClass();
		const result = await instance.getGreeting("Alice");
		expect(result).toBe("Hello Alice");
		expect(collectedSteps[0]).toBe("Get greeting for Alice");
	});

	test("should support sync method returning a number", async () => {
		class MyTestClass {
			@step("Add {{a}} and {{b}}")
			add(a: number, b: number): number {
				return a + b;
			}
		}
		const instance = new MyTestClass();
		const result = await instance.add(2, 3);
		expect(result).toBe(5);
		expect(collectedSteps[0]).toBe("Add 2 and 3");
	});

	test("should support sync method returning an object", async () => {
		class MyTestClass {
			@step("Build user {{name}}")
			buildUser(name: string): { name: string; active: boolean } {
				return { name, active: true };
			}
		}
		const instance = new MyTestClass();
		const result = await instance.buildUser("Bob");
		expect(result).toEqual({ name: "Bob", active: true });
		expect(collectedSteps[0]).toBe("Build user Bob");
	});
});
