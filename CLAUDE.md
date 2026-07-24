# Project Context

## Terminology

Before working on any UI, code, or documentation in this project, read the glossary:

**`design/glossary.md`** — defines all standard terms (Story, Lesson, Creation, Generator, Library, etc.)

Use these terms consistently across variable names, comments, and documentation and design.

Also use these terms to understand the prompts provided by me

## Tests
* When creating significant features also suggest adding them to the test suit that I can run from the "tests" page.
* When I ask to add tests, always add them to the tests page unless I said otherwise.

## Designs
When I'm asking you to create a design for something, please always create an md file with the design in the design folder

## Git
Never commit or push on my behalf. Make code changes and stop there — I will review, commit, and manage branches myself.

## Translations
Every visible UI string **must** go through the translation system — no hardcoded text in components.

- Translation files: `website/src/app/i18n/en.json` and `he.json`
- Use `t("namespace.key")` in components via `useLanguage()`
- When adding any new string, always add the key to **both** `en.json` and `he.json` in the same change
- Key naming: dot-notation namespaces — `storyForm.*`, `lessonForm.*`, `common.*`, `story.*`, `lesson.*`, etc.
- Parameters use `{placeholder}` syntax: `"common.timeAgo.minutes": "{n}m ago"` → `t("common.timeAgo.minutes", { n: mins })`
- For utility functions that return UI strings, pass `t` as a parameter (don't call hooks outside React components)
