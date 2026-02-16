# @cerios/playwright-step-decorator

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
