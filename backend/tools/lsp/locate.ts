/**
 * This tool does not perform actions by itself.
 * It exists as a configuration entry for Locate mode.
 */

import type { Tool } from '../types';

export function createLocateTool(): Tool {
    return {
        declaration: {
            name: 'locate',
            description:
                'Locate mode configuration entry. Locate mode can be activated automatically for locate-style queries. ' +
                'This tool itself does not perform actions when called by the model.',
            category: 'lsp',
            parameters: {
                type: 'object',
                properties: {
                    note: {
                        type: 'string',
                        description: 'Optional note.'
                    }
                }
            }
        },
        handler: async () => {
            return {
                success: true,
                data: {
                    message: 'Locate mode is configured in settings and can be activated automatically.'
                }
            };
        }
    };
}

export function registerLocate(): Tool {
    return createLocateTool();
}
