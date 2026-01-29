<script setup lang="ts">
import { computed } from 'vue'
import ExecuteCommandPanel from './execute_command.vue'

interface ExecuteCommandGroupItem {
  id: string
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error' | 'warning'
}

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error' | 'warning'
  toolId?: string
  embedded?: boolean
}>()

const items = computed<ExecuteCommandGroupItem[]>(() => {
  const raw = (props.args as any)?.items
  if (!Array.isArray(raw)) return []

  return raw
    .map((r: any) => ({
      id: String(r?.id || '').trim(),
      args: (r?.args && typeof r.args === 'object') ? (r.args as Record<string, unknown>) : {},
      result: (r?.result && typeof r.result === 'object') ? (r.result as Record<string, unknown>) : undefined,
      error: typeof r?.error === 'string' ? r.error : undefined,
      status: r?.status as ExecuteCommandGroupItem['status']
    }))
    .filter((r) => Boolean(r.id))
})
</script>

<template>
  <div class="execute-command-group-panel">
    <div v-for="item in items" :key="item.id" class="execute-command-group-item">
      <ExecuteCommandPanel
        :args="item.args"
        :result="item.result"
        :error="item.error"
        :status="item.status"
        :tool-id="item.id"
      />
    </div>
  </div>
</template>

<style scoped>
.execute-command-group-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

.execute-command-group-item {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  overflow: hidden;
}
</style>
