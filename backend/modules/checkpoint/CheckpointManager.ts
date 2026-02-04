/**
 * Acopilot - 检查点管理器
 *
 * 负责工作区备份和恢复：
 * - 在工具执行前后创建工作区快照
 * - 存储检查点记录到对话元数据
 * - 支持恢复到指定检查点
 *
 * 增量备份策略：
 * - 第一个检查点：完整备份所有文件
 * - 后续检查点：始终使用增量备份，只复制有变化的文件（added/modified）
 * - 无变化时：创建空的增量备份，不复制任何文件
 * - 每个检查点都记录完整的文件哈希映射（fileHashes），用于增量比较和恢复
 */

import { t } from '../../i18n';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { SettingsManager } from '../settings/SettingsManager';
import type { ConversationManager } from '../conversation/ConversationManager';
import type { CheckpointRecord, FileChange } from './checkpointTypes';
import { createCheckpoint as createCheckpointImpl } from './checkpointManager/createCheckpoint';
import { restoreCheckpoint as restoreCheckpointImpl } from './checkpointManager/restoreCheckpoint';
import { getAllConversationsWithCheckpoints as getAllConversationsWithCheckpointsImpl, type ConversationCheckpointStats } from './checkpointManager/conversationStats';
export type { CheckpointRecord, FileChange } from './checkpointTypes';

/**
 * 检查点管理器
 */
export class CheckpointManager {
    private checkpointsDir: string;
    
    constructor(
        private settingsManager: SettingsManager,
        private conversationManager: ConversationManager,
        private context: vscode.ExtensionContext,
        customDataPath?: string
    ) {
        // 如果提供了自定义路径，使用自定义路径下的 checkpoints 目录
        // 否则使用扩展存储目录
        const basePath = customDataPath || context.globalStorageUri.fsPath;
        this.checkpointsDir = path.join(basePath, 'checkpoints');
    }
    
    /**
     * 初始化
     */
    async initialize(): Promise<void> {
        // 确保检查点目录存在
        await fs.mkdir(this.checkpointsDir, { recursive: true });
    }
    
