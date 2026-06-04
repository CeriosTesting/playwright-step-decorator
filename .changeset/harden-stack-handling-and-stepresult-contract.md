---
"@cerios/playwright-step-decorator": patch
---

Harden stack-derived step reporting by normalizing Windows `file:///` call-site paths into valid source locations and by preserving user stack frames while trimming internal decorator wrapper frames. This also clarifies `stepResult`'s function-input semantics so zero-argument callbacks are treated as factories and function values can be returned explicitly from the callback form.
