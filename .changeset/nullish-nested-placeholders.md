---
"@cerios/playwright-step-decorator": patch
---

Nested `@step` placeholders (e.g. `{{user.name}}`) now print `undefined` or `null` when the parameter or an intermediate property is `undefined`/`null`, instead of throwing "Invalid @step placeholder". A property that does not exist on an actual object still throws.
