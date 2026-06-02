---
"@cerios/playwright-step-decorator": patch
---

Allow `@step` to decorate non-`async` methods. Methods that return a `Promise` without using the `async` keyword (e.g. `resetForm(): Promise<void> { return Promise.resolve(); }`) no longer require `async`, avoiding the `require-await` lint error when a method body has no `await`.
