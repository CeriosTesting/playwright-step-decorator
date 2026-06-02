---
"@cerios/playwright-step-decorator": minor
---

Add support for truly synchronous `@step` methods

The `@step` decorator now works with methods that return any type — not just `Promise<T>`. You can decorate methods that return `void`, `string`, `number`, an object, or nothing at all:

```typescript
class MyPage {
	@step("Set value to {{value}}")
	setValue(value: string): void {
		this.inputValue = value;
	}

	@step("Get the current URL")
	getPageUrl(): string {
		return this._page.url();
	}
}
```

TypeScript sees the correct return type at the call site — no `await` needed, no type widening, no cast required. The step is still recorded in Playwright reports and the trace viewer.
