import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - parameter parsing", () => {
	setupMockStep();

	test("should match parameters that follow line comments", async () => {
		class MyTestClass {
			@step("{{first}} / {{second}}")
			async myMethod(
				// The first value
				first: string,
				// The second value, with a comma and a ) in this comment
				second: string
			): Promise<void> {
				void first;
				void second;
			}
		}

		await new MyTestClass().myMethod("a", "b");
		expect(collectedSteps[0]).toBe("a / b");
	});

	test("should match parameters with block comments and trailing line comments", async () => {
		class MyTestClass {
			@step("{{first}} / {{second}} / {{third}}")
			async myMethod(
				first /* before the type */ : string,
				/* before the name */ second: string, // trailing
				third: string
			): Promise<void> {
				void first;
				void second;
				void third;
			}
		}

		await new MyTestClass().myMethod("a", "b", "c");
		expect(collectedSteps[0]).toBe("a / b / c");
	});

	test("should keep comment-like text and repeated spaces in a string default", async () => {
		class MyTestClass {
			@step("{{val}}")
			async myMethod(val = "a  // b /* c */"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("a  // b /* c */");
	});

	test("should match parameter names with non-ASCII letters", async () => {
		class MyTestClass {
			@step("{{naïve}} / {{名前}} / {{$a_1}}")
			async myMethod(naïve: string, 名前: string, $a_1: string): Promise<void> {
				void naïve;
				void 名前;
				void $a_1;
			}
		}

		await new MyTestClass().myMethod("a", "b", "c");
		expect(collectedSteps[0]).toBe("a / b / c");
	});

	test("should print hexadecimal, octal, binary and leading-dot number defaults", async () => {
		class MyTestClass {
			@step("{{hex}} {{octal}} {{binary}} {{fraction}} {{negative}} {{exponent}}")
			async myMethod(hex = 0x10, octal = 0o7, binary = 0b11, fraction = 0.5, negative = -0x10, exponent = 1e3) {
				void hex;
				void octal;
				void binary;
				void fraction;
				void negative;
				void exponent;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("16 7 3 0.5 -16 1000");
	});

	test("should print number defaults whose source keeps numeric separators or a leading dot", async () => {
		// Playwright's transpiler normalises some number literals. `tsc` keeps them, so read the raw source here.
		// oxlint-disable-next-line no-implied-eval
		const rawFn = new Function("return async function myMethod(big = 15_000, dot = .5, hex = 0xFF_FF) {}")() as (
			big?: number,
			dot?: number,
			hex?: number
		) => Promise<void>;
		class MyTestClass {}

		const decorated = step("{{big}} {{dot}} {{hex}}")(rawFn, {
			kind: "method",
			name: "myMethod",
			addInitializer: () => {},
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			access: {} as any,
			metadata: {},
			static: false,
			private: false,
		} as ClassMethodDecoratorContext<MyTestClass, typeof rawFn>);

		await decorated.call(new MyTestClass());
		expect(collectedSteps[0]).toBe("15000 0.5 65535");
	});
});
