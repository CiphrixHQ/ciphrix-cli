import { hostname, platform } from 'node:os';

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

/**
 * A friendly default device name derived from the machine hostname, so a fresh
 * login is recognisable on the approval page without any setup.
 */
export const defaultDeviceName = (): string => {
  const raw = hostname()
    .replace(/\.local$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return raw === '' ? 'This device' : raw;
};

export const defaultDevicePlatform = (): string => {
  const label = PLATFORM_LABELS[platform()] ?? platform();
  return `${label} · ${process.arch}`;
};

export interface DeviceIdentity {
  deviceName?: string | undefined;
  devicePlatform?: string | undefined;
}

export const resolveDeviceIdentity = (deviceName?: string): Required<DeviceIdentity> => ({
  deviceName: deviceName?.trim() || defaultDeviceName(),
  devicePlatform: defaultDevicePlatform(),
});
