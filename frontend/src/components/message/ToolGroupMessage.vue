<script setup lang="ts">
import { computed } from 'vue'
import type { Message, ToolUsage } from '../../types'
import ToolMessage from './ToolMessage.vue'

const props = defineProps<{
  messages: Message[]
  toolName: string
}>()

const tools = computed<ToolUsage[]>(() => {
  const all: ToolUsage[] = []
  for (const m of props.messages) {
    if (Array.isArray(m.tools)) {
      for (const t of m.tools) {
        if (t?.name === props.toolName) all.push(t)
      }
    }
  }
  return all
})
</script>

<template>
  <div class="tool-group">
    <ToolMessage :tools="tools" />
  </div>
</template>

<style scoped>
.tool-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
  min-width: 0;
  padding: var(--spacing-md, 16px) var(--spacing-md, 16px);
  border-bottom: 1px solid var(--vscode-panel-border);
}
</style>
