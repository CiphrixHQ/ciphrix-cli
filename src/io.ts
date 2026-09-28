import { createInterface } from 'node:readline/promises';

import { createTheme, renderThemeStyles, type Theme } from './theme.js';

/* eslint-disable no-control-regex */

/**
 * Output targets for the CLI. Commands receive this rather than touching
 * `process` directly, so they can be tested with captured streams.
 */
export interface CliIO {
  readonly stdout: NodeJS.WriteStream;
  readonly stderr: NodeJS.WriteStream;
  readonly theme: Theme;
}

export const createDefaultIO = (): CliIO => ({
  stdout: process.stdout,
  stderr: process.stderr,
  theme: createTheme(),
});

export const writeLine = (stream: NodeJS.WriteStream, text = ''): void => {
  stream.write(`${safeOutputText(text)}\n`);
};

/** Writes a local, intentionally multiline block such as the fixed CLI banner. */
export const writeBlock = (stream: NodeJS.WriteStream, text: string): void => {
  stream.write(
    text
      .split(/\r\n|[\r\n]/)
      .map(safeOutputText)
      .join('\n'),
  );
};

const safeOutputText = (text: string): string => {
  try {
    JSON.parse(text) as unknown;
    // JSON.stringify leaves C1 code points literal. Escape them in the serialized representation so
    // consumers recover the original values while terminals never interpret them as controls.
    return text.replace(
      /[\u0080-\u009F]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
  } catch {
    return renderTerminalText(text);
  }
};

export const renderTerminalText = (text: string): string =>
  renderThemeStyles(sanitizeTerminalText(text));

/**
 * Remove terminal controls from untrusted text.
 * Newlines and carriage returns become spaces so a server value cannot forge extra output lines.
 */
export const sanitizeTerminalText = (value: string): string => {
  // OSC, DCS, SOS, PM and APC strings may end with BEL or ST (7-bit or 8-bit).
  const withoutStrings = value.replace(
    /(?:\u001B\][\s\S]*?(?:\u0007|\u001B\\|\u009C)|\u009D[\s\S]*?(?:\u0007|\u001B\\|\u009C)|\u001B[P^_X][\s\S]*?(?:\u001B\\|\u009C)|[\u0090\u0098\u009E\u009F][\s\S]*?(?:\u001B\\|\u009C))/g,
    '',
  );

  // Theme styling uses private markers that are restored only after sanitization. Remove every
  // actual CSI and ESC sequence here, including SGR sequences supplied by untrusted data.
  const withoutControls = withoutStrings
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u009B[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001B(?!\[)[ -/]*[0-~]/g, '')
    .replace(/\u001B(?!\[[0-9;]*m)/g, '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F-\u009F]/g, '');

  return withoutControls.replace(/\r\n|[\r\n]/g, ' ');
};

/**
 * Renders an aligned table. Column widths follow the content; the last column may overflow gracefully.
 */
export const writeTable = (io: CliIO, headers: string[], rows: string[][]): void => {
  const safeHeaders = headers.map(sanitizeTerminalText);
  const safeRows = rows.map((row) => row.map(sanitizeTerminalText));
  const widths = safeHeaders.map((header, index) =>
    Math.max(
      stripAnsi(header).length,
      ...safeRows.map((row) => stripAnsi(row[index] ?? '').length),
    ),
  );
  const render = (cells: string[]) =>
    cells
      .map((cell, index) =>
        index === cells.length - 1 ? cell : cell.padEnd((widths[index] ?? 0) + 2),
      )
      .join('');
  writeLine(io.stdout, io.theme.dim(render(safeHeaders)));
  for (const row of safeRows) writeLine(io.stdout, render(row));
};

const stripAnsi = (value: string): string =>
  sanitizeTerminalText(value).replace(/\u001B\[[0-9;]*m/g, '');

/**
 * Prints a pagination footer for a list. Makes truncation explicit and shows the next page command.
 */
export const writePageFooter = (
  io: CliIO,
  {
    shown,
    total,
    page,
    limit,
    hasMore,
  }: { shown: number; total: number; page: number; limit: number; hasMore: boolean },
): void => {
  if (total <= 0) return;
  const first = (page - 1) * limit + 1;
  const last = Math.min(first + shown - 1, total);
  const range = shown === 0 ? '0' : `${first}–${last}`;
  writeLine(
    io.stdout,
    io.theme.dim(`showing ${range} of ${total}${hasMore ? ` · next: --page ${page + 1}` : ''}`),
  );
};

/**
 * One dim line naming the drill-down for what was just listed, so the next step is obvious rather than
 * guessed. Callers pass the concrete command; nothing is printed when there is nothing to drill into.
 */
export const writeNextHint = (io: CliIO, command: string | null | undefined): void => {
  if (!command) return;
  writeLine(io.stdout, io.theme.dim(`next: ${command}`));
};

/** Clips a value to a column-friendly width. Asset names are often long cloud ARNs. */
export const clip = (value: string, max = 60): string =>
  value.length > max ? `${value.slice(0, max - 1)}\u2026` : value;

/**
 * Asks a yes/no question. Returns false when there is no interactive terminal,
 * so a non-`--yes` write never applies in a pipe or CI by accident.
 */
export const promptConfirm = async (io: CliIO, question: string): Promise<boolean> => {
  if (io.stdout.isTTY !== true) return false;
  const rl = createInterface({ input: process.stdin, output: io.stdout });
  try {
    const answer = await rl.question(`${sanitizeTerminalText(question)} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
};
