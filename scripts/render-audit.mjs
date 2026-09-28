#!/usr/bin/env node
/**
 * Render audit — a dev tool, not part of the shipped CLI.
 *
 * Calls every read tool the signed-in account may use and reports, per tool, which returned fields are
 * empty for *every* row. It is a report to triage by hand, not a pass/fail gate: a field can be empty
 * because the tenant genuinely has no data for it (a legitimate blank, e.g. an unassigned risk owner) or
 * because the tool maps a key the service never returns (a bug). Only a human can tell those apart.
 *
 * Requires a signed-in CLI (`ciphrix login`) and a reachable API (`CIPHRIX_API_URL`).
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const configuredBaseUrl = process.env.CIPHRIX_API_URL;
if (!configuredBaseUrl) {
  console.error('Set CIPHRIX_API_URL to your Ciphrix API URL before running this audit.');
  process.exit(1);
}

const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
const configDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'ciphrix');

const credentialFile = await readFile(join(configDir, 'credentials.json'), 'utf8').catch(
  () => null,
);
const token = credentialFile ? JSON.parse(credentialFile)[baseUrl]?.token : null;
if (!token) {
  console.error(`No stored credential for ${baseUrl}. Run \`ciphrix login\` first.`);
  process.exit(1);
}

const call = async (path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** The first array of objects in a tool payload — the rows this audit cares about. */
const rowsOf = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  if (!value || typeof value !== 'object') return [];
  for (const entry of Object.values(value)) {
    const rows = rowsOf(entry);
    if (rows.length > 0) return rows;
  }
  return [];
};

const empty = (value) => value === null || value === undefined || value === '';

const manifest = await call('/tools/v1');
if (!manifest?.tools) {
  console.error('Could not read the tool manifest. Is the API reachable and are you signed in?');
  process.exit(1);
}

const tools = manifest.tools.filter((tool) => tool.effect === 'read');
console.log(`Render audit — ${tools.length} read tools against ${baseUrl}\n`);

for (const tool of tools) {
  const required = tool.inputSchema?.required ?? [];
  if (required.length > 0) {
    console.log(`- ${tool.name}: skipped (needs input: ${required.join(', ')})`);
    continue;
  }

  const envelope = await call(`/tools/v1/${encodeURIComponent(tool.name)}`, { input: {} });
  if (envelope?.status !== 'ok') {
    console.log(`- ${tool.name}: call failed (${envelope?.error?.message ?? 'unknown'})`);
    continue;
  }

  const rows = rowsOf(envelope.data);
  if (rows.length === 0) {
    console.log(`- ${tool.name}: no rows returned`);
    continue;
  }

  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const blank = keys.filter((key) => rows.every((row) => empty(row[key])));
  const note = blank.length > 0 ? `always empty: ${blank.join(', ')}` : 'all fields populated';
  console.log(`- ${tool.name}: ${rows.length} row(s), ${note}`);
}
