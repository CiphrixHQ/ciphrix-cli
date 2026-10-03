import { afterEach, describe, expect, it, vi } from 'vitest';

import { testRunCreateCommand, testUpdateCommand } from '../src/commands/test.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('test run write', () => {
  it('sends the idempotency key when creating a run', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { testId: 't-1', runId: 'r-1', status: 'created' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await testRunCreateCommand({ io, credentialStore: store, apiUrl, name: 'MFA enforced' });

    const body = requestBody(fetchMock.mock.calls[0]);
    expect(body.input).toEqual({ name: 'MFA enforced' });
    expect(body.idempotencyKey).toBeTruthy();
  });
});

describe('test update confirmation', () => {
  it('applies only with the confirmation token and the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { testId: 't-1' },
          meta: {
            confirmation: { token: 'tok-2', summary: 'Change applicability on MFA enforced.' },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { id: 't-1', applied: ['applicability'] } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await testUpdateCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'MFA enforced',
      changes: { applicability: 'in_scope' },
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.idempotencyKey).toBeTruthy();
    expect(first.confirmationToken).toBeUndefined();
    expect(second.confirmationToken).toBe('tok-2');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
