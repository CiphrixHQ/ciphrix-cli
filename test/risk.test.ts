import { afterEach, describe, expect, it, vi } from 'vitest';

import { riskListCommand, riskUpdateCommand } from '../src/commands/risk.js';
import type { CredentialStore } from '../src/credentials.js';
import type { CliIO } from '../src/io.js';
import { createTheme } from '../src/theme.js';

class Capture {
  text = '';
  isTTY = false;

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }
}

const setup = () => {
  const out = new Capture();
  const err = new Capture();
  const io = { stdout: out, stderr: err, theme: createTheme(false) } as unknown as CliIO;
  const store = {
    get: () => Promise.resolve({ apiUrl: 'https://api.example.com/api', token: 'token' }),
    set: () => Promise.resolve(),
    clear: () => Promise.resolve(),
  } as unknown as CredentialStore;
  return { io, out, err, store };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const apiUrl = 'https://api.example.com/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('risk list', () => {
  it('renders a table with a pagination footer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: 'ok',
          data: {
            total: 15,
            page: 1,
            limit: 25,
            hasMore: false,
            risks: [
              {
                id: 'r-1',
                title: 'Cloud permission sprawl',
                status: 'open',
                category: 'technology',
                businessUnit: 'Eng',
                score: 16,
              },
            ],
          },
        }),
      ),
    );
    const { io, out, store } = setup();

    await riskListCommand({ io, credentialStore: store, apiUrl });

    expect(out.text).toContain('Cloud permission sprawl');
    expect(out.text).toContain('showing 1–1 of 15');
  });
});

describe('risk update', () => {
  it('sends a whitelist patch and reports applied fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { id: 'r-1', applied: ['status'], failed: [] } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await riskUpdateCommand({
      io,
      credentialStore: store,
      apiUrl,
      risk: 'Cloud permission sprawl',
      changes: { status: 'closed' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      input: { title: 'Cloud permission sprawl', changes: { status: 'closed' } },
    });
    expect(out.text).toContain('status');
  });

  it('requires at least one field', async () => {
    const { io, store } = setup();
    await expect(
      riskUpdateCommand({ io, credentialStore: store, apiUrl, risk: 'x', changes: {} }),
    ).rejects.toThrow(/at least one field/);
  });

  it('surfaces a tool error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            status: 'error',
            error: { code: 'forbidden_scope', message: 'Missing scope: risk:write' },
          },
          403,
        ),
      ),
    );
    const { io, store } = setup();

    await expect(
      riskUpdateCommand({
        io,
        credentialStore: store,
        apiUrl,
        risk: 'x',
        changes: { status: 'closed' },
      }),
    ).rejects.toThrow(/Missing scope/);
  });
});
