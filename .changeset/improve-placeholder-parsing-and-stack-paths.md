---
"@cerios/playwright-step-decorator": patch
---

Improve named-placeholder resolution by supporting default-value and rest parameters more robustly, including printing omitted literal defaults such as string-literal union values. Step descriptions now render objects and arrays as JSON when possible, raise clearer errors when a method signature cannot be matched safely by name or when an omitted default expression cannot be resolved safely, and stack filtering/location capture avoid treating user files with similar basenames as internal decorator frames.
