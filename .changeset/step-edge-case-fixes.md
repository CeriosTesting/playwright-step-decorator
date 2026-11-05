---
"@cerios/playwright-step-decorator": patch
---

Fix several `@step` edge cases:

- **Step names:** static methods are now named after their class instead of `Function`. Detached calls no longer crash, and neither do symbol-named methods compiled with `tsc`.
- **Printed values:** an object used more than once is no longer labelled `[Circular]`. `RegExp`, `Map`, `Set` and nested `Error` values no longer print as `{}`. Very large objects use a shorter, depth-limited form.
- **Named placeholders:**
  - Comments in the parameter list no longer break them.
  - Non-ASCII parameter names are supported.
  - A template literal default only affects its own parameter.
  - Hexadecimal, octal, binary, leading-dot and separated number defaults can be printed, and so can object and array defaults made only of literals, such as `{ timeout: 5 }` or `["a", "b"]`. A property missing from an omitted object default prints `undefined`.
  - Repeated spaces in string defaults are preserved.
  - Properties of strings, numbers and functions can be read, for example `{{name.length}}`.
  - The "Missing function parameters" error now suggests moving `@step` directly above the method when another decorator hides the parameters.
- **`getStepInfo()`:** it now works when a step was started by the other build of this package (CommonJS or ES module).
- **Performance:** descriptions and parameter lists are parsed once instead of on every call.
- **Types:** `stepResult()` now rejects functions with parameters and classes at compile time. These always failed at runtime.
- **Source locations:** call-site detection now handles anonymous async stack frames and skips all `node:` frames.
- **Package metadata:** `engines` now declares the supported Node.js versions (18 and later).
