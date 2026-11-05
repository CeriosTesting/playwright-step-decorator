---
"@cerios/playwright-step-decorator": minor
---

Add type-safe `__key__` value placeholders. Pass a `values` option that maps each key to a lambda, for example `@step("Login as __0__ (__role__)", { values: { 0: user => user.name, role: user => user.role } })`. The lambda parameters are inferred from the decorated method's signature, so you get full autocompletion, and the compiler reports missing or extra keys and mismatched parameter types. Descriptions are now formatted in a single pass, so substituted values are never re-scanned for placeholders, and the `values` option is not forwarded to `test.step()`.

`__key__` placeholders are only active when `values` is passed, so existing descriptions containing text such as `__NEXT_DATA__` keep working unchanged.

**Behaviour change:** if a description can't be resolved (for example a missing parameter, an out-of-bounds index or a failing selector), the decorated method now returns a rejected promise instead of throwing synchronously. `await` and `try`/`catch` work as before, and `.catch()`, `expect(...).rejects` and `Promise.all()` now handle these errors. Code that wraps an un-awaited call in `try`/`catch` or asserts with `expect(() => ...).toThrow()` needs updating.
