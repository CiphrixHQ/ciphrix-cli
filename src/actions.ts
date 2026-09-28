import { randomUUID } from 'node:crypto';

import { promptConfirm, writeLine, type CliIO } from './io.js';
import { asRecord, asText, callTool, errorMessage, type ToolContext } from './toolSurface.js';

export interface ApplyOptions {
  ctx: ToolContext;
  io: CliIO;
  toolName: string;
  input: unknown;
  fallback: string;
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}

/**
 * Runs a tool, handling the two-step confirm contract when the tool requires it.
 *
 * - Tools that need no confirmation apply on the first call.
 * - Tools that require confirmation: the first call is a preflight (summary + token), the user is asked
 *   once, then the change is applied with the token and an idempotency key.
 */
export const applyTool = async ({
  ctx,
  io,
  toolName,
  input,
  fallback,
  yes = false,
  confirm,
}: ApplyOptions): Promise<Record<string, unknown> | null> => {
  const ask = confirm ?? ((question: string) => promptConfirm(io, question));
  const idempotencyKey = randomUUID();

  const first = await callTool(ctx, toolName, input, { idempotencyKey });
  if (first.status !== 'ok') throw new Error(errorMessage(first, fallback));

  const confirmation = asRecord(asRecord(first.meta).confirmation);
  const token = asText(confirmation.token);
  if (!token) return first;

  writeLine(io.stdout, asText(confirmation.summary, 'Apply this change?'));
  if (!yes && !(await ask('Apply this change?'))) {
    writeLine(io.stdout, 'Cancelled.');
    return null;
  }

  const result = await callTool(ctx, toolName, input, { confirmationToken: token, idempotencyKey });
  if (result.status !== 'ok') throw new Error(errorMessage(result, fallback));
  return result;
};
