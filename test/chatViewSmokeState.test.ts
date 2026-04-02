import { describe, expect, it } from 'vitest';
import { ChatViewSmokeStateTracker } from '../webview/chatViewSmokeState';

describe('ChatViewSmokeStateTracker', () => {
  it('tracks valid smoke UI updates and exposes a full smoke status snapshot', () => {
    const tracker = new ChatViewSmokeStateTracker();

    tracker.update({
      currentView: 'chat',
      activeTab: 'tools',
      showEmptyState: true,
      currentConversationId: 'conv-1',
      selectionReferenceCount: 2,
    });

    expect(
      tracker.getStatus({
        viewResolved: true,
        webviewReady: true,
      }),
    ).toEqual({
      viewResolved: true,
      webviewReady: true,
      currentView: 'chat',
      activeTab: 'tools',
      showEmptyState: true,
      currentConversationId: 'conv-1',
      selectionReferenceCount: 2,
    });
  });

  it('ignores invalid payloads and resets back to the initial smoke state', () => {
    const tracker = new ChatViewSmokeStateTracker();

    tracker.update({
      currentView: 'invalid',
      activeTab: 1,
      showEmptyState: 'yes',
      currentConversationId: null,
      selectionReferenceCount: -1,
    });

    expect(
      tracker.getStatus({
        viewResolved: false,
        webviewReady: false,
      }),
    ).toEqual({
      viewResolved: false,
      webviewReady: false,
      currentView: null,
      activeTab: null,
      showEmptyState: null,
      currentConversationId: null,
      selectionReferenceCount: null,
    });

    tracker.update({
      currentView: 'history',
      activeTab: 'tab',
      showEmptyState: false,
      currentConversationId: 'conv-2',
      selectionReferenceCount: 1,
    });
    tracker.reset();

    expect(
      tracker.getStatus({
        viewResolved: true,
        webviewReady: false,
      }),
    ).toEqual({
      viewResolved: true,
      webviewReady: false,
      currentView: null,
      activeTab: null,
      showEmptyState: null,
      currentConversationId: null,
      selectionReferenceCount: null,
    });
  });
});
