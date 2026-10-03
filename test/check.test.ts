import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkSetEnabledCommand } from '../src/commands/check.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('check enable/disable confirmation', () => {
  it('sends the write input and idempotency key, then applies with the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { checkId: 'chk-1', enabled: false },
          meta: { confirmation: { token: 'tok-check', summary: 'Disable the check CHK-1.' } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { checkId: 'chk-1', enabled: false } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await checkSetEnabledCommand({
      io,
      credentialStore: store,
      apiUrl,
      check: 'CHK-1',
      enabled: false,
      notes: 'Temporary',
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.input).toEqual({ name: 'CHK-1', enabled: false, notes: 'Temporary' });
    expect(first.idempotencyKey).toBeTruthy();
    expect(second.confirmationToken).toBe('tok-check');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
