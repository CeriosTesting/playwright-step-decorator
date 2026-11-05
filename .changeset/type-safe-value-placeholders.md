---
"@cerios/playwright-step-decorator": minor
---

Add type-safe `__key__` value placeholders. Pass a `values` option that maps each key to a lambda, for example `@step("Login as __0__ (__role__)", { values: { 0: user => user.name, role: user => user.role } })`. The lambda parameters are inferred from the decorated method's signature, so you get full autocompletion, and the compiler reports missing or extra keys and mismatched parameter types. Descriptions are now formatted in a single pass, so substituted values are never re-scanned for placeholders, and the `values` option is not forwarded to `test.step()`.

`__key__` placeholders are only active when `values` is passed, so existing descriptions containing text such as `__NEXT_DATA__` keep working unchanged. Selectors must be synchronous; one that returns a promise causes a rejection.

**Behaviour changes:**

- **Broken placeholders now fail when the class is defined.** A named placeholder that doesn't match a parameter, an index beyond the declared parameters, or a missing selector now throws as soon as the file containing the class loads, instead of when the method is called. A typo in a shared page object therefore stops every spec that imports it from loading, even if the method is never called. These errors name only the method, not the class.
- **Other description errors now reject.** If a description can't be resolved for a particular call (for example a missing nested property or a failing selector), the decorated method now returns a rejected promise instead of throwing synchronously. `await` and `try`/`catch` work as before, and `.catch()`, `expect(...).rejects` and `Promise.all()` now handle these errors. Code that wraps an un-awaited call in `try`/`catch` or asserts with `expect(() => ...).toThrow()` needs updating.
- **Long values are cut off.** Each placeholder now adds at most 1,000 characters to the step title.
