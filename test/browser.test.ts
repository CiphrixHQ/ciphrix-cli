import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: spawnMock }));

import { openInBrowser } from '../src/browser.js';

describe('openInBrowser', () => {
  beforeEach(() => spawnMock.mockReset());

  it.each([
    ['darwin', 'open'],
    ['linux', 'xdg-open'],
    ['win32', 'rundll32.exe'],
  ] as const)(
    'uses the platform browser opener on %s without a shell',
    async (platform, executable) => {
      const child = new EventEmitter() as EventEmitter & { unref: () => void };
      child.unref = vi.fn();
      spawnMock.mockImplementation(() => {
        queueMicrotask(() => child.emit('spawn'));
        return child;
      });

      await expect(
        openInBrowser('https://app.example.com/device?code=a&next=b', platform),
      ).resolves.toBe(true);
      expect(spawnMock).toHaveBeenCalledWith(
        executable,
        expect.arrayContaining(['https://app.example.com/device?code=a&next=b']),
        expect.objectContaining({ detached: true, stdio: 'ignore', windowsHide: true }),
      );
      expect(spawnMock.mock.calls[0]?.[2]).not.toHaveProperty('shell', true);
      expect(child.unref).toHaveBeenCalledOnce();
    },
  );

  it('fails closed on unsupported schemes and platforms without spawning a process', async () => {
    await expect(openInBrowser('file:///tmp/a', 'linux')).resolves.toBe(false);
    await expect(openInBrowser('http://app.example.com/device', 'linux')).resolves.toBe(false);
    await expect(openInBrowser('https://example.com', 'aix')).resolves.toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('allows loopback HTTP for a local verification server', async () => {
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = vi.fn();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'));
      return child;
    });
    await expect(openInBrowser('http://localhost:3000/device', 'linux')).resolves.toBe(true);
  });

  it('returns false when the platform opener cannot be started', async () => {
    spawnMock.mockReturnValue(undefined);
    await expect(openInBrowser('https://app.example.com/device', 'linux')).resolves.toBe(false);
  });
});
