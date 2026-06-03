# 🎭 Playwright Step Decorator | By Cerios

A TypeScript decorator for Playwright that makes your test steps more readable and traceable by allowing you to add dynamic, parameterized descriptions to your test steps.

## Features

- **Decorator syntax** for Playwright steps.
- **Dynamic descriptions**: Use placeholders to inject parameter values into step descriptions.
- **Supports nested properties**: Reference nested object properties in your descriptions.
- **Index-based placeholders**: Reference arguments by their position.
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

If a method uses destructured parameters, prefer index placeholders such as `[[0]]`. The decorator cannot reliably map destructured bindings like `{ name }` back to a placeholder name such as `{{name}}`.

When a placeholder resolves to an object or array, the decorator renders it as JSON when possible so reports stay readable.

---

## Examples

### 1. Named and Nested Placeholders

```typescript
@step("User: {{user.name}}, Age: {{user.age}}")
async function greet(user: { name: string, age: number }) {
  // ...
}
await greet({ name: 'Alice', age: 30 });
// Step description: "User: Alice, Age: 30"
```

### 2. Index Placeholders

```typescript
@step("First arg is [[0]], second is [[1]]")
async function doSomething(a: string, b: number) {
  // ...
}
await doSomething('foo', 42);
// Step description: "First arg is foo, second is 42"
```

### 3. Mixing Named and Index Placeholders

```typescript
@step("Named: {{name}}, Index: [[1]]")
async function example(name: string, value: number) {
  // ...
}
await example('Bob', 77);
// Step description: "Named: Bob, Index: 77"
```

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

- Throws if a named parameter in the description does not exist in the function signature.
- Throws a targeted error when named placeholders are used with destructured or otherwise unsupported parameter syntax, and suggests using index placeholders instead.
- Throws if a nested property does not exist on the parameter.
- Throws if an index placeholder is out of bounds.

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
