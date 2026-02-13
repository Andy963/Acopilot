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
import { debugLog } from '../../core/logger';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { SettingsManager } from '../settings/SettingsManager';
import type { ConversationManager } from '../conversation/ConversationManager';
import { getDiffManager } from '../../tools/file/diffManager';
import { cleanupEmptyDirsRecursive, collectFilesAndDirsWithPatterns, loadAllGitignorePatterns } from './checkpointFs';
import type { CheckpointRecord, FileChange } from './checkpointTypes';
import { restoreCheckpointLegacy } from './checkpointLegacyRestore';
import { getCheckpointIoConcurrency, runWithConcurrency } from './concurrency';

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
        // 检查是否应该创建检查点
        const config = this.settingsManager.getCheckpointConfig();
        if (!config.enabled) {
            return null;
        }
        
        let shouldCreate = false;
        
        // 检查是否是消息类型
        if (toolName === 'user_message' || toolName === 'model_message') {
            // 使用消息类型配置
            const messageType = toolName === 'user_message' ? 'user' : 'model';
            if (phase === 'before') {
                shouldCreate = config.messageCheckpoint?.beforeMessages?.includes(messageType) ?? false;
            } else {
                shouldCreate = config.messageCheckpoint?.afterMessages?.includes(messageType) ?? false;
            }
        } else if (toolName === 'tool_batch') {
            // 批量工具：只要配置了任何工具的检查点，就创建
            // tool_batch 表示多个工具调用被批量处理
            if (phase === 'before') {
                shouldCreate = config.beforeTools.length > 0;
            } else {
                shouldCreate = config.afterTools.length > 0;
            }
        } else {
            // 使用工具配置
            shouldCreate = phase === 'before'
                ? config.beforeTools.includes(toolName)
                : config.afterTools.includes(toolName);
        }
            
        if (!shouldCreate) {
            return null;
        }
        
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            console.warn('[CheckpointManager] No workspace root');
            return null;
        }
        
        try {
            const checkpointId = this.generateCheckpointId();
            const backupDir = path.join(this.checkpointsDir, checkpointId);
            
            // 创建备份目录
            await fs.mkdir(backupDir, { recursive: true });
            
            // 收集需要备份的文件和目录
            const ignorePatterns = await loadAllGitignorePatterns(workspaceRoot.fsPath, config.customIgnorePatterns);
            const { files, dirs } = await collectFilesAndDirsWithPatterns(workspaceRoot.fsPath, ignorePatterns);
            
            // 计算当前所有文件的哈希
            const currentHashes: Record<string, string> = {};
            const sortedFiles = [...files].sort();

            const hashConcurrency = getCheckpointIoConcurrency(sortedFiles.length);
            await runWithConcurrency(sortedFiles, hashConcurrency, async (file) => {
                try {
                    const relativePath = path.relative(workspaceRoot.fsPath, file);
                    const content = await fs.readFile(file);
                    const fileHash = crypto.createHash('md5').update(content).digest('hex');
                    currentHashes[relativePath] = fileHash;
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to hash ${file}:`, err);
                }
            });

            const hashParts: string[] = [];
            for (const file of sortedFiles) {
                const relativePath = path.relative(workspaceRoot.fsPath, file);
                const fileHash = currentHashes[relativePath];
                if (fileHash) {
                    hashParts.push(`${relativePath}:${fileHash}`);
                }
            }
            
            // 收集空目录的相对路径
            const currentEmptyDirs: string[] = [];
            for (const dir of dirs) {
                const relativePath = path.relative(workspaceRoot.fsPath, dir);
                currentEmptyDirs.push(relativePath);
                hashParts.push(`${relativePath}:empty-dir`);
            }
            currentEmptyDirs.sort();
            
            // 计算综合内容签名
            const contentHash = crypto.createHash('sha256')
                .update(hashParts.join('\n'))
                .digest('hex')
                .substring(0, 16);
            
            // 获取该对话的上一个检查点，用于增量备份
            const existingCheckpoints = await this.getCheckpoints(conversationId);
            const lastCheckpoint = existingCheckpoints.length > 0
                ? existingCheckpoints[existingCheckpoints.length - 1]
                : null;
            
            // 判断是否可以进行增量备份
            let isIncremental = false;
            let baseCheckpointId: string | undefined;
            let changes: FileChange[] = [];
            let fileCount = 0;
            
            if (lastCheckpoint && lastCheckpoint.fileHashes) {
                // 计算变更
                const { added, modified, deleted } = this.computeChanges(
                    lastCheckpoint.fileHashes,
                    currentHashes
                );
                
                // 如果变更的文件数量小于总文件数的一半，使用增量备份
                const totalChanges = added.length + modified.length + deleted.length;
                const totalFiles = Object.keys(currentHashes).length;
                
                // 始终使用增量备份（只要有上一个检查点）
                // 增量备份的主要目的是节省磁盘空间，恢复时性能差异可忽略
                isIncremental = true;
                baseCheckpointId = lastCheckpoint.id;
                
                // 构建变更列表
                changes = [
                    ...added.map(p => ({ path: p, type: 'added' as const, hash: currentHashes[p] })),
                    ...modified.map(p => ({ path: p, type: 'modified' as const, hash: currentHashes[p] })),
                    ...deleted.map(p => ({ path: p, type: 'deleted' as const }))
                ];
                
                // 只复制变更的文件（如果没有变更，则不复制任何文件）
                const incrementalCopyChanges = changes.filter(change => change.type !== 'deleted');
                const incrementalCopyConcurrency = getCheckpointIoConcurrency(incrementalCopyChanges.length);
                await runWithConcurrency(incrementalCopyChanges, incrementalCopyConcurrency, async (change) => {
                    const srcPath = path.join(workspaceRoot.fsPath, change.path);
                    const destPath = path.join(backupDir, change.path);

                    try {
                        await fs.mkdir(path.dirname(destPath), { recursive: true });
                        await fs.copyFile(srcPath, destPath);
                        fileCount++;
                    } catch (err) {
                        console.warn(`[CheckpointManager] Failed to copy ${change.path}:`, err);
                    }
                });
                
                debugLog(`[CheckpointManager] Incremental backup: ${added.length} added, ${modified.length} modified, ${deleted.length} deleted`);
            }
            
            // 如果不是增量备份，进行完整备份
            if (!isIncremental) {
                const fullCopyConcurrency = getCheckpointIoConcurrency(sortedFiles.length);
                await runWithConcurrency(sortedFiles, fullCopyConcurrency, async (file) => {
                    try {
                        const relativePath = path.relative(workspaceRoot.fsPath, file);
                        const destPath = path.join(backupDir, relativePath);

                        await fs.mkdir(path.dirname(destPath), { recursive: true });
                        await fs.copyFile(file, destPath);
                        fileCount++;
                    } catch (err) {
                        console.warn(`[CheckpointManager] Failed to copy ${file}:`, err);
                    }
                });
                
                // 备份空目录
                for (const dir of dirs) {
                    try {
                        const relativePath = path.relative(workspaceRoot.fsPath, dir);
                        const destPath = path.join(backupDir, relativePath);
                        await fs.mkdir(destPath, { recursive: true });
                    } catch (err) {
                        console.warn(`[CheckpointManager] Failed to create empty dir ${dir}:`, err);
                    }
                }
                
                debugLog(`[CheckpointManager] Full backup: ${fileCount} files`);
            }
            
            // 创建检查点记录
            const phaseText = phase === 'before'
                ? t('modules.checkpoint.description.before')
                : t('modules.checkpoint.description.after');
            const checkpoint: CheckpointRecord = {
                id: checkpointId,
                conversationId,
                messageIndex,
                toolName,
                phase,
                timestamp: Date.now(),
                backupDir: checkpointId,
                fileCount,
                contentHash,
                description: `${phaseText}: ${toolName}`,
                type: isIncremental ? 'incremental' : 'full',
                baseCheckpointId: isIncremental ? baseCheckpointId : undefined,
                changes: isIncremental ? changes : undefined,
                fileHashes: currentHashes,
                emptyDirs: currentEmptyDirs
            };
            
            // 保存到对话元数据
            await this.saveCheckpointToConversation(conversationId, checkpoint);
            
            // 清理过期检查点
            await this.cleanupOldCheckpoints(conversationId);
            
            return checkpoint;
            
        } catch (err) {
            console.error('[CheckpointManager] Failed to create checkpoint:', err);
            return null;
        }
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
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'No workspace root' };
        }
        
        try {
            // 查找检查点
            const checkpoints = await this.getCheckpoints(conversationId);
            const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
            
            if (!checkpoint) {
                return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'Checkpoint not found' };
            }

            const config = this.settingsManager.getCheckpointConfig();
            
            // 在恢复前，取消所有 pending diffs（因为恢复后它们将无效）
            try {
                const diffManager = getDiffManager();
                await diffManager.cancelAllPending();
            } catch (err) {
                console.warn('[CheckpointManager] Failed to cancel pending diffs:', err);
            }
            
            // 获取目标检查点的文件哈希映射（这是最终目标状态）
            const targetHashes = checkpoint.fileHashes;
            
            // 如果没有 fileHashes（旧版本检查点），回退到原来的逻辑
            if (!targetHashes) {
                return restoreCheckpointLegacy({
                    checkpointsDir: this.checkpointsDir,
                    workspaceRootFsPath: workspaceRoot.fsPath,
                    checkpoint,
                    customIgnorePatterns: config.customIgnorePatterns,
                    getFileHash: (filePath) => this.getFileHash(filePath),
                    refreshAffectedDocuments: (modifiedFiles, deletedFiles) => this.refreshAffectedDocuments(modifiedFiles, deletedFiles)
                });
            }
            
            // 获取增量链（从基准点到目标点）
            const chain = this.getIncrementalChain(checkpoints, checkpoint);
            if (chain.length === 0) {
                return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'Cannot build checkpoint chain' };
            }
            
            // 验证链的完整性（确保所有备份目录都存在）
            for (const cp of chain) {
                const backupPath = path.join(this.checkpointsDir, cp.backupDir);
                try {
                    await fs.access(backupPath);
                } catch {
                    return { success: false, restored: 0, deleted: 0, skipped: 0, error: `Backup directory not found: ${cp.backupDir}` };
                }
            }
            
            const ignorePatterns = await loadAllGitignorePatterns(workspaceRoot.fsPath, config.customIgnorePatterns);
            
            // 收集当前工作区文件
            const { files: workspaceFiles } = await collectFilesAndDirsWithPatterns(workspaceRoot.fsPath, ignorePatterns);
            const currentHashes: Record<string, string> = {};
            for (const file of workspaceFiles) {
                const relativePath = path.relative(workspaceRoot.fsPath, file);
                const hash = await this.getFileHash(file);
                if (hash) {
                    currentHashes[relativePath] = hash;
                }
            }
            
            let deleted = 0;
            let restored = 0;
            let skipped = 0;
            const modifiedFiles: string[] = [];
            const deletedFiles: string[] = [];
            
            // 计算需要的变更
            const { added, modified, deleted: toDelete } = this.computeChanges(currentHashes, targetHashes);
            
            // 删除多余的文件
            for (const relativePath of toDelete) {
                const fullPath = path.join(workspaceRoot.fsPath, relativePath);
                try {
                    await fs.unlink(fullPath);
                    deleted++;
                    deletedFiles.push(fullPath);
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to delete ${relativePath}:`, err);
                }
            }
            
            // 清理空目录
            await cleanupEmptyDirsRecursive(workspaceRoot.fsPath, ignorePatterns);
            
            // 恢复需要添加/修改的文件
            const filesToRestore = [...added, ...modified];
            for (const relativePath of filesToRestore) {
                // 在增量链中查找这个文件
                const srcPath = await this.findFileInChain(chain, relativePath);
                
                if (!srcPath) {
                    console.warn(`[CheckpointManager] Cannot find ${relativePath} in backup chain`);
                    continue;
                }
                
                const destPath = path.join(workspaceRoot.fsPath, relativePath);
                
                try {
                    // 验证文件哈希是否匹配目标
                    const srcHash = await this.getFileHash(srcPath);
                    if (srcHash !== targetHashes[relativePath]) {
                        console.warn(`[CheckpointManager] Hash mismatch for ${relativePath}`);
                        continue;
                    }
                    
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(srcPath, destPath);
                    restored++;
                    modifiedFiles.push(destPath);
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to restore ${relativePath}:`, err);
                }
            }
            
            // 跳过的文件数量（当前哈希与目标哈希相同的文件）
            skipped = Object.keys(targetHashes).length - added.length - modified.length;
            
            // 恢复空目录（从检查点元数据中读取）
            const targetEmptyDirs = checkpoint.emptyDirs || [];
            for (const relativePath of targetEmptyDirs) {
                try {
                    const destPath = path.join(workspaceRoot.fsPath, relativePath);
                    await fs.mkdir(destPath, { recursive: true });
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to restore empty dir ${relativePath}:`, err);
                }
            }
            
            // 刷新 VSCode 中被修改的文档
            await this.refreshAffectedDocuments(modifiedFiles, deletedFiles);
            
            // 显示恢复结果
            const phaseText = checkpoint.phase === 'before'
                ? t('modules.checkpoint.description.before')
                : t('modules.checkpoint.description.after');
            let message = `$(check) ${t('modules.checkpoint.restore.success', { toolName: checkpoint.toolName, phase: phaseText })}`;
            const details: string[] = [];
            if (restored > 0) details.push(t('modules.checkpoint.restore.filesUpdated', { count: restored }));
            if (deleted > 0) details.push(t('modules.checkpoint.restore.filesDeleted', { count: deleted }));
            if (skipped > 0) details.push(t('modules.checkpoint.restore.filesUnchanged', { count: skipped }));
            if (details.length > 0) {
                message += `（${details.join('，')}）`;
            }
            vscode.window.setStatusBarMessage(message, 5000);
            
            debugLog(`[CheckpointManager] Restore from chain: ${chain.length} checkpoints, restored=${restored}, deleted=${deleted}, skipped=${skipped}`);
            
            return { success: true, restored, deleted, skipped };
            
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error';
            console.error('[CheckpointManager] Failed to restore checkpoint:', err);
            return { success: false, restored: 0, deleted: 0, skipped: 0, error };
        }
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
    
    /**
     * 计算目录的总大小（字节）
     */
    private async getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                } else if (entry.isFile()) {
                    try {
                        const stat = await fs.stat(fullPath);
                        totalSize += stat.size;
                    } catch {
                        // 忽略无法访问的文件
                    }
                }
            }
        } catch {
            // 忽略无法访问的目录
        }
        
        return totalSize;
    }
    
    /**
     * 获取所有对话的检查点统计信息
     *
     * @returns 对话列表，包含检查点数量和总大小
     */
    async getAllConversationsWithCheckpoints(): Promise<Array<{
        conversationId: string;
        title: string;
        checkpointCount: number;
        totalSize: number;
        createdAt?: number;
        updatedAt?: number;
    }>> {
        const results: Array<{
            conversationId: string;
            title: string;
            checkpointCount: number;
            totalSize: number;
            createdAt?: number;
            updatedAt?: number;
        }> = [];
        
        try {
            // 获取所有对话 ID
            const conversationIds = await this.conversationManager.listConversations();
            
            for (const conversationId of conversationIds) {
                try {
                    const metadata = await this.conversationManager.getMetadata(conversationId);
                    const checkpoints = (metadata?.custom?.checkpoints as CheckpointRecord[]) || [];
                    
                    // 只包含有检查点的对话
                    if (checkpoints.length > 0) {
                        // 计算所有检查点目录的总大小
                        let totalSize = 0;
                        for (const cp of checkpoints) {
                            const backupPath = path.join(this.checkpointsDir, cp.backupDir);
                            totalSize += await this.getDirectorySize(backupPath);
                        }
                        
                        results.push({
                            conversationId,
                            title: metadata?.title || t('modules.checkpoint.defaultConversationTitle', { conversationId: conversationId.slice(0, 8) }),
                            checkpointCount: checkpoints.length,
                            totalSize,
                            createdAt: metadata?.createdAt,
                            updatedAt: metadata?.updatedAt
                        });
                    }
                } catch {
                    // 忽略单个对话的错误
                }
            }
            
            // 按更新时间降序排列
            results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            
        } catch (err) {
            console.error('[CheckpointManager] Failed to get all conversations with checkpoints:', err);
        }
        
        return results;
    }
}
