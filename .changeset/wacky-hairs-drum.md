---
"@cerios/playwright-step-decorator": minor
---

Refactor tooling: replace Prettier with oxfmt and lint-staged with oxlint

This release modernizes the development toolchain by adopting faster, more efficient tooling:

- **Formatting**: Replaced Prettier with oxfmt for faster code formatting
- **Linting**: Replaced lint-staged + Husky pre-commit hooks with oxlint for type-aware linting
- **Dependencies**: Updated @playwright/test to ^1.58.1 and other development dependencies
- **CI/CD**: Split GitHub workflows into separate CI and release workflows

These changes improve developer experience with faster formatting and linting while maintaining code quality standards.
