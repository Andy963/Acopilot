
# Acopilot - 设置管理模块

全局设置和状态管理系统。

## 📋 目录

- [概述](#概述)
- [核心组件](#核心组件)
- [功能特性](#功能特性)
- [使用指南](#使用指南)
- [API 文档](#api-文档)
- [最佳实践](#最佳实践)

## 概述

设置管理模块提供了一个全局的设置存储和状态管理系统，支持：

- ✅ 全局设置的持久化存储
- ✅ 工具启用/禁用的动态管理
- ✅ 活动渠道的快速切换
- ✅ 设置变更的实时通知
- ✅ UI 偏好设置管理

## 核心组件

### 1. SettingsManager

全局设置管理器，负责设置的读写和通知。

```typescript
import { SettingsManager, FileSettingsStorage } from './modules/settings';

// 创建设置管理器
const storage = new FileSettingsStorage('/path/to/storage');
const settingsManager = new SettingsManager(storage);

// 初始化（从存储加载）
await settingsManager.initialize();
```

在 VS Code 扩展中，推荐使用 `VSCodeSettingsStorage` 以便配合 VS Code Settings Sync 实现跨设备同步：

```typescript
import * as path from 'path';
import type * as vscode from 'vscode';
import { SettingsManager, VSCodeSettingsStorage } from './modules/settings';

function createSettingsManager(context: vscode.ExtensionContext): SettingsManager {
    const legacySettingsFilePath = path.join(context.globalStorageUri.fsPath, 'settings', 'settings.json');
    const storage = new VSCodeSettingsStorage({ legacySettingsFilePath });
    return new SettingsManager(storage);
}
```

### 2. SettingsStorage

存储接口，支持不同的存储实现：

- **FileSettingsStorage**: 基于文件系统的存储
- **MemorySettingsStorage**: 基于内存的存储（测试用）
- **VSCodeSettingsStorage**: 基于 VS Code Settings 的存储（支持 Settings Sync）

### 3. GlobalSettings

全局设置的类型定义，包含：

```typescript
interface GlobalSettings {
    // 当前激活的渠道 ID
    activeChannelId?: string;
    
    // 工具启用状态
    toolsEnabled: {
        [toolName: string]: boolean;
    };
    
    // 默认工具模式
    defaultToolMode?: 'function_call' | 'xml';
    
    // UI 偏好设置
    ui?: {
        theme?: 'light' | 'dark' | 'auto';
        language?: string;
    };
    
    // 最后更新时间戳
    lastUpdated: number;
}
```

## 功能特性

### 1. 渠道管理

```typescript
// 获取当前激活的渠道
const activeId = settingsManager.getActiveChannelId();

// 切换激活渠道
await settingsManager.setActiveChannelId('gemini-1');
```

### 2. 工具管理

```typescript
// 检查工具是否启用
const enabled = settingsManager.isToolEnabled('read_file');

// 启用/禁用单个工具
await settingsManager.setToolEnabled('read_file', false);

// 批量设置工具状态
await settingsManager.setToolsEnabled({
    'read_file': true,
    'write_file': true,
    'execute_command': false
});

// 获取启用的工具列表
const allTools = ['read_file', 'write_file', 'execute_command'];
const enabledTools = settingsManager.getEnabledTools(allTools);
// 返回: ['read_file', 'write_file']
```

### 3. 工具模式管理

```typescript
// 获取默认工具模式
const mode = settingsManager.getDefaultToolMode();

// 设置默认工具模式
await settingsManager.setDefaultToolMode('xml');
```

### 4. UI 设置管理

```typescript
// 更新 UI 设置
await settingsManager.updateUISettings({
    theme: 'dark',
    language: 'en'
});

// 获取 UI 设置
const uiSettings = settingsManager.getUISettings();
```

### 5. 设置变更监听

```typescript
// 添加监听器
settingsManager.addChangeListener((event) => {
    console.log('Setting changed:', event);
    
    if (event.type === 'tools') {
        console.log('Tool setting changed:', event.path);
        console.log('Old value:', event.oldValue);
        console.log('New value:', event.newValue);
    }
});

// 移除监听器
settingsManager.removeChangeListener(listener);
```

## 使用指南

### 基本流程

```typescript
// 1. 创建存储实现
const storage = new FileSettingsStorage(
    context.globalStorageUri.fsPath,  // VSCode 全局存储目录
    'settings.json'
);

// 2. 创建设置管理器
const settingsManager = new SettingsManager(storage);

// 3. 初始化（加载存储的设置）
await settingsManager.initialize();

// 4. 使用设置
const activeChannel = settingsManager.getActiveChannelId();
const isEnabled = settingsManager.isToolEnabled('read_file');
```

### 与其他模块集成

#### 集成到 ChannelManager

```typescript
// 创建 ChannelManager 时传入 SettingsManager
const channelManager = new ChannelManager(
    configManager,
    toolRegistry,
    settingsManager  // 传入设置管理器
);

// ChannelManager 会自动使用设置过滤工具
```

#### 集成到 ToolRegistry

```typescript
// 获取过滤后的工具声明
const allTools = toolRegistry.getToolNames();
const enabledTools = settingsManager.getEnabledTools(allTools);
const filteredDeclarations = toolRegistry.getFilteredDeclarations(enabledTools);

// 或使用过滤函数
const declarations = toolRegistry.getDeclarationsBy(
    toolName => settingsManager.isToolEnabled(toolName)
);
```

### 实时更新示例

```typescript
// 监听工具设置变更，实时更新工具系统
settingsManager.addChangeListener(async (event) => {
    if (event.type === 'tools') {
        // 工具启用状态变更
        console.log(`工具 ${event.path} 状态变更为 ${event.newValue}`);
        
        // 可以触发其他操作，如：
        // - 更新 UI 显示
        // - 重新加载工具配置
        // - 通知相关模块
    }
    
    if (event.type === 'channel') {
        // 渠道切换
        console.log(`切换到渠道: ${event.newValue}`);
        
        // 可以触发：
        // - 更新当前对话使用的配置
        // - 刷新 UI 状态
    }
});
```

## API 文档

### SettingsManager

#### 初始化
