import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/api.js';
import { createProgram } from '../src/cli.js';
import { registerCapabilities, RenderedCommandError } from '../src/commands/capabilities.js';
import { policyApproveCommand, policySubmitCommand } from '../src/commands/policyActions.js';
import { apiUrl, jsonResponse, requestBody, setup } from './helpers.js';

afterEach(() => vi.unstubAllGlobals());
const userId = 'b789a9aa-98fe-41dc-80db-440fc913d383';
const fixtures = [
  ['document workflow set', true, ['--type', 'advanced'], { workflowType: 'advanced' }],
  [
    'document reviewer set',
    true,
    ['--user', 'employee@example.com'],
    { user: { email: 'employee@example.com' } },
  ],
  ['document reviewer remove', true, [], {}],
  ['document approver set', true, ['--user', userId], { user: { id: userId } }],
  ['document approver remove', true, [], {}],
  ['document review complete', false, [], {}],
  ['document review send-back', false, [], {}],
  ['document review cancel', true, [], {}],
  ['document approval send', false, [], {}],
  ['document approval send-back', false, [], {}],
  ['document approval cancel', true, [], {}],
  ['document approval self-approve', false, [], {}],
  ['document workflow return-to-draft', true, [], {}],
] as const;

const fixture = (path: string, confirmed: boolean) => {
  const parts = path.split(' ');
  const operation = parts.pop()!;
  const tool = {
    name: 'synthetic_operation',
    version: 1,
    description: 'Synthetic fixture.',
    effect: path === 'user list' ? 'read' : 'write',
    confirmation: confirmed ? 'preflight_confirm' : 'none',
    inputSchema: { type: 'object' },
    cli: { group: parts, operation },
  };
  const response = {
    status: 'ok',
    data: { policyId: 'synthetic', status: 'draft' },
    meta: { fixture: true },
    warnings: [],
  };
  const calls: [string, RequestInit][] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    if (url.endsWith('/tools/v1'))
      return Promise.resolve(jsonResponse({ manifestVersion: 1, apiVersion: 'v1', tools: [tool] }));
    calls.push([url, init]);
    const body = requestBody([url, init]);
    return Promise.resolve(
      jsonResponse(
        confirmed && !body.confirmationToken
          ? {
              status: 'ok',
              data: {},
              meta: {
                confirmation: {
                  token: 'synthetic-confirmation',
                  summary: 'Apply explicitly selected action?',
                },
              },
            }
          : response,
      ),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  const { io, out, store } = setup();
  const program = new Command().exitOverride();
  const context = { baseUrl: apiUrl, client: createApiClient(apiUrl), token: 'synthetic-token' };
  registerCapabilities(program, io, () => Promise.resolve(context));
  return { program, calls, out, tool, fetchMock, response, io, store };
};

describe('document workflow command contracts', () => {
  it.each(fixtures)(
    '%s uses the manifest binding and exact wire payload',
    async (path, confirmed, flags, extra) => {
      const test = fixture(path, confirmed);
      await test.program.parseAsync(
        [
          ...path.split(' '),
          'Security Policy',
          ...flags,
          '--json',
          '--idempotency-key',
          'explicit-key',
          ...(confirmed ? ['--yes'] : []),
        ],
        { from: 'user' },
      );
      expect(test.calls).toHaveLength(confirmed ? 2 : 1);
      for (const call of test.calls) {
        expect(call[0]).toBe(`${apiUrl}/tools/v1/synthetic_operation`);
        expect(requestBody(call)).toMatchObject({
          input: { name: 'Security Policy', ...extra },
          idempotencyKey: 'explicit-key',
          version: 1,
        });
      }
      if (confirmed)
        expect(requestBody(test.calls[1])).toEqual({
          ...requestBody(test.calls[0]),
          confirmationToken: 'synthetic-confirmation',
        });
      expect(JSON.parse(test.out.text)).toEqual(test.response);
    },
  );
  it.each([userId, 'POL-001', 'A quoted policy name'])(
    'retains document selector resolution for %s',
    async (document) => {
      const test = fixture('document review complete', false);
      await test.program.parseAsync(['document', 'review', 'complete', document, '--json'], {
        from: 'user',
      });
      expect(requestBody(test.calls[0]).input).toEqual(
        document === userId ? { policyId: document } : { name: document },
      );
    },
  );
  it.each(['', 'somebody', 'self'])('refuses invalid user %s without requests', async (user) => {
    const test = fixture('document reviewer set', true);
    await expect(
      test.program.parseAsync(
        ['document', 'reviewer', 'set', 'Policy', '--user', user, '--yes', '--json'],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(test.calls).toHaveLength(0);
    expect(JSON.parse(test.out.text)).toMatchObject({ error: { code: 'invalid_input' } });
  });
  it.each([
    ['document approval send', false, ['--yes']],
    ['document review cancel', true, []],
    ['user list', false, ['--yes']],
  ] as const)(
    'rejects incompatible confirmation controls for %s before mutation',
    async (path, confirmed, flags) => {
      const test = fixture(path, confirmed);
      await expect(
        test.program.parseAsync(
          [...path.split(' '), ...(path === 'user list' ? [] : ['Policy']), '--json', ...flags],
          { from: 'user' },
        ),
      ).rejects.toBeInstanceOf(RenderedCommandError);
      expect(test.calls).toHaveLength(0);
    },
  );
  it('returns a sent-stage recovery error unchanged and never recalls or resends automatically', async () => {
    const test = fixture('document approver set', true);
    const original = test.fetchMock.getMockImplementation()!;
    const envelope = {
      status: 'error',
      error: {
        code: 'invalid_state',
        message: 'Already awaiting approval',
        details: {
          nextOperations: [
            'cancel_document_approval',
            'set_document_approver',
            'send_document_for_approval',
          ],
        },
      },
    };
    test.fetchMock.mockImplementation(async (url, init) =>
      url.endsWith('/tools/v1') ? original(url, init) : jsonResponse(envelope, 409),
    );
    await expect(
      test.program.parseAsync(
        ['document', 'approver', 'set', 'Policy', '--user', userId, '--yes', '--json'],
        { from: 'user' },
      ),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(JSON.parse(test.out.text)).toEqual(envelope);
    expect(test.fetchMock).toHaveBeenCalledTimes(2); // manifest + rejected preflight only
  });
  it('fails a new command against an old manifest before calling any write', async () => {
    const test = fixture('document review complete', false);
    test.fetchMock.mockResolvedValue(
      jsonResponse({ manifestVersion: 1, apiVersion: 'v1', tools: [] }),
    );
    await expect(
      test.program.parseAsync(['document', 'review', 'complete', 'Policy', '--json'], {
        from: 'user',
      }),
    ).rejects.toBeInstanceOf(RenderedCommandError);
    expect(JSON.parse(test.out.text)).toMatchObject({ error: { code: 'unsupported_capability' } });
    expect(test.calls).toHaveLength(0);
  });
  it('has exactly one existing submit/approve spelling and no duplicate registration', () => {
    const { io } = setup();
    const program = createProgram(io);
    const document = program.commands.find((command) => command.name() === 'document')!;
    expect(document.commands.filter((command) => command.name() === 'submit')).toHaveLength(1);
    expect(document.commands.filter((command) => command.name() === 'approve')).toHaveLength(1);
    expect(
      document.commands
        .find((command) => command.name() === 'review')!
        .commands.some((command) => command.name() === 'send'),
    ).toBe(false);
    expect(
      document.commands
        .find((command) => command.name() === 'approval')!
        .commands.some((command) => command.name() === 'approve'),
    ).toBe(false);
  });
  it.each(['submit', 'approve'] as const)(
    'retains %s legacy JSON/options through a renamed canonical binding',
    async (operation) => {
      const test = fixture(`document ${operation}`, false);
      const command = operation === 'submit' ? policySubmitCommand : policyApproveCommand;
      await command({
        io: test.io,
        store: test.store,
        apiUrl,
        json: true,
        yes: true,
        policy: 'Policy',
      });
      expect(test.calls).toHaveLength(1);
      expect(test.calls[0]![0]).toBe(`${apiUrl}/tools/v1/synthetic_operation`);
      expect(JSON.parse(test.out.text)).toEqual(test.response);
    },
  );
});
