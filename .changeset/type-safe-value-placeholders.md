---
"@cerios/playwright-step-decorator": minor
---

Add type-safe `__key__` value placeholders. Pass a `values` option that maps each key to a lambda, for example `@step("Login as __0__ (__role__)", { values: { 0: user => user.name, role: user => user.role } })`. The lambda parameters are inferred from the decorated method's signature, so you get full autocompletion, and the compiler reports missing or extra keys and mismatched parameter types. Descriptions are now formatted in a single pass, so substituted values are never re-scanned for placeholders, and the `values` option is not forwarded to `test.step()`.

Note: if a literal description already contains text such as `__word__`, it is now treated as a value placeholder and needs a matching selector in `values`.
