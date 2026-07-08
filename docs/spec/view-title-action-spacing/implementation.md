# View Title Action Spacing Implementation

## Steps

1. Update the `view/title` contribution ranks in `package.json`.
2. Update the VS Code menu enhancement test to require separated action ranks.
3. Run the targeted test, validators, and extension build.
4. Release as the next independent prerelease version.

## Files

- `package.json`
- `test/vscodeMenuEnhancements.test.ts`

## Verification

- `npx vitest run test/vscodeMenuEnhancements.test.ts`
- `npm run validate`
- `npm run build`
