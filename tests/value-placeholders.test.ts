import { test, expect } from "@playwright/test";

import { step, stepResult } from "../src/playwright-step-decorator";

import { collectedStepOptions, collectedSteps, setupMockStep } from "./helpers";

type Contact = { email: string; name: string; primary: boolean };
type User = { contacts: Contact[]; name: string; role: string };

const alice: User = {
	name: "Alice",
	role: "editor",
	contacts: [
		{ name: "Bob", email: "bob@example.com", primary: true },
		{ name: "Carol", email: "carol@example.com", primary: false },
		{ name: "Dave", email: "dave@example.com", primary: true },
	],
};

test.describe("step decorator - __key__ value placeholders", () => {
	setupMockStep();

	test("should replace numeric and named keys with the selector results", async () => {
		class LoginPage {
			@step("Login as __0__ with role __role__", {
				values: {
					0: user => user.name,
					role: (user, admin) => (admin ? "admin" : user.role),
				},
			})
			login(user: User, admin?: boolean): Promise<void> {
				void user;
				void admin;
				return stepResult();
			}
		}

		await new LoginPage().login(alice);
		await new LoginPage().login(alice, true);
		expect(collectedSteps).toEqual(["Login as Alice with role editor", "Login as Alice with role admin"]);
	});

	test("should support selecting from and filtering array parameters", async () => {
		class ContactsPage {
			@step("Second contact __second__, primaries __primary__, owner __owner__", {
				values: {
					second: (_user, contacts) => contacts[1].email,
					primary: user =>
						user.contacts
							.filter(contact => contact.primary)
							.map(contact => contact.name)
							.join(", "),
					owner: (user: User) => user.name,
				},
			})
			addContacts(user: User, contacts: Contact[]): Promise<void> {
				void user;
				void contacts;
				return stepResult();
			}
		}

		await new ContactsPage().addContacts(alice, alice.contacts);
		expect(collectedSteps[0]).toBe("Second contact carol@example.com, primaries Bob, Dave, owner Alice");
	});

	test("should mix value placeholders with named and index placeholders and repeat keys", async () => {
		class MyTestClass {
			@step("{{user.name}} / [[1]] / __upper__ / __upper__", {
				values: { upper: user => user.name.toUpperCase() },
			})
			async myMethod(user: User, count: number): Promise<void> {
				void user;
				void count;
			}
		}

		await new MyTestClass().myMethod(alice, 3);
		expect(collectedSteps[0]).toBe("Alice / 3 / ALICE / ALICE");
	});

	test("should format non-string selector results like other placeholders", async () => {
		class MyTestClass {
			@step("Primary: __primary__, count: __count__, missing: __missing__", {
				values: {
					primary: user => user.contacts.find(contact => contact.primary),
					count: user => user.contacts.length,
					missing: (_user, label) => label,
				},
			})
			async myMethod(user: User, label?: string): Promise<void> {
				void user;
				void label;
			}
		}

		await new MyTestClass().myMethod(alice);
		expect(collectedSteps[0]).toBe(
			'Primary: {"name":"Bob","email":"bob@example.com","primary":true}, count: 3, missing: undefined'
		);
	});

	test("should print undefined when a selector reads from an omitted optional parameter", async () => {
		class MyTestClass {
			@step("Value: __name__", { values: { name: user => user?.name } })
			async myMethod(user?: User): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod();
		expect(collectedSteps[0]).toBe("Value: undefined");
	});

	test("should print null when a selector returns a null parameter", async () => {
		class MyTestClass {
			@step("Value: __user__", { values: { user: user => user } })
			async myMethod(user: User | null): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod(null);
		expect(collectedSteps[0]).toBe("Value: null");
	});

	test("should resolve nullish arguments the same way for named and value placeholders", async () => {
		class MyTestClass {
			@step("{{user.address.street}} / __street__", {
				values: { street: user => user.address && user.address.street },
			})
			async myMethod(user: { address: { street: string } | null }): Promise<void> {
				void user;
			}
		}

		await new MyTestClass().myMethod({ address: null });
		expect(collectedSteps[0]).toBe("null / null");
	});

	test("should not forward the values option to test.step but keep other options", async () => {
		class MyTestClass {
			@step("Open __name__", { box: true, timeout: 1234, values: { name: (name: string) => name } })
			async open(name: string): Promise<void> {
				void name;
			}
		}

		await new MyTestClass().open("menu");
		expect(collectedSteps[0]).toBe("Open menu");
		expect(collectedStepOptions[0]).toMatchObject({ box: true, timeout: 1234 });
		expect(collectedStepOptions[0]).not.toHaveProperty("values");
	});

	test("should leave empty or whitespace __ spans untouched", async () => {
		class MyTestClass {
			@step("a __ b __ c and ____ for {{name}}")
			async myMethod(name: string): Promise<void> {
				void name;
			}
		}

		await new MyTestClass().myMethod("x");
		expect(collectedSteps[0]).toBe("a __ b __ c and ____ for x");
	});

	test("should not re-scan substituted values for placeholders", async () => {
		class MyTestClass {
			@step("{{text}} | __key__", { values: { key: () => "{{text}} [[0]] __key__" } })
			async myMethod(text: string): Promise<void> {
				void text;
			}
		}

		await new MyTestClass().myMethod("__key__ [[0]]");
		expect(collectedSteps[0]).toBe("__key__ [[0]] | {{text}} [[0]] __key__");
	});

	test("should throw when a placeholder has no selector at runtime", () => {
		const description: string = "Hello __name__";
		class MyTestClass {
			@step(description, { values: { other: () => "x" } })
			async myMethod(): Promise<void> {}
		}

		expect(() => new MyTestClass().myMethod()).toThrow(
			"Missing value selector for placeholder '__name__' in method 'MyTestClass.myMethod'"
		);
	});

	test("should wrap errors thrown by a selector and keep the cause", () => {
		const failure = new Error("boom");
		class MyTestClass {
			@step("Hello __name__", {
				values: {
					name: (): string => {
						throw failure;
					},
				},
			})
			async myMethod(): Promise<void> {}
		}

		let error: unknown;
		try {
			void new MyTestClass().myMethod();
		} catch (e) {
			error = e;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(
			"Value selector for placeholder '__name__' in method 'MyTestClass.myMethod' threw: boom"
		);
		expect((error as Error & { cause?: unknown }).cause).toBe(failure);
	});
});

// Compile-time checks only: this function is never called. `tsc --noEmit` and `npm run lint` fail if an
// expected error disappears (unused @ts-expect-error) or if a valid usage stops compiling.
export function valuePlaceholderTypeChecks(): void {
	class TypeChecks {
		@step("Valid __name__ __1__", { values: { name: user => user.name, 1: (_user, contacts) => contacts[0].email } })
		async valid(user: User, contacts: Contact[]): Promise<void> {
			void user;
			void contacts;
		}

		// @ts-expect-error -- the description contains __name__, so the values option is required
		@step("Missing values __name__")
		async missingValues(user: User): Promise<void> {
			void user;
		}

		// @ts-expect-error -- __role__ has no selector
		@step("Missing key __name__ __role__", { values: { name: user => user.name } })
		async missingKey(user: User): Promise<void> {
			void user;
		}

		// @ts-expect-error -- `extra` is not a placeholder in the description
		@step("Extra key __name__", { values: { name: user => user.name, extra: () => "x" } })
		async extraKey(user: User): Promise<void> {
			void user;
		}

		// @ts-expect-error -- the first parameter is a User, not a string
		@step("Wrong param __name__", { values: { name: (user: string) => user } })
		async wrongParam(user: User): Promise<void> {
			void user;
		}

		// @ts-expect-error -- `nickname` does not exist on User
		@step("Bad property __name__", { values: { name: user => user.nickname } })
		async badProperty(user: User): Promise<void> {
			void user;
		}

		// @ts-expect-error -- `user` may be undefined, so the selector has to handle it
		@step("Unsafe optional __name__", { values: { name: user => user.name } })
		async unsafeOptional(user?: User): Promise<void> {
			void user;
		}

		@step("Safe optional __name__", { values: { name: user => user?.name } })
		async safeOptional(user?: User): Promise<void> {
			void user;
		}
	}
	void TypeChecks;
}
