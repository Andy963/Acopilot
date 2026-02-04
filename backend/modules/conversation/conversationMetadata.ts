import { t } from '../../i18n';
import type { ConversationMetadata } from './types';
import type { IStorageAdapter } from './storage';

export async function setConversationTitle(
  storage: IStorageAdapter,
  conversationId: string,
  title: string
): Promise<void> {
  let meta = await storage.loadMetadata(conversationId);
  if (!meta) {
    meta = {
      id: conversationId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      custom: {}
    };
  } else {
    meta.title = title;
    meta.updatedAt = Date.now();
  }
  await storage.saveMetadata(meta);
}

export async function setConversationWorkspaceUri(
  storage: IStorageAdapter,
  conversationId: string,
  workspaceUri: string
): Promise<void> {
  let meta = await storage.loadMetadata(conversationId);
  if (!meta) {
    meta = {
      id: conversationId,
      title: t('modules.conversation.defaultTitle', { conversationId }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspaceUri,
      custom: {}
    };
  } else {
    meta.workspaceUri = workspaceUri;
    meta.updatedAt = Date.now();
  }
  await storage.saveMetadata(meta);
}

export async function getConversationMetadata(
  storage: IStorageAdapter,
  conversationId: string
): Promise<ConversationMetadata | null> {
  const meta = await storage.loadMetadata(conversationId);
  return meta ? JSON.parse(JSON.stringify(meta)) : null;
}

export async function setConversationCustomMetadata(
  storage: IStorageAdapter,
  conversationId: string,
  key: string,
  value: unknown
): Promise<void> {
  let meta = await storage.loadMetadata(conversationId);
  if (!meta) {
    meta = {
      id: conversationId,
      title: t('modules.conversation.defaultTitle', { conversationId }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      custom: {}
    };
  }

  if (!meta.custom) {
    meta.custom = {};
  }

  meta.custom[key] = value;
  meta.updatedAt = Date.now();

  await storage.saveMetadata(meta);
}

export async function getConversationCustomMetadata(
  storage: IStorageAdapter,
  conversationId: string,
  key: string
): Promise<unknown> {
  const meta = await getConversationMetadata(storage, conversationId);
  return meta?.custom?.[key];
}

