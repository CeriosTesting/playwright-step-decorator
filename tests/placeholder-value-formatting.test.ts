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

	test("should format a nested placeholder on an undefined parameter as 'undefined'", async () => {
		class MyTestClass {
			@step("Value: {{user.name}}")
			async myMethod(user?: { name: string }): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod(undefined);
		expect(collectedSteps[0]).toBe("Value: undefined");
	});

	test("should format a nested placeholder on a null parameter as 'null'", async () => {
		class MyTestClass {
			@step("Value: {{user.name}}")
			async myMethod(user: { name: string } | null): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod(null);
		expect(collectedSteps[0]).toBe("Value: null");
	});

	test("should format a deep nested placeholder with a null intermediate property as 'null'", async () => {
		class MyTestClass {
			@step("Value: {{user.address.street}}")
			async myMethod(user: { address: { street: string } | null }): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod({ address: null });
		expect(collectedSteps[0]).toBe("Value: null");
	});

	test("should still format a nested placeholder on a nullable parameter when it is filled", async () => {
		class MyTestClass {
			@step("Value: {{user.name}}")
			async myMethod(user?: { name: string } | null): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod({ name: "Alice" });
		expect(collectedSteps[0]).toBe("Value: Alice");
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
		expect(collectedSteps[0]).toBe('Value: {"a":1,"self":"[Circular]"}');
	});

	test("should print an object that is used twice instead of marking it circular", async () => {
		class MyTestClass {
			@step("{{inObject}} {{inArray}}")
			async myMethod(inObject: unknown, inArray: unknown): Promise<void> {
				void inObject;
				void inArray;
			}
		}

		const shared = { n: 1 };
		await new MyTestClass().myMethod({ a: shared, b: shared }, [shared, shared]);
		expect(collectedSteps[0]).toBe('{"a":{"n":1},"b":{"n":1}} [{"n":1},{"n":1}]');
	});

	test("should mark a cycle that passes through a shared object", async () => {
		class MyTestClass {
			@step("[[0]]")
			async myMethod(value: unknown): Promise<void> {
				void value;
			}
		}

		const shared: Record<string, unknown> = { n: 1 };
		shared["parent"] = { shared };
		await new MyTestClass().myMethod({ a: { n: 2 }, b: shared });
		expect(collectedSteps[0]).toBe('{"a":{"n":2},"b":{"n":1,"parent":{"shared":"[Circular]"}}}');
	});

	test("should not hang on a heavily shared object graph", async () => {
		class MyTestClass {
			@step("[[0]]")
			async myMethod(value: unknown): Promise<void> {
				void value;
			}
		}

		// Expanding every shared reference would produce 2^60 values, so this falls back to depth-limited output.
		let graph: Record<string, unknown> = { leaf: true };
		for (let i = 0; i < 60; i++) {
			graph = { left: graph, right: graph };
		}

		await new MyTestClass().myMethod(graph);
		expect(collectedSteps[0]).toContain("[Object]");
		expect(collectedSteps[0].length).toBeLessThan(1_000);
	});

	test("should read properties of primitive values and functions", async () => {
		class MyTestClass {
			@step("{{text.length}} {{list.length}} {{fn.name}} {{user.name.length}}")
			async myMethod(text: string, list: string[], fn: () => void, user: { name: string }): Promise<void> {
				void text;
				void list;
				void fn;
				void user;
			}
		}

		function myNamedFn() {}
		await new MyTestClass().myMethod("abc", ["a", "b"], myNamedFn, { name: "Alice" });
		expect(collectedSteps[0]).toBe("3 2 myNamedFn 5");
	});

	test("should reject when a property does not exist on a primitive value", async () => {
		class MyTestClass {
			@step("{{text.nope}}")
			async myMethod(text: string): Promise<void> {
				void text;
			}
		}

		await expect(new MyTestClass().myMethod("abc")).rejects.toThrow(
			"Property 'nope' does not exist on parameter 'text'"
		);
	});

	test("should cut off long values and say how much was removed", async () => {
		class MyTestClass {
			@step("{{text}} | {{list}} | {{short}}")
			async myMethod(text: string, list: number[], short: string): Promise<void> {
				void text;
				void list;
				void short;
			}
		}

		await new MyTestClass().myMethod("x".repeat(1_500), Array(600).fill(1) as number[], "y".repeat(1_000));
		const [text, list, short] = collectedSteps[0].split(" | ");
		expect(text).toBe(`${"x".repeat(1_000)}… (500 more characters)`);
		expect(list).toBe(`${JSON.stringify(Array(600).fill(1)).slice(0, 1_000)}… (201 more characters)`);
		expect(short).toBe("y".repeat(1_000));
	});

	test("should apply the length cap to selector results", async () => {
		class MyTestClass {
			@step("Value __long__", { values: { long: () => "z".repeat(1_001) } })
			async myMethod(): Promise<void> {}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe(`Value ${"z".repeat(1_000)}… (1 more characters)`);
	});

	test("should format Map, Set and RegExp values at the top level", async () => {
		class MyTestClass {
			@step("[[0]] | [[1]] | [[2]]")
			async myMethod(map: unknown, set: unknown, pattern: unknown): Promise<void> {
				void map;
				void set;
				void pattern;
			}
		}

		await new MyTestClass().myMethod(new Map([["a", 1]]), new Set([1, 2]), /foo/i);
		expect(collectedSteps[0]).toBe("Map(1) { 'a' => 1 } | Set(2) { 1, 2 } | /foo/i");
	});

	test("should format nested Map, Set, RegExp and Error values", async () => {
		class MyTestClass {
			@step("[[0]]")
			async myMethod(value: unknown): Promise<void> {
				void value;
			}
		}

		await new MyTestClass().myMethod({
			error: new TypeError("bad"),
			map: new Map([["a", 1]]),
			pattern: /foo/i,
			set: new Set([1]),
		});
		expect(JSON.parse(collectedSteps[0])).toEqual({
			error: "TypeError: bad",
			map: "Map(1) { 'a' => 1 }",
			pattern: "/foo/i",
			set: "Set(1) { 1 }",
		});
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
