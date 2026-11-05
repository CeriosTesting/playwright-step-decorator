import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - method naming and this", () => {
	setupMockStep();

	test("should use the class name for static methods", async () => {
		class MyTestClass {
			@step()
			static async create(): Promise<string> {
				return "created";
			}
		}

		await expect(MyTestClass.create()).resolves.toBe("created");
		expect(collectedSteps[0]).toBe("MyTestClass.create");
	});

	test("should use the subclass name when an inherited static method is called on it", async () => {
		class Base {
			@step()
			static async create(): Promise<void> {}
		}
		class Derived extends Base {}

		await Derived.create();
		expect(collectedSteps[0]).toBe("Derived.create");
	});

	test("should support symbol-named methods with and without a description", async () => {
		// Playwright's transpiler rejects any decorator on a symbol-named method, so apply this one by hand. This
		// covers code compiled by `tsc`, which passes the symbol through in `context.name`.
		class MyTestClass {}
		const method = async function (this: MyTestClass): Promise<void> {};
		const context = {
			kind: "method",
			name: Symbol("unnamed"),
			addInitializer: () => {},
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			access: {} as any,
			metadata: {},
			static: false,
			private: false,
		} as ClassMethodDecoratorContext<MyTestClass, typeof method>;

		await step()(method, context).call(new MyTestClass());
		await step("Described step")(method, context).call(new MyTestClass());
		expect(collectedSteps).toEqual(["MyTestClass.Symbol(unnamed)", "Described step"]);
	});

	test("should run a detached method that does not use this", async () => {
		class MyTestClass {
			@step("Value {{value}}")
			async withDescription(value: string): Promise<string> {
				return value;
			}

			@step()
			async withoutDescription(): Promise<string> {
				return "done";
			}
		}

		// oxlint-disable-next-line typescript-eslint/unbound-method -- detaching the method is what this test covers
		const { withDescription, withoutDescription } = new MyTestClass();
		await expect(withDescription("x")).resolves.toBe("x");
		await expect(withoutDescription()).resolves.toBe("done");
		expect(collectedSteps).toEqual(["Value x", "withoutDescription"]);
	});

	test("should still reject when a detached method uses this", async () => {
		class MyTestClass {
			private readonly value = "x";

			@step("Read value")
			async read(): Promise<string> {
				return this.value;
			}
		}

		// oxlint-disable-next-line typescript-eslint/unbound-method -- detaching the method is what this test covers
		const { read } = new MyTestClass();
		await expect(read()).rejects.toThrow(TypeError);
	});
});
