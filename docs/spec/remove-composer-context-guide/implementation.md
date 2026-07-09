# Remove Composer Context Guide Implementation

## Steps

1. Remove `contextLifecycleTooltip` and its template chip from `ComposerTopBar.vue`.
2. Remove `contextLifecycle` translations from input i18n dictionaries.
3. Update the static attachment context enhancement test.
4. Run targeted tests, type checking, frontend build, and full validation.

## Files

- `frontend/src/components/input/ComposerTopBar.vue`
- `frontend/src/i18n/langs/en/components/input.ts`
- `frontend/src/i18n/langs/zh-CN/components/input.ts`
- `frontend/src/i18n/langs/ja/components/input.ts`
- `test/attachmentContextEnhancements.test.ts`

## Verification

- `npx vitest run test/attachmentContextEnhancements.test.ts`
- `npm run typecheck:frontend`
- `npm run build`
- `npm run validate`
