import { afterEach, describe, expect, it, vi } from 'vitest';

import { vendorCreateCommand, vendorDeleteCommand } from '../src/commands/vendor.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('vendor write', () => {
  it('sends the idempotency key when creating a vendor', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { id: 'v-1', name: 'Acme', status: 'created' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await vendorCreateCommand({ io, credentialStore: store, apiUrl, name: 'Acme' });

    const body = requestBody(fetchMock.mock.calls[0]);
    expect(body.input).toEqual({ name: 'Acme' });
    expect(body.idempotencyKey).toBeTruthy();
  });

  it('sends the optional creation fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', data: { id: 'v-1', name: 'Acme', status: 'created' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await vendorCreateCommand({
      io,
      credentialStore: store,
      apiUrl,
      name: 'Acme',
      category: 'software',
      subcategory: 'saas',
      criticality: 'high',
      dataSensitivity: 'confidential',
      serviceAvailability: 'business_hours',
      description: 'A vendor',
    });

    expect(requestBody(fetchMock.mock.calls[0]).input).toEqual({
      name: 'Acme',
      category: 'software',
      subcategory: 'saas',
      criticality: 'high',
      dataSensitivity: 'confidential',
      serviceAvailability: 'business_hours',
      description: 'A vendor',
    });
  });
});

describe('vendor delete confirmation', () => {
  it('applies only with the confirmation token and the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          data: { id: 'v-1', name: 'Acme' },
          meta: { confirmation: { token: 'tok-vendor', summary: 'Delete the vendor "Acme".' } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: 'ok', data: { id: 'v-1', status: 'deleted' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { io, store } = setup();

    await vendorDeleteCommand({ io, credentialStore: store, apiUrl, name: 'Acme', yes: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0]);
    const second = requestBody(fetchMock.mock.calls[1]);
    expect(first.idempotencyKey).toBeTruthy();
    expect(first.confirmationToken).toBeUndefined();
    expect(second.confirmationToken).toBe('tok-vendor');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
