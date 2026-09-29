export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code: string | undefined = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export interface ApiClient {
  readonly baseUrl: string;
  request(path: string, options?: RequestOptions): Promise<unknown>;
}

/** Default time allowed for an API request, including reading its response body. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
/** Maximum decoded response size buffered by the CLI. */
export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export interface RequestLimits {
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export const withRequestTimeout = async <T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw new Error(`Request timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const readLimitedText = async (response: Response, maxBytes: number): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`The API response exceeds the ${maxBytes}-byte size limit.`);
  }
  if (!response.body) return '';

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const readPromise: Promise<unknown> = Promise.resolve(reader.read() as unknown);
      const result = await readPromise.then(
        (value: unknown) => value as { done: boolean; value: Uint8Array | undefined },
      );
      const { done, value } = result;
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`The API response exceeds the ${maxBytes}-byte size limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buffer);
};

/** Never follow redirects for requests that may carry credentials or user data. */
export const fetchWithoutRedirects = async (url: string, init: RequestInit): Promise<Response> => {
  const response = await fetch(url, { ...init, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      'The API redirected this request. Redirects are blocked to protect credentials and data; update the API URL to the final HTTPS endpoint.',
    );
  }
  return response;
};

const errorPayload = (
  data: unknown,
): { message: string | undefined; code: string | undefined; details: unknown[] } => {
  if (!data || typeof data !== 'object')
    return { message: undefined, code: undefined, details: [] };
  const record = data as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : undefined;
  const message =
    typeof record.message === 'string'
      ? record.message
      : typeof record.error_description === 'string'
        ? record.error_description
        : typeof record.error === 'string'
          ? record.error
          : typeof nested?.message === 'string'
            ? nested.message
            : undefined;
  const code =
    typeof record.error === 'string'
      ? record.error
      : typeof record.code === 'string'
        ? record.code
        : typeof nested?.code === 'string'
          ? nested.code
          : undefined;
  const details = Array.isArray(nested?.details) ? (nested?.details as unknown[]) : [];
  return { message, code, details };
};

/**
 * Turn structured error details into something a user can act on: the ambiguous candidates, or the fields
 * that failed validation. A bare "use a code" or "invalid input" is not actionable.
 */
const withDetails = (message: string, code: string | undefined, details: unknown[]): string => {
  if (details.length === 0) return message;
  const asRecord = (item: unknown): Record<string, unknown> =>
    item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  if (code === 'ambiguous') {
    const candidates = details
      .map((item) => {
        const record = asRecord(item);
        const candidateCode = text(record.code);
        const candidateName = text(record.name);
        if (candidateCode && candidateName) return `${candidateCode}  ${candidateName}`;
        return candidateCode || candidateName || text(record.id);
      })
      .filter((value) => value !== '');
    return candidates.length > 0 ? `${message}\n  ${candidates.join('\n  ')}` : message;
  }

  if (code === 'invalid_input') {
    const problems = details
      .map((item) => {
        const record = asRecord(item);
        const path = text(record.path) || text(record.field) || text(record.instancePath);
        const problem = text(record.message) || text(record.error);
        if (path && problem) return `${path}: ${problem}`;
        return problem || path;
      })
      .filter((value) => value !== '');
    return problems.length > 0 ? `${message}\n  ${problems.join('\n  ')}` : message;
  }

  return message;
};

export const createApiClient = (baseUrl: string, limits: RequestLimits = {}): ApiClient => ({
  baseUrl,
  request: async (path, options = {}) => {
    const timeoutMs = limits.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const maxResponseBytes = limits.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    const { method = 'GET', body, token } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    return withRequestTimeout(timeoutMs, async (signal) => {
      const response = await fetchWithoutRedirects(`${baseUrl}${path}`, { ...init, signal });
      const text = await readLimitedText(response, maxResponseBytes);

      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!response.ok) {
        const { message, code, details } = errorPayload(data);
        throw new ApiError(
          withDetails(message || `Request failed with status ${response.status}`, code, details),
          response.status,
          code,
        );
      }

      return data;
    });
  },
});
