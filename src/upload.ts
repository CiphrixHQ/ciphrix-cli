import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { basename } from 'node:path';

import {
  ApiError,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithoutRedirects,
  readLimitedText,
  withRequestTimeout,
} from './api.js';
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

/** Maximum evidence file size read and staged by the CLI (50 MiB). */
export const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface UploadLimits {
  maxUploadBytes?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

const readUploadFile = async (filePath: string, maxBytes: number): Promise<Buffer> => {
  const initialStat = await lstat(filePath);
  if (initialStat.isSymbolicLink() || !initialStat.isFile()) {
    throw new Error('Upload path must be a regular file, not a symlink or special file.');
  }
  if (initialStat.size > maxBytes) {
    throw new Error(`Upload exceeds the ${maxBytes}-byte file size limit.`);
  }

  const noFollow = constants.O_NOFOLLOW ?? 0;
  const file = await open(filePath, constants.O_RDONLY | noFollow);
  try {
    const openedStat = await file.stat();
    if (
      !openedStat.isFile() ||
      openedStat.dev !== initialStat.dev ||
      openedStat.ino !== initialStat.ino
    ) {
      throw new Error('Upload path changed while it was being opened. Please retry.');
    }
    if (openedStat.size > maxBytes) {
      throw new Error(`Upload exceeds the ${maxBytes}-byte file size limit.`);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const remaining = maxBytes + 1 - total;
      if (remaining <= 0) throw new Error(`Upload exceeds the ${maxBytes}-byte file size limit.`);
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await file.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) throw new Error(`Upload exceeds the ${maxBytes}-byte file size limit.`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await file.close();
  }
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
  limits: UploadLimits = {},
): Promise<{ id: string; filename: string; size: number }> => {
  const filename = basename(filePath);
  const contents = await readUploadFile(
    filePath,
    limits.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES,
  );

  const form = new FormData();
  form.append('purpose', purpose);
  form.append(
    'file',
    new Blob([new Uint8Array(contents)], { type: contentTypeFor(filename) }),
    filename,
  );

  return withRequestTimeout(limits.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, async (signal) => {
    const response = await fetchWithoutRedirects(`${ctx.baseUrl}/tools/v1/upload_file`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ctx.token}`, 'idempotency-key': randomUUID() },
      body: form,
      signal,
    });

    const text = await readLimitedText(
      response,
      limits.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    );
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
  });
};
