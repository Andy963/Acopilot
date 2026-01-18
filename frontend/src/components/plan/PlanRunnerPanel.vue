<script setup lang="ts">
/**
 * PlanRunnerPanel - 多步任务执行面板（Plan & Run）
 */

import { computed, ref } from 'vue'
import { useChatStore } from '../../stores'
import type { PlanRunnerStep } from '../../stores/chat/types'
import { useI18n } from '../../i18n'

const { t } = useI18n()

const chatStore = useChatStore()

const plan = computed(() => chatStore.planRunner)
const expanded = ref(true)

const statusLabel = computed(() => {
  if (!plan.value) return ''
  switch (plan.value.status) {
    case 'running':
      return t('components.planRunner.status.running')
    case 'paused':
      return t('components.planRunner.status.paused')
    case 'completed':
      return t('components.planRunner.status.completed')
    case 'cancelled':
      return t('components.planRunner.status.cancelled')
    default:
      return t('components.planRunner.status.idle')
  }
})

function stepIcon(step: PlanRunnerStep): string {
  switch (step.status) {
    case 'success':
      return 'codicon-pass'
    case 'running':
      return 'codicon-loading'
    case 'error':
      return 'codicon-error'
    case 'cancelled':
      return 'codicon-circle-slash'
    default:
      return 'codicon-circle-outline'
  }
}

function stepClass(step: PlanRunnerStep): string {
  return step.status
}

function attachmentAlias(stepIndex: number, attachmentIndex: number): string {
  return `S${stepIndex + 1}A${attachmentIndex + 1}`
}

const canStart = computed(() => plan.value && (plan.value.status === 'idle' || plan.value.status === 'paused'))
const canPause = computed(() => plan.value && plan.value.status === 'running')
const canCancel = computed(() => plan.value && (plan.value.status === 'running' || plan.value.status === 'paused'))

async function handleStartOrResume() {
  if (!plan.value) return
  if (plan.value.status === 'paused') {
    await chatStore.resumePlanRunner()
    return
  }
  await chatStore.startPlanRunner()
}

async function handlePause() {
  await chatStore.pausePlanRunner()
}

async function handleCancel() {
  await chatStore.cancelPlanRunner()
}

async function handleClear() {
  await chatStore.clearPlanRunner()
}

function canRerunStep(idx: number): boolean {
  if (!plan.value) return false
  if (plan.value.status === 'running') return false
  if (chatStore.isWaitingForResponse || chatStore.isStreaming) return false
  if (!Number.isFinite(idx)) return false
  if (idx < 0 || idx >= plan.value.steps.length) return false
  return true
}

async function handleRerunStep(idx: number) {
  if (!canRerunStep(idx)) return
  await chatStore.rerunPlanRunnerFromStep(idx)
}
</script>

