import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - placeholder value formatting", () => {
	setupMockStep();

	test("should format null as 'null'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val: null): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod(null);
		expect(collectedSteps[0]).toBe("Value: null");
	});

	test("should format explicit undefined as 'undefined'", async () => {
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

	test("should format boolean true as 'true'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val: boolean): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod(true);
		expect(collectedSteps[0]).toBe("Value: true");
	});

	test("should format boolean false as 'false'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val: boolean): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod(false);
		expect(collectedSteps[0]).toBe("Value: false");
	});

	test("should format bigint as its numeric string", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val: bigint): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod(BigInt(42));
		expect(collectedSteps[0]).toBe("Value: 42");
	});

	test("should format a named function as '[Function <name>]'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		function myNamedFn() {}
		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod(myNamedFn);
		expect(collectedSteps[0]).toBe("Value: [Function myNamedFn]");
	});

	test("should format an anonymous function as '[Function anonymous]'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		// Strip the inferred name so it behaves as anonymous
		const anonymousFn = Object.defineProperty(() => {}, "name", { value: "" });
		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod(anonymousFn);
		expect(collectedSteps[0]).toBe("Value: [Function anonymous]");
	});

	test("should format an Error instance as '<Name>: <message>'", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		const err = new TypeError("bad input");
		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod(err);
		expect(collectedSteps[0]).toBe("Value: TypeError: bad input");
	});

	test("should format an object with a circular reference containing [Circular]", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		const obj: Record<string, unknown> = { a: 1 };
		obj["self"] = obj;
		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod(obj);
		expect(collectedSteps[0]).toContain("[Circular]");
	});

	test("should format an object containing a Symbol value via JSON replacer", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod({ sym: Symbol("foo") });
		expect(collectedSteps[0]).toContain("Symbol(foo)");
	});

	test("should format an object containing a bigint value via JSON replacer", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod({ n: BigInt(99) });
		expect(collectedSteps[0]).toContain('"99"');
	});

	test("should format an object containing a nested function via JSON replacer", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any): Promise<void> {
				void val;
			}
		}

		function myFn() {}
		// oxlint-disable-next-line typescript-eslint/no-unsafe-argument
		await new MyTestClass().myMethod({ fn: myFn });
		expect(collectedSteps[0]).toContain("[Function myFn]");
	});
});
