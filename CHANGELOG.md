# @cerios/playwright-step-decorator

## 2.3.0

### Minor Changes

- dcd343d: Add type-safe `__key__` value placeholders. Pass a `values` option that maps each key to a lambda, for example `@step("Login as __0__ (__role__)", { values: { 0: user => user.name, role: user => user.role } })`. The lambda parameters are inferred from the decorated method's signature, so you get full autocompletion, and the compiler reports missing or extra keys and mismatched parameter types. Descriptions are now formatted in a single pass, so substituted values are never re-scanned for placeholders, and the `values` option is not forwarded to `test.step()`.

  `__key__` placeholders are only active when `values` is passed, so existing descriptions containing text such as `__NEXT_DATA__` keep working unchanged. Selectors must be synchronous; one that returns a promise causes a rejection.

  **Behaviour changes:**

  - **Broken placeholders now fail when the class is defined.** A named placeholder that doesn't match a parameter, an index beyond the declared parameters, or a missing selector now throws as soon as the file containing the class loads, instead of when the method is called. A typo in a shared page object therefore stops every spec that imports it from loading, even if the method is never called. These errors name only the method, not the class.
  - **Other description errors now reject.** If a description can't be resolved for a particular call (for example a missing nested property or a failing selector), the decorated method now returns a rejected promise instead of throwing synchronously. `await` and `try`/`catch` work as before, and `.catch()`, `expect(...).rejects` and `Promise.all()` now handle these errors. Code that wraps an un-awaited call in `try`/`catch` or asserts with `expect(() => ...).toThrow()` needs updating.
  - **Long values are cut off.** Each placeholder now adds at most 1,000 characters to the step title.

### Patch Changes

- 6b46b25: Nested `@step` placeholders (e.g. `{{user.name}}`) now print `undefined` or `null` when the parameter or an intermediate property is `undefined`/`null`, instead of throwing "Invalid @step placeholder". A property that does not exist on an actual object still throws.
- 5a57808: Fix several `@step` edge cases:

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

## 2.2.2

### Patch Changes

- ad6ea44: Update development dependencies, including Playwright, Changesets, Node.js typings, and the formatting, linting, and build tools. Add `npm-check-updates` for managing dependency updates.

## 2.2.1

### Patch Changes

- 9870119: Widen the optional TypeScript peer dependency range to `>=5.0.2 <8`.

## 2.2.0

### Minor Changes

- 00806ec: Add support for passing Playwright step options either as the only `@step()` argument or as the second argument after a description string. The decorator now forwards `box` and `timeout`, accepts an explicit `location`, and still falls back to the generated call-site location when `location` is omitted.
- 00806ec: Add the `stepResult` helper for non-async `@step` methods so they can return resolved promises without writing `Promise.resolve(...)` directly. This also adds support for passing a lambda to `stepResult`, making it easier to keep multiple synchronous actions together before returning the resolved value.

### Patch Changes

- 00806ec: Fix `getStepInfo` context tracking for concurrent `@step` calls on the same instance by storing the active step in async-local storage instead of on `this`. This keeps step context isolated across overlapping `Promise.all(...)` calls and adds a zero-argument `getStepInfo()` overload while retaining `getStepInfo(this)` for backwards compatibility.
- 00806ec: Harden stack-derived step reporting by normalizing Windows `file:///` call-site paths into valid source locations and by preserving user stack frames while trimming internal decorator wrapper frames. This also clarifies `stepResult`'s function-input semantics so zero-argument callbacks are treated as factories and function values can be returned explicitly from the callback form.
- 00806ec: Improve named-placeholder resolution by supporting default-value and rest parameters more robustly, including printing omitted literal defaults such as string-literal union values. Step descriptions now render objects and arrays as JSON when possible, raise clearer errors when a method signature cannot be matched safely by name or when an omitted default expression cannot be resolved safely, and stack filtering/location capture avoid treating user files with similar basenames as internal decorator frames.

## 2.1.2

### Patch Changes

- 83979de: Allow `@step` to decorate non-`async` methods. Methods that return a `Promise` without using the `async` keyword (e.g. `resetForm(): Promise<void> { return Promise.resolve(); }`) no longer require `async`, avoiding the `require-await` lint error when a method body has no `await`.

## 2.1.1

### Patch Changes

- d357129: Widen the TypeScript peer dependency range to support TypeScript 6 (`^5.0.2 || ^6.0.0`).

## 2.1.0

### Minor Changes

- 6d3953c: Add accurate source location tracking to step decorator

  Step locations in Playwright reports (HTML report, trace viewer, CI output) now point to the actual call site where the decorated method is invoked, rather than the decorator implementation file. This makes reports much easier to navigate when using decorators extensively.

  The decorator automatically captures the call site location using stack trace parsing and passes it to Playwright's `test.step()` via the `location` parameter option.

- 5a5f8a7: Refactor tooling: replace Prettier with oxfmt and lint-staged with oxlint

  This release modernizes the development toolchain by adopting faster, more efficient tooling:
  - **Formatting**: Replaced Prettier with oxfmt for faster code formatting
  - **Linting**: Replaced lint-staged + Husky pre-commit hooks with oxlint for type-aware linting
  - **Dependencies**: Updated @playwright/test to ^1.58.1 and other development dependencies
  - **CI/CD**: Split GitHub workflows into separate CI and release workflows

  These changes improve developer experience with faster formatting and linting while maintaining code quality standards.

## 2.0.0

### Major Changes

- 037cc56: New getStepInfo to retreive the new Playwright TestStepInfo of the @step decorator from within the calling method. You can then add attachments to the step or use the skip functionality

## 1.3.0

### Minor Changes

- 969a029: force async methods to be used with step decorator to prevent unawaited async

## 1.2.0

### Minor Changes

- 34195b3: Changed the step decorator to ClassMethodDecoratorContext

## 1.1.1

### Patch Changes

- 712703a: Now supporting synchronous functions in step decorator. Including fix for previous 1.1.0 release with empty node modules

## 1.1.0

### Minor Changes

- ec79eae: Now possible to use sync methods with the step decorator.
