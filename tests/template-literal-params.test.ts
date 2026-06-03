import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { setupMockStep } from "./helpers";

test.describe("step decorator - template literal in parameter list", () => {
	setupMockStep();

	test("should throw 'Unable to parse the parameter list' when a parameter default uses a template literal", () => {
		// TypeScript does not allow template literal defaults in parameter lists, so we construct
		// a function via new Function() whose toString() contains a template literal default.
		// The decorator reads the function source via toString() to resolve named placeholders,
		// and must throw when it encounters the unparseable template literal.
		// oxlint-disable-next-line no-implied-eval
		const rawFn = new Function("return async function myMethod(val = `hello`) { return val; }")() as (
			val?: string
		) => Promise<string>;

		class MyTestClass {}

		// Apply the @step decorator manually to match what the class decorator would do
		const decorated = step("Value: {{val}}")(rawFn, {
			kind: "method",
			name: "myMethod",
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			addInitializer: () => {},
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			access: {} as any,
			metadata: {},
			static: false,
			private: false,
		} as ClassMethodDecoratorContext<MyTestClass, typeof rawFn>);

		const instance = new MyTestClass();

		expect(() => decorated.call(instance)).toThrow("Unable to parse the parameter list for method");
	});
});
