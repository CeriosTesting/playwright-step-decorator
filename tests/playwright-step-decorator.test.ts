import { test, expect, TestStepInfo } from "@playwright/test";

import { getStepInfo, step, stepResult } from "../src/playwright-step-decorator";

type MockLocation = { file: string; line: number; column: number };
type MockStepOptions = { box?: boolean; location?: MockLocation; timeout?: number };

const collectedSteps: string[] = [];
const collectedLocations: Array<MockLocation | undefined> = [];
const collectedStepOptions: Array<MockStepOptions | undefined> = [];
let nextMockStepId = 1;

type MockStepInfo = {
	readonly id: number;
	attach: TestStepInfo["attach"];
	skip: TestStepInfo["skip"];
};

const getCurrentLineNumber = () => {
	const stack = new Error().stack;
	if (!stack) return -1;
	const line = stack.split("\n")[2];
	if (!line) return -1;
	const match = line.match(/:(\d+):(\d+)\)?$/);
	return match ? Number(match[1]) : -1;
};

const createDeferred = <T = void>() => {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>(resolver => {
		resolve = resolver;
	});
	return { promise, resolve };
};

const withMockedErrorStack = async (stack: string, action: () => Promise<void>) => {
	const originalError = globalThis.Error;
	class MockError extends originalError {
		override stack: string;

		constructor(message?: string) {
			super(message);
			this.stack = stack;
		}
	}

	Object.defineProperty(globalThis, "Error", {
		configurable: true,
		writable: true,
		value: MockError,
	});

	try {
		await action();
	} finally {
		Object.defineProperty(globalThis, "Error", {
			configurable: true,
			writable: true,
			value: originalError,
		});
	}
};

const mockTestStep = async (desc: string, fn: (step: TestStepInfo) => Promise<unknown>, options?: MockStepOptions) => {
	collectedSteps.push(desc);
	collectedLocations.push(options?.location);
	collectedStepOptions.push(options ? { ...options } : undefined);
	const stepInfo: MockStepInfo = {
		id: nextMockStepId++,
		attach: async () => {},
		skip: () => {},
	};
	return await fn(stepInfo as unknown as TestStepInfo);
};

test.describe("stepResult helper", () => {
	test("should resolve without a value", async () => {
		expect(await stepResult()).toBeUndefined();
	});

	test("should resolve a provided value", async () => {
		expect(await stepResult("value")).toBe("value");
	});

	test("should resolve the result of a lambda with multiple actions", async () => {
		const sideEffects: string[] = [];

		const result = await stepResult(() => {
			sideEffects.push("first");
			sideEffects.push("second");
			return sideEffects.join("-");
		});

		expect(result).toBe("first-second");
		expect(sideEffects).toEqual(["first", "second"]);
	});

	test("should reject when a lambda throws", async () => {
		await expect(
			stepResult(() => {
				throw new Error("boom");
			})
		).rejects.toThrow("boom");
	});

	test("should resolve a function value when it is returned from a lambda", async () => {
		const actualFunction = () => "value";

		expect(await stepResult(() => actualFunction)).toBe(actualFunction);
	});
});

