# 🎭 Playwright Step Decorator | By Cerios

A TypeScript decorator for Playwright that makes your test steps more readable and traceable by allowing you to add dynamic, parameterized descriptions to your test steps.

## Features

- **Decorator syntax** for Playwright steps.
- **Dynamic descriptions**: Use placeholders to inject parameter values into step descriptions.
- **Supports nested properties**: Reference nested object properties in your descriptions.
- **Index-based placeholders**: Reference arguments by their position.
- **Type-safe value placeholders**: `__key__` placeholders are filled by lambdas whose parameters are inferred from the decorated method. You get full autocompletion, and the compiler checks that every key has exactly one selector.
- **Better parameter matching**: Named placeholders now handle default values and rest parameters more reliably.
- **Readable complex values**: Objects and arrays are rendered as JSON in step descriptions when possible.
- **Forwards Playwright step options**: Pass `box`, `timeout`, or a custom `location` to `test.step()`.
- **Accurate source locations**: Step locations in reports point to the actual method call site, not the decorator implementation.

---

## Installation

```sh
npm install @cerios/playwright-step-decorator
```

### For Development

```sh
npm install --save-dev @cerios/playwright-step-decorator
```

---

## Usage

`@step` is a standard ECMAScript decorator for class methods. Playwright's transpiler supports this out of the box. If you compile your tests with `tsc`, make sure `experimentalDecorators` is not enabled: `@step` then has no effect, and no step is reported.

### Import the Decorator

```typescript
import { step, stepResult } from "@cerios/playwright-step-decorator";
```

Use `stepResult()` for non-async `@step` methods that resolve no value, `stepResult(value)` when they resolve a non-function value, or `stepResult(() => { ... })` when you want a small lambda with multiple actions. Function inputs are treated as factories, so if you need to resolve a function itself, return it from a lambda such as `stepResult(() => actualFunction)`.

### Basic Example

```typescript
class MyTest {
	@step("Login as {{user.name}}")
	async login(user: { name: string }) {
		// ...login logic
	}

	@step("Click button [[0]] times")
	async clickButton(times: number) {
		// ...click logic
	}

	@step("Build greeting for {{name}}")
	buildGreeting(name: string): Promise<string> {
		return stepResult(`Hello ${name}`);
	}

	@step("Prepare greeting for {{name}}")
	prepareGreeting(name: string): Promise<string> {
		return stepResult(() => {
			const greeting = `Hello ${name}`;
			return greeting.toUpperCase();
		});
	}

	@step("Reset the form")
	resetForm(): Promise<void> {
		// No `await` inside and no `async` keyword needed (avoids the require-await lint error)
		this.dirty = false;
		return stepResult();
	}
}
```

### Passing `test.step()` Options

You can pass Playwright step options as the only decorator argument, or as the second argument when you also want a custom description:

```typescript
class MyTest {
	@step("Wait for checkout", { box: true, timeout: 15_000 })
	async waitForCheckout() {
		// ...wait logic
	}

	@step({ timeout: 5_000 })
	async refreshTotals() {
		// Uses the default step name: "MyTest.refreshTotals"
	}

	@step("Open modal", {
		location: { file: "tests/cart.spec.ts", line: 42, column: 7 },
	})
	async openModal() {
		// Uses the explicit location instead of the generated call site
	}

	@step("Submit order", { timeout: 30_000 })
	async submitOrder() {
		// Still auto-generates the call-site location because no custom location was supplied
	}
}
```

---

## How It Works

The `@step` decorator wraps your promise-returning method in a Playwright `test.step`, using a dynamic description. Placeholders in the description are replaced with actual argument values at runtime.

> **Note:** A decorated method does not need the `async` keyword. If a method body has no `await`, you can drop `async` to avoid the `require-await` lint error. Because the decorated call is wrapped in `test.step` (which is asynchronous) and callers should `await` it, keep the return type a `Promise` and return `stepResult()`, `stepResult(value)` for non-function values, or `stepResult(() => { ... })` instead of marking the method `async`:
>
> ```typescript
> @step("Reset the form")
> resetForm(): Promise<void> {
> 	this.dirty = false;
> 	return stepResult(); // no `async`, no require-await warning
> }
>
> @step("Build greeting for {{name}}")
> buildGreeting(name: string): Promise<string> {
> 	return stepResult(`Hello ${name}`);
> }
>
> @step("Prepare greeting for {{name}}")
> prepareGreeting(name: string): Promise<string> {
> 	return stepResult(() => {
> 		const greeting = `Hello ${name}`;
> 		return greeting;
> 	});
> }
> ```

