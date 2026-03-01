<script setup lang="ts">
import { ConfirmDialog, CustomSelect } from '../common'
import ModelManager from './ModelManager.vue'
import { AnthropicOptions, CustomBodySettings, CustomHeadersSettings, GeminiOptions, OpenAIOptions, OpenAIResponsesOptions, TokenCountMethodSettings, ToolOptionsSettings } from './channels'
import { useChannelSettings } from './useChannelSettings'

const { t, chatStore, configs, currentConfigId, isLoading, isEditing, editingName, editInput, showNewDialog, newConfigName, newConfigType, showAdvancedOptions, showCustomHeaders, showCustomBody, showApiKey, showRetryOptions, showContextThreshold, showToolOptions, showTokenCountMethod, showMultimodalDetails, showConfirmDialog, confirmDialogTitle, confirmDialogMessage, currentConfig, updateOption, updateOptionEnabled, multimodalSummaryText, providerIcon, toolModeDisplayName, configOptions, typeOptions, toolModeOptions, customHeaders, customHeadersEnabled, updateCustomHeadersEnabled, updateCustomHeaders, customBody, customBodyEnabled, updateCustomBodyEnabled, updateCustomBodyConfig, retryEnabled, retryCount, retryInterval, updateRetryEnabled, updateRetryCount, updateRetryInterval, toolOptions, updateToolOptions, contextThresholdEnabled, contextThreshold, contextTrimExtraCut, contextManagementSummary, toolOptionsSummary, tokenCountMethodSummary, customBodySummary, customHeadersSummary, autoRetrySummary, advancedOptionsSummary, updateContextThresholdEnabled, updateContextThreshold, updateContextTrimExtraCut, toggleMultimodalDetails, copyToClipboard, loadConfigs, createConfig, onConfirmDialogConfirm, isConfigDisabled, toggleConfigEnabledById, deleteConfigById, startEditing, saveEditing, cancelEditing, handleEditKeydown, cancelNew, updateConfigField, handleUpdateModels, handleUpdateSelectedModel } = useChannelSettings()
</script>

