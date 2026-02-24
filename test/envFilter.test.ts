import { describe, expect, it } from 'vitest';

import { filterSensitiveEnv } from '../backend/core/envFilter';

describe('filterSensitiveEnv', () => {
  it('removes common secret env keys', () => {
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: '/home/user',
      OPENAI_API_KEY: 'sk-123',
      AWS_ACCESS_KEY_ID: 'akid',
      AWS_SECRET_ACCESS_KEY: 'asecret',
      GITHUB_TOKEN: 'ghp_123',
      MY_CLIENT_SECRET: 'secret',
      MY_PASSWORD: 'password',
      MY_REFRESH_TOKEN: 'refresh',
    };

    const filtered = filterSensitiveEnv(env);

    expect(filtered.PATH).toBe('/usr/bin:/bin');
    expect(filtered.HOME).toBe('/home/user');
    expect(filtered.OPENAI_API_KEY).toBeUndefined();
    expect(filtered.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(filtered.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(filtered.GITHUB_TOKEN).toBeUndefined();
    expect(filtered.MY_CLIENT_SECRET).toBeUndefined();
    expect(filtered.MY_PASSWORD).toBeUndefined();
    expect(filtered.MY_REFRESH_TOKEN).toBeUndefined();
  });

  it('keeps non-sensitive keys unchanged', () => {
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: '/home/user',
      USER: 'user',
      LANG: 'en_US.UTF-8',
      MONKEY_PATCH: '1',
    };

    const filtered = filterSensitiveEnv(env);
    expect(filtered).toEqual(env);
  });
});
