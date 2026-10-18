import { withLegacyManifest } from './legacyManifest.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { callTool, resolveToolContext } from '../src/toolSurface.js';
import { getManifest } from '../src/manifest.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tool surface write guard', () => {
  it('refuses a write tool without an idempotency key, before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', withLegacyManifest(fetchMock));
    const { store } = setup();
    const ctx = await resolveToolContext(apiUrl, store);

    await expect(
      callTool(ctx, 'set_context_answer', {
        store: 'business',
        questionId: 'company_size',
        value: 'x',
      }),
    ).rejects.toThrow(/idempotency key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a read through without an idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', data: {} }));
    vi.stubGlobal('fetch', withLegacyManifest(fetchMock));
    const { store } = setup();
    const ctx = await resolveToolContext(apiUrl, store);

    await callTool(ctx, 'get_context', { store: 'business' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(fetchMock.mock.calls[0])).not.toHaveProperty('idempotencyKey');
  });

  it('sends the idempotency key for a write when one is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', data: {} }));
    vi.stubGlobal('fetch', withLegacyManifest(fetchMock));
    const { store } = setup();
    const ctx = await resolveToolContext(apiUrl, store);

    await callTool(
      ctx,
      'set_context_answer',
      { store: 'business', questionId: 'company_size', value: 'x' },
      { idempotencyKey: 'idem-1' },
    );

    expect(requestBody(fetchMock.mock.calls[0]).idempotencyKey).toBe('idem-1');
  });

  it('discovers the write effects the commands use from the manifest', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', withLegacyManifest(fetchMock));
    const { store } = setup();
    const tools = await getManifest(await resolveToolContext(apiUrl, store));
    for (const name of [
      'set_context_answer',
      'create_document',
      'edit_document_content',
      'create_test_run',
      'attach_run_item',
      'update_clause',
      'update_control',
      'create_vendor',
      'update_risk',
      'set_check_enabled',
      'create_asset',
      'set_asset_tag',
    ]) {
      expect(tools.find((tool) => tool.name === name)?.effect).toBe('write');
    }
  });
});
