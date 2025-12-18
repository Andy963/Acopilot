# LimCode 前端组件架构设计

## 1. 整体架构（单页应用）

```
┌─────────────────────────────────────────────────────┐
│                    App.vue                          │
│  ┌───────────────────────────────────────────────┐  │
│  │              Header (顶部栏)                  │  │
│  │  [Logo] [新对话] [历史] [设置]               │  │
│  ├───────────────────────────────────────────────┤  │
│  │                                               │  │
│  │           MessageList (消息列表)              │  │
│  │                                               │  │
│  ├───────────────────────────────────────────────┤  │
│  │           InputArea (输入区域)                │  │
│  │  [附件列表]                                   │  │
│  │  [工具栏] [输入框] [发送]                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  弹出层（按需显示）：                               │
│  - SettingsModal (设置对话框)                      │
│  - HistoryDrawer (历史记录侧边栏)                  │
│  - AttachmentPreview (附件预览)                   │
└─────────────────────────────────────────────────────┘
```

## 2. 组件分类

### 2.1 核心布局组件

#### App.vue
- **职责**：应用根组件，管理全局状态和路由
- **布局**：
  ```
  ┌──────────────────┐
  │   ChatHeader     │  固定顶部
  ├──────────────────┤
  │   MessageList    │  滚动区域
  ├──────────────────┤
  │   InputArea      │  固定底部
  └──────────────────┘
  ```
- **状态**：
  - 当前视图（主聊天/设置/历史）
  - 全局加载状态
  - 错误状态
  - 模态框显示状态

#### ChatHeader.vue
- **职责**：顶部导航栏
- **按钮**：
  - Logo/标题
  - 新对话按钮
  - 历史记录按钮
  - 设置按钮
  - 状态指示器（连接状态、模型名称等）
- **交互**：
  - 点击历史记录 → 打开 HistoryDrawer
  - 点击设置 → 打开 SettingsModal
  - 点击新对话 → 清空当前对话

---

### 2.2 消息显示组件

#### MessageList.vue
- **职责**：消息列表容器
- **功能**：
  - 自动滚动到底部
  - 虚拟滚动（优化性能）
  - 加载更多历史记录
- **子组件**：MessageItem

#### MessageItem.vue
- **职责**：单条消息渲染
- **props**：
  ```typescript
  {
    message: Message,
    isUser: boolean,
    showActions: boolean
  }
  ```
- **子组件**：
  - UserMessage / AssistantMessage
  - MessageActions
  - AttachmentList

#### UserMessage.vue
- **职责**：用户消息样式
- **特点**：
  - 右对齐
  - 用户头像/标识
  - 浅色背景

#### AssistantMessage.vue
- **职责**：AI 消息样式
- **特点**：
  - 左对齐
  - AI 图标
  - Markdown 渲染
  - 代码高亮
  - 流式显示动画

#### MessageContent.vue
- **职责**：消息内容渲染
- **功能**：
  - Markdown 渲染
  - 代码高亮
  - 链接处理
  - 图片展示

#### MessageActions.vue
- **职责**：消息操作按钮
- **功能**：
  - 复制消息
  - 重新生成
  - 编辑消息
  - 删除消息
  - 点赞/点踩

---

### 2.3 输入组件

#### InputArea.vue
- **职责**：输入区域容器
- **布局**：
  ```
  ┌────────────────────────────┐
  │   AttachmentList (可选)    │
  ├────────────────────────────┤
  │      InputToolbar          │
  ├────────────────────────────┤
  │       InputBox             │
  └────────────────────────────┘
  ```

#### InputBox.vue
- **职责**：文本输入框
- **功能**：
  - 多行文本输入
  - 自动高度调整
  - 快捷键支持
    - Enter：发送
    - Shift+Enter：换行
    - Ctrl+K：清空
  - 占位符提示
  - 字数统计

#### InputToolbar.vue
- **职责**：输入工具栏
- **按钮**：
  - AttachButton：上传附件
  - SendButton：发送消息
  - ClearButton：清空输入
  - SettingsButton：快速设置

