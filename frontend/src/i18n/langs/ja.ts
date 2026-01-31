/**
 * Acopilot - Japanese Language Pack
 * Organized by component directory structure
 */

import { jaApp } from './ja/app';
import { jaCommon } from './ja/common';
import { jaComponents } from './ja/components';
import { jaComposables } from './ja/composables';
import { jaErrors } from './ja/errors';
import { jaStores } from './ja/stores';

const ja = {
    common: jaCommon,
    components: jaComponents,
    app: jaApp,
    errors: jaErrors,
    composables: jaComposables,
    stores: jaStores
};

export default ja;

