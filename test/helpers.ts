import type { CredentialStore } from '../src/credentials.js';
import type { CliIO } from '../src/io.js';
import { createTheme } from '../src/theme.js';

/** Captures writes so tests can assert what a command printed. */
export class Capture {
  text = '';
  isTTY = false;

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }
}

/** A captured CLI IO pair and an in-memory credential store for `https://api.example.com/api`. */
export const setup = () => {
  const out = new Capture();
  const err = new Capture();
  const io = { stdout: out, stderr: err, theme: createTheme(false) } as unknown as CliIO;
  const store = {
    get: () => Promise.resolve({ apiUrl: 'https://api.example.com/api', token: 'token' }),
    set: () => Promise.resolve(),
    clear: () => Promise.resolve(),
  } as unknown as CredentialStore;
  return { io, out, err, store };
};

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const apiUrl = 'https://api.example.com/api';

/** The JSON body of a captured fetch call. */
export const requestBody = (call: unknown): Record<string, unknown> => {
  const init = (call as [string, RequestInit])[1];
  return JSON.parse((init.body as string) ?? '{}') as Record<string, unknown>;
};
