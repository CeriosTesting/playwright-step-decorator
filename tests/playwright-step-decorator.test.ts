import { test, expect } from "@playwright/test";
import { step } from "../src/playwright-step-decorator";

const collectedSteps: string[] = [];
const collectedLocations: Array<{ file: string; line: number; column: number } | undefined> = [];

const mockTestStep = async (
	desc: string,
	fn: () => Promise<any>,
	options?: { location?: { file: string; line: number; column: number } }
) => {
	collectedSteps.push(desc);
	collectedLocations.push(options?.location);
	return await fn();
};

test.describe("step decorator", () => {
	let originalStep: typeof test.step;

	test.beforeAll(() => {
		originalStep = (test as any).step;
		(test as any).step = mockTestStep;
	});

	test.afterAll(() => {
		(test as any).step = originalStep;
	});

	test.beforeEach(() => {
		collectedSteps.length = 0;
		collectedLocations.length = 0;
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
		expect(collectedSteps[0]).toBe("Array values: one,two,three");
	});
});

test.describe("step decorator - location tracking", () => {
	let originalStep: typeof test.step;

	test.beforeAll(() => {
		originalStep = (test as any).step;
		(test as any).step = mockTestStep;
	});

	test.afterAll(() => {
		(test as any).step = originalStep;
	});

	test.beforeEach(() => {
		collectedSteps.length = 0;
		collectedLocations.length = 0;
	});

	test("should capture location when decorated method is called", async () => {
		class MyTestClass {
			@step("Test step with location")
			async myMethod(): Promise<void> {
				// Method body
			}
		}

		const instance = new MyTestClass();
		await instance.myMethod(); // This line should be captured

		expect(collectedSteps).toEqual(["Test step with location"]);
		expect(collectedLocations).toHaveLength(1);

		const location = collectedLocations[0];
		expect(location).toBeDefined();
		expect(location?.file).toContain("playwright-step-decorator.test.ts");
		expect(location?.line).toBeGreaterThan(0);
		expect(location?.column).toBeGreaterThan(0);
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
