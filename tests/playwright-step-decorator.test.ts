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
		const decorated = step("Say hello to {{name}}")(async function (name: string) {
			return name;
		});

		const result = await decorated("Alice");

		expect(result).toBe("Alice");
		expect(collectedSteps).toEqual(["Say hello to Alice"]);
	});

	test("should replace nested parameter in description", async () => {
		const decorated = step("User: {{user.name}}, Age: {{user.age}}")(async function (user: {
			name: string;
			age: number;
		}) {
			return `${user.name}, ${user.age}`;
		});

		await decorated({ name: "Bob", age: 30 });
		expect(collectedSteps).toEqual(["User: Bob, Age: 30"]);
	});

	test("should throw error if parameter missing in function", async () => {
		const decorated = step("Missing param {{foo}}")(async function (bar: string) {
			return bar;
		});

		expect(() => decorated("test")).toThrow("Missing function parameters: foo");
		expect(collectedSteps).toEqual([]);
	});

	test("should throw error if nested property does not exist", async () => {
		const decorated = step("User: {{user.name}}, City: {{user.address.city}}")(async function (user: { name: string }) {
			return user.name;
		});

		expect(() => decorated({ name: "Charlie" })).toThrow("Property 'address' does not exist on parameter 'user'");
		expect(collectedSteps).toEqual([]);
	});

	test("should work with multiple parameters", async () => {
		const decorated = step("A: {{a}}, B: {{b}}")(async function (a: number, b: string) {
			return `${a}-${b}`;
		});

		await decorated(42, "foo");
		expect(collectedSteps).toEqual(["A: 42, B: foo"]);
	});

	test("should handle no parameters in description", async () => {
		const decorated = step("No parameters")(async function () {
			return "Done";
		});

		await decorated();
		expect(collectedSteps).toEqual(["No parameters"]);
	});

	test("should handle empty description", async () => {
		const decorated = step("")(async function () {
			return "Empty step";
		});

		await decorated();
		expect(collectedSteps).toEqual([""]);
	});

	test("should support multiple decorated steps in sequence", async () => {
		const step1 = step("Step 1: greet {{name}}")(async function (name: string) {
			return `Hello, ${name}`;
		});
		const step2 = step("Step 2: farewell {{name}}")(async function (name: string) {
			return `Goodbye, ${name}`;
		});

		await step1("John");
		await step2("Doe");

		expect(collectedSteps).toEqual(["Step 1: greet John", "Step 2: farewell Doe"]);
	});

	test("should replace [[0]] with first argument", async () => {
		const decorated = step("First arg is [[0]]")(async function (a: string) {
			return a;
		});

		await decorated("foo");
		expect(collectedSteps).toEqual(["First arg is foo"]);
	});

	test("should replace [[1]] with second argument", async () => {
		const decorated = step("Second arg is [[1]]")(async function (a: string, b: number) {
			return a + b;
		});

		await decorated("foo", 123);
		expect(collectedSteps).toEqual(["Second arg is 123"]);
	});

	test("should throw error if [[2]] index is out of bounds", async () => {
		const decorated = step("Arg [[2]]")(async function (a: string, b: string) {
			return a + b;
		});

		expect(() => {
			decorated("x", "y");
		}).toThrow("Parameter index '2' is out of bounds");
		expect(collectedSteps).toEqual([]);
	});

	test("should support mixing named and index placeholders", async () => {
		const decorated = step("Named: {{name}}, Index: [[1]]")(async function (name: string, value: number) {
			return `${name}-${value}`;
		});

		await decorated("Bob", 77);
		expect(collectedSteps).toEqual(["Named: Bob, Index: 77"]);
	});
});
