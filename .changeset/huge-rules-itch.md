---
"@cerios/playwright-step-decorator": minor
---

Add accurate source location tracking to step decorator

Step locations in Playwright reports (HTML report, trace viewer, CI output) now point to the actual call site where the decorated method is invoked, rather than the decorator implementation file. This makes reports much easier to navigate when using decorators extensively.

The decorator automatically captures the call site location using stack trace parsing and passes it to Playwright's `test.step()` via the `location` parameter option.
