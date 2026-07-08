# Webview Main View Navigation Implementation

## Steps

1. Add a main view registry module under `frontend/src/navigation/`.
2. Update `settingsStore` to import the registry, expose main view metadata, and route view changes through one helper.
3. Add settings tab ID validation and load the initial tab from Webview state.
4. Persist tab changes from `showSettings(tab)` and `setActiveTab(tab)`.
5. Add unit tests for persistence, invalid fallback, and registry-backed view metadata.
6. Run project validation and frontend build.

## Files

- `frontend/src/navigation/mainViews.ts`
- `frontend/src/composables/useAppShell.ts`
- `frontend/src/stores/settingsStore.ts`
- `test/frontendI18nPersistence.test.ts`
- `test/useAppShellSettingsNavigation.test.ts`

## Verification

- `npm run validate`
- `npm run build`
