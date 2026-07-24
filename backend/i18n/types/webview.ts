export interface BackendWebviewMessages {
    errors: {
        noWorkspaceOpen: string;
        workspaceNotFound: string;
        invalidFileUri: string;
        pathNotFile: string;
        fileNotExists: string;
        fileNotInWorkspace: string;
        fileNotInAnyWorkspace: string;
        fileInOtherWorkspace: string;
        conversationFileNotExists: string;
        cannotRevealInExplorer: string;

        deleteMessageFailed: string;

        getModelsFailed: string;
        addModelsFailed: string;
        removeModelFailed: string;
        setActiveModelFailed: string;

        updateUISettingsFailed: string;
        getSettingsFailed: string;
        updateSettingsFailed: string;
        setActiveChannelFailed: string;

        getToolsFailed: string;
        setToolEnabledFailed: string;
        getToolConfigFailed: string;
        updateToolConfigFailed: string;
        getAutoExecConfigFailed: string;
<<<<<<< HEAD
=======
        getMcpToolsFailed: string;
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
        setToolAutoExecFailed: string;
        updateListFilesConfigFailed: string;
        updateApplyDiffConfigFailed: string;
        updateExecuteCommandConfigFailed: string;
        checkShellFailed: string;

        killTerminalFailed: string;
        getTerminalOutputFailed: string;

        cancelImageGenFailed: string;

        cancelTaskFailed: string;
        getTasksFailed: string;

        getCheckpointConfigFailed: string;
        updateCheckpointConfigFailed: string;
        getCheckpointsFailed: string;
        restoreCheckpointFailed: string;
        deleteCheckpointFailed: string;
        deleteAllCheckpointsFailed: string;
        getConversationsWithCheckpointsFailed: string;

        openDiffPreviewFailed: string;
        acceptDiffFailed: string;
        diffContentNotFound: string;
        loadDiffContentFailed: string;
        invalidDiffData: string;
        noFileContent: string;
        unsupportedToolType: string;

        getRelativePathFailed: string;
        previewAttachmentFailed: string;
        readImageFailed: string;
        openFileFailed: string;
        saveImageFailed: string;

<<<<<<< HEAD
=======
        openMcpConfigFailed: string;
        getMcpServersFailed: string;
        validateMcpServerIdFailed: string;
        createMcpServerFailed: string;
        updateMcpServerFailed: string;
        deleteMcpServerFailed: string;
        connectMcpServerFailed: string;
        disconnectMcpServerFailed: string;
        setMcpServerEnabledFailed: string;

>>>>>>> f327a97 (merge: dev into main for v1.2.0)
        getSummarizeConfigFailed: string;
        updateSummarizeConfigFailed: string;
        summarizeFailed: string;

        getGenerateImageConfigFailed: string;
        updateGenerateImageConfigFailed: string;

        getContextAwarenessConfigFailed: string;
        updateContextAwarenessConfigFailed: string;
        getOpenTabsFailed: string;
        getActiveEditorFailed: string;

        getSystemPromptConfigFailed: string;
        updateSystemPromptConfigFailed: string;

        getPinnedFilesConfigFailed: string;
        checkPinnedFilesExistenceFailed: string;
        updatePinnedFilesConfigFailed: string;
        addPinnedFileFailed: string;
        removePinnedFileFailed: string;
        setPinnedFileEnabledFailed: string;

        listDependenciesFailed: string;
        installDependencyFailed: string;
        uninstallDependencyFailed: string;
        getInstallPathFailed: string;

        showNotificationFailed: string;

        rejectToolCallsFailed: string;

        getStorageConfigFailed: string;
        updateStorageConfigFailed: string;
        validateStoragePathFailed: string;
        migrateStorageFailed: string;
    };

    messages: {
        historyDiffPreview: string;
        newFileContentPreview: string;
        fullFileDiffPreview: string;
        searchReplaceDiffPreview: string;
    };

    dialogs: {
        selectStorageFolder: string;
        selectFolder: string;
    };
}
<<<<<<< HEAD
=======

>>>>>>> f327a97 (merge: dev into main for v1.2.0)
