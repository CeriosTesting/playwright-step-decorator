import { test, expect } from "@playwright/test";

import { step } from "../src/playwright-step-decorator";

import { collectedSteps, setupMockStep } from "./helpers";

test.describe("step decorator - literal default values", () => {
	setupMockStep();

	test("should show number default when argument is omitted", async () => {
		class MyTestClass {
			@step("Count: {{count}}")
			async myMethod(count = 42): Promise<void> {
				void count;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Count: 42");
	});

	test("should show boolean true default when argument is omitted", async () => {
		class MyTestClass {
			@step("Enabled: {{enabled}}")
			async myMethod(enabled = true): Promise<void> {
				void enabled;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Enabled: true");
	});

	test("should show boolean false default when argument is omitted", async () => {
		class MyTestClass {
			@step("Enabled: {{enabled}}")
			async myMethod(enabled = false): Promise<void> {
				void enabled;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Enabled: false");
	});

	test("should show null default when argument is omitted", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			async myMethod(val: any = null): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: null");
	});

	test("should show undefined default when argument is omitted", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// oxlint-disable-next-line typescript-eslint/no-explicit-any, no-useless-default-assignment
			async myMethod(val: any = undefined): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: undefined");
	});

	test("should show bigint default when argument is omitted", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			// @ts-expect-error TS2737 -- BigInt literal required to test parseLiteralDefaultValue source parsing
			async myMethod(val = 42n): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: 42");
	});

	test("should show empty object and array defaults when the argument is omitted", async () => {
		class MyTestClass {
			@step("{{options}} {{items}} {{items.length}}")
			async myMethod(options: object = {}, items: string[] = []): Promise<void> {
				void options;
				void items;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("{} [] 0");
	});

	test("should print undefined for properties of an omitted empty object default", async () => {
		class MyTestClass {
			@step("Timeout {{options.timeout}}, nested {{options.retry.count}}")
			async myMethod(options: { retry?: { count: number }; timeout?: number } = {}): Promise<void> {
				void options;
			}
		}

		await new MyTestClass().myMethod();
		await new MyTestClass().myMethod({ timeout: 5, retry: { count: 2 } });
		expect(collectedSteps).toEqual(["Timeout undefined, nested undefined", "Timeout 5, nested 2"]);
	});

	test("should still reject for a missing property on a passed object", async () => {
		class MyTestClass {
			@step("Timeout {{options.timeout}}")
			async myMethod(options: { timeout?: number } = {}): Promise<void> {
				void options;
			}
		}

		await expect(new MyTestClass().myMethod({})).rejects.toThrow(
			"Property 'timeout' does not exist on parameter 'options'"
		);
	});

	test("should show non-empty object and array defaults when the argument is omitted", async () => {
		class MyTestClass {
			@step("{{options}} | {{items}}")
			async myMethod(options: object = { a: 1, b: "two" }, items: unknown[] = [1, "two", null]): Promise<void> {
				void options;
				void items;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe('{"a":1,"b":"two"} | [1,"two",null]');
	});

	test("should read properties and indexes of omitted object and array defaults", async () => {
		class MyTestClass {
			@step("{{options.timeout}} {{options.retry.count}} {{options.tags.1}} {{options.tags.length}} {{list.0.id}}")
			async myMethod(
				options: object = { timeout: 5, retry: { count: 2 }, tags: ["a", "b"] },
				list: object[] = [{ id: 7 }]
			): Promise<void> {
				void options;
				void list;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("5 2 b 2 7");
	});

	test("should print undefined for a property missing from an omitted object default", async () => {
		class MyTestClass {
			@step("{{options.timeout}} {{options.retry}} {{options.retry.count}}")
			async myMethod(options: { retry?: { count: number }; timeout?: number } = { timeout: 5 }): Promise<void> {
				void options;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("5 undefined undefined");
	});

	test("should prefer a passed argument over an object default", async () => {
		class MyTestClass {
			@step("{{options.timeout}}")
			async myMethod(options: { timeout?: number } = { timeout: 5 }): Promise<void> {
				void options;
			}
		}

		await new MyTestClass().myMethod({ timeout: 9 });
		await new MyTestClass().myMethod(undefined);
		await expect(new MyTestClass().myMethod({})).rejects.toThrow(
			"Property 'timeout' does not exist on parameter 'options'"
		);
		expect(collectedSteps).toEqual(["9", "5"]);
	});

	test("should parse every literal form inside object defaults", async () => {
		class MyTestClass {
			@step("{{val}}")
			async myMethod(
				val: object = {
					// A comment, with: punctuation
					plain: 1 /* another */,
					"quoted key": "a, b: {c} [d]",
					"single:quoted": 'it\'s "fine"',
					42: true,
					negative: -1.5,
					hex: 0x10,
					// @ts-expect-error TS2737 -- BigInt literal required to test source parsing
					big: 12n,
					missing: null,
					nothing: undefined,
					nested: { deep: [1, [2, { deeper: false }]] },
					empty: {},
					none: [],
					$dollar_1: "trailing comma",
				}
			): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(JSON.parse(collectedSteps[0])).toEqual({
			42: true,
			plain: 1,
			"quoted key": "a, b: {c} [d]",
			"single:quoted": 'it\'s "fine"',
			negative: -1.5,
			hex: 16,
			big: "12",
			missing: null,
			nested: { deep: [1, [2, { deeper: false }]] },
			empty: {},
			none: [],
			$dollar_1: "trailing comma",
		});
	});

	test("should reject for object and array defaults that need evaluating", async () => {
		const shared = 1;
		const key = "computed";
		const rest = { a: 1 };
		const reject = (run: () => Promise<void>) =>
			expect(run()).rejects.toThrow("Only literal default values can be printed when the argument is omitted");

		class MyTestClass {
			@step("{{val}}")
			async variable(val: object = { a: shared }): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async shorthand(val: object = { shared }): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async spread(val: object = { ...rest }): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async computed(val: object = { [key]: 1 }): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async method(val: object = { run() {} }): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async callValue(val: object = { a: String(1) }): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async arrayVariable(val: unknown[] = [shared]): Promise<void> {
				void val;
			}

			@step("{{val}}")
			// oxlint-disable-next-line unicorn/no-useless-spread -- the spread syntax is what this case covers
			async arraySpread(val: unknown[] = [...[1]]): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async arrayMethodCall(val: number[] = [1, 2].map(n => n)): Promise<void> {
				void val;
			}

			@step("{{val}}")
			async nestedVariable(val: object = { a: { b: [shared] } }): Promise<void> {
				void val;
			}
		}

		const instance = new MyTestClass();
		await reject(() => instance.variable());
		await reject(() => instance.shorthand());
		await reject(() => instance.spread());
		await reject(() => instance.computed());
		await reject(() => instance.method());
		await reject(() => instance.callValue());
		await reject(() => instance.arrayVariable());
		await reject(() => instance.arraySpread());
		await reject(() => instance.arrayMethodCall());
		await reject(() => instance.nestedVariable());

		// Passing the argument still works for all of these.
		await instance.variable({ a: 2 });
		expect(collectedSteps).toEqual(['{"a":2}']);
	});

	test("should not treat __proto__ in an object default as a property", async () => {
		class MyTestClass {
			@step("{{val}}")
			async myMethod(val: object = { __proto__: { polluted: true } }): Promise<void> {
				void val;
			}
		}

		await expect(new MyTestClass().myMethod()).rejects.toThrow(
			"Only literal default values can be printed when the argument is omitted"
		);
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
	});

	test("should reject for array defaults with holes", async () => {
		// oxlint-disable-next-line no-implied-eval
		const rawFn = new Function("return async function myMethod(val = [1, , 2]) {}")() as (
			val?: unknown[]
		) => Promise<void>;
		class MyTestClass {}

		const decorated = step("{{val}}")(rawFn, {
			kind: "method",
			name: "myMethod",
			addInitializer: () => {},
			// oxlint-disable-next-line typescript-eslint/no-explicit-any
			access: {} as any,
			metadata: {},
			static: false,
			private: false,
		} as ClassMethodDecoratorContext<MyTestClass, typeof rawFn>);

		await expect(decorated.call(new MyTestClass())).rejects.toThrow(
			"Only literal default values can be printed when the argument is omitted"
		);
	});

	test("should resolve \\n escape sequence in string default", async () => {
		class MyTestClass {
			// The default value source contains the two chars \n which parseLiteralDefaultValue
			// should decode into an actual newline character.
			@step("Value: {{val}}")
			async myMethod(val = "hello\nworld"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: hello\nworld");
	});

	test("should resolve \\uXXXX escape sequence in string default", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val = "\u0041"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: A");
	});

	test("should resolve \\xXX escape sequence in string default", async () => {
		class MyTestClass {
			@step("Value: {{val}}")
			async myMethod(val = "\x41"): Promise<void> {
				void val;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: A");
	});
});
