export const ACOPILOT_VIEW_CONTAINER_ID = 'acopilot';
export const ACOPILOT_VIEW_ID = 'acopilot.chatView';
export const ACOPILOT_VIEW_CONTAINER_COMMAND = `workbench.view.extension.${ACOPILOT_VIEW_CONTAINER_ID}`;
export const ACOPILOT_VIEW_FOCUS_COMMAND = `${ACOPILOT_VIEW_ID}.focus`;

export type AcopilotFrontendCommand =
  | 'showChat'
  | 'newChat'
  | 'showHistory'
  | 'showSettings'
  | 'addSelectionToChat';

type ExecuteCommand = (command: string, ...args: unknown[]) => Thenable<unknown>;
type SendCommand = (command: AcopilotFrontendCommand, data?: unknown) => void;

export async function revealAcopilotView(executeCommand: ExecuteCommand): Promise<void> {
  await executeCommand(ACOPILOT_VIEW_CONTAINER_COMMAND);
  await executeCommand(ACOPILOT_VIEW_FOCUS_COMMAND);
}

export async function revealAcopilotViewAndSendCommand(
  executeCommand: ExecuteCommand,
  sendCommand: SendCommand | undefined,
  command: AcopilotFrontendCommand,
  data?: unknown
): Promise<void> {
  await revealAcopilotView(executeCommand);
  sendCommand?.(command, data);
}
