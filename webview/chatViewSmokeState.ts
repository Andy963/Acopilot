import { isRecord } from './protocol';

export type SmokeView = 'chat' | 'history' | 'settings';

export type SmokeUiState = {
  currentView: SmokeView | null;
  activeTab: string | null;
  showEmptyState: boolean | null;
  currentConversationId: string | null;
  selectionReferenceCount: number | null;
};

export type SmokeStatus = SmokeUiState & {
  viewResolved: boolean;
  webviewReady: boolean;
};

const INITIAL_SMOKE_UI_STATE: SmokeUiState = {
  currentView: null,
  activeTab: null,
  showEmptyState: null,
  currentConversationId: null,
  selectionReferenceCount: null,
};

export class ChatViewSmokeStateTracker {
  private state: SmokeUiState = createInitialSmokeUiState();

  reset(): void {
    this.state = createInitialSmokeUiState();
  }

  update(data: unknown): void {
    if (!isRecord(data)) {
      return;
    }

    this.state = {
      currentView:
        data.currentView === 'chat' || data.currentView === 'history' || data.currentView === 'settings'
          ? data.currentView
          : null,
      activeTab: typeof data.activeTab === 'string' ? data.activeTab : null,
      showEmptyState: typeof data.showEmptyState === 'boolean' ? data.showEmptyState : null,
      currentConversationId: typeof data.currentConversationId === 'string' ? data.currentConversationId : null,
      selectionReferenceCount:
        typeof data.selectionReferenceCount === 'number' && data.selectionReferenceCount >= 0
          ? data.selectionReferenceCount
          : null,
    };
  }

  getStatus(params: { viewResolved: boolean; webviewReady: boolean }): SmokeStatus {
    return {
      viewResolved: params.viewResolved,
      webviewReady: params.webviewReady,
      ...this.state,
    };
  }
}

function createInitialSmokeUiState(): SmokeUiState {
  return { ...INITIAL_SMOKE_UI_STATE };
}
