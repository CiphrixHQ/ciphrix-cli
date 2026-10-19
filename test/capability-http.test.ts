import { Command } from 'commander';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';

import { createApiClient } from '../src/api.js';
import { registerCapabilities } from '../src/commands/capabilities.js';
import { setup } from './helpers.js';

describe('CLI over the actual HTTP boundary with synthetic fixtures', () => {
  it('discovers a binding, preflights and confirms without retrying or fetching signed references', async () => {
    const calls: {
      path: string;
      method: string;
      body: Record<string, unknown>;
      authorization: string | undefined;
    }[] = [];
    const tool = {
      name: 'synthetic_create',
      version: 1,
      description: 'Synthetic write fixture.',
      effect: 'write',
      confirmation: 'preflight_confirm',
      inputSchema: { type: 'object' },
      cli: { group: ['access', 'resource'], operation: 'create' },
    };
    const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
      const text = Buffer.concat(chunks).toString('utf8');
      const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      calls.push({
        path: request.url ?? '',
        method: request.method ?? '',
        body,
        authorization: request.headers.authorization,
      });
      response.setHeader('content-type', 'application/json');
      if (request.url === '/api/tools/v1')
        response.end(JSON.stringify({ manifestVersion: 1, apiVersion: 'v1', tools: [tool] }));
      else if (!body.confirmationToken)
        response.end(
          JSON.stringify({
            status: 'ok',
            data: { selected: 'Synthetic' },
            meta: {
              confirmation: {
                token: 'synthetic-confirmation',
                summary: 'Create selected synthetic record',
              },
            },
          }),
        );
      else
        response.end(
          JSON.stringify({
            status: 'ok',
            data: { id: 'synthetic-id', downloadUrl: 'https://files.example.com/synthetic' },
            warnings: ['Inspect the result.'],
          }),
        );
    };
    const server = createServer((request, response) => {
      void handle(request, response).catch(() => {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: 'Synthetic fixture failed' }));
      });
    });
    server.listen({ host: 'localhost', port: 0 });
    await once(server, 'listening');
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
      const baseUrl = `http://localhost:${address.port}/api`;
      const { io, out } = setup();
      const program = new Command().exitOverride();
      registerCapabilities(program, io, () =>
        Promise.resolve({ baseUrl, client: createApiClient(baseUrl), token: 'synthetic-token' }),
      );
      await program.parseAsync(
        [
          'access',
          'resource',
          'create',
          '--name',
          'Synthetic',
          '--yes',
          '--json',
          '--idempotency-key',
          'synthetic-key',
        ],
        { from: 'user' },
      );
      expect(calls.map((call) => [call.method, call.path])).toEqual([
        ['GET', '/api/tools/v1'],
        ['POST', '/api/tools/v1/synthetic_create'],
        ['POST', '/api/tools/v1/synthetic_create'],
      ]);
      expect(calls.every((call) => call.authorization === 'Bearer synthetic-token')).toBe(true);
      expect(calls[2]!.body).toEqual({
        ...calls[1]!.body,
        confirmationToken: 'synthetic-confirmation',
      });
      expect(JSON.parse(out.text)).toMatchObject({
        status: 'ok',
        warnings: ['Inspect the result.'],
      });
      expect(out.text).not.toContain('synthetic-token');
      expect(out.text).not.toContain('synthetic-confirmation');
    } finally {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }
  });
});
