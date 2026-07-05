<script setup lang="ts">
import { ref, watch } from 'vue'
import { Modal } from '@/components/common'
import { useI18n } from '@/i18n'

const props = defineProps<{
  modelValue: boolean
  isInstalling: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  install: [url: string]
}>()

const { t } = useI18n()
const installUrl = ref('')

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      installUrl.value = ''
    }
  },
  { immediate: true }
)
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="t('components.settings.promptSettings.skills.installFromUrl.modal.title')"
    width="680px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="skill-form">
      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.installFromUrl.modal.url') }}</label>
        <input
          v-model="installUrl"
          class="skill-form-input"
          :placeholder="t('components.settings.promptSettings.skills.installFromUrl.modal.urlPlaceholder')"
        />
        <div class="skill-install-hint">
          {{ t('components.settings.promptSettings.skills.installFromUrl.modal.hint') }}
        </div>
      </div>

      <div v-if="error" class="skill-form-error">
        <i class="codicon codicon-warning"></i>
        <span>{{ error }}</span>
      </div>
    </div>

    <template #footer>
      <button class="dialog-btn cancel" :disabled="isInstalling" @click="emit('update:modelValue', false)">
        {{ t('common.cancel') }}
      </button>
      <button class="dialog-btn confirm" :disabled="isInstalling" @click="emit('install', installUrl)">
        <i v-if="isInstalling" class="codicon codicon-loading codicon-modifier-spin"></i>
        <span v-else>{{ t('common.install') }}</span>
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.skill-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-form-label {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.skill-form-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  font-size: 12px;
}

.skill-install-hint {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.skill-form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-errorForeground, #f14c4c);
}

.dialog-btn {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s, opacity 0.15s;
}

.dialog-btn.cancel {
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}

.dialog-btn.cancel:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.dialog-btn.confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 88px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dialog-btn.confirm:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.dialog-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