### Placeholders

- **Named parameter**: `{{param}}`
  Replaced with the value of the parameter named `param`. Named placeholders support identifier parameters, default values, and rest parameters.
- **Nested property**: `{{param.prop}}`
  Replaced with the value of the property `prop` of parameter `param`.
- **Index-based**: `[[0]]`, `[[1]]`, ...
  Replaced with the argument at the given index.
- **Value selector**: `__key__` (for example `__0__` or `__role__`)
  Replaced with the result of the matching lambda in the `values` option. Without `values`, `__key__` is literal text. See [Value Selector Placeholders](#4-value-selector-placeholders).

When a placeholder resolves to an object or array, the decorator renders it as JSON when possible so reports stay readable. Regular expressions, errors, `Map`s and `Set`s are printed in a readable form, and very large values use a shorter, depth-limited form.

Named placeholders read the parameter names from the method's source. If another decorator sits below `@step`, `@step` sees that decorator's wrapper function rather than your parameters, so use index placeholders such as `[[0]]` instead.

---

## Examples

### 1. Named and Nested Placeholders

```typescript
class Greeter {
	@step("User: {{user.name}}, Age: {{user.age}}")
	async greet(user: { name: string; age: number }) {
		// ...
	}
}
await new Greeter().greet({ name: "Alice", age: 30 });
// Step description: "User: Alice, Age: 30"
```

### 2. Index Placeholders

```typescript
class Worker {
	@step("First arg is [[0]], second is [[1]]")
	async doSomething(a: string, b: number) {
		// ...
	}
}
await new Worker().doSomething("foo", 42);
// Step description: "First arg is foo, second is 42"
```

### 3. Mixing Named and Index Placeholders

```typescript
class Example {
	@step("Named: {{name}}, Index: [[1]]")
	async run(name: string, value: number) {
		// ...
	}
}
await new Example().run("Bob", 77);
// Step description: "Named: Bob, Index: 77"
```

### 4. Value Selector Placeholders

Use `__key__` placeholders when the step text needs something computed from the arguments, such as one item of an array, a filtered list, or a conditional label. Each key maps to a lambda in the `values` option. The lambda receives the method's arguments **with their real types**, so your editor autocompletes them and the compiler checks them:

```typescript
type Contact = { name: string; email: string; primary: boolean };
type User = { name: string; role: string; contacts: Contact[] };

class ContactsPage {
	@step("Add contacts for __0__ (second: __second__, primary: __primary__)", {
		values: {
			0: user => user.name, // user: User
			second: (_user, contacts) => contacts[1].email, // contacts: Contact[]
			primary: user =>
				user.contacts
					.filter(c => c.primary)
					.map(c => c.name)
					.join(", "),
		},
	})
	async addContacts(user: User, contacts: Contact[]) {
		// ...
	}
}
// Step description: "Add contacts for Alice (second: carol@example.com, primary: Bob, Dave)"
```

`__key__` placeholders are only active when you pass the `values` option. Without it, text such as `__NEXT_DATA__` prints as is.

When you pass `values` with a literal description, the compiler enforces:

- every `__key__` in the description has a selector in `values`,
- `values` contains no keys that aren't in the description,
- each lambda's parameters match the decorated method's parameters. Explicit annotations such as `(user: User) => ...` are allowed, but they must match.

Notes:

- Keys can be numeric (`__0__` → `{ 0: ... }`) or names (`__role__` → `{ role: ... }`). Keys are any text between `__` and `__` without whitespace, braces or square brackets. Other spans, such as `a __ b __ c` or `report__{{date}}__final`, stay as literal text.
- To print literal `__text__` in a description that also uses `values`, return it from a selector: `{ literal: () => "__text__" }`. A parameter name that contains a complete `__key__`, such as `{{a__b__c}}`, can't be used alongside `values`, so use an index placeholder for it.
- Lambdas receive the arguments exactly as passed; omitted optional arguments are `undefined`.
- A lambda that returns `null` or `undefined` prints `null` or `undefined`. For nullable parameters, use optional chaining (`user => user?.name`), which the compiler requires when the parameter's type allows `null` or `undefined`.
- The returned value is formatted like any other placeholder (strings as-is, objects as JSON).
- If the description is a plain `string` variable instead of a literal, keys can't be checked at compile time. A missing selector then throws at runtime.

---

## Accurate Source Locations in Reports

The decorator automatically captures the call site location of your decorated methods and passes it to Playwright's `test.step()`. This means that:

- **HTML reports** show the correct file and line number where the method was called
- **Trace viewer** points to the actual test code, not the decorator implementation
- **CI logs** display accurate source locations for easier debugging

This feature uses Playwright's built-in [`location` parameter](https://playwright.dev/docs/api/class-test#test-step-option-location) to ensure step locations in reports are as helpful as possible. If you provide `location` in the decorator's second argument, that explicit value is used. Otherwise, the decorator falls back to the generated call-site location automatically.

### Example

When you call a decorated method in your test:

```typescript
// my-test.spec.ts
test("example", async ({ page }) => {
	const loginPage = new LoginPage(page);
	await loginPage.login(user); // Line 10
});
```

The Playwright report will show the step location as `my-test.spec.ts:10`, not the location of the decorator implementation.

---

## Error Handling

If a description can't be resolved, the promise returned by the decorated method rejects and the step doesn't start. This happens when:

- A named parameter in the description does not exist in the function signature.
- Named placeholders are used with destructured or otherwise unsupported parameter syntax. The error suggests using index placeholders instead.
- A nested property does not exist on the parameter. If the parameter (or an intermediate property) is `null` or `undefined`, the placeholder prints `null` or `undefined` instead.
- An index placeholder is out of bounds.
- A `__key__` placeholder has no selector in `values`. This is a compile-time error for literal descriptions.
- A `values` selector throws. The rejection is a descriptive error with the original error as `cause`.

---

## Accessing Step Context (`getStepInfo`)

Sometimes you want to attach files, logs, or metadata to the current Playwright step inside your decorated method.
Use the `getStepInfo` function to access the [`TestStepInfo`](https://playwright.dev/docs/api/class-teststepinfo) object for the current step.

### Example

```typescript
import { step, getStepInfo } from "@cerios/playwright-step-decorator";

class NavbarTest {
	@step("Assert the navbar items are as expected")
	async assertNavbarItems(expectedItems: string[]): Promise<void> {
		const stepInfo = getStepInfo();
		await stepInfo.attach("expected-items.json", {
			body: JSON.stringify(expectedItems),
			contentType: "application/json",
		});
		// ...your assertions...
		await stepInfo.attach("actual-items.json", {
			body: JSON.stringify(await this.navbarItem.allInnerTexts()),
			contentType: "application/json",
		});
	}
}
```

**Note:**

- `getStepInfo()` and `getStepInfo(this)` must be called inside a method decorated with `@step`.
- Step context is tracked per async invocation, so concurrent `Promise.all(...)` calls on the same instance keep their own `TestStepInfo`.
- Throws an error if called outside a step context.

---

## API

### `step(description: string)`

- **description**: The step description, supporting placeholders like `{{param}}`, `{{param.prop}}`, or `[[index]]`.
- **Returns**: A decorator function for promise-returning methods.

### `step(description: string, options)`

- **options.box / options.timeout / options.location**: Forwarded to Playwright's `test.step()`.
- **options.values**: An object mapping each `__key__` placeholder in the description to a lambda `(...methodArgs) => unknown`. Passing it turns on `__key__` placeholders for that description.

### `step(options)`

- **options**: Playwright step options; the step uses the default `ClassName.methodName` description.

Exported helper types: `StepOptions`, `StepValueSelector<Args>`, `StepValues<Description, Args>`, `StepOptionsWithValues<Description, Args>`, and `ValuePlaceholderKeys<Description>`.

### `getStepInfo()`

- **Returns**: The current Playwright `TestStepInfo` for the active decorated method call.

### `getStepInfo(instance)`

- **instance**: Retained for backwards compatibility with earlier releases.
- **Returns**: The current Playwright `TestStepInfo` for the active decorated method call.

### `stepResult()`

- **Returns**: `Promise<void>` for non-async `@step` methods that do not return a value.

### `stepResult(value)`

- **value**: A non-function value to resolve.
- **Returns**: `Promise<Awaited<T>>` for non-async `@step` methods that return a value.

### `stepResult(() => value)`

- **callback**: A zero-argument lambda that can perform multiple synchronous actions before returning a value.
- **Returns**: `Promise<Awaited<T>>` with the callback result, rejecting if the callback throws.

If you need to resolve a function value itself, wrap it in the callback form: `stepResult(() => actualFunction)`.

---

## License

MIT

---

## Author

Ronald Veth - Cerios

---

## Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

---

## Links

- [NPM Package](https://www.npmjs.com/package/@cerios/playwright-step-decorator)
- [GitHub Repository](https://github.com/CeriosTesting/playwright-step-decorator)
