import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clauseAvailableItemsCommand,
  clauseLinkCommand,
  clauseUpdateCommand,
} from '../src/commands/framework.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

const preflight = (summary: string) =>
  jsonResponse({
    status: 'ok',
    data: { frameworkId: 'f-1', clauseId: 'c-1' },
    meta: { confirmation: { token: 'tok-clause', summary } },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clause update confirmation', () => {
  it('sends the write input and idempotency key, then applies with the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflight('Change applicability on CC6.1.'))
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { frameworkId: 'f-1', clauseId: 'c-1', applied: ['applicability'] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await clauseUpdateCommand({
      io,
      credentialStore: store,
      apiUrl,
      framework: 'SOC 2',
      clause: 'CC6.1',
      changes: { applicability: 'in_scope' },
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.input).toEqual({
      framework: 'SOC 2',
      clause: 'CC6.1',
      changes: { applicability: 'in_scope' },
    });
    expect(first.idempotencyKey).toBeTruthy();
    expect(second.confirmationToken).toBe('tok-clause');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});

describe('clause link confirmation', () => {
  it('applies the link with the confirmation token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflight('Link test to CC6.1.'))
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { frameworkId: 'f-1', clauseId: 'c-1' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await clauseLinkCommand({
      io,
      credentialStore: store,
      apiUrl,
      framework: 'SOC 2',
      clause: 'CC6.1',
      action: 'link',
      itemType: 'test',
      itemId: 't-1',
      yes: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.input).toEqual({
      framework: 'SOC 2',
      clause: 'CC6.1',
      action: 'link',
      itemType: 'test',
      itemId: 't-1',
    });
    expect(second.confirmationToken).toBe('tok-clause');
  });
});

describe('clause available pagination', () => {
  it('passes page and limit and shows the page footer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'ok',
        data: {
          frameworkId: 'f-1',
          clauseId: 'c-1',
          itemType: 'test',
          items: [
            { id: 't-1', name: 'T1' },
            { id: 't-2', name: 'T2' },
          ],
          total: 40,
          page: 1,
          limit: 2,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { io, out, store } = setup();

    await clauseAvailableItemsCommand({
      io,
      credentialStore: store,
      apiUrl,
      framework: 'SOC 2',
      clause: 'CC6.1',
      itemType: 'test',
      page: 1,
      limit: 2,
    });

    expect(requestBody(fetchMock.mock.calls[0]).input).toEqual({
      framework: 'SOC 2',
      clause: 'CC6.1',
      itemType: 'test',
      page: 1,
      limit: 2,
    });
    expect(out.text).toContain('of 40');
    expect(out.text).toContain('next: --page 2');
  });
});
