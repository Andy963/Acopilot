export const enComponentsPlanRunner = {
    status: {
        idle: 'Idle',
        running: 'Running',
        paused: 'Paused',
        completed: 'Completed',
        cancelled: 'Cancelled'
    },
    actions: {
        start: 'Start',
        resume: 'Resume',
        pause: 'Pause',
        cancel: 'Cancel',
        clear: 'Clear',
        runStep: 'Run step',
        rerunStep: 'Rerun step'
    },
    current: 'Current',
    goalLabel: 'Goal',
    acceptanceCriteriaLabel: 'Acceptance',
    attachmentsLabel: 'Attachments',
    modal: {
        title: 'Plan & Run',
        planTitle: 'Plan title',
        planTitlePlaceholder: 'e.g. Fix xxx and add tests',
        goal: 'Goal / context (optional)',
        goalPlaceholder: 'Optional: constraints, context…',
        acceptanceCriteria: 'Acceptance criteria (optional)',
        acceptanceCriteriaPlaceholder: 'Optional: how to verify completion…',
        steps: 'Steps',
        addStep: 'Add step',
        stepTitle: 'Step title',
        stepInstruction: 'Instruction/prompt to send for this step…',
        attachImage: 'Attach image',
        removeStep: 'Remove step',
        removeAttachment: 'Remove attachment',
        stash: 'Save draft',
        stashed: 'Draft saved',
        draftLoaded: 'Loaded saved draft (you can continue editing next time)',
        hint: 'Need: plan title + at least 1 complete step (title + instruction).',
        save: 'Save plan',
        saveAndStart: 'Save & start'
    }
};
