import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { ApiError } from './api.js';
import { asRecord, type ToolContext } from './toolSurface.js';

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const contentTypeFor = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  const extension = dot === -1 ? '' : filename.slice(dot).toLowerCase();
  return MIME_TYPES[extension] ?? 'application/octet-stream';
};

/**
 * Stages a local file through the `upload_file` tool and returns its upload id, ready to be attached
 * to a target (a test run, a risk, a vendor). The file is sent as multipart to the tool surface with
 * the bearer credential, so no cookie or CSRF token is involved.
 */
export const uploadLocalFile = async (
  ctx: ToolContext,
  filePath: string,
  purpose: string,
): Promise<{ id: string; filename: string; size: number }> => {
  const filename = basename(filePath);
  const contents = await readFile(filePath);

  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', new Blob([contents], { type: contentTypeFor(filename) }), filename);

  const response = await fetch(`${ctx.baseUrl}/tools/v1/upload_file`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ctx.token}`, 'idempotency-key': randomUUID() },
    body: form,
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const envelope = asRecord(data);
  if (!response.ok || envelope.status !== 'ok') {
    const message =
      typeof asRecord(envelope.error).message === 'string'
        ? (asRecord(envelope.error).message as string)
        : `Upload failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  const payload = asRecord(envelope.data);
  const id = typeof payload.uploadId === 'string' ? payload.uploadId : null;
  if (!id) throw new ApiError('Upload did not return an id', 502);
  return {
    id,
    filename: typeof payload.filename === 'string' ? payload.filename : filename,
    size: typeof payload.size === 'number' ? payload.size : contents.length,
  };
};
