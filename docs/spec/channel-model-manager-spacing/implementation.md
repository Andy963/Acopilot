# Channel Settings Compact Layout Implementation

## Steps

1. Update `ModelManager.css` with model list block margin and model list padding/gap.
2. Add or update a static test covering the spacing rules.
3. Remove the standalone icon gutter from the tool protocol row.
4. Move the tool protocol icon inline with the label.
5. Render the multimodal label before its checkbox.
6. Add an accessible label to the checkbox-only multimodal control.
7. Update scoped CSS for compact row spacing and right-side checkbox alignment.
8. Add static coverage for the capability control structure.
9. Run targeted tests, type checking, build, and full validation.

## Files

- `frontend/src/components/settings/ModelManager.css`
- `frontend/src/components/settings/ChannelSettings.vue`
- `frontend/src/components/settings/ChannelSettings.part1.css`
- `test/modelManagerSpacing.test.ts`
- `test/vscodeMenuEnhancements.test.ts`

## Verification

- `npx vitest run test/modelManagerSpacing.test.ts`
- `npx vitest run test/vscodeMenuEnhancements.test.ts`
- `npm run typecheck:frontend`
- `npm run build`
- `npm run validate`
