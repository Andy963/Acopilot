<script setup lang="ts">
import { IconButton, Modal, Tooltip } from '../common'
import { useCreateTaskModal } from './useCreateTaskModal'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const {
  t,
  visible,
  issueUrl,
  issue,
  fetchError,
  isFetching,
  isAnalyzing,
  analysisProgress,
  intentSummary,
  suggestedPrompt,
  taskContext,
  promptExpanded,
  canCreate,
  handleOpenIssue,
  handleCopyPrompt,
  handleInsertToChat,
  handleCreate,
  handleStart,
} = useCreateTaskModal(props, emit)
</script>

<template>
  <Modal v-model="visible" title="Create Task" width="640px">
    <div class="create-task">
      <div class="url-row">
        <input
          v-model="issueUrl"
          type="text"
          class="url-input"
          placeholder="Issue URL"
        />
        <Tooltip content="Open in browser" placement="left">
          <IconButton icon="codicon-link-external" size="small" :disabled="!issueUrl.trim()" @click="handleOpenIssue" />
        </Tooltip>
      </div>

      <div class="issue-card">
        <template v-if="isFetching">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-90"></div>
          <div class="skeleton-line w-80"></div>
        </template>

        <template v-else-if="fetchError">
          <div class="issue-error">
            <i class="codicon codicon-error"></i>
            <span>{{ fetchError }}</span>
          </div>
        </template>

        <template v-else-if="issueUrl.trim()">
          <div class="issue-header">
            <i class="codicon" :class="issue?.provider === 'github' ? 'codicon-mark-github' : 'codicon-globe'"></i>
            <span class="issue-ref">
              <template v-if="issue?.repo && issue?.number">{{ issue.repo }}#{{ issue.number }}</template>
              <template v-else>Unrecognized URL</template>
            </span>
          </div>
          <div class="issue-title">
            <template v-if="issue?.title">{{ issue.title }}</template>
            <template v-else>Paste an issue URL to preview</template>
          </div>
        </template>

        <template v-else>
          <div class="issue-empty">
            <i class="codicon codicon-info"></i>
            <span>Paste an issue URL to start</span>
          </div>
        </template>
      </div>

      <div class="analyzing" v-if="issueUrl.trim()">
        <div class="analyzing-row">
          <i class="codicon codicon-sync spin" v-if="isAnalyzing"></i>
          <i class="codicon codicon-check" v-else-if="analysisProgress === 100"></i>
          <span>Analyzing intent...</span>
          <span class="analyzing-percent">{{ analysisProgress }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${analysisProgress}%` }"></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Intent Summary</div>
        <textarea v-model="intentSummary" class="textarea" rows="3" placeholder="Intent summary..."></textarea>
      </div>

      <div class="section">
        <div class="section-title section-title-row" @click="promptExpanded = !promptExpanded">
          <div class="section-title-left">
            <i class="codicon" :class="promptExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
            <span>Suggested prompt</span>
          </div>
          <div class="section-title-actions" @click.stop>
            <button class="mini-btn" :disabled="!suggestedPrompt.trim()" @click="handleCopyPrompt">{{ t('common.copy') }}</button>
            <button class="mini-btn" :disabled="!suggestedPrompt.trim()" @click="handleInsertToChat">Insert to chat</button>
          </div>
        </div>
        <textarea
          v-if="promptExpanded"
          v-model="suggestedPrompt"
          class="textarea textarea-mono"
          rows="6"
          placeholder="Suggested prompt..."
        ></textarea>
      </div>
    </div>

    <template #footer>
      <button class="footer-btn cancel" @click="visible = false">{{ t('common.cancel') }}</button>
      <button class="footer-btn" :disabled="!canCreate" @click="handleCreate">{{ t('common.create') }}</button>
      <button class="footer-btn primary" :disabled="!canCreate" @click="handleStart">
        <i class="codicon codicon-play"></i>
        {{ t('common.start') }}
      </button>
    </template>
  </Modal>
</template>

<style scoped src="./CreateTaskModal.css"></style>
