import type { ToolContext } from './toolSurface.js';

export interface ToolDescriptor {
  name: string;
  version: number;
  description: string;
  effect: 'read' | 'write' | 'destructive';
  confirmation: 'none' | 'preflight_confirm';
  inputSchema: Record<string, unknown>;
  cli?: { group: string[]; operation: string };
  limits?: Record<string, unknown>;
}

export class ManifestError extends Error {}

const cache = new WeakMap<
  ToolContext,
  { baseUrl: string; token: string; manifest: Promise<ToolDescriptor[]> }
>();
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const checkSchema = (value: unknown, depth = 0, budget = { properties: 0 }): void => {
  if (depth > 32) throw new ManifestError('Tool schema exceeds the supported nesting limit.');
  if (Array.isArray(value)) {
    for (const child of value) checkSchema(child, depth + 1, budget);
  } else if (value && typeof value === 'object') {
    const schema = record(value);
    budget.properties += Object.keys(record(schema.properties)).length;
    if (budget.properties > 1000)
      throw new ManifestError('Tool schema exceeds the supported property limit.');
    for (const child of Object.values(schema)) checkSchema(child, depth + 1, budget);
  }
};

export const getManifest = (ctx: ToolContext): Promise<ToolDescriptor[]> => {
  const previous = cache.get(ctx);
  if (previous?.baseUrl === ctx.baseUrl && previous.token === ctx.token) return previous.manifest;
  const loaded = (async () => {
    const body = record(await ctx.client.request('/tools/v1', { token: ctx.token }));
    if (
      body.manifestVersion !== 1 ||
      body.apiVersion !== 'v1' ||
      !Array.isArray(body.tools) ||
      body.tools.length > 1024
    ) {
      throw new ManifestError(
        'Unsupported tool manifest. Update the client or contact your administrator.',
      );
    }
    const names = new Set<string>();
    const bindings = new Set<string>();
    return body.tools.map((value: unknown) => {
      const tool = record(value);
      if (
        typeof tool.name !== 'string' ||
        !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(tool.name) ||
        !Number.isInteger(tool.version) ||
        Number(tool.version) < 1 ||
        !['read', 'write', 'destructive'].includes(String(tool.effect)) ||
        !['none', 'preflight_confirm'].includes(String(tool.confirmation)) ||
        typeof tool.description !== 'string' ||
        !tool.inputSchema ||
        typeof tool.inputSchema !== 'object' ||
        Array.isArray(tool.inputSchema) ||
        names.has(tool.name)
      )
        throw new ManifestError('Invalid or unsupported tool descriptor.');
      names.add(tool.name);
      checkSchema(tool.inputSchema);
      if (tool.cli !== undefined) {
        const binding = record(tool.cli);
        const segment = (part: unknown): part is string =>
          typeof part === 'string' &&
          part.length <= 64 &&
          /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(part);
        if (
          !Array.isArray(binding.group) ||
          binding.group.length < 1 ||
          binding.group.length > 6 ||
          !binding.group.every(segment) ||
          !segment(binding.operation)
        )
          throw new ManifestError('Invalid command binding.');
        const key = JSON.stringify([binding.group, binding.operation]);
        if (tool.version === 1 && bindings.has(key))
          throw new ManifestError('Ambiguous command binding in tool manifest.');
        if (tool.version === 1) bindings.add(key);
      }
      return tool as unknown as ToolDescriptor;
    });
  })();
  cache.set(ctx, { baseUrl: ctx.baseUrl, token: ctx.token, manifest: loaded });
  return loaded;
};

export const getTool = async (ctx: ToolContext, name: string): Promise<ToolDescriptor> => {
  const tool = (await getManifest(ctx)).find((candidate) => candidate.name === name);
  if (!tool)
    throw new ManifestError('This operation is not available in the current tool manifest.');
  if (tool.version !== 1)
    throw new ManifestError('This operation version is not supported. Update the CLI.');
  if (tool.effect === 'destructive')
    throw new ManifestError('This operation is not available through tools.');
  return tool;
};

export const resolveBinding = async (
  ctx: ToolContext,
  group: string[],
  operation: string,
): Promise<ToolDescriptor> => {
  const matches = (await getManifest(ctx)).filter(
    (candidate) =>
      candidate.cli?.operation === operation &&
      JSON.stringify(candidate.cli.group) === JSON.stringify(group),
  );
  const tool = matches.find((candidate) => candidate.version === 1) ?? matches[0];
  if (!tool)
    throw new ManifestError(
      'This command is not supported by the current tool manifest. Update the server or check available capabilities.',
    );
  return getTool(ctx, tool.name);
};
