---
"@cerios/playwright-step-decorator": patch
---

Fix several `@step` edge cases:

- **Step names:** static methods are now named after their class instead of `Function`. Detached calls no longer crash, and neither do symbol-named methods compiled with `tsc`.
- **Printed values:** an object used more than once is no longer labelled `[Circular]`. `RegExp`, `Map`, `Set` and nested `Error` values no longer print as `{}`. Very large values use a shorter, depth-limited form.
- **Named placeholders:**
  - Comments in the parameter list no longer break them.
  - Non-ASCII parameter names are supported.
  - A template literal default only affects its own parameter.
  - Hexadecimal, octal, binary, leading-dot and separated number defaults can be printed.
  - Repeated spaces in string defaults are preserved.
- **Types:** `stepResult()` now rejects functions with parameters and classes at compile time. These always failed at runtime.
- **Source locations:** call-site detection now handles anonymous async stack frames and skips all `node:` frames.
