---
"@cerios/playwright-step-decorator": patch
---

Fix `getStepInfo` context tracking for concurrent `@step` calls on the same instance by storing the active step in async-local storage instead of on `this`. This keeps step context isolated across overlapping `Promise.all(...)` calls and adds a zero-argument `getStepInfo()` overload while retaining `getStepInfo(this)` for backwards compatibility.