<template>
  <div class="channel-settings v2">
    <!-- 确认对话框 -->
    <ConfirmDialog v-model="showConfirmDialog" :title="confirmDialogTitle" :message="confirmDialogMessage"
      :is-danger="confirmDialogTitle === t('components.settings.channelSettings.dialog.delete.title')"
      :confirm-text="t('components.settings.channelSettings.dialog.delete.confirm')"
      :cancel-text="t('components.settings.channelSettings.dialog.delete.cancel')" @confirm="onConfirmDialogConfirm" />

    <!-- 新建对话框 -->
    <div v-if="showNewDialog" class="config-dialog">
      <div class="dialog-content">
        <h4>{{ t('components.settings.channelSettings.dialog.new.title') }}</h4>

        <div class="form-group">
          <label>{{ t('components.settings.channelSettings.dialog.new.nameLabel') }}</label>
          <input v-model="newConfigName" type="text"
            :placeholder="t('components.settings.channelSettings.dialog.new.namePlaceholder')"
            @keyup.enter="createConfig" />
        </div>

        <div class="form-group">
          <label>{{ t('components.settings.channelSettings.dialog.new.typeLabel') }}</label>
          <CustomSelect v-model="newConfigType" :options="typeOptions"
            :placeholder="t('components.settings.channelSettings.dialog.new.typePlaceholder')" />
        </div>

        <div class="dialog-actions">
          <button class="btn secondary" @click="cancelNew">{{ t('components.settings.channelSettings.dialog.new.cancel')
          }}</button>
          <button class="btn primary" @click="createConfig">{{
            t('components.settings.channelSettings.dialog.new.create') }}</button>
        </div>
      </div>
    </div>

    <!-- ==================== 1. 顶部：身份与凭据区 ==================== -->
    <!-- 配置选择器 -->
    <div class="config-selector">
      <i :class="['provider-icon', 'codicon', providerIcon]"></i>
      <!-- 编辑模式：输入框 + 确认/取消按钮 -->
      <template v-if="isEditing">
        <input ref="editInput" v-model="editingName" type="text" class="config-input"
          :placeholder="t('components.settings.channelSettings.selector.inputPlaceholder')"
          @keydown="handleEditKeydown" />
        <button class="icon-btn confirm" :title="t('components.settings.channelSettings.selector.confirm')"
          @click="saveEditing">
          <i class="codicon codicon-check"></i>
        </button>
        <button class="icon-btn cancel" :title="t('components.settings.channelSettings.selector.cancel')"
          @click="cancelEditing">
          <i class="codicon codicon-close"></i>
        </button>
      </template>

      <!-- 正常模式：自定义下拉框 -->
      <div v-else class="config-select-wrapper">
        <CustomSelect v-model="currentConfigId" :options="configOptions"
          :placeholder="t('components.settings.channelSettings.selector.placeholder')">
          <template #option-actions="{ option }">
            <button
              type="button"
              class="icon-btn option-toggle-btn"
              :title="isConfigDisabled(String(option.value)) ? t('common.enable') : t('common.disable')"
              @click="toggleConfigEnabledById(String(option.value))"
            >
              <i
                :class="[
                  'codicon',
                  isConfigDisabled(String(option.value)) ? 'codicon-eye-closed' : 'codicon-eye'
                ]"
              ></i>
            </button>
            <button type="button" class="icon-btn danger option-delete-btn"
              :title="t('components.settings.channelSettings.selector.delete')" :disabled="configs.length <= 1"
              @click="deleteConfigById(String(option.value))">
              <i class="codicon codicon-trash"></i>
            </button>
          </template>
        </CustomSelect>
      </div>

      <button v-if="!isEditing" class="icon-btn" :title="t('components.settings.channelSettings.selector.rename')"
        @click="startEditing">
        <i class="codicon codicon-edit"></i>
      </button>

      <button v-if="!isEditing" class="icon-btn" :title="t('components.settings.channelSettings.selector.add')"
        @click="showNewDialog = true">
        <i class="codicon codicon-add"></i>
      </button>
    </div>

    <!-- 配置表单 -->
    <div v-if="currentConfig" class="config-form">
      <!-- 身份与凭据区 -->
      <div class="section-group credentials-section">
        <div class="section-title">
          <i class="codicon codicon-key"></i>
          <span>{{ t('components.settings.channelSettings.form.sections.identityCredentials') }}</span>
        </div>

        <div class="credentials-card">
          <div class="credential-row api-row">
            <i class="codicon codicon-globe row-icon"></i>
            <input :value="currentConfig.url" type="text" class="credential-input" :placeholder="currentConfig.type === 'openai-responses'
              ? t('components.settings.channelSettings.form.apiUrl.placeholderResponses')
              : t('components.settings.channelSettings.form.apiUrl.placeholder')"
              @input="(e: any) => updateConfigField('url', e.target.value)" />
            <button v-if="currentConfig.url" class="credential-action copy-btn" :title="t('common.copy')"
              @click="copyToClipboard(currentConfig.url)">
              <i class="codicon codicon-copy"></i>
            </button>
          </div>

          <div class="credential-row api-key-row">
            <i class="codicon codicon-key row-icon"></i>
            <input :value="currentConfig.apiKey" :type="showApiKey ? 'text' : 'password'" class="credential-input"
              :placeholder="t('components.settings.channelSettings.form.apiKey.placeholder')"
              @input="(e: any) => updateConfigField('apiKey', e.target.value)" />
            <button class="credential-action" :title="showApiKey
              ? t('components.settings.channelSettings.form.apiKey.hide')
              : t('components.settings.channelSettings.form.apiKey.show')" @click="showApiKey = !showApiKey">
              <i :class="['codicon', showApiKey ? 'codicon-eye-closed' : 'codicon-eye']"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== 2. 中部：模型与性能区 ==================== -->
      <div class="section-group model-section">
        <!-- 模型管理器 -->
        <ModelManager :config-id="currentConfig.id" :models="currentConfig.models || []"
          :selected-model="currentConfig.model || ''" @update:models="handleUpdateModels"
          @update:selected-model="handleUpdateSelectedModel" />

        <label class="custom-checkbox compact">
          <input type="checkbox" :checked="currentConfig.options?.stream ?? true"
            @change="(e: any) => updateOption('stream', e.target.checked)" />
          <span class="checkmark"></span>
          <span class="checkbox-text">{{ t('components.settings.channelSettings.form.stream.label') }}</span>
        </label>

        <!-- 超时时间和最大上下文 Tokens 并排 -->
        <div class="performance-row">
          <div class="perf-item">
            <label>{{ t('components.settings.channelSettings.form.timeout.label') }}</label>
            <input :value="currentConfig.timeout" type="number"
              :placeholder="t('components.settings.channelSettings.form.timeout.placeholder')"
              @input="(e: any) => updateConfigField('timeout', Number(e.target.value))" />
          </div>
          <div class="perf-item">
            <label>{{ t('components.settings.channelSettings.form.maxContextTokens.label') }}</label>
            <input :value="currentConfig.maxContextTokens || 128000" type="number"
              :placeholder="t('components.settings.channelSettings.form.maxContextTokens.placeholder')"
              @input="(e: any) => updateConfigField('maxContextTokens', Number(e.target.value))" />
          </div>
        </div>
        <span class="field-hint perf-hint">{{ t('components.settings.channelSettings.form.maxContextTokens.hint')
        }}</span>
      </div>

      <!-- ==================== 3. 中部：功能能力区 ==================== -->
      <div class="section-group capabilities-section">
        <div class="section-title">
          <i class="codicon codicon-extensions"></i>
          <span>{{ t('components.settings.channelSettings.form.sections.capabilities') }}</span>
        </div>

        <!-- 工具调用格式 -->
        <div class="capability-row">
          <div class="capability-icon">
            <i class="codicon codicon-symbol-method"></i>
          </div>
          <div class="capability-content">
            <div class="capability-header">
              <span class="capability-label">{{ t('components.settings.channelSettings.form.toolMode.label') }}</span>
              <span class="capability-value">{{ toolModeDisplayName }}</span>
            </div>
            <CustomSelect :model-value="currentConfig.toolMode || 'function_call'" :options="toolModeOptions"
              :placeholder="t('components.settings.channelSettings.form.toolMode.placeholder')"
              class="capability-select" @update:model-value="(v: string) => updateConfigField('toolMode', v)" />
          </div>
        </div>

        <!-- 多模态工具配置 -->
        <div class="capability-row multimodal-row">
          <div class="capability-icon">
            <i class="codicon codicon-file"></i>
          </div>
          <div class="capability-content">
            <div class="capability-header">
              <label class="custom-checkbox compact">
                <input type="checkbox" :checked="currentConfig.multimodalToolsEnabled ?? false"
                  @change="(e: any) => updateConfigField('multimodalToolsEnabled', e.target.checked)" />
                <span class="checkmark"></span>
                <span class="checkbox-text">{{ t('components.settings.channelSettings.form.multimodalSummary') }}</span>
              </label>
            </div>
            <div class="multimodal-inline">
              <span class="multimodal-types">{{ multimodalSummaryText }}</span>
              <button type="button" class="inline-link" @click="toggleMultimodalDetails">
                {{ t('components.settings.channelSettings.form.viewCompatibility') }}
                <i class="codicon codicon-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 多模态兼容性矩阵展开内容 -->
        <div v-show="showMultimodalDetails" class="multimodal-matrix-panel">
          <div class="matrix-header">
            <span>{{ t('components.settings.channelSettings.form.multimodal.capabilities') }}</span>
            <button class="close-btn" @click="showMultimodalDetails = false">
              <i class="codicon codicon-close"></i>
            </button>
          </div>
          <div class="channel-support-table detailed">
            <div class="channel-row header-row">
              <span class="channel-name">{{ t('components.settings.channelSettings.form.multimodal.table.channel')
              }}</span>
              <span class="channel-feature">{{ t('components.settings.channelSettings.form.multimodal.table.readImage')
              }}</span>
              <span class="channel-feature">{{
                t('components.settings.channelSettings.form.multimodal.table.readDocument')
              }}</span>
              <span class="channel-feature">{{
                t('components.settings.channelSettings.form.multimodal.table.generateImage')
              }}</span>
              <span class="channel-feature">{{
                t('components.settings.channelSettings.form.multimodal.table.historyMultimodal') }}</span>
            </div>
            <div class="channel-row" :class="{ current: currentConfig.type === 'gemini' }">
              <span class="channel-name">{{ t('components.settings.channelSettings.form.multimodal.channels.geminiAll')
              }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row" :class="{ current: currentConfig.type === 'anthropic' }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.anthropicAll')
              }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row" :class="{ current: currentConfig.type === 'openai-responses' }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.openaiResponses') }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row"
              :class="{ current: currentConfig.type === 'openai' && (currentConfig.toolMode === 'xml' || currentConfig.toolMode === 'json') }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.openaiXmlJson')
              }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row"
              :class="{ current: currentConfig.type === 'openai' && (currentConfig.toolMode === 'function_call' || !currentConfig.toolMode) }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.openaiFunction')
              }}</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-no">✗</span>
            </div>
          </div>
          <div class="support-legend">
            <span class="legend-item">
              <span class="legend-symbol support-yes">✓</span>
              <span class="legend-text">{{ t('components.settings.channelSettings.form.multimodal.legend.supported')
              }}</span>
            </span>
            <span class="legend-item">
              <span class="legend-symbol support-no">✗</span>
              <span class="legend-text">{{ t('components.settings.channelSettings.form.multimodal.legend.notSupported')
              }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- ==================== 4. 下部：逻辑配置广场 ==================== -->
      <div class="section-group accordion-square">
        <div class="section-title">
          <i class="codicon codicon-settings-gear"></i>
          <span>{{ t('components.settings.channelSettings.form.sections.advancedConfig') }}</span>
        </div>

        <!-- 上下文管理 -->
        <div class="accordion-item" :class="{ disabled: !contextThresholdEnabled, expanded: showContextThreshold }">
          <button class="accordion-header" @click="showContextThreshold = !showContextThreshold">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-history item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.contextManagement.title') }}</span>
            <span class="item-summary">{{ contextManagementSummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="contextThresholdEnabled"
                @change="(e: any) => updateContextThresholdEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showContextThreshold" class="accordion-content">
            <div class="context-threshold-options">
              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.contextManagement.threshold.label') }}</label>
                <input type="text" :value="contextThreshold"
                  :placeholder="t('components.settings.channelSettings.form.contextManagement.threshold.placeholder')"
                  :disabled="!contextThresholdEnabled" :class="{ disabled: !contextThresholdEnabled }"
                  @input="(e: any) => updateContextThreshold(e.target.value)" />
                <span class="option-hint">{{
                  t('components.settings.channelSettings.form.contextManagement.threshold.hint')
                }}</span>
              </div>

              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.contextManagement.extraCut.label') }}</label>
                <input type="text" :value="contextTrimExtraCut"
                  :placeholder="t('components.settings.channelSettings.form.contextManagement.extraCut.placeholder')"
                  :disabled="!contextThresholdEnabled" :class="{ disabled: !contextThresholdEnabled }"
                  @input="(e: any) => updateContextTrimExtraCut(e.target.value)" />
                <span class="option-hint">{{
                  t('components.settings.channelSettings.form.contextManagement.extraCut.hint')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 工具配置 -->
        <div class="accordion-item" :class="{ expanded: showToolOptions }">
          <button class="accordion-header" @click="showToolOptions = !showToolOptions">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-tools item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.toolOptions.title') }}</span>
            <span class="item-summary">{{ toolOptionsSummary }}</span>
          </button>
          <div v-if="showToolOptions" class="accordion-content">
            <ToolOptionsSettings :tool-options="toolOptions" @update:config="updateToolOptions" />
          </div>
        </div>

        <!-- Token 计数方式 -->
        <div class="accordion-item" :class="{ expanded: showTokenCountMethod }">
          <button class="accordion-header" @click="showTokenCountMethod = !showTokenCountMethod">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-symbol-number item-icon"></i>
            <span class="item-title">{{ t('components.channels.tokenCountMethod.title') }}</span>
            <span class="item-summary">{{ tokenCountMethodSummary }}</span>
          </button>
          <div v-if="showTokenCountMethod" class="accordion-content">
            <TokenCountMethodSettings :token-count-method="currentConfig.tokenCountMethod || 'channel_default'"
              :token-count-api-config="currentConfig.tokenCountApiConfig || {}" :channel-type="currentConfig.type"
              @update:token-count-method="(v: string) => updateConfigField('tokenCountMethod', v)"
              @update:token-count-api-config="(v: any) => updateConfigField('tokenCountApiConfig', v)" />
          </div>
        </div>

        <!-- 分割线 -->
        <div class="accordion-divider"></div>

        <!-- 自定义 Body -->
        <div class="accordion-item" :class="{ disabled: !customBodyEnabled, expanded: showCustomBody }">
          <button class="accordion-header" @click="showCustomBody = !showCustomBody">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-code item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.customBody.title') }}</span>
            <span class="item-summary">{{ customBodySummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="customBodyEnabled"
                @change="(e: any) => updateCustomBodyEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showCustomBody" class="accordion-content">
            <CustomBodySettings :custom-body="customBody" :enabled="customBodyEnabled"
              @update:enabled="updateCustomBodyEnabled" @update:config="updateCustomBodyConfig" />
          </div>
        </div>

        <!-- 自定义标头 -->
        <div class="accordion-item" :class="{ disabled: !customHeadersEnabled, expanded: showCustomHeaders }">
          <button class="accordion-header" @click="showCustomHeaders = !showCustomHeaders">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-list-unordered item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.customHeaders.title') }}</span>
            <span class="item-summary">{{ customHeadersSummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="customHeadersEnabled"
                @change="(e: any) => updateCustomHeadersEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showCustomHeaders" class="accordion-content">
            <CustomHeadersSettings :headers="customHeaders" :enabled="customHeadersEnabled"
              @update:enabled="updateCustomHeadersEnabled" @update:headers="updateCustomHeaders" />
          </div>
        </div>

        <!-- 自动重试 -->
        <div class="accordion-item" :class="{ disabled: !retryEnabled, expanded: showRetryOptions }">
          <button class="accordion-header" @click="showRetryOptions = !showRetryOptions">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-sync item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.autoRetry.title') }}</span>
            <span class="item-summary">{{ autoRetrySummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="retryEnabled"
                @change="(e: any) => updateRetryEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showRetryOptions" class="accordion-content">
            <div class="retry-options">
              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.autoRetry.retryCount.label') }}</label>
                <input type="number" :value="retryCount" min="1" max="10" :disabled="!retryEnabled"
                  :class="{ disabled: !retryEnabled }" @input="(e: any) => updateRetryCount(Number(e.target.value))" />
                <span class="option-hint">{{ t('components.settings.channelSettings.form.autoRetry.retryCount.hint')
                }}</span>
              </div>

              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.autoRetry.retryInterval.label') }}</label>
                <input type="number" :value="retryInterval" min="1000" max="60000" step="1000" :disabled="!retryEnabled"
                  :class="{ disabled: !retryEnabled }"
                  @input="(e: any) => updateRetryInterval(Number(e.target.value))" />
                <span class="option-hint">{{ t('components.settings.channelSettings.form.autoRetry.retryInterval.hint')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 高级选项 -->
        <div class="accordion-item" :class="{ expanded: showAdvancedOptions }">
          <button class="accordion-header" @click="showAdvancedOptions = !showAdvancedOptions">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-beaker item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.advancedOptions.title') }}</span>
            <span class="item-summary">{{ advancedOptionsSummary }}</span>
          </button>
          <div v-if="showAdvancedOptions" class="accordion-content">
            <!-- Gemini 选项 -->
            <GeminiOptions v-if="currentConfig.type === 'gemini'" :config="currentConfig" @update:option="updateOption"
              @update:option-enabled="updateOptionEnabled" @update:field="updateConfigField" />

            <!-- OpenAI 选项 -->
            <OpenAIOptions v-if="currentConfig.type === 'openai'" :config="currentConfig" @update:option="updateOption"
              @update:option-enabled="updateOptionEnabled" @update:field="updateConfigField" />

            <!-- OpenAI Responses 选项 -->
            <OpenAIResponsesOptions v-if="currentConfig.type === 'openai-responses'" :config="currentConfig"
              @update:option="updateOption" @update:option-enabled="updateOptionEnabled"
              @update:field="updateConfigField" />

            <!-- Anthropic 选项 -->
            <AnthropicOptions v-if="currentConfig.type === 'anthropic'" :config="currentConfig"
              @update:option="updateOption" @update:option-enabled="updateOptionEnabled"
              @update:field="updateConfigField" />
          </div>
        </div>
      </div>

      <!-- ==================== 5. 底部：启用此配置 ==================== -->
      <div class="footer-section">
        <label class="custom-checkbox">
          <input type="checkbox" :checked="currentConfig.enabled"
            @change="(e: any) => updateConfigField('enabled', e.target.checked)" />
          <span class="checkmark"></span>
          <span class="checkbox-text">{{ t('components.settings.channelSettings.form.enabled.label') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ChannelSettings.part1.css"></style>
<style scoped src="./ChannelSettings.part2.css"></style>
