---
"@cerios/playwright-step-decorator": minor
---

Add support for passing Playwright step options either as the only `@step()` argument or as the second argument after a description string. The decorator now forwards `box` and `timeout`, accepts an explicit `location`, and still falls back to the generated call-site location when `location` is omitted.
