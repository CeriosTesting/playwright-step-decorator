# @cerios/playwright-step-decorator

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
