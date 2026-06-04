# @cerios/playwright-step-decorator

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
