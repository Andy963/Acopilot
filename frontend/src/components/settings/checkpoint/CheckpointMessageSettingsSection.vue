<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { CustomCheckbox } from '@/components/common'
import type { CheckpointMessageType, MessageCheckpointConfig } from './types'

const { t } = useI18n()

const props = defineProps<{
  enabled: boolean
  messageTypes: CheckpointMessageType[]
  messageCheckpoint?: MessageCheckpointConfig
}>()

const emit = defineEmits<{
  toggleAllBefore: [enabled: boolean]
  toggleAllAfter: [enabled: boolean]
  toggleBefore: [payload: { messageType: string; enabled: boolean }]
  toggleAfter: [payload: { messageType: string; enabled: boolean }]
  toggleModelOuterLayerOnly: [enabled: boolean]
  toggleMergeUnchangedCheckpoints: [enabled: boolean]
}>()

const hasModelMessageCheckpoint = computed(() => {
  const checkpoint = props.messageCheckpoint
  return checkpoint?.beforeMessages?.includes('model') || checkpoint?.afterMessages?.includes('model')
})

const isAllMessageBeforeSelected = computed(() =>
  props.messageTypes.every(message => props.messageCheckpoint?.beforeMessages?.includes(message.name))
)

const isAllMessageAfterSelected = computed(() =>
  props.messageTypes.every(message => props.messageCheckpoint?.afterMessages?.includes(message.name))
)

function isMessageInBefore(messageType: string): boolean {
  return props.messageCheckpoint?.beforeMessages?.includes(messageType) ?? false
}

function isMessageInAfter(messageType: string): boolean {
  return props.messageCheckpoint?.afterMessages?.includes(messageType) ?? false
}
</script>

<template>
  <div class="setting-group" :class="{ disabled: !enabled }">
    <h4 class="group-title">
      <i class="codicon codicon-comment"></i>
      {{ t('components.settings.checkpoint.sections.messages.title') }}
    </h4>
    <p class="setting-description">
      {{ t('components.settings.checkpoint.sections.messages.description') }}
    </p>

    <div class="tools-table">
      <div class="table-header">
        <div class="col-tool">{{ t('components.settings.checkpoint.sections.messages.title') }}</div>
        <div class="col-before">
          <CustomCheckbox
            :modelValue="isAllMessageBeforeSelected"
            :label="t('components.settings.checkpoint.sections.messages.beforeLabel')"
            :disabled="!enabled"
            @update:modelValue="emit('toggleAllBefore', $event)"
          />
        </div>
        <div class="col-after">
          <CustomCheckbox
            :modelValue="isAllMessageAfterSelected"
            :label="t('components.settings.checkpoint.sections.messages.afterLabel')"
            :disabled="!enabled"
            @update:modelValue="emit('toggleAllAfter', $event)"
          />
        </div>
      </div>

      <div
        v-for="msg in messageTypes"
        :key="msg.name"
        class="table-row"
      >
        <div class="col-tool">
          <span class="tool-name">{{ msg.displayName }}</span>
          <span class="tool-desc">{{ msg.description }}</span>
        </div>
        <div class="col-before">
          <CustomCheckbox
            :modelValue="isMessageInBefore(msg.name)"
            :disabled="!enabled"
            @update:modelValue="emit('toggleBefore', { messageType: msg.name, enabled: $event })"
          />
        </div>
        <div class="col-after">
          <CustomCheckbox
            :modelValue="isMessageInAfter(msg.name)"
            :disabled="!enabled"
            @update:modelValue="emit('toggleAfter', { messageType: msg.name, enabled: $event })"
          />
        </div>
      </div>
    </div>

    <div v-if="hasModelMessageCheckpoint" class="advanced-option">
      <CustomCheckbox
        :modelValue="messageCheckpoint?.modelOuterLayerOnly ?? true"
        :label="t('components.settings.checkpoint.sections.messages.options.modelOuterLayerOnly.label')"
        :disabled="!enabled"
        @update:modelValue="emit('toggleModelOuterLayerOnly', $event)"
      />
      <p class="option-hint">
        {{ t('components.settings.checkpoint.sections.messages.options.modelOuterLayerOnly.hint') }}
      </p>
    </div>

    <div class="advanced-option">
      <CustomCheckbox
        :modelValue="messageCheckpoint?.mergeUnchangedCheckpoints ?? true"
        :label="t('components.settings.checkpoint.sections.messages.options.mergeUnchanged.label')"
        :disabled="!enabled"
        @update:modelValue="emit('toggleMergeUnchangedCheckpoints', $event)"
      />
      <p class="option-hint">
        {{ t('components.settings.checkpoint.sections.messages.options.mergeUnchanged.hint') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s;
}

.setting-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.group-title .codicon {
  font-size: 14px;
  color: var(--vscode-foreground);
}

.setting-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.tools-table {
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--vscode-sideBarSectionHeader-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 12px;
  font-weight: 500;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--vscode-list-hoverBackground);
}

.col-tool {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.col-before,
.col-after {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.tool-desc {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.advanced-option {
  margin-top: 12px;
  padding: 12px;
  background: var(--vscode-textBlockQuote-background);
  border-radius: 6px;
}

.option-hint {
  margin: 8px 0 0 24px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.4;
}
</style>
