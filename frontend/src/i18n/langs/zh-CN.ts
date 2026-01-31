/**
 * Acopilot - Simplified Chinese Language Pack
 * Organized by component directory structure
 */

import { zhCNApp } from './zh-CN/app';
import { zhCNCommon } from './zh-CN/common';
import { zhCNComponents } from './zh-CN/components';
import { zhCNComposables } from './zh-CN/composables';
import { zhCNErrors } from './zh-CN/errors';
import { zhCNStores } from './zh-CN/stores';

const zhCN = {
    common: zhCNCommon,
    components: zhCNComponents,
    app: zhCNApp,
    errors: zhCNErrors,
    composables: zhCNComposables,
    stores: zhCNStores
};

export default zhCN;

