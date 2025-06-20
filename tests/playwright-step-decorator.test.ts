import { test, expect } from "@playwright/test";
import { step } from "../src/playwright-step-decorator";

const collectedSteps: string[] = [];
const mockTestStep = async (desc: string, fn: () => Promise<any>) => {
	collectedSteps.push(desc);
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
		expect(() => instance.foo("value")).toThrow("Missing function parameters: param2");
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