test.describe("step decorator", () => {
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
		collectedLocations.length = 0;
		collectedStepOptions.length = 0;
		nextMockStepId = 1;
	});

	test("should replace simple parameter in description", async () => {
		class MyTestClass {
			@step("Class method called with {{param}}")
			async myMethod(param: string): Promise<string> {
				return `Called with ${param}`;
			}
		}

		const instance = new MyTestClass();
		const result = await instance.myMethod("test");

		expect(result).toBe("Called with test");
		expect(collectedSteps).toEqual(["Class method called with test"]);
	});

	test("should resolve named placeholders for parameters with default values", async () => {
		class MyTestClass {
			@step("Greeting for {{name}}")
			async myMethod(name = "Guest"): Promise<string> {
				return name;
			}
		}

		const instance = new MyTestClass();
		const result = await instance.myMethod("Alice");

		expect(result).toBe("Alice");
		expect(collectedSteps).toEqual(["Greeting for Alice"]);
	});

	test("should print the default value when a named placeholder uses an omitted defaulted parameter", async () => {
		class MyTestClass {
			@step("Greeting for {{name}}")
			async myMethod(name = "Guest"): Promise<string> {
				return name;
			}
		}

		const instance = new MyTestClass();
		const result = await instance.myMethod();

		expect(result).toBe("Guest");
		expect(collectedSteps).toEqual(["Greeting for Guest"]);
	});

	test("should print an omitted literal union default value in a named placeholder", async () => {
		class MyTestClass {
			@step("Mode {{mode}}")
			async myMethod(mode: "auto" | "manual" = "auto"): Promise<string> {
				return mode;
			}
		}

		const instance = new MyTestClass();
		const result = await instance.myMethod();

		expect(result).toBe("auto");
		expect(collectedSteps).toEqual(["Mode auto"]);
	});

	test("should throw a targeted error for omitted enum defaults in named placeholders", async () => {
		enum Mode {
			Auto = "auto",
			Manual = "manual",
		}

		class MyTestClass {
			@step("Mode {{mode}}")
			async myMethod(mode: Mode = Mode.Auto): Promise<Mode> {
				return mode;
			}
		}

		const instance = new MyTestClass();
		expect(() => instance.myMethod()).toThrow(
			"Unable to resolve the default value for parameter 'mode' in method 'MyTestClass.myMethod' while formatting @step placeholder '{{mode}}'. Only literal default values can be printed when the argument is omitted. Pass the argument explicitly or use an index placeholder instead."
		);
		expect(collectedSteps).toEqual([]);
	});

	test("should use default description if none provided", async () => {
		class MyTestClass {
			@step()
			async foo() {
				return "bar";
			}
		}
		const instance = new MyTestClass();
		const result = await instance.foo();
		expect(result).toBe("bar");
		expect(collectedSteps[0]).toBe("MyTestClass.foo");
	});

	test("should support non-async methods returning a void promise", async () => {
		const sideEffects: string[] = [];
		class MyTestClass {
			@step("Record value")
			recordValue(value: string): Promise<void> {
				sideEffects.push(value);
				return stepResult();
			}
		}
		const instance = new MyTestClass();
		await instance.recordValue("hello");
		expect(sideEffects).toEqual(["hello"]);
		expect(collectedSteps[0]).toBe("Record value");
	});

	test("should support non-async methods returning a promise", async () => {
		class MyTestClass {
			@step("Build greeting for {{name}}")
			buildGreeting(name: string): Promise<string> {
				return stepResult(`Hello ${name}`);
			}
		}
		const instance = new MyTestClass();
		const result = await instance.buildGreeting("Alice");
		expect(result).toBe("Hello Alice");
		expect(collectedSteps[0]).toBe("Build greeting for Alice");
	});

	test("should support non-async methods using a lambda with multiple actions", async () => {
		const sideEffects: string[] = [];

		class MyTestClass {
			@step("Prepare greeting for {{name}}")
			prepareGreeting(name: string): Promise<string> {
				return stepResult(() => {
					sideEffects.push(`start:${name}`);
					const greeting = `Hello ${name}`;
					sideEffects.push(`end:${greeting}`);
					return greeting;
				});
			}
		}

		const instance = new MyTestClass();
		const result = await instance.prepareGreeting("Alice");

		expect(result).toBe("Hello Alice");
		expect(sideEffects).toEqual(["start:Alice", "end:Hello Alice"]);
		expect(collectedSteps[0]).toBe("Prepare greeting for Alice");
	});

	test("should forward box and timeout options while keeping generated location fallback", async () => {
		class MyTestClass {
			@step("Configured step", { box: true, timeout: 1_500 })
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		const instance = new MyTestClass();
		await instance.myMethod();

		expect(collectedSteps).toEqual(["Configured step"]);
		expect(collectedStepOptions[0]).toMatchObject({ box: true, timeout: 1_500 });
		expect(collectedLocations[0]).toBeDefined();
	});

	test("should use the default step name when only options are provided", async () => {
		class MyTestClass {
			@step({ timeout: 250 })
			async myMethod(): Promise<string> {
				return "done";
			}
		}

		const instance = new MyTestClass();
		const result = await instance.myMethod();

		expect(result).toBe("done");
		expect(collectedSteps).toEqual(["MyTestClass.myMethod"]);
		expect(collectedStepOptions[0]).toMatchObject({ timeout: 250 });
		expect(collectedLocations[0]).toBeDefined();
	});

	test("should throw error if description references missing param", async () => {
		class MyTestClass {
			@step("Test with {{param2}}")
			async foo(param1: string) {
				return param1;
			}
		}
		const instance = new MyTestClass();
		expect(() => instance.foo("value")).toThrow(
			"Missing function parameters (param2) in method 'MyTestClass.foo'. Please check your @step decorator placeholders."
		);
		expect(collectedSteps).toEqual([]);
	});

	test("should provide a targeted error for destructured parameters in named placeholders", async () => {
		class MyTestClass {
			@step("User {{name}}")
			async foo({ name }: { name: string }) {
				return name;
			}
		}

		const instance = new MyTestClass();
		expect(() => instance.foo({ name: "Alice" })).toThrow(
			"Unable to resolve named @step placeholders (name) in method 'MyTestClass.foo' because this signature contains parameters that cannot be matched by name ({ name }). Named placeholders support identifier parameters, default values, and rest parameters. Use index placeholders like [[0]] for destructured or unsupported parameters."
		);
		expect(collectedSteps).toEqual([]);
	});

	test("should replace multiple placeholders in description", async () => {
		class MyTestClass {
			@step("Params: {{a}}, {{b}}")
			async foo(a: string, b: number) {
				return `${a} ${b}`;
			}
		}
		const instance = new MyTestClass();
		await instance.foo("hello", 42);
		expect(collectedSteps[0]).toBe("Params: hello, 42");
	});

	test("should support mixing named and index placeholders", async () => {
		class MyTestClass {
			@step("Array value at [[0]] is {{value}}")
			async foo(value: string) {
				return `Value is ${value}`;
			}
		}
		const instance = new MyTestClass();
		await instance.foo("TEST");
		expect(collectedSteps[0]).toBe("Array value at TEST is TEST");
	});

	test("should serialize object and rest-parameter placeholders into readable step text", async () => {
		class MyTestClass {
			@step("Payload {{payload}} with items {{items}}")
			async foo(payload: { name: string }, ...items: string[]) {
				return `${payload.name}:${items.length}`;
			}
		}

		const instance = new MyTestClass();
		await instance.foo({ name: "Alice" }, "one", "two");

		expect(collectedSteps[0]).toBe('Payload {"name":"Alice"} with items ["one","two"]');
	});

	test("should handle nested object placeholders", async () => {
		class MyTestClass {
			@step("Nested value: {{obj.prop}}")
			async foo(obj: { prop: string }) {
				return `Value is ${obj.prop}`;
			}
		}
		const instance = new MyTestClass();
		await instance.foo({ prop: "test" });
		expect(collectedSteps[0]).toBe("Nested value: test");
	});

	test("should handle multiple placeholders in nested objects", async () => {
		class MyTestClass {
			@step("Values: {{obj.prop1}}, {{obj.prop2}}")
			async foo(obj: { prop1: string; prop2: number }) {
				return `Values are ${obj.prop1} and ${obj.prop2}`;
			}
		}
		const instance = new MyTestClass();
		await instance.foo({ prop1: "test", prop2: 42 });
		expect(collectedSteps[0]).toBe("Values: test, 42");
	});

	test("should throw error if [[2]] index is out of bounds", async () => {
		class MyTestClass {
			@step("Value at [[2]] is {{value}}")
			async foo(value: string) {
				return `Value is ${value}`;
			}
		}
		const instance = new MyTestClass();
		expect(() => instance.foo("test")).toThrow("Parameter index '2' is out of bounds");
		expect(collectedSteps).toEqual([]);
	});

	test("should throw error if nested property does not exist", async () => {
		class MyTestClass {
			@step("Value: {{obj.nonExistent}}")
			async foo(obj: { prop: string }) {
				return `Value is ${obj.prop}`;
			}
		}
		const instance = new MyTestClass();
		expect(() => instance.foo({ prop: "test" })).toThrow("Property 'nonExistent' does not exist on parameter 'obj'");
		expect(collectedSteps).toEqual([]);
	});

	test("should handle array placeholders", async () => {
		class MyTestClass {
			@step("Array values: [[0]]")
			async foo(arr: string[]) {
				return `Value is ${arr.join(",")}`;
			}
		}
		const instance = new MyTestClass();
		await instance.foo(["one", "two", "three"]);
		expect(collectedSteps[0]).toBe('Array values: ["one","two","three"]');
	});

	test("should allow index placeholders for destructured parameters", async () => {
		class MyTestClass {
			@step("User [[0]]")
			async foo({ name }: { name: string }) {
				return name;
			}
		}

		const instance = new MyTestClass();
		await instance.foo({ name: "Alice" });

		expect(collectedSteps[0]).toBe('User {"name":"Alice"}');
	});

	test("should preserve user stack frames when filtering decorator internals", async () => {
		class MyTestClass {
			@step("Failure step")
			async myMethod(): Promise<void> {
				const error = new Error("boom");
				error.stack = [
					"Error: boom",
					"    at MyTestClass.myMethod (C:/repo/playwright-step-decorator/tests/playwright-step-decorator.test.ts:10:5)",
					"    at replacementMethod (C:/repo/playwright-step-decorator/src/playwright-step-decorator.ts:99:5)",
					"    at processTicksAndRejections (node:internal/process/task_queues:95:5)",
				].join("\n");
				throw error;
			}
		}

		const instance = new MyTestClass();
		let caughtError: Error | undefined;

		try {
			await instance.myMethod();
		} catch (error) {
			caughtError = error as Error;
		}

		expect(caughtError).toBeDefined();
		expect(caughtError?.stack).toContain("MyTestClass.myMethod");
		expect(caughtError?.stack).not.toContain("replacementMethod");
	});

	test("should keep user frames whose filename matches the decorator basename", async () => {
		class MyTestClass {
			@step("Failure step")
			async myMethod(): Promise<void> {
				const error = new Error("boom");
				error.stack = [
					"Error: boom",
					"    at MyTestClass.myMethod (C:/repo/tests/playwright-step-decorator.ts:10:5)",
					"    at replacementMethod (C:/repo/playwright-step-decorator/src/playwright-step-decorator.ts:99:5)",
				].join("\n");
				throw error;
			}
		}

		const instance = new MyTestClass();
		let caughtError: Error | undefined;

		try {
			await instance.myMethod();
		} catch (error) {
			caughtError = error as Error;
		}

		expect(caughtError).toBeDefined();
		expect(caughtError?.stack).toContain("C:/repo/tests/playwright-step-decorator.ts:10:5");
		expect(caughtError?.stack).not.toContain("replacementMethod");
	});

	test("should collect steps when a step-decorated method calls another", async () => {
		class MyTestClass {
			@step("Outer step")
			async outer(action: string): Promise<string> {
				return await this.inner(action);
			}

			@step("Inner step with {{action}}")
			async inner(action: string): Promise<string> {
				return `Action: ${action}`;
			}
		}

		const instance = new MyTestClass();
		const result = await instance.outer("run");

		expect(result).toBe("Action: run");
		expect(collectedSteps).toEqual(["Outer step", "Inner step with run"]);
	});

	test("should keep step context isolated for concurrent calls on the same instance", async () => {
		const ready = createDeferred<void>();
		const release = createDeferred<void>();
		let started = 0;
		let recorded = 0;
		const observations: Array<{
			label: string;
			before: TestStepInfo;
			beforeNoArg: TestStepInfo;
			after: TestStepInfo;
			afterNoArg: TestStepInfo;
		}> = [];

		class MyTestClass {
			@step("Concurrent [[0]]")
			async run(label: string): Promise<void> {
				const before = getStepInfo(this);
				const beforeNoArg = getStepInfo();

				started += 1;
				if (started === 2) {
					ready.resolve();
				}
				await ready.promise;

				const after = getStepInfo(this);
				const afterNoArg = getStepInfo();
				observations.push({ label, before, beforeNoArg, after, afterNoArg });

				recorded += 1;
				if (recorded === 2) {
					release.resolve();
				}
				await release.promise;
			}
		}

		const instance = new MyTestClass();
		await Promise.all([instance.run("A"), instance.run("B")]);

		const [first, second] = observations.sort((left, right) => left.label.localeCompare(right.label));

		expect(first.before).toBe(first.beforeNoArg);
		expect(first.after).toBe(first.afterNoArg);
		expect(first.before).toBe(first.after);
		expect(second.before).toBe(second.beforeNoArg);
		expect(second.after).toBe(second.afterNoArg);
		expect(second.before).toBe(second.after);
		expect(first.before).not.toBe(second.before);
	});

	test("should restore the outer step context after nested decorated calls while a sibling step is active", async () => {
		const innerEntered = createDeferred<void>();
		const siblingStarted = createDeferred<void>();
		const siblingCanFinish = createDeferred<void>();
		let outerBefore!: TestStepInfo;
		let outerAfter!: TestStepInfo;
		let innerStep!: TestStepInfo;
		let siblingStep!: TestStepInfo;

		class MyTestClass {
			@step("Outer")
			async outer(): Promise<void> {
				outerBefore = getStepInfo();
				await this.inner();
				outerAfter = getStepInfo(this);
				siblingCanFinish.resolve();
			}

			@step("Inner")
			async inner(): Promise<void> {
				innerStep = getStepInfo();
				innerEntered.resolve();
				await siblingStarted.promise;
			}

			@step("Sibling")
			async sibling(): Promise<void> {
				await innerEntered.promise;
				siblingStep = getStepInfo();
				siblingStarted.resolve();
				await siblingCanFinish.promise;
			}
		}

		const instance = new MyTestClass();
		await Promise.all([instance.outer(), instance.sibling()]);

		expect(outerBefore).toBe(outerAfter);
		expect(outerBefore).not.toBe(innerStep);
		expect(outerBefore).not.toBe(siblingStep);
		expect(innerStep).not.toBe(siblingStep);
	});

	test("should keep step context isolated when async and promise-returning methods overlap", async () => {
		const ready = createDeferred<void>();
		const release = createDeferred<void>();
		let started = 0;
		let recorded = 0;
		const observations: Array<{
			label: string;
			before: TestStepInfo;
			after: TestStepInfo;
		}> = [];

		const observeStepContext = async (label: string) => {
			const before = getStepInfo();

			started += 1;
			if (started === 2) {
				ready.resolve();
			}
			await ready.promise;

			const after = getStepInfo();
			observations.push({ label, before, after });

			recorded += 1;
			if (recorded === 2) {
				release.resolve();
			}
			await release.promise;
		};

		class MyTestClass {
			@step("Async method")
			async asyncMethod(): Promise<void> {
				await observeStepContext("async");
			}

			@step("Promise-returning method")
			promiseMethod(): Promise<void> {
				return stepResult(() => observeStepContext("promise"));
			}
		}

		const instance = new MyTestClass();
		await Promise.all([instance.asyncMethod(), instance.promiseMethod()]);

		const asyncObservation = observations.find(observation => observation.label === "async");
		const promiseObservation = observations.find(observation => observation.label === "promise");

		expect(asyncObservation).toBeDefined();
		expect(promiseObservation).toBeDefined();

		if (!asyncObservation || !promiseObservation) {
			throw new Error("Expected both concurrent step observations to be recorded.");
		}

		expect(asyncObservation.before).toBe(asyncObservation.after);
		expect(promiseObservation.before).toBe(promiseObservation.after);
		expect(asyncObservation.before).not.toBe(promiseObservation.before);
	});
});

