import { describe, it, expect } from 'vitest';
import { filterSensitiveEnv } from '../backend/core/envFilter';

describe('filterSensitiveEnv', () => {
  it('should filter out sensitive environment variables', () => {
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: '/home/user',
      GEMINI_API_KEY: 'secret1',
      OPENAI_API_KEY: 'secret2',
      MY_SECRET_KEY: 'secret3',
      GITHUB_TOKEN: 'secret4',
      ACCESS_TOKEN: 'secret5',
      PASSWORD: 'password123',
    };

    const filtered = filterSensitiveEnv(env);

    expect(filtered.PATH).toBe('/usr/bin:/bin');
    expect(filtered.HOME).toBe('/home/user');
    expect(filtered.GEMINI_API_KEY).toBeUndefined();
    expect(filtered.OPENAI_API_KEY).toBeUndefined();
    expect(filtered.MY_SECRET_KEY).toBeUndefined();
    expect(filtered.GITHUB_TOKEN).toBeUndefined();
    expect(filtered.ACCESS_TOKEN).toBeUndefined();
    expect(filtered.PASSWORD).toBeUndefined();
  });

  it('should keep non-sensitive environment variables', () => {
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: '/home/user',
      USER: 'user',
      LANG: 'en_US.UTF-8',
      XDG_SESSION_TYPE: 'tty',
    };

    const filtered = filterSensitiveEnv(env);

    expect(filtered).toEqual(env);
  });
});
