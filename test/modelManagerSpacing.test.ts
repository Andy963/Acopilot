import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

describe('ModelManager spacing', () => {
  it('keeps vertical spacing between filter, list, and manual model input', () => {
    const css = readProjectFile('frontend/src/components/settings/ModelManager.css');

    expect(css).toMatch(/\.model-list-container\s*\{[\s\S]*margin-bottom:\s*10px;/);
    expect(css).toMatch(/\.model-list\s*\{[\s\S]*gap:\s*2px;/);
    expect(css).toMatch(/\.model-list\s*\{[\s\S]*padding:\s*6px 0;/);
  });
});