---

### 2.4 附件组件

#### AttachmentList.vue
- **职责**：附件列表容器
- **布局**：横向滚动列表
- **子组件**：AttachmentItem

#### AttachmentItem.vue
- **职责**：单个附件项
- **显示**：
  - 附件图标/缩略图
  - 文件名
  - 文件大小
  - 删除按钮
- **交互**：
  - 点击预览
  - 拖拽排序

#### AttachmentPreview.vue
- **职责**：附件预览对话框
- **支持类型**：
  - 图片：ImagePreview
  - 视频：VideoPreview
  - 音频：AudioPreview
  - 文档：DocumentPreview

#### ImagePreview.vue
- **功能**：
  - 图片展示
  - 缩放、旋转
  - 下载

#### VideoPreview.vue
- **功能**：
  - 视频播放器
  - 进度控制
  - 音量控制

#### AudioPreview.vue
- **功能**：
  - 音频波形图
  - 播放控制

#### DocumentPreview.vue
- **功能**：
  - PDF 预览
  - Word/Excel 预览
  - 下载

---

### 2.5 设置组件

#### SettingsPanel.vue
- **职责**：设置面板容器
- **分区**：
  - 模型设置
  - API 配置
  - 界面设置
  - 高级选项

#### ModelSelector.vue
- **职责**：模型选择器
- **功能**：
  - 模型列表
  - 模型信息展示
  - 快速切换

#### ConfigForm.vue
- **职责**：配置表单
- **字段**：
  - API Key
  - Base URL
  - Temperature
  - Max Tokens
  - 其他参数

---

### 2.6 通用组件

#### EmptyState.vue
- **职责**：空状态提示
- **场景**：
  - 无消息时
  - 无附件时
  - 无历史记录时

#### LoadingSpinner.vue
- **职责**：加载动画
- **样式**：VSCode 风格的加载动画

#### ErrorMessage.vue
- **职责**：错误提示
- **类型**：
  - 网络错误
  - API 错误
  - 验证错误

#### IconButton.vue
- **职责**：图标按钮
- **props**：
  ```typescript
  {
    icon: string,
    tooltip: string,
    disabled: boolean,
    loading: boolean
  }
  ```

#### Tooltip.vue
- **职责**：提示框
- **位置**：上、下、左、右

---

## 3. 状态管理 (Composables)

### useChat.ts
```typescript
export function useChat() {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  const sendMessage = async (content: string) => { }
  const clearMessages = () => { }
  const retryLastMessage = () => { }
  
  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage
  }
}
```

### useMessages.ts
```typescript
export function useMessages() {
  const addMessage = (message: Message) => { }
  const updateMessage = (id: string, content: Partial<Message>) => { }
  const deleteMessage = (id: string) => { }
  const getMessageById = (id: string) => { }
  
  return {
    addMessage,
    updateMessage,
    deleteMessage,
    getMessageById
  }
}
```

### useAttachments.ts
```typescript
export function useAttachments() {
  const attachments = ref<Attachment[]>([])
  
  const addAttachment = async (file: File) => { }
  const removeAttachment = (id: string) => { }
  const clearAttachments = () => { }
  const previewAttachment = (id: string) => { }
  
  return {
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    previewAttachment
  }
}
```

### useVSCode.ts
```typescript
export function useVSCode() {
  const vscode = acquireVsCodeApi()
  
  const sendToExtension = (type: string, data: any) => { }
  const onMessageFromExtension = (handler: (message: any) => void) => { }
  
  return {
    sendToExtension,
    onMessageFromExtension
  }
}
```

### useMarkdown.ts
```typescript
export function useMarkdown() {
  const renderMarkdown = (content: string): string => { }
  const highlightCode = (code: string, language: string): string => { }
  
  return {
    renderMarkdown,
    highlightCode
  }
}
```

---

## 4. 数据类型定义

