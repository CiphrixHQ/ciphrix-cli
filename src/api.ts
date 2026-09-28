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

export const createApiClient = (baseUrl: string): ApiClient => ({
  baseUrl,
  request: async (path, options = {}) => {
    const { method = 'GET', body, token } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();

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
  },
});
