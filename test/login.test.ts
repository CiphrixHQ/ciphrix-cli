import { afterEach, describe, expect, it, vi } from 'vitest';

import { loginCommand } from '../src/commands/login.js';
import type { CliIO } from '../src/io.js';
import { createTheme } from '../src/theme.js';

class Capture {
  private readonly chunks: string[] = [];
  isTTY = false;

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }

  text(): string {
    return this.chunks.join('');
  }
}

const captureIO = (): { io: CliIO; out: Capture } => {
  const out = new Capture();
  const err = new Capture();
  return {
    io: {
      stdout: out as unknown as NodeJS.WriteStream,
      stderr: err as unknown as NodeJS.WriteStream,
      theme: createTheme(false),
    },
    out,
  };
};

const response = (payload: unknown, status = 200): Response =>
  new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('loginCommand browser behavior', () => {
  afterEach(() => vi.unstubAllGlobals());

  const setup = () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          device_code: 'device',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://app.example.com/device',
          verification_uri_complete: 'https://app.example.com/device?code=ABCD-EFGH',
          interval: 1,
          expires_in: 600,
        }),
      )
      .mockResolvedValueOnce(response({ access_token: 'secret-token' }))
      .mockResolvedValueOnce(response(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    const store = { get: vi.fn(), set: vi.fn(), clear: vi.fn() };
    return { fetchMock, store };
  };

  it('attempts to open the complete verification link by default and still prints URL and code', async () => {
    const { store } = setup();
    const { io, out } = captureIO();
    const openBrowser = vi.fn().mockResolvedValue(true);

    await loginCommand({ io, apiUrl: 'https://api.example.com/api', store, openBrowser });

    expect(openBrowser).toHaveBeenCalledWith('https://app.example.com/device?code=ABCD-EFGH');
    expect(out.text()).toContain('https://app.example.com/device?code=ABCD-EFGH');
    expect(out.text()).toContain('ABCD-EFGH');
  });

  it('does not attempt to open a browser when noOpen is selected', async () => {
    const { store } = setup();
    const { io, out } = captureIO();
    const openBrowser = vi.fn().mockResolvedValue(true);

    await loginCommand({
      io,
      apiUrl: 'https://api.example.com/api',
      store,
      noOpen: true,
      openBrowser,
    });

    expect(openBrowser).not.toHaveBeenCalled();
    expect(out.text()).toContain('https://app.example.com/device?code=ABCD-EFGH');
    expect(out.text()).toContain('ABCD-EFGH');
  });

  it('continues when browser launch fails and prints only generic fallback guidance', async () => {
    const { store } = setup();
    const { io, out } = captureIO();
    const openBrowser = vi.fn().mockResolvedValue(false);

    await loginCommand({ io, apiUrl: 'https://api.example.com/api', store, openBrowser });

    expect(out.text()).toContain('Could not open a browser automatically. Open the link above.');
    expect(out.text()).toContain('Signed in');
    expect(out.text()).not.toContain('xdg-open');
    expect(out.text()).not.toContain('platform-specific');
  });
});
