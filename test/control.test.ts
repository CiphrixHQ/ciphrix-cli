import { afterEach, describe, expect, it, vi } from 'vitest';

import { controlLinkCommand, controlUpdateCommand } from '../src/commands/control.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

const preflight = (summary: string) =>
  jsonResponse({
    status: 'ok',
    data: { id: 'ctrl-1' },
    meta: { confirmation: { token: 'tok-control', summary } },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('control update confirmation', () => {
  it('sends the write input and idempotency key, then applies with the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflight('Change applicability on Control 1.'))
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { id: 'ctrl-1', applied: ['applicability'] } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await controlUpdateCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'Control 1',
      changes: { applicability: 'out_of_scope', justification: 'Not applicable' },
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.input).toEqual({
      name: 'Control 1',
      changes: { applicability: 'out_of_scope', justification: 'Not applicable' },
    });
    expect(first.idempotencyKey).toBeTruthy();
    expect(second.confirmationToken).toBe('tok-control');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});

describe('control link confirmation', () => {
  it('applies the link with the confirmation token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflight('Link test to Control 1.'))
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { id: 'ctrl-1', action: 'link', itemType: 'test', itemId: 't-1' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await controlLinkCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'Control 1',
      action: 'link',
      itemType: 'test',
      itemId: 't-1',
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock.mock.calls[1]).confirmationToken).toBe('tok-control');
  });
});