    /**
     * 生成检查点 ID
     */
    private generateCheckpointId(): string {
        return `cp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    
    /**
     * 获取工作区根目录
     */
    private getWorkspaceRoot(): vscode.Uri | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri;
    }
    
    /**
     * 创建检查点
     *
     * @param conversationId 对话 ID
     * @param messageIndex 消息索引
     * @param toolName 工具名称或消息类型（user_message, model_message, tool_batch）
     * @param phase 阶段（执行前/执行后）
     * @returns 检查点记录，如果创建失败返回 null
     */
    async createCheckpoint(
        conversationId: string,
        messageIndex: number,
        toolName: string,
        phase: 'before' | 'after'
    ): Promise<CheckpointRecord | null> {
        return createCheckpointImpl({
            settingsManager: this.settingsManager,
            conversationManager: this.conversationManager,
            checkpointsDir: this.checkpointsDir,
            conversationId,
            messageIndex,
            toolName,
            phase,
            generateCheckpointId: () => this.generateCheckpointId(),
            getWorkspaceRoot: () => this.getWorkspaceRoot(),
            getCheckpoints: (id) => this.getCheckpoints(id),
            computeChanges: (oldHashes, newHashes) => this.computeChanges(oldHashes, newHashes),
            saveCheckpointToConversation: (id, checkpoint) => this.saveCheckpointToConversation(id, checkpoint),
            cleanupOldCheckpoints: (id) => this.cleanupOldCheckpoints(id)
        });
    }

    /**
     * 保存检查点到对话元数据
     */
    private async saveCheckpointToConversation(
        conversationId: string,
        checkpoint: CheckpointRecord
    ): Promise<void> {
        try {
            // 获取现有检查点
            const metadata = await this.conversationManager.getMetadata(conversationId);
            const existingCheckpoints: CheckpointRecord[] = (metadata?.custom?.checkpoints as CheckpointRecord[]) || [];
            
            // 添加新检查点
            existingCheckpoints.push(checkpoint);
            
            // 保存
            await this.conversationManager.setCustomMetadata(
                conversationId,
                'checkpoints',
                existingCheckpoints
            );
        } catch (err) {
            console.error('[CheckpointManager] Failed to save checkpoint to conversation:', err);
        }
    }
    
    /**
     * 获取对话的所有检查点
     */
    async getCheckpoints(conversationId: string): Promise<CheckpointRecord[]> {
        try {
            const metadata = await this.conversationManager.getMetadata(conversationId);
            return (metadata?.custom?.checkpoints as CheckpointRecord[]) || [];
        } catch (err) {
            console.error('[CheckpointManager] Failed to get checkpoints:', err);
            return [];
        }
    }
    
    /**
     * 计算文件的 MD5 哈希
     */
    private async getFileHash(filePath: string): Promise<string | null> {
        try {
            const content = await fs.readFile(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch {
            return null;
        }
    }
    
    /**
     * 计算两个文件哈希映射之间的差异
     */
    private computeChanges(
        oldHashes: Record<string, string>,
        newHashes: Record<string, string>
    ): { added: string[]; modified: string[]; deleted: string[] } {
        const added: string[] = [];
        const modified: string[] = [];
        const deleted: string[] = [];
        
        // 检查新增和修改的文件
        for (const [path, hash] of Object.entries(newHashes)) {
            if (!(path in oldHashes)) {
                added.push(path);
            } else if (oldHashes[path] !== hash) {
                modified.push(path);
            }
        }
        
        // 检查删除的文件
        for (const path of Object.keys(oldHashes)) {
            if (!(path in newHashes)) {
                deleted.push(path);
            }
        }
        
        return { added, modified, deleted };
    }
    
    /**
     * 查找完整备份的基准点
     * 从目标检查点向前查找，直到找到完整备份
     */
    private findBaseCheckpoint(
        checkpoints: CheckpointRecord[],
        targetCheckpoint: CheckpointRecord
    ): CheckpointRecord | null {
        // 如果目标本身是完整备份
        if (targetCheckpoint.type !== 'incremental') {
            return targetCheckpoint;
        }
        
        // 查找基准检查点
        if (!targetCheckpoint.baseCheckpointId) {
            return null;
        }
        
        const baseCheckpoint = checkpoints.find(cp => cp.id === targetCheckpoint.baseCheckpointId);
        if (!baseCheckpoint) {
            return null;
        }
        
        // 递归查找（如果基准也是增量的话）
        return this.findBaseCheckpoint(checkpoints, baseCheckpoint);
    }
    
    /**
     * 获取从基准点到目标点的增量链
     */
    private getIncrementalChain(
        checkpoints: CheckpointRecord[],
        targetCheckpoint: CheckpointRecord
    ): CheckpointRecord[] {
        const chain: CheckpointRecord[] = [];
        let current: CheckpointRecord | undefined = targetCheckpoint;
        
        while (current) {
            chain.unshift(current);  // 添加到链的开头
            
            if (current.type !== 'incremental' || !current.baseCheckpointId) {
                break;  // 到达完整备份，停止
            }
            
            current = checkpoints.find(cp => cp.id === current!.baseCheckpointId);
        }
        
        return chain;
    }
    
    /**
     * 恢复到指定检查点
     *
     * 支持增量备份恢复：
     * 1. 如果是完整备份，直接恢复
     * 2. 如果是增量备份，先恢复基准点，然后按顺序应用增量变更
     * 3. 智能比较哈希，只更新有变化的文件
     */
    async restoreCheckpoint(
        conversationId: string,
        checkpointId: string
    ): Promise<{ success: boolean; restored: number; deleted: number; skipped: number; error?: string }> {
        return restoreCheckpointImpl({
            conversationId,
            checkpointId,
            checkpointsDir: this.checkpointsDir,
            settingsManager: this.settingsManager,
            getWorkspaceRoot: () => this.getWorkspaceRoot(),
            getCheckpoints: (id) => this.getCheckpoints(id),
            getFileHash: (filePath) => this.getFileHash(filePath),
            refreshAffectedDocuments: (modifiedFiles, deletedFiles) => this.refreshAffectedDocuments(modifiedFiles, deletedFiles),
            getIncrementalChain: (checkpoints, targetCheckpoint) => this.getIncrementalChain(checkpoints, targetCheckpoint),
            computeChanges: (oldHashes, newHashes) => this.computeChanges(oldHashes, newHashes),
            findFileInChain: (chain, relativePath) => this.findFileInChain(chain, relativePath)
        });
    }

    /**
     * 在增量链中查找文件
     * 从最新的检查点向前查找，返回第一个包含该文件的备份路径
     */
    private async findFileInChain(
        chain: CheckpointRecord[],
        relativePath: string
    ): Promise<string | null> {
        // 从链的末尾（最新）向前查找
        for (let i = chain.length - 1; i >= 0; i--) {
            const cp = chain[i];
            const filePath = path.join(this.checkpointsDir, cp.backupDir, relativePath);
            
            try {
                await fs.access(filePath);
                return filePath;  // 找到了
            } catch {
                // 文件不在这个备份中，继续向前查找
            }
        }
        
        return null;
    }
    
    /**
     * 清理空目录（从指定目录向上递归，直到工作区根目录）
     */
    private async cleanupEmptyDirs(dir: string, stopAt: string): Promise<void> {
        if (dir === stopAt || !dir.startsWith(stopAt)) {
            return;
        }
        
        try {
            const entries = await fs.readdir(dir);
            if (entries.length === 0) {
                await fs.rmdir(dir);
                // 继续向上清理
                await this.cleanupEmptyDirs(path.dirname(dir), stopAt);
            }
        } catch {
            // 忽略错误
        }
    }
    
    /**
     * 清理过期检查点
     */
    private async cleanupOldCheckpoints(conversationId: string): Promise<void> {
        const config = this.settingsManager.getCheckpointConfig();
        
        // -1 表示无上限
        if (config.maxCheckpoints < 0) {
            return;
        }
        
        try {
            const checkpoints = await this.getCheckpoints(conversationId);
            
            // 如果超过限制，删除最旧的
            if (checkpoints.length > config.maxCheckpoints) {
                // 按时间排序（旧的在前）
                const sorted = [...checkpoints].sort((a, b) => a.timestamp - b.timestamp);
                const toDelete = sorted.slice(0, checkpoints.length - config.maxCheckpoints);
                
                for (const cp of toDelete) {
                    await this.deleteCheckpoint(conversationId, cp.id);
                }
            }
        } catch (err) {
            console.error('[CheckpointManager] Failed to cleanup old checkpoints:', err);
        }
    }
    
    /**
     * 删除检查点
     */
    async deleteCheckpoint(conversationId: string, checkpointId: string): Promise<boolean> {
        try {
            // 获取检查点列表
            const checkpoints = await this.getCheckpoints(conversationId);
            const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
            
            if (!checkpoint) {
                return false;
            }
            
            // 删除备份目录
            const backupPath = path.join(this.checkpointsDir, checkpoint.backupDir);
            try {
                await fs.rm(backupPath, { recursive: true, force: true });
            } catch {
                // 忽略删除错误
            }
            
            // 从对话元数据中移除
            const remaining = checkpoints.filter(cp => cp.id !== checkpointId);
            await this.conversationManager.setCustomMetadata(
                conversationId,
                'checkpoints',
                remaining
            );
            
            return true;
            
        } catch (err) {
            console.error('[CheckpointManager] Failed to delete checkpoint:', err);
            return false;
        }
    }
    
    /**
     * 删除指定消息索引及之后的检查点
     *
     * 用于重试/编辑消息时清理关联的检查点
     */
    async deleteCheckpointsFromIndex(conversationId: string, fromIndex: number): Promise<number> {
        try {
            const checkpoints = await this.getCheckpoints(conversationId);
            
            // 筛选出需要删除的检查点（消息索引 >= fromIndex）
            const toDelete = checkpoints.filter(cp => cp.messageIndex >= fromIndex);
            const toKeep = checkpoints.filter(cp => cp.messageIndex < fromIndex);
            
            // 删除备份目录
            for (const cp of toDelete) {
                const backupPath = path.join(this.checkpointsDir, cp.backupDir);
                try {
                    await fs.rm(backupPath, { recursive: true, force: true });
                } catch {
                    // 忽略删除错误
                }
            }
            
            // 更新对话的检查点列表
            await this.conversationManager.setCustomMetadata(
                conversationId,
                'checkpoints',
                toKeep
            );
            
            return toDelete.length;
            
        } catch (err) {
            console.error('[CheckpointManager] Failed to delete checkpoints from index:', err);
            return 0;
        }
    }
    
    /**
     * 只刷新受影响的文档
     *
     * 相比刷新所有文档，这种方式更高效，只处理实际被修改或删除的文件
     *
     * @param modifiedFiles 被修改或新增的文件路径列表
     * @param deletedFiles 被删除的文件路径列表
     */
    private async refreshAffectedDocuments(modifiedFiles: string[], deletedFiles: string[]): Promise<void> {
        // 创建快速查找集合
        const modifiedSet = new Set(modifiedFiles.map(f => f.toLowerCase()));
        const deletedSet = new Set(deletedFiles.map(f => f.toLowerCase()));
        
        try {
            // 获取所有已打开的文本文档
            const openDocuments = vscode.workspace.textDocuments;
            
            for (const doc of openDocuments) {
                if (doc.uri.scheme !== 'file') continue;
                
                const docPath = doc.uri.fsPath.toLowerCase();
                
                // 检查文档是否在受影响列表中
                if (modifiedSet.has(docPath)) {
                    // 如果文档在受影响列表中，使用 revert 刷新
                    // 这会丢弃未保存的更改并重新从磁盘加载，使文档回到干净的状态
                    try {
                        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
                        await vscode.commands.executeCommand('workbench.action.files.revert');
                    } catch (err) {
                        console.warn(`[CheckpointManager] Failed to revert ${doc.uri.fsPath}:`, err);
                    }
                }
                // 删除的文件不做任何处理，让 VSCode 自然显示"文件已删除"的状态
            }
            
            // 关闭涉及受影响文件的 diff 视图
            for (const tabGroup of vscode.window.tabGroups.all) {
                for (const tab of tabGroup.tabs) {
                    if (tab.input instanceof vscode.TabInputTextDiff) {
                        const diffInput = tab.input as vscode.TabInputTextDiff;
                        const modifiedPath = diffInput.modified.fsPath.toLowerCase();
                        
                        // 如果 diff 涉及被修改或删除的文件，关闭它
                        if (modifiedSet.has(modifiedPath) || deletedSet.has(modifiedPath)) {
                            await vscode.window.tabGroups.close(tab);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[CheckpointManager] Failed to refresh affected documents:', err);
        }
    }
    
    /**
     * 删除对话的所有检查点
     */
    async deleteAllCheckpoints(conversationId: string): Promise<{ success: boolean; deletedCount: number }> {
        try {
            const checkpoints = await this.getCheckpoints(conversationId);
            let deletedCount = 0;
            
            for (const cp of checkpoints) {
                const backupPath = path.join(this.checkpointsDir, cp.backupDir);
                try {
                    await fs.rm(backupPath, { recursive: true, force: true });
                    deletedCount++;
                } catch {
                    // 忽略删除错误
                }
            }
            
            // 清空对话的检查点列表
            await this.conversationManager.setCustomMetadata(
                conversationId,
                'checkpoints',
                []
            );
            
            return { success: true, deletedCount };
            
        } catch (err) {
            console.error('[CheckpointManager] Failed to delete all checkpoints:', err);
            return { success: false, deletedCount: 0 };
        }
    }
    async getAllConversationsWithCheckpoints(): Promise<ConversationCheckpointStats[]> {
        return getAllConversationsWithCheckpointsImpl({
            conversationManager: this.conversationManager,
            checkpointsDir: this.checkpointsDir
        });
    }
}
