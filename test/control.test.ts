import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  controlAvailableItemsCommand,
  controlLinkCommand,
  controlListCommand,
  controlUpdateCommand,
} from '../src/commands/control.js';
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
      changes: {
        applicability: 'out_of_scope',
        justification: 'Not applicable',
        description: 'Rewritten',
      },
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.input).toEqual({
      name: 'Control 1',
      changes: {
        applicability: 'out_of_scope',
        justification: 'Not applicable',
        description: 'Rewritten',
      },
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

describe('control list filters', () => {
  it('sends owner ids as a list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { controls: [], total: 0, page: 1, limit: 25 } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await controlListCommand({ io, credentialStore: store, apiUrl, ownerId: 'u-1, u-2' });

    expect(requestBody(fetchMock.mock.calls[0]).input).toEqual({ ownerId: ['u-1', 'u-2'] });
  });
});

describe('control available pagination', () => {
  it('passes page and limit and shows the page footer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'ok',
        data: {
          controlId: 'ctrl-1',
          itemType: 'test',
          items: [
            { id: 't-1', name: 'T1', status: 'active' },
            { id: 't-2', name: 'T2', status: 'active' },
          ],
          total: 40,
          page: 1,
          limit: 2,
          hasMore: true,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await controlAvailableItemsCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'Control 1',
      itemType: 'test',
      page: 1,
      limit: 2,
    });

    expect(requestBody(fetchMock.mock.calls[0]).input).toEqual({
      name: 'Control 1',
      itemType: 'test',
      page: 1,
      limit: 2,
    });
    expect(out.text).toContain('of 40');
    expect(out.text).toContain('next: --page 2');
  });
});
