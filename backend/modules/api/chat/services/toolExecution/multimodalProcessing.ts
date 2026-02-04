import { debugLog } from '../../../../../core/logger';
import { getMultimodalCapability, type ChannelType as UtilChannelType, type ToolMode as UtilToolMode } from '../../../../../tools/utils';
import type { ContentPart } from '../../../../conversation/types';
import type { BaseChannelConfig } from '../../../../config/configs/base';
import type { FunctionCallInfo } from '../../utils';

export function processMultimodalData(params: {
  multimodalData: Array<{ mimeType: string; data: string; name?: string }>;
  response: Record<string, unknown>;
  call: FunctionCallInfo;
  config: BaseChannelConfig | undefined;
  toolMode: string;
  isPromptMode: boolean;
  responseParts: ContentPart[];
  multimodalAttachments: ContentPart[];
}): void {
  const {
    multimodalData,
    response,
    call,
    config,
    toolMode,
    isPromptMode,
    responseParts,
    multimodalAttachments
  } = params;

  const channelType = (config?.type || 'custom') as UtilChannelType;
  const currentToolMode = (toolMode || 'function_call') as UtilToolMode;
  const multimodalEnabled = config?.multimodalToolsEnabled ?? false;
  const capability = getMultimodalCapability(channelType, currentToolMode, multimodalEnabled);

  if (isPromptMode) {
    for (const item of multimodalData) {
      multimodalAttachments.push({
        inlineData: {
          mimeType: item.mimeType,
          data: item.data,
          displayName: item.name
        }
      });
    }

    delete (response as any).multimodal;

    responseParts.push({
      functionResponse: {
        name: call.name,
        response,
        id: call.id
      }
    });

    return;
  }

  if (capability.supportsImages || capability.supportsDocuments) {
    const multimodalParts: ContentPart[] = multimodalData.map(item => ({
      inlineData: {
        mimeType: item.mimeType,
        data: item.data,
        displayName: item.name
      }
    }));

    delete (response as any).multimodal;

    responseParts.push({
      functionResponse: {
        name: call.name,
        response,
        id: call.id,
        parts: multimodalParts
      }
    });

    return;
  }

  debugLog(`[Multimodal] Channel ${channelType} does not support function_call multimodal, image data will be discarded`);
  delete (response as any).multimodal;

  responseParts.push({
    functionResponse: {
      name: call.name,
      response,
      id: call.id
    }
  });
}

