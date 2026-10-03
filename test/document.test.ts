import { afterEach, describe, expect, it, vi } from 'vitest';

import { policyCreateCommand, policyDeleteCommand } from '../src/commands/policyActions.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('document write', () => {
  it('sends the idempotency key when creating a document', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { name: 'Backup Policy', created: true } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await policyCreateCommand({ io, store, apiUrl, name: 'Backup Policy' });

    const body = requestBody(fetchMock.mock.calls[0]);
    expect(body.input).toEqual({ name: 'Backup Policy' });
    expect(body.idempotencyKey).toBeTruthy();
  });
});

describe('document delete confirmation', () => {
  it('applies only with the confirmation token and the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { policyId: 'p-1', name: 'Backup Policy' },
          meta: {
            confirmation: {
              token: 'tok-1',
              summary: 'Permanently delete the policy "Backup Policy".',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { policyId: 'p-1', name: 'Backup Policy', status: 'deleted' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await policyDeleteCommand({ io, store, apiUrl, policy: 'Backup Policy', yes: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.idempotencyKey).toBeTruthy();
    expect(first.confirmationToken).toBeUndefined();
    expect(second.confirmationToken).toBe('tok-1');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
