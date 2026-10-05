import { afterEach, describe, expect, it, vi } from 'vitest';

import { contextResetCommand, contextSetCommand } from '../src/commands/context.js';
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

describe('context set', () => {
  it('sends the idempotency key required for write tools', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'ok',
        data: { store: 'business', questionId: 'company_size', saved: true },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await contextSetCommand({
      io,
      credentialStore: store,
      apiUrl,
      target: 'business.company_size',
      value: '50-200',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/tools/v1/set_context_answer');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.input).toEqual({ store: 'business', questionId: 'company_size', value: '50-200' });
    expect(typeof body.idempotencyKey).toBe('string');
    expect(body.idempotencyKey).not.toBe('');
    expect(out.text).toContain('business.company_size saved');
  });

  it('surfaces a tool error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { status: 'error', error: { code: 'invalid_input', message: 'Invalid value' } },
            400,
          ),
        ),
    );
    const { io, store } = setup();

    await expect(
      contextSetCommand({
        io,
        credentialStore: store,
        apiUrl,
        target: 'business.company_size',
        value: 'x',
      }),
    ).rejects.toThrow(/Invalid value/);
  });
});

describe('context reset', () => {
  it('preflights, then applies with the confirmation token and an idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { store: 'business' },
          meta: {
            confirmation: { token: 'tok-1', summary: 'Reset all Business Context answers.' },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { store: 'business', status: 'reset' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await contextResetCommand({ io, credentialStore: store, apiUrl, yes: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toBe('https://api.example.com/api/tools/v1/reset_context');
    const first = JSON.parse(firstInit.body as string) as Record<string, unknown>;
    expect(first.input).toEqual({ store: 'business' });
    expect(typeof first.idempotencyKey).toBe('string');
    expect(first.confirmationToken).toBeUndefined();

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const second = JSON.parse(secondInit.body as string) as Record<string, unknown>;
    expect(second.confirmationToken).toBe('tok-1');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(out.text).toContain('Business Context reset');
  });

  it('cancels without a second request when the user declines', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        status: 'ok',
        data: { store: 'business' },
        meta: { confirmation: { token: 'tok-1', summary: 'Reset all Business Context answers.' } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await contextResetCommand({
      io,
      credentialStore: store,
      apiUrl,
      confirm: () => Promise.resolve(false),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.text).toContain('Cancelled.');
  });
});
