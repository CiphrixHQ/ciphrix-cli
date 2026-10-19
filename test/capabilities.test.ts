import { Command } from 'commander';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../src/api.js';
import { registerCapabilities, RenderedCommandError } from '../src/commands/capabilities.js';
import { capabilities, onboardingOperations } from '../src/commands/capabilityDefinitions.js';
import type { ToolContext } from '../src/toolSurface.js';
import { apiUrl, jsonResponse, setup, requestBody } from './helpers.js';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cli-input-'));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

const fixture = (path: string, effect = 'read', confirmation = 'none') => {
  const parts = path.split(' ');
  const operation = parts.pop()!;
  const tool = {
    name: 'fixture_operation',
    version: 1,
    effect,
    confirmation,
    description: 'Synthetic operation fixture.',
    inputSchema: { type: 'object', properties: { purpose: { enum: ['documents'] } } },
    cli: { group: parts, operation },
  };
  const calls: [string, RequestInit][] = [];
  const response = {
    status: 'ok',
    data: { marker: 'synthetic', hasMore: true, nextCursor: 'next' },
    meta: { truncated: true },
    warnings: ['Review the result.'],
  };
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    if (url.endsWith('/tools/v1'))
      return Promise.resolve(jsonResponse({ manifestVersion: 1, apiVersion: 'v1', tools: [tool] }));
    calls.push([url, init]);
    const body =
      typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (confirmation !== 'none' && !body.confirmationToken)
      return Promise.resolve(
        jsonResponse({
          status: 'ok',
          data: {},
          meta: {
            confirmation: {
              token: 'synthetic-confirmation',
              summary: 'Review the selected operation.',
            },
          },
        }),
      );
    return Promise.resolve(jsonResponse(response));
  });
  vi.stubGlobal('fetch', fetchMock);
  const { io, out, err } = setup();
  const ctx: ToolContext = {
    baseUrl: apiUrl,
    client: createApiClient(apiUrl),
    token: 'synthetic-token',
  };
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeOut: (text) => out.write(text), writeErr: (text) => err.write(text) });
  registerCapabilities(program, io, () => Promise.resolve(ctx));
  return { program, calls, out, err, tool, fetchMock, response, ctx };
};

