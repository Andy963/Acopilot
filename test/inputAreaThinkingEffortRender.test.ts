import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('InputArea thinking effort integration (static)', () => {
  it('renders the effort selector behind a visibility gate', () => {
    const filePath = resolve(__dirname, '../frontend/src/components/input/InputArea.vue');
    const content = readFileSync(filePath, 'utf8');

    expect(content).toContain("v-if=\"isThinkingEffortVisible\"");
    expect(content).toContain("class=\"thinking-effort-wrapper\"");
    expect(content).toContain('<CustomSelect');
    expect(content).toContain('@update:model-value="handleThinkingEffortChange"');
  });

  it('ensures effort changes actually affect requests by enabling reasoning', () => {
    const filePath = resolve(__dirname, '../frontend/src/components/input/InputArea.vue');
    const content = readFileSync(filePath, 'utf8');

    // The footer control should not be a no-op; it must flip the enabled flag.
    expect(content).toMatch(/reasoning\s*:\s*true/);
    expect(content).toContain("optionsEnabled: nextOptionsEnabled");
    expect(content).toContain("options: nextOptions");
  });
});

