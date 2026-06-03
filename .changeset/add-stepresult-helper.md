---
"@cerios/playwright-step-decorator": minor
---

Add the `stepResult` helper for non-async `@step` methods so they can return resolved promises without writing `Promise.resolve(...)` directly. This also adds support for passing a lambda to `stepResult`, making it easier to keep multiple synchronous actions together before returning the resolved value.