```typescript
// types/index.ts

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  attachments?: Attachment[]
  metadata?: Record<string, any>
}

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'video' | 'audio' | 'document'
  size: number
  url: string
  mimeType: string
}

export interface ChatConfig {
  model: string
  apiKey: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
}

export interface VSCodeMessage {
  type: string
  requestId?: string
  data: any
}
```

---

## 5. 样式设计原则

### 5.1 主题适配
- 使用 CSS 变量适配 VSCode 主题
- 支持浅色/深色主题自动切换

### 5.2 响应式设计
- 适配不同面板宽度
- 移动端友好（虽然主要在 VSCode 中使用）

### 5.3 动画效果
- 消息出现动画
- 加载动画
- 按钮交互反馈

---

## 6. 性能优化

### 6.1 虚拟滚动
- 长列表使用虚拟滚动
- 只渲染可见区域的消息

### 6.2 懒加载
- 图片懒加载
- 组件按需加载

### 6.3 防抖节流
- 输入防抖
- 滚动节流

---

## 7. 开发顺序建议

1. **基础组件**（第1周）
   - EmptyState、LoadingSpinner、IconButton
   - 基础样式系统

2. **消息组件**（第2周）
   - MessageList、MessageItem
   - UserMessage、AssistantMessage
   - MessageContent（Markdown 渲染）

3. **输入组件**（第3周）
   - InputArea、InputBox
   - InputToolbar、SendButton

4. **附件功能**（第4周）
   - AttachmentList、AttachmentItem
   - 各类预览组件

5. **设置面板**（第5周）
   - SettingsPanel
   - ModelSelector、ConfigForm

6. **状态管理**（第6周）
   - 实现所有 composables
   - VSCode API 集成

7. **优化打磨**（第7周）
   - 性能优化
   - 动画效果
   - 测试和修复

---

## 8. 技术栈

- **框架**：Vue 3 (Composition API)
- **构建工具**：Vite
- **类型检查**：TypeScript
- **Markdown**：marked / markdown-it
- **代码高亮**：highlight.js / prism.js
- **图标**：VSCode Codicons
- **样式**：原生 CSS + CSS 变量

---

## 9. 目录结构

```
frontend/src/
├── App.vue
├── main.ts
├── components/
│   ├── layout/
│   │   └── ChatLayout.vue
│   ├── message/
│   │   ├── MessageList.vue
│   │   ├── MessageItem.vue
│   │   ├── UserMessage.vue
│   │   ├── AssistantMessage.vue
│   │   ├── MessageActions.vue
│   │   └── MessageContent.vue
│   ├── input/
│   │   ├── InputArea.vue
│   │   ├── InputBox.vue
│   │   ├── InputToolbar.vue
│   │   ├── AttachButton.vue
│   │   ├── SendButton.vue
│   │   └── ClearButton.vue
│   ├── attachment/
│   │   ├── AttachmentList.vue
│   │   ├── AttachmentItem.vue
│   │   ├── AttachmentPreview.vue
│   │   ├── ImagePreview.vue
│   │   ├── VideoPreview.vue
│   │   ├── AudioPreview.vue
│   │   └── DocumentPreview.vue
│   ├── settings/
│   │   ├── SettingsPanel.vue
│   │   ├── ModelSelector.vue
│   │   └── ConfigForm.vue
│   └── common/
│       ├── EmptyState.vue
│       ├── LoadingSpinner.vue
│       ├── ErrorMessage.vue
│       ├── IconButton.vue
│       └── Tooltip.vue
├── composables/
│   ├── useChat.ts
│   ├── useMessages.ts
│   ├── useAttachments.ts
│   ├── useVSCode.ts
│   └── useMarkdown.ts
├── utils/
│   ├── vscode.ts
│   ├── file.ts
│   ├── markdown.ts
│   └── format.ts
├── types/
│   └── index.ts
└── styles/
    ├── main.css
    ├── variables.css
    ├── message.css
    └── input.css