<template>
  <div v-if="plan" class="plan-runner">
    <div class="plan-header" @click="expanded = !expanded">
      <i class="codicon codicon-list-ordered"></i>
      <span class="plan-title">{{ plan.title }}</span>
      <span class="plan-status">{{ statusLabel }}</span>

      <div class="plan-actions" @click.stop>
        <button
          v-if="canStart"
          class="plan-btn primary"
          @click="handleStartOrResume"
        >
          <i class="codicon codicon-play"></i>
          {{ plan.status === 'paused' ? t('components.planRunner.actions.resume') : t('components.planRunner.actions.start') }}
        </button>

        <button
          v-if="canPause"
          class="plan-btn"
          @click="handlePause"
        >
          <i class="codicon codicon-debug-pause"></i>
          {{ t('components.planRunner.actions.pause') }}
        </button>

        <button
          v-if="canCancel"
          class="plan-btn danger"
          @click="handleCancel"
        >
          <i class="codicon codicon-circle-slash"></i>
          {{ t('components.planRunner.actions.cancel') }}
        </button>

        <button class="plan-btn" @click="handleClear">
          <i class="codicon codicon-trash"></i>
          {{ t('components.planRunner.actions.clear') }}
        </button>
      </div>
    </div>

    <div v-if="expanded" class="plan-body">
      <div v-if="plan.goal" class="plan-meta">
        <span class="plan-meta-label">{{ t('components.planRunner.goalLabel') }}:</span>
        <span class="plan-meta-text">{{ plan.goal }}</span>
      </div>
      <div v-if="plan.acceptanceCriteria" class="plan-meta">
        <span class="plan-meta-label">{{ t('components.planRunner.acceptanceCriteriaLabel') }}:</span>
        <span class="plan-meta-text">{{ plan.acceptanceCriteria }}</span>
      </div>

      <div class="plan-steps">
        <div
          v-for="(step, idx) in plan.steps"
          :key="step.id"
          class="plan-step"
          :class="stepClass(step)"
        >
          <div class="step-row">
            <span class="step-index">{{ idx + 1 }}.</span>
            <i
              class="codicon step-icon"
              :class="[stepIcon(step), { 'codicon-modifier-spin': step.status === 'running' }]"
            ></i>
            <span class="step-title">{{ step.title }}</span>

            <div class="step-right">
              <span v-if="idx === plan.currentStepIndex" class="step-current">
                {{ t('components.planRunner.current') }}
              </span>
              <span v-if="step.error" class="step-error" :title="step.error">{{ step.error }}</span>
              <button
                class="step-icon-btn"
                :disabled="!canRerunStep(idx)"
                :title="t('components.planRunner.actions.rerunStep')"
                @click.stop="handleRerunStep(idx)"
              >
                <i class="codicon codicon-refresh"></i>
              </button>
            </div>
          </div>

          <div v-if="step.attachments && step.attachments.length > 0" class="step-attachments-row">
            <span class="attachments-label">{{ t('components.planRunner.attachmentsLabel') }}:</span>
            <div class="attachments-chips">
              <span
                v-for="(att, aIdx) in step.attachments"
                :key="att.id"
                class="attachment-chip"
                :title="att.name"
              >
                <code class="attachment-alias">{{ attachmentAlias(idx, aIdx) }}</code>
                <span class="attachment-name">{{ att.name }}</span>
              </span>
            </div>
          </div>

          <div v-if="step.acceptanceCriteria" class="step-acceptance-row">
            <span class="acceptance-label">{{ t('components.planRunner.acceptanceCriteriaLabel') }}:</span>
            <span class="acceptance-text" :title="step.acceptanceCriteria">{{ step.acceptanceCriteria }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-runner {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(127, 127, 127, 0.04);
  margin: 0 var(--spacing-md, 16px) var(--spacing-md, 16px);
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.plan-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.plan-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--vscode-foreground);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-status {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.plan-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.plan-btn {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.plan-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.plan-btn.primary {
  border: none;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.plan-btn.danger {
  border-color: rgba(255, 0, 0, 0.3);
}

.plan-body {
  border-top: 1px solid var(--vscode-panel-border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-meta {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  white-space: pre-wrap;
}

.plan-meta-label {
  color: var(--vscode-descriptionForeground);
}

.plan-meta-text {
  color: var(--vscode-foreground);
}

.plan-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-step {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
}

.plan-step.running {
  background: rgba(0, 120, 212, 0.08);
}

.plan-step.success {
  opacity: 0.85;
}

.plan-step.error {
  background: rgba(255, 0, 0, 0.06);
}

.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-index {
  width: 22px;
  text-align: right;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.step-icon {
  font-size: 14px;
}

.step-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.step-attachments-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 44px;
  flex-wrap: wrap;
}

.step-acceptance-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-left: 44px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  white-space: pre-wrap;
}

.acceptance-label {
  flex-shrink: 0;
}

.acceptance-text {
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.attachments-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.attachments-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--vscode-panel-border);
  background: rgba(127, 127, 127, 0.04);
  max-width: 100%;
}

.attachment-alias {
  font-size: 10px;
  color: var(--vscode-textLink-foreground);
}

.attachment-name {
  font-size: 11px;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.step-current {
  font-size: 11px;
  color: var(--vscode-textLink-foreground);
}

.step-error {
  font-size: 11px;
  color: var(--vscode-editorError-foreground);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.step-icon-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.step-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
