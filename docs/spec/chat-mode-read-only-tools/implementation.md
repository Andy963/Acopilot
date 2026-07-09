# Chat Mode Read-Only Tools Implementation

## Steps

1. Update chat and plan mode task context with an explicit no-write instruction.
2. Pass the active `toolAllowList` into confirmation filtering.
3. Skip confirmation candidates that are outside the active allowlist.
4. Add focused tests for policy text, allowlist contents, and confirmation filtering.
5. Run validation:
   - `npm run typecheck`
   - `npm run build`
   - `npm test`

## Expected Files

- `backend/modules/api/chat/services/chatMode.ts`
- `backend/modules/api/chat/services/ToolExecutionService.ts`
- `backend/modules/api/chat/services/toolIterationLoop/runToolLoop.ts`
- `test/chatModePolicyMaxToolIterations.test.ts`
- `test/toolAllowListPropagation.test.ts`
