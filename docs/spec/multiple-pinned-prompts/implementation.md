# Multiple Pinned Prompts Implementation

## Steps

1. Add backend types and helpers for resolving active pinned prompt blocks from both `pinnedPrompts` and legacy `pinnedPrompt` metadata.
2. Add placeholder rendering for `{{$PINNED_PROMPTS}}` and `{{$PINNED_PROMPT:<id>}}`.
3. Replace direct pinned prompt prepend logic in streaming, non-streaming, context preview, and token estimation paths.
4. Add `{{$PINNED_PROMPTS}}` to backend and frontend default prompt templates and prompt module lists.
5. Update frontend pinned prompt state to store a list while retaining legacy compatibility helpers.
6. Update pinned context UI to add, remove, and reorder multiple prompt blocks.
7. Update Context Inspector types and display to summarize multiple injected prompts.
8. Add focused backend and frontend tests.
9. Run validation:
   - `npm run typecheck`
   - `npm run build`
   - `npm test`
   - `npm run validate`

## Expected Files

- `backend/modules/api/chat/services/pinnedPrompt.ts`
- `backend/modules/api/chat/services/toolIterationLoop/buildPromptAndSnapshot.ts`
- `backend/modules/api/chat/services/toolIterationLoop/runNonStreamLoop.ts`
- `backend/modules/api/chat/contextInspector.ts`
- `backend/modules/api/chat/services/ContextTrimService.ts`
- `backend/modules/settings/settingsTypes/prompting.ts`
- `backend/modules/conversation/types/context.ts`
- `frontend/src/stores/chat/pinnedPromptActions.ts`
- `frontend/src/stores/chat/types.ts`
- `frontend/src/stores/chat/state.ts`
- `frontend/src/components/input/usePinnedFilesPanel.ts`
- `frontend/src/components/input/PinnedFilesPanel.vue`
- `frontend/src/components/input/PinnedFilesPanel.css`
- `frontend/src/components/settings/prompt/types.ts`
- `frontend/src/types/ui.ts`
- `frontend/src/components/common/ContextInspectorModal.vue`
- `frontend/src/components/message/ContextUsedMessage.vue`
- `frontend/src/i18n/langs/*`
- `test/pinnedPromptPresetInjection.test.ts`
- `test/pinnedPromptActions.test.ts`