test.describe("step decorator - location tracking", () => {
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
		collectedLocations.length = 0;
		collectedStepOptions.length = 0;
	});

	test("should capture location when decorated method is called", async () => {
		class MyTestClass {
			@step("Test step with location")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		const instance = new MyTestClass();
		const callSiteLine = getCurrentLineNumber() + 1;
		await instance.myMethod(); // This line should be captured

		expect(collectedSteps).toEqual(["Test step with location"]);
		expect(collectedLocations).toHaveLength(1);

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).toContain("playwright-step-decorator.test.ts");
		expect(location?.file).not.toContain("playwright-step-decorator.ts");
		expect(location?.line).toBe(callSiteLine);
		expect(location?.line).toBeGreaterThan(0);
		expect(location?.column).toBeGreaterThan(0);
	});

	test("should keep outer location when a decorated method nests test.step", async () => {
		class MyTestClass {
			@step("Outer step")
			async myMethod(): Promise<void> {
				await test.step("Inner step", async () => {
					// Nested step
				});
			}
		}

		const instance = new MyTestClass();
		const callSiteLine = getCurrentLineNumber() + 1;
		await instance.myMethod(); // This line should be captured for the outer step

		expect(collectedSteps).toEqual(["Outer step", "Inner step"]);

		const outerLocation = collectedLocations[0];
		expect(outerLocation).toBeDefined();
		expect(outerLocation?.file).toContain("playwright-step-decorator.test.ts");
		expect(outerLocation?.file).not.toContain("playwright-step-decorator.ts");
		expect(outerLocation?.line).toBe(callSiteLine);

		const innerLocation = collectedLocations[1];
		expect(innerLocation).toBeUndefined();
	});

	test("should capture different locations for multiple calls", async () => {
		class MyTestClass {
			@step("Method call")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		const instance = new MyTestClass();
		await instance.myMethod(); // First call - line X
		const firstLocation = collectedLocations[0];

		collectedLocations.length = 0;

		await instance.myMethod(); // Second call - line Y
		const secondLocation = collectedLocations[0];

		expect(firstLocation).toBeDefined();
		expect(secondLocation).toBeDefined();
		expect(firstLocation?.file).toBe(secondLocation?.file);
		// Line numbers should be different since calls are on different lines
		expect(firstLocation?.line).not.toBe(secondLocation?.line);
	});

	test("should capture location for nested property placeholders", async () => {
		class MyTestClass {
			@step("User: {{user.name}}")
			async login(user: { name: string }): Promise<void> {
				void user; // Suppress unused warning
			}
		}

		const instance = new MyTestClass();
		await instance.login({ name: "Alice" }); // This line should be captured

		expect(collectedSteps).toEqual(["User: Alice"]);

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).toContain("playwright-step-decorator.test.ts");
		expect(location?.line).toBeGreaterThan(0);
	});

	test("should capture location for index placeholders", async () => {
		class MyTestClass {
			@step("Value: [[0]]")
			async doSomething(value: string): Promise<void> {
				void value; // Suppress unused warning
			}
		}

		const instance = new MyTestClass();
		await instance.doSomething("test"); // This line should be captured

		expect(collectedSteps).toEqual(["Value: test"]);

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).toContain("playwright-step-decorator.test.ts");
	});

	test("should capture location even without description", async () => {
		class MyTestClass {
			@step()
			async defaultMethod(): Promise<string> {
				return "result";
			}
		}

		const instance = new MyTestClass();
		await instance.defaultMethod(); // This line should be captured

		expect(collectedSteps).toEqual(["MyTestClass.defaultMethod"]);

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).toContain("playwright-step-decorator.test.ts");
		expect(location?.line).toBeGreaterThan(0);
	});

	test("should prefer an explicit location over the generated call site", async () => {
		const customLocation = {
			file: "C:/repo/tests/custom-location.spec.ts",
			line: 42,
			column: 9,
		};

		class MyTestClass {
			@step("Custom location", { box: true, location: customLocation, timeout: 5_000 })
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		const instance = new MyTestClass();
		await instance.myMethod();

		expect(collectedSteps).toEqual(["Custom location"]);
		expect(collectedLocations[0]).toEqual(customLocation);
		expect(collectedStepOptions[0]).toEqual({ box: true, location: customLocation, timeout: 5_000 });
	});

	test("should not include node_modules in location path", async () => {
		class MyTestClass {
			@step("Test step")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		const instance = new MyTestClass();
		await instance.myMethod();

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).not.toContain("node_modules");
		expect(location?.file).not.toContain("playwright-step-decorator.ts");
	});

	test("should normalize Windows file URLs in captured locations", async () => {
		class MyTestClass {
			@step("Windows location")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		await withMockedErrorStack(
			[
				"Error",
				"    at captureCallSiteLocation (file:///C:/repo/src/playwright-step-decorator.ts:10:5)",
				"    at replacementMethod (file:///C:/repo/src/playwright-step-decorator.ts:20:5)",
				"    at MyTestClass.myMethod (file:///C:/repo/tests/example.spec.ts:30:7)",
			].join("\n"),
			async () => {
				const instance = new MyTestClass();
				await instance.myMethod();
			}
		);

		const location = collectedLocations[0];
		expect(location).toEqual({
			file: "C:/repo/tests/example.spec.ts",
			line: 30,
			column: 7,
		});
	});

	test("should normalize POSIX file URLs in captured locations", async () => {
		class MyTestClass {
			@step("POSIX location")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		await withMockedErrorStack(
			[
				"Error",
				"    at captureCallSiteLocation (file:///home/tester/repo/src/playwright-step-decorator.ts:10:5)",
				"    at replacementMethod (file:///home/tester/repo/src/playwright-step-decorator.ts:20:5)",
				"    at MyTestClass.myMethod (file:///home/tester/repo/tests/example%20spec.ts:30:7)",
			].join("\n"),
			async () => {
				const instance = new MyTestClass();
				await instance.myMethod();
			}
		);

		const location = collectedLocations[0];
		expect(location).toEqual({
			file: "/home/tester/repo/tests/example spec.ts",
			line: 30,
			column: 7,
		});
	});

	test("should capture user locations whose filename matches the decorator basename", async () => {
		class MyTestClass {
			@step("Matching basename")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		await withMockedErrorStack(
			[
				"Error",
				"    at captureCallSiteLocation (file:///C:/repo/playwright-step-decorator/src/playwright-step-decorator.ts:10:5)",
				"    at replacementMethod (file:///C:/repo/playwright-step-decorator/src/playwright-step-decorator.ts:20:5)",
				"    at MyTestClass.myMethod (file:///C:/repo/tests/playwright-step-decorator.ts:30:7)",
			].join("\n"),
			async () => {
				const instance = new MyTestClass();
				await instance.myMethod();
			}
		);

		expect(collectedLocations[0]).toEqual({
			file: "C:/repo/tests/playwright-step-decorator.ts",
			line: 30,
			column: 7,
		});
	});

	test("should handle location for methods called in sequence", async () => {
		class MyTestClass {
			@step("First step")
			async first(): Promise<void> {}

			@step("Second step")
			async second(): Promise<void> {}
		}

		const instance = new MyTestClass();
		await instance.first();
		await instance.second();

		expect(collectedLocations).toHaveLength(2);
		expect(collectedLocations[0]).toBeDefined();
		expect(collectedLocations[1]).toBeDefined();

		// Both should be in the same file but different lines
		expect(collectedLocations[0]?.file).toBe(collectedLocations[1]?.file);
		expect(collectedLocations[0]?.line).not.toBe(collectedLocations[1]?.line);
	});

	test("should capture location when step-decorated method calls another class method", async () => {
		class HelperClass {
			async doWork(): Promise<string> {
				return "work done";
			}
		}

		class MainClass {
			private helper = new HelperClass();

			@step("Main operation calling helper")
			async performOperation(): Promise<string> {
				return await this.helper.doWork();
			}
		}

		const instance = new MainClass();
		await instance.performOperation(); // This line should be captured

		expect(collectedSteps).toEqual(["Main operation calling helper"]);

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).toContain("playwright-step-decorator.test.ts");
		expect(location?.line).toBeGreaterThan(0);
		expect(location?.column).toBeGreaterThan(0);
	});
});
