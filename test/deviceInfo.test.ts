import { describe, expect, it } from 'vitest';

import { defaultDeviceName, resolveDeviceIdentity } from '../src/deviceInfo.js';

describe('device identity', () => {
  it('uses an explicit device name when provided', () => {
    expect(resolveDeviceIdentity('  work laptop  ').deviceName).toBe('work laptop');
  });

  it('generates a non-empty default name and a platform label', () => {
    expect(defaultDeviceName().length).toBeGreaterThan(0);
    expect(defaultDeviceName()).not.toContain('.local');
    expect(resolveDeviceIdentity().devicePlatform).toContain('·');
  });

  it('falls back to the generated name when the override is blank', () => {
    expect(resolveDeviceIdentity('   ').deviceName).toBe(defaultDeviceName());
  });
});
