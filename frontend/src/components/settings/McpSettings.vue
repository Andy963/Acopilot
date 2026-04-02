<script setup lang="ts">
import { ConfirmDialog, CustomCheckbox } from '../common'
import { useMcpSettings } from './useMcpSettings'

const {
  t,
  servers,
  isLoading,
  viewMode,
  editingServer,
  isCreating,
  formData,
  idValidation,
  isSaving,
  saveError,
  showDeleteConfirm,
  deleteTargetServer,
  hasServers,
  statusColor,
  statusText,
  loadServers,
  startCreate,
  startEdit,
  cancelEdit,
  onIdInput,
  saveServer,
  showDeleteDialog,
  confirmDeleteServer,
  getDisplayStatus,
  toggleConnection,
  toggleEnabled,
  openConfigFile,
} = useMcpSettings()
</script>

<template>
  <div class="mcp-settings">
    <!-- 列表视图 -->
    <div v-if="viewMode === 'list'" class="mcp-list-view">
      <!-- 工具栏 -->
      <div class="mcp-toolbar">
        <button class="toolbar-btn primary" @click="startCreate">
          <i class="codicon codicon-add"></i>
          <span>{{ t('components.settings.mcpSettings.toolbar.addServer') }}</span>
        </button>
        <button class="toolbar-btn" @click="openConfigFile">
          <i class="codicon codicon-json"></i>
          <span>{{ t('components.settings.mcpSettings.toolbar.editJson') }}</span>
        </button>
        <button class="toolbar-btn" @click="loadServers()" :disabled="isLoading" :title="t('components.settings.mcpSettings.toolbar.refresh')">
          <i class="codicon" :class="isLoading ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'"></i>
        </button>
      </div>
      
      <!-- 服务器列表 -->
      <div v-if="isLoading && !hasServers" class="loading-state">
        <i class="codicon codicon-loading codicon-modifier-spin"></i>
        <span>{{ t('components.settings.mcpSettings.loading') }}</span>
      </div>
      
      <div v-else-if="!hasServers" class="empty-state">
        <div class="empty-icon">
          <i class="codicon codicon-plug"></i>
        </div>
        <h4>{{ t('components.settings.mcpSettings.empty.title') }}</h4>
        <p>{{ t('components.settings.mcpSettings.empty.description') }}</p>
      </div>
      
      <div v-else class="server-list">
        <div
          v-for="server in servers"
          :key="server.config.id"
          class="server-card"
          :class="{ disabled: !server.config.enabled }"
        >
          <div class="server-checkbox">
            <CustomCheckbox
              :model-value="server.config.enabled"
              @update:model-value="toggleEnabled(server)"
            />
          </div>
          <div class="server-content">
            <div class="server-header">
              <div class="server-info">
                <div class="server-name">{{ server.config.name }}</div>
                <div class="server-type">
                  <span class="transport-badge">{{ server.config.transport.type.toUpperCase() }}</span>
                  <span class="status-dot" :style="{ backgroundColor: statusColor(getDisplayStatus(server)) }"></span>
                  <span class="status-text">{{ statusText(getDisplayStatus(server)) }}</span>
                </div>
              </div>
              <div class="server-actions">
                <button
                  class="action-btn"
                  :title="getDisplayStatus(server) === 'connected' ? t('components.settings.mcpSettings.serverCard.disconnect') : getDisplayStatus(server) === 'connecting' ? t('components.settings.mcpSettings.serverCard.connecting') : t('components.settings.mcpSettings.serverCard.connect')"
                  @click="toggleConnection(server)"
                  :disabled="!server.config.enabled || getDisplayStatus(server) === 'connecting'"
                >
                  <i class="codicon" :class="getDisplayStatus(server) === 'connected' ? 'codicon-debug-disconnect' : getDisplayStatus(server) === 'connecting' ? 'codicon-loading codicon-modifier-spin' : 'codicon-plug'"></i>
                </button>
                <button class="action-btn" :title="t('components.settings.mcpSettings.serverCard.edit')" @click="startEdit(server)">
                  <i class="codicon codicon-edit"></i>
                </button>
                <button class="action-btn danger" :title="t('components.settings.mcpSettings.serverCard.delete')" @click="showDeleteDialog(server)">
                  <i class="codicon codicon-trash"></i>
                </button>
              </div>
            </div>
            
            <div v-if="server.config.description" class="server-description">
              {{ server.config.description }}
            </div>
            
            <div class="server-details">
              <template v-if="server.config.transport.type === 'stdio'">
                <code class="transport-detail">{{ server.config.transport.command }}</code>
              </template>
              <template v-else>
                <code class="transport-detail">{{ server.config.transport.url }}</code>
              </template>
            </div>
            
            <!-- 能力显示 -->
            <div v-if="server.capabilities && server.status === 'connected'" class="server-capabilities">
              <span v-if="server.capabilities.tools?.length" class="capability-badge">
                <i class="codicon codicon-tools"></i>
                {{ server.capabilities.tools.length }} {{ t('components.settings.mcpSettings.serverCard.tools') }}
              </span>
              <span v-if="server.capabilities.resources?.length" class="capability-badge">
                <i class="codicon codicon-file"></i>
                {{ server.capabilities.resources.length }} {{ t('components.settings.mcpSettings.serverCard.resources') }}
              </span>
              <span v-if="server.capabilities.prompts?.length" class="capability-badge">
                <i class="codicon codicon-comment"></i>
                {{ server.capabilities.prompts.length }} {{ t('components.settings.mcpSettings.serverCard.prompts') }}
              </span>
            </div>
            
            <div v-if="server.lastError" class="server-error">
              <i class="codicon codicon-error"></i>
              {{ server.lastError }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 编辑视图 -->
    <div v-else-if="viewMode === 'edit'" class="mcp-edit-view">
      <div class="edit-header">
        <h4>{{ isCreating ? t('components.settings.mcpSettings.form.addTitle') : t('components.settings.mcpSettings.form.editTitle') }}</h4>
        <button class="close-btn" @click="cancelEdit">
          <i class="codicon codicon-close"></i>
        </button>
      </div>
      
      <div class="edit-form">
        <!-- 基本信息 -->
        <div class="form-section">
          <!-- 自定义 ID（仅创建时显示） -->
          <div v-if="isCreating" class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.serverId') }}</label>
            <div class="id-input-wrapper">
              <input
                type="text"
                v-model="formData.customId"
                :placeholder="t('components.settings.mcpSettings.form.serverIdPlaceholder')"
                class="form-input"
                :class="{
                  'input-error': idValidation.valid === false,
                  'input-success': idValidation.valid === true
                }"
                @input="onIdInput"
              />
              <span v-if="idValidation.checking" class="id-status checking">
                <i class="codicon codicon-loading codicon-modifier-spin"></i>
              </span>
              <span v-else-if="idValidation.valid === true" class="id-status valid">
                <i class="codicon codicon-check"></i>
              </span>
              <span v-else-if="idValidation.valid === false" class="id-status invalid">
                <i class="codicon codicon-error"></i>
              </span>
            </div>
            <div v-if="idValidation.error" class="id-error">{{ idValidation.error }}</div>
            <div class="form-hint">{{ t('components.settings.mcpSettings.form.serverIdHint') }}</div>
          </div>
          
          <!-- 显示当前 ID（编辑时） -->
          <div v-else class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.serverId') }}</label>
            <div class="id-display">{{ editingServer?.id }}</div>
          </div>
          
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.serverName') }} <span class="required">{{ t('components.settings.mcpSettings.form.required') }}</span></label>
            <input
              type="text"
              v-model="formData.name"
              :placeholder="t('components.settings.mcpSettings.form.serverNamePlaceholder')"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.description') }}</label>
            <input
              type="text"
              v-model="formData.description"
              :placeholder="t('components.settings.mcpSettings.form.descriptionPlaceholder')"
              class="form-input"
            />
          </div>
        </div>
        
        <!-- 传输类型 -->
        <div class="form-section">
          <label class="section-label">{{ t('components.settings.mcpSettings.form.transportType') }}</label>
          <div class="transport-tabs">
            <button
              :class="['transport-tab', { active: formData.transportType === 'stdio' }]"
              @click="formData.transportType = 'stdio'"
            >
              <i class="codicon codicon-terminal"></i>
              Stdio
            </button>
            <button
              :class="['transport-tab', { active: formData.transportType === 'sse' }]"
              @click="formData.transportType = 'sse'"
            >
              <i class="codicon codicon-radio-tower"></i>
              SSE
            </button>
            <button
              :class="['transport-tab', { active: formData.transportType === 'streamable-http' }]"
              @click="formData.transportType = 'streamable-http'"
            >
              <i class="codicon codicon-globe"></i>
              Streamable HTTP
            </button>
          </div>
        </div>
        
        <!-- Stdio 配置 -->
        <div v-if="formData.transportType === 'stdio'" class="form-section">
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.command') }} <span class="required">{{ t('components.settings.mcpSettings.form.required') }}</span></label>
            <input
              type="text"
              v-model="formData.command"
              :placeholder="t('components.settings.mcpSettings.form.commandPlaceholder')"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.args') }}</label>
            <input
              type="text"
              v-model="formData.args"
              :placeholder="t('components.settings.mcpSettings.form.argsPlaceholder')"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.env') }}</label>
            <textarea
              v-model="formData.env"
              :placeholder="t('components.settings.mcpSettings.form.envPlaceholder')"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>
        </div>
        
        <!-- SSE/WebSocket 配置 -->
        <div v-else class="form-section">
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.url') }} <span class="required">{{ t('components.settings.mcpSettings.form.required') }}</span></label>
            <input
              type="text"
              v-model="formData.url"
              :placeholder="formData.transportType === 'sse' ? t('components.settings.mcpSettings.form.urlPlaceholderSse') : t('components.settings.mcpSettings.form.urlPlaceholderHttp')"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.headers') }}</label>
            <textarea
              v-model="formData.headers"
              :placeholder="t('components.settings.mcpSettings.form.headersPlaceholder')"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>
        </div>
        
        <!-- 选项 -->
        <div class="form-section">
          <label class="section-label">{{ t('components.settings.mcpSettings.form.options') }}</label>
          
          <div class="form-row">
            <CustomCheckbox
              v-model="formData.enabled"
              :label="t('components.settings.mcpSettings.form.enabled')"
            />
            
            <CustomCheckbox
              v-model="formData.autoConnect"
              :label="t('components.settings.mcpSettings.form.autoConnect')"
            />
          </div>
          
          <div class="form-row">
            <CustomCheckbox
              v-model="formData.cleanSchema"
              :label="t('components.settings.mcpSettings.form.cleanSchema')"
            />
          </div>
          <div class="form-hint" style="margin-top: -8px; margin-bottom: 12px;">
            {{ t('components.settings.mcpSettings.form.cleanSchemaHint') }}
          </div>
          
          <div class="form-group">
            <label>{{ t('components.settings.mcpSettings.form.timeout') }}</label>
            <input
              type="number"
              v-model.number="formData.timeout"
              class="form-input"
              min="1000"
              max="300000"
            />
          </div>
        </div>
        
        <!-- 错误信息 -->
        <div v-if="saveError" class="form-error">
          <i class="codicon codicon-error"></i>
          {{ saveError }}
        </div>
        
        <!-- 操作按钮 -->
        <div class="form-actions">
          <button class="action-button secondary" @click="cancelEdit">
            {{ t('components.settings.mcpSettings.form.cancel') }}
          </button>
          <button
            class="action-button primary"
            @click="saveServer"
            :disabled="isSaving"
          >
            <i v-if="isSaving" class="codicon codicon-loading codicon-modifier-spin"></i>
            <span v-else>{{ isCreating ? t('components.settings.mcpSettings.form.create') : t('components.settings.mcpSettings.form.save') }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model="showDeleteConfirm"
      :title="t('components.settings.mcpSettings.delete.title')"
      :message="t('components.settings.mcpSettings.delete.message', { name: deleteTargetServer?.config.name || '' })"
      :confirm-text="t('components.settings.mcpSettings.delete.confirm')"
      :cancel-text="t('components.settings.mcpSettings.delete.cancel')"
      :is-danger="true"
      @confirm="confirmDeleteServer"
    />
  </div>
</template>

<style scoped src="./McpSettings.part1.css"></style>
<style scoped src="./McpSettings.part2.css"></style>
