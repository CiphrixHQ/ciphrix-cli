import { afterEach, describe, expect, it, vi } from 'vitest';

import { policyGetCommand, policyListCommand } from '../src/commands/policy.js';
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

describe('policy list', () => {
  it('renders a table with counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: 'ok',
          data: {
            total: 1,
            counts: { draft: 1 },
            policies: [{ id: 'p-1', name: 'Backup Policy', status: 'draft', isPublished: false }],
          },
        }),
      ),
    );
    const { io, out, store } = setup();

    await policyListCommand({ io, store, apiUrl });

    expect(out.text).toContain('Documents');
    expect(out.text).toContain('Backup Policy');
    expect(out.text).toContain('draft');
  });
});

describe('policy get', () => {
  it('sends the name and prints Markdown', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'ok',
        data: {
          policy: {
            id: 'p-1',
            name: 'Backup Policy',
            status: 'draft',
            currentVersion: { contentMarkdown: '# Backup Policy\n\nNightly backups.' },
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await policyGetCommand({ io, store, apiUrl, policy: 'Backup Policy' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ input: { name: 'Backup Policy' } });
    expect(out.text).toContain('Backup Policy');
    expect(out.text).toContain('Nightly backups.');
  });

  it('sends an id when a UUID is given', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { policy: { name: 'X', currentVersion: {} } } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await policyGetCommand({ io, store, apiUrl, policy: '11111111-1111-1111-1111-111111111111' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      input: { policyId: '11111111-1111-1111-1111-111111111111' },
    });
  });

  it('surfaces a not-found error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { status: 'error', error: { code: 'not_found', message: 'Policy not found' } },
            404,
          ),
        ),
    );
    const { io, store } = setup();

    await expect(policyGetCommand({ io, store, apiUrl, policy: 'missing' })).rejects.toThrow(
      /Policy not found/,
    );
  });
});

describe('policy list --json', () => {
  it('emits the data payload without the response envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: 'ok',
          data: {
            total: 1,
            counts: { draft: 1 },
            policies: [{ id: 'p-1', name: 'Backup Policy' }],
          },
          meta: { total: 1 },
        }),
      ),
    );
    const { io, out, store } = setup();

    await policyListCommand({ io, store, apiUrl, json: true });

    const parsed = JSON.parse(out.text) as Record<string, unknown>;
    expect(parsed.policies).toHaveLength(1);
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('data');
  });
});