describe('capability grammar and manifest-owned dispatch', () => {
  it.each([
    { status: 'ok', httpStatus: 200 },
    { status: 'error', httpStatus: 200 },
    { status: 'error', httpStatus: 409 },
  ])(
    'preserves safe single-line JSON for $status envelopes over HTTP $httpStatus',
    async ({ status, httpStatus }) => {
      const test = fixture('task list');
      const controls = Array.from({ length: 32 }, (_unused, index) =>
        String.fromCharCode(0x80 + index),
      ).join('');
      const value = `Synthetic ${controls} value\nwith a newline`;
      const envelope = {
        status,
        ...(status === 'ok'
          ? { data: { label: value, nested: [{ [value]: value }] }, warnings: [value] }
          : { error: { code: 'invalid_state', message: value, details: { [value]: value } } }),
      };
      const original = test.fetchMock.getMockImplementation()!;
      test.fetchMock.mockImplementation((url, init) =>
        url.endsWith('/tools/v1')
          ? original(url, init)
          : Promise.resolve(jsonResponse(envelope, httpStatus)),
      );
      const invocation = test.program.parseAsync(['task', 'list', '--json'], { from: 'user' });
      if (status === 'ok') await invocation;
      else await expect(invocation).rejects.toBeInstanceOf(RenderedCommandError);
      expect(
        [...test.out.text].some((character) => {
          const code = character.charCodeAt(0);
          return code >= 0x80 && code <= 0x9f;
        }),
      ).toBe(false);
      expect(test.out.text.split('\n')).toHaveLength(2);
      expect(test.out.text.endsWith('\n')).toBe(true);
      expect(JSON.parse(test.out.text)).toEqual(envelope);
      expect(test.err.text).toBe('');
    },
  );

  it('rejects an invalid write key before resolving capabilities or applying a change', async () => {
    const test = fixture('file process', 'write');
    await expect(
      test.program.parseAsync(
        ['file', 'process', '--upload', 'synthetic', '--idempotency-key', ' ', '--json'],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(test.out.text)).toMatchObject({ error: { code: 'invalid_input' } });
  });
  it('does not misreport a plain HTTP denial as a network failure or a missing record', async () => {
    const test = fixture('task list');
    const original = test.fetchMock.getMockImplementation()!;
    test.fetchMock.mockImplementation((url, init) =>
      url.endsWith('/tools/v1')
        ? original(url, init)
        : Promise.resolve(jsonResponse({ message: 'Not authorized' }, 403)),
    );
    await expect(
      test.program.parseAsync(['task', 'list', '--json'], { from: 'user' }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(JSON.parse(test.out.text)).toMatchObject({
      status: 'error',
      error: { code: 'http_error', httpStatus: 403 },
    });
    expect(test.fetchMock).toHaveBeenCalledTimes(2);
  });
  it('refuses conflicting onboarding intents before resolving credentials or invoking tools', async () => {
    const test = fixture('onboarding status');
    await expect(
      test.program.parseAsync(['onboarding', '--status', '--complete', '--json'], { from: 'user' }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(test.out.text)).toMatchObject({ error: { code: 'invalid_input' } });
  });

  it('renders human errors on stderr without losing structured onboarding state', async () => {
    const test = fixture('onboarding status');
    const original = test.fetchMock.getMockImplementation()!;
    test.fetchMock.mockImplementation((url, init) =>
      url.endsWith('/tools/v1')
        ? original(url, init)
        : Promise.resolve(
            jsonResponse(
              {
                status: 'error',
                error: {
                  code: 'invalid_state',
                  message: 'Read readiness',
                  details: { onboarding: { ready: false } },
                },
              },
              409,
            ),
          ),
    );
    await expect(
      test.program.parseAsync(['onboarding', '--status'], { from: 'user' }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.out.text).toBe('');
    expect(test.err.text).toContain('onboarding');
  });

  it('does not turn historical failures in a successful read into a failed mutation', async () => {
    const test = fixture('access import get');
    Object.assign(test.response.data, { failures: [{ reason: 'Historical processing outcome' }] });
    await test.program.parseAsync(['access', 'import', 'get', 'synthetic', '--json'], {
      from: 'user',
    });
    expect(JSON.parse(test.out.text)).toEqual(test.response);
  });

  it('rejects oversized selected-row files and malformed integer options before requests', async () => {
    const path = join(directory, 'oversized.json');
    await writeFile(path, Buffer.alloc(1024 * 1024 + 1, ' '));
    const test = fixture('access import merge', 'write', 'preflight_confirm');
    await expect(
      test.program.parseAsync(
        ['access', 'import', 'merge', 'synthetic', '--rows-file', path, '--yes', '--json'],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.fetchMock).not.toHaveBeenCalled();
    const integer = fixture('access resource list');
    await expect(
      integer.program.parseAsync(['access', 'resource', 'list', '--page', '1.5', '--json'], {
        from: 'user',
      }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(integer.fetchMock).not.toHaveBeenCalled();
  });
  it.each(capabilities.filter((spec) => spec.path !== 'file stage'))(
    'maps $path through its discovered binding',
    async (spec) => {
      const test = fixture(spec.path);
      const args = [
        ...spec.path.split(' '),
        ...(spec.argument?.split(' ').map((name) => `${name}-fixture`) ?? []),
      ];
      const expected: Record<string, unknown> = {};
      for (const name of spec.argument?.split(' ') ?? []) expected[name] = `${name}-fixture`;
      for (const field of spec.fields.filter((field) => field.kind !== 'clear')) {
        let value = 'synthetic';
        if (field.kind === 'integer') value = '2';
        if (field.kind === 'json') value = '"replacement"';
        if (field.kind === 'file') {
          value = join(directory, 'rows.json');
          await writeFile(value, '[{"selected":"synthetic"}]');
        }
        args.push(`--${field.flag}`);
        if (field.kind !== 'boolean') args.push(value);
        expected[field.field] =
          field.kind === 'integer'
            ? 2
            : field.kind === 'json'
              ? 'replacement'
              : field.kind === 'file'
                ? [{ selected: 'synthetic' }]
                : field.kind === 'boolean'
                  ? true
                  : field.kind === 'repeat'
                    ? [value]
                    : value;
      }
      if (spec.path === 'access entry bulk-update') expected.operation = 'update';
      await test.program.parseAsync([...args, '--json'], { from: 'user' });
      expect(test.calls).toHaveLength(1);
      expect(test.calls[0]![0]).toBe(`${apiUrl}/tools/v1/fixture_operation`);
      expect(requestBody(test.calls[0])).toEqual({ input: expected, version: 1 });
      expect(JSON.parse(test.out.text)).toEqual(test.response);
      expect(test.err.text).toBe('');
    },
  );

  it('confirms once with identical input/key and preserves the complete JSON envelope', async () => {
    const test = fixture('access resource create', 'write', 'preflight_confirm');
    await test.program.parseAsync(
      [
        'access',
        'resource',
        'create',
        '--name',
        'Synthetic',
        '--yes',
        '--json',
        '--idempotency-key',
        'operation-key',
      ],
      { from: 'user' },
    );
    expect(test.calls).toHaveLength(2);
    const first = requestBody(test.calls[0]);
    expect(first).toEqual({
      input: { name: 'Synthetic' },
      version: 1,
      idempotencyKey: 'operation-key',
    });
    expect(requestBody(test.calls[1])).toEqual({
      ...first,
      confirmationToken: 'synthetic-confirmation',
    });
    expect(JSON.parse(test.out.text)).toEqual(test.response);
    expect(test.out.text).not.toContain('synthetic-confirmation');
    expect(test.fetchMock.mock.calls.filter(([url]) => url.endsWith('/tools/v1'))).toHaveLength(1);
  });

  it('applies an immediate write exactly once without a confirmation probe', async () => {
    const test = fixture('file process', 'write');
    await test.program.parseAsync(
      ['file', 'process', '--upload', 'one', '--upload', 'two', '--json'],
      { from: 'user' },
    );
    expect(test.calls).toHaveLength(1);
    expect(requestBody(test.calls[0]).input).toEqual({ uploadIds: ['one', 'two'] });
    expect(requestBody(test.calls[0]).idempotencyKey).toEqual(expect.any(String));
  });

  it('refuses confirmed JSON/non-interactive writes without explicit consent', async () => {
    const test = fixture('access review complete', 'write', 'preflight_confirm');
    await expect(
      test.program.parseAsync(['access', 'review', 'complete', 'TK-synthetic', '--json'], {
        from: 'user',
      }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.calls).toHaveLength(0);
    expect(JSON.parse(test.out.text)).toMatchObject({ error: { code: 'invalid_input' } });
  });

  it('preserves structured domain errors and never retries uncertain writes', async () => {
    const test = fixture('file process', 'write');
    const envelope = {
      status: 'error',
      error: {
        code: 'ambiguous',
        message: 'Inspect existing work.',
        details: { onboarding: { ready: false } },
      },
    };
    const original = test.fetchMock.getMockImplementation()!;
    test.fetchMock.mockImplementation((url, init) =>
      url.endsWith('/tools/v1')
        ? original(url, init)
        : Promise.resolve(jsonResponse(envelope, 409)),
    );
    await expect(
      test.program.parseAsync(['file', 'process', '--upload', 'synthetic', '--json'], {
        from: 'user',
      }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(JSON.parse(test.out.text)).toEqual(envelope);
    expect(test.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves partial outcomes and exits unsuccessfully rather than retrying rows', async () => {
    const test = fixture('file process', 'write');
    Object.assign(test.response.data, { failures: [{ id: 'synthetic', message: 'Needs review' }] });
    await expect(
      test.program.parseAsync(['file', 'process', '--upload', 'synthetic', '--json'], {
        from: 'user',
      }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(JSON.parse(test.out.text)).toEqual(test.response);
    expect(test.calls).toHaveLength(1);
  });

  it('rejects conflicting clears and preserves an explicit null', async () => {
    const test = fixture('access entry update', 'write', 'preflight_confirm');
    await expect(
      test.program.parseAsync(
        [
          'access',
          'entry',
          'update',
          'synthetic',
          '--expected-revision',
          '2',
          '--person',
          'person',
          '--clear-person',
          '--yes',
          '--json',
        ],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.calls).toHaveLength(0);
    const clear = fixture('access entry update', 'write', 'preflight_confirm');
    await clear.program.parseAsync(
      [
        'access',
        'entry',
        'update',
        'synthetic',
        '--expected-revision',
        '2',
        '--clear-person',
        '--yes',
        '--json',
      ],
      { from: 'user' },
    );
    expect(requestBody(clear.calls[1]).input).toEqual({
      accessId: 'synthetic',
      expectedRevision: 2,
      personId: null,
    });
  });

  it('rejects malformed and symlink JSON files before mutation', async () => {
    const path = join(directory, 'invalid.json');
    await writeFile(path, '{}');
    const test = fixture('access import merge', 'write', 'preflight_confirm');
    await expect(
      test.program.parseAsync(
        ['access', 'import', 'merge', 'synthetic', '--rows-file', path, '--yes', '--json'],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    const link = join(directory, 'link.json');
    await symlink(path, link);
    await expect(
      test.program.parseAsync(
        ['access', 'import', 'merge', 'synthetic', '--rows-file', link, '--yes', '--json'],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.calls).toHaveLength(0);
  });

  it('stages a bounded local file through the discovered multipart operation', async () => {
    const path = join(directory, 'synthetic.txt');
    await writeFile(path, 'Synthetic');
    const test = fixture('file stage', 'write');
    Object.assign(test.response.data, { uploadId: 'synthetic-upload' });
    await test.program.parseAsync(['file', 'stage', path, '--purpose', 'documents', '--json'], {
      from: 'user',
    });
    expect(test.calls).toHaveLength(1);
    const request = test.calls[0]![1];
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get('purpose')).toBe('documents');
    expect(request.headers).toMatchObject({
      authorization: 'Bearer synthetic-token',
      'idempotency-key': expect.any(String),
    });
  });

  it.each(onboardingOperations)(
    'dispatches onboarding --%s with its own status pack',
    async (operation) => {
      const mapped = operation === 'help-onboarding' ? 'help' : operation;
      const test = fixture(`onboarding ${mapped}`);
      const args = ['onboarding', `--${operation}`];
      const input: Record<string, unknown> = {};
      if (operation === 'get-context' || operation === 'set-context') {
        args.push('business');
        input.store = 'business';
      }
      if (operation === 'set-context') {
        args.push('--question', 'synthetic-question', '--value', 'false');
        input.questionId = 'synthetic-question';
        input.value = false;
      }
      if (operation === 'init-framework') {
        args.push('synthetic-code');
        input.frameworkCode = 'synthetic-code';
      }
      Object.assign(test.response.data, { onboarding: { ready: false }, result: {} });
      await test.program.parseAsync([...args, '--json'], { from: 'user' });
      expect(requestBody(test.calls[0]).input).toEqual(input);
      expect(JSON.parse(test.out.text)).toEqual(test.response);
    },
  );

  it('provides offline help for every new command and option without authentication or requests', async () => {
    for (const spec of capabilities) {
      const test = fixture(spec.path);
      await expect(
        test.program.parseAsync([...spec.path.split(' '), '--help'], { from: 'user' }),
      ).rejects.toMatchObject({ code: 'commander.helpDisplayed' });
      for (const field of spec.fields) expect(test.out.text).toContain(`--${field.flag}`);
      expect(test.fetchMock).not.toHaveBeenCalled();
    }
  });
});
