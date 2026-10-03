import { afterEach, describe, expect, it, vi } from 'vitest';

import { assetCreateCommand, assetUpdateCommand } from '../src/commands/asset.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('asset write', () => {
  it('sends the idempotency key when creating an asset', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { id: 'a-1', code: 'AST-1', name: 'Payroll DB' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await assetCreateCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'Payroll DB',
      category: 'application',
      subCategory: 'database',
    });

    const body = requestBody(fetchMock.mock.calls[0]);
    expect(body.input).toEqual({
      name: 'Payroll DB',
      category: 'application',
      subCategory: 'database',
    });
    expect(body.idempotencyKey).toBeTruthy();
  });
});

describe('asset update confirmation', () => {
  it('applies only with the confirmation token and the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { assetId: 'a-1', changes: ['status'] },
          meta: { confirmation: { token: 'tok-asset', summary: 'Change status on asset AST-1.' } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { assetId: 'a-1', applied: ['status'], failed: [] } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await assetUpdateCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'AST-1',
      changes: { status: 'active' },
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.input).toEqual({ name: 'AST-1', changes: { status: 'active' } });
    expect(first.idempotencyKey).toBeTruthy();
    expect(second.confirmationToken).toBe('tok-asset');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
