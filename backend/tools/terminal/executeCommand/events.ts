import { EventEmitter } from 'events';

import { TaskManager, type TaskEvent } from '../../taskManager';

import { TASK_TYPE_TERMINAL } from './constants';
import type { TerminalOutputEvent } from './types';

const terminalEmitter = new EventEmitter();

export function onTerminalOutput(listener: (event: TerminalOutputEvent) => void): () => void {
    terminalEmitter.on('output', listener);
    return () => terminalEmitter.off('output', listener);
}

export function onTerminalTaskEvent(listener: (event: TaskEvent) => void): () => void {
    return TaskManager.onTaskEventByType(TASK_TYPE_TERMINAL, listener);
}

export function emitTerminalOutput(event: TerminalOutputEvent): void {
    terminalEmitter.emit('output', event);
}

