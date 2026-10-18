import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTool } from '../src/actions.js';
import { createApiClient } from '../src/api.js';
import { getManifest, getTool, resolveBinding } from '../src/manifest.js';
import { callTool, type ToolContext } from '../src/toolSurface.js';
import { apiUrl, jsonResponse, setup, requestBody } from './helpers.js';

afterEach(() => vi.unstubAllGlobals());
const descriptor = (overrides: Record<string, unknown> = {}) => ({
  name: 'synthetic_operation',
  version: 1,
  description: 'Synthetic public fixture.',
  effect: 'write',
  confirmation: 'preflight_confirm',
  inputSchema: { type: 'object' },
  cli: { group: ['example'], operation: 'change' },
  ...overrides,
});
const manifest = (tools: unknown[] = [descriptor()]) => ({
  manifestVersion: 1,
  apiVersion: 'v1',
  tools,
});
const context = (): ToolContext => ({
  baseUrl: apiUrl,
  client: createApiClient(apiUrl),
  token: 'synthetic-token',
});

describe('manifest contract and invocation boundaries', () => {
  it('does not break supported commands when an unrelated future tool version is advertised', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            manifest([
              descriptor({
                name: 'future_operation',
                version: 2,
                cli: { group: ['future'], operation: 'read' },
              }),
              descriptor(),
            ]),
          ),
        ),
      ),
    );
    const ctx = context();
    expect((await getTool(ctx, 'synthetic_operation')).version).toBe(1);
    await expect(getTool(ctx, 'future_operation')).rejects.toThrow(/version is not supported/);
  });

  it('invalidates context-local discovery if credentials change', async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`${apiUrl}/tools/v1`);
      expect(init.headers).toBeDefined();
      return Promise.resolve(jsonResponse(manifest()));
    });
    vi.stubGlobal('fetch', fetchMock);
    const ctx = context();
    await getManifest(ctx);
    ctx.token = 'another-synthetic-token';
    await getManifest(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1].headers).toMatchObject({
      authorization: 'Bearer another-synthetic-token',
    });
  });

  it('bounds tool counts and schema nesting before any operation', async () => {
    const deep: Record<string, unknown> = {};
    let current = deep;
    for (let index = 0; index < 35; index++) {
      const child = {};
      current.properties = { nested: child };
      current = child;
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(manifest([descriptor({ inputSchema: deep })])))),
    );
    await expect(getManifest(context())).rejects.toThrow(/nesting limit/);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse(manifest(Array.from({ length: 1025 }, () => descriptor())))),
      ),
    );
    await expect(getManifest(context())).rejects.toThrow(/Unsupported tool manifest/);
  });
  it.each([
    { manifestVersion: 2, apiVersion: 'v1', tools: [] },
    { manifestVersion: 1, apiVersion: 'v2', tools: [] },
    manifest([descriptor({ version: 0 })]),
    manifest([descriptor(), descriptor()]),
    manifest([descriptor(), descriptor({ name: 'second_operation' })]),
    manifest([descriptor({ cli: { group: ['invalid segment'], operation: 'change' } })]),
    manifest([descriptor({ effect: 'unknown' })]),
    manifest([descriptor({ confirmation: 'unknown' })]),
  ])('rejects unsupported/malformed manifests without a domain request', async (payload) => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(payload)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getManifest(context())).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches only within one authenticated context and resolves names from bindings', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(manifest())));
    vi.stubGlobal('fetch', fetchMock);
    const ctx = context();
    expect((await resolveBinding(ctx, ['example'], 'change')).name).toBe('synthetic_operation');
    await getTool(ctx, 'synthetic_operation');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getManifest(context());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(resolveBinding(ctx, ['missing'], 'change')).rejects.toThrow(/not supported/);
  });

  it('rejects a write without a key based on its discovered effect, not its name', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(manifest([descriptor({ name: 'looks_like_a_read' })]))),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(callTool(context(), 'looks_like_a_read', {})).rejects.toThrow(/idempotency key/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never falls back to a domain route for missing/destructive operations', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(manifest([descriptor({ effect: 'destructive' })]))),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(getTool(context(), 'missing')).rejects.toThrow(/not available/);
    await expect(getTool(context(), 'synthetic_operation')).rejects.toThrow(/not available/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retains confirmation and key only for the invocation and supports explicit cancellation', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        jsonResponse(
          url.endsWith('/tools/v1')
            ? manifest()
            : {
                status: 'ok',
                data: {},
                meta: {
                  confirmation: {
                    token: 'synthetic-confirmation',
                    summary: 'Review synthetic change',
                  },
                },
              },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out } = setup();
    const result = await applyTool({
      ctx: context(),
      io,
      toolName: 'synthetic_operation',
      input: { selected: ['one'] },
      fallback: 'Failed',
      confirm: () => Promise.resolve(false),
    });
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.text).toContain('Cancelled');
    expect(out.text).not.toContain('synthetic-confirmation');
  });

  it('does not treat an expired/conflicting preflight as permission to replay with a new key', async () => {
    const envelope = {
      status: 'error',
      error: { code: 'conflict_stale', message: 'Read current state.' },
    };
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        jsonResponse(
          url.endsWith('/tools/v1') ? manifest() : envelope,
          url.endsWith('/tools/v1') ? 200 : 409,
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      applyTool({
        ctx: context(),
        io: setup().io,
        toolName: 'synthetic_operation',
        input: {},
        fallback: 'Failed',
        yes: true,
        idempotencyKey: 'same-operation',
      }),
    ).rejects.toMatchObject({ code: 'conflict_stale', envelope });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock.mock.calls[1])).toMatchObject({
      idempotencyKey: 'same-operation',
    });
  });
});
