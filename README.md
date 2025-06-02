# 🎭 Playwright Step Decorator | By Cerios

A TypeScript decorator for Playwright that makes your test steps more readable and traceable by allowing you to add dynamic, parameterized descriptions to your test steps.

## Features

- **Decorator syntax** for Playwright steps.
- **Dynamic descriptions**: Use placeholders to inject parameter values into step descriptions.
- **Supports nested properties**: Reference nested object properties in your descriptions.
- **Index-based placeholders**: Reference arguments by their position.

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
import { step } from "@cerios/playwright-step-decorator";
```

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
}
```

---

## How It Works

The `@step` decorator wraps your async function in a Playwright `test.step`, using a dynamic description. Placeholders in the description are replaced with actual argument values at runtime.

### Placeholders

- **Named parameter**: `{{param}}`  
  Replaced with the value of the parameter named `param`.
- **Nested property**: `{{param.prop}}`  
  Replaced with the value of the property `prop` of parameter `param`.
- **Index-based**: `[[0]]`, `[[1]]`, ...  
  Replaced with the argument at the given index.

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

## Error Handling

- Throws if a named parameter in the description does not exist in the function signature.
- Throws if a nested property does not exist on the parameter.
- Throws if an index placeholder is out of bounds.

---

## API

### `step(description: string)`

- **description**: The step description, supporting placeholders like `{{param}}`, `{{param.prop}}`, or `[[index]]`.
- **Returns**: A decorator function for async methods or functions.

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
