/**
 * Acopilot - English Language Pack
 * Organized by component directory structure
 */

import { enApp } from './en/app';
import { enCommon } from './en/common';
import { enComponents } from './en/components';
import { enComposables } from './en/composables';
import { enErrors } from './en/errors';
import { enStores } from './en/stores';

const en = {
    common: enCommon,
    components: enComponents,
    app: enApp,
    errors: enErrors,
    composables: enComposables,
    stores: enStores
};

export default en;

