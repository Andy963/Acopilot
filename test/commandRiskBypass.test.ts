
import { describe, expect, it } from 'vitest';
import { assessExecuteCommandRisk } from '../backend/core/commandRisk';

describe('assessExecuteCommandRisk Bypass Check', () => {
  it('flags quoted rm command as critical', () => {
    const risk = assessExecuteCommandRisk("'rm' -rf /");
    expect(risk.level).toBe('critical');
    expect(risk.categories).toContain('destructive');
  });

  it('flags double quoted rm command as critical', () => {
    const risk = assessExecuteCommandRisk('"rm" -rf /');
    expect(risk.level).toBe('critical');
    expect(risk.categories).toContain('destructive');
  });

  it('flags backslash escaped rm command as critical', () => {
    const risk = assessExecuteCommandRisk("\\rm -rf /");
    expect(risk.level).toBe('critical');
    expect(risk.categories).toContain('destructive');
  });

  it('flags interleaved backslash rm command as critical', () => {
    const risk = assessExecuteCommandRisk("r\\m -rf /");
    expect(risk.level).toBe('critical');
    expect(risk.categories).toContain('destructive');
  });

  it('flags mixed quotes rm command as critical', () => {
    const risk = assessExecuteCommandRisk("'r'\"m\" -rf /");
    expect(risk.level).toBe('critical');
    expect(risk.categories).toContain('destructive');
  });

  it('flags quoted git reset --hard as high', () => {
    const risk = assessExecuteCommandRisk("'git' reset --hard");
    expect(risk.level).toBe('high');
    expect(risk.categories).toContain('gitHistory');
  });
});
