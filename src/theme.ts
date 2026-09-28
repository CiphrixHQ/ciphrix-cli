import { randomUUID } from 'node:crypto';

/**
 * Colour handling for terminal output.
 *
 * Rules:
 * - `NO_COLOR` (non-empty) disables colour, per https://no-color.org.
 * - `FORCE_COLOR` (non-empty, not `0`) enables colour even when piped.
 * - Otherwise colour is enabled only for an interactive TTY.
 *
 * Decoration must never leak into machine-readable output; callers gate that
 * with the resolved `color` flag.
 */
export interface Theme {
  readonly color: boolean;
  bold(text: string): string;
  dim(text: string): string;
  cyan(text: string): string;
  green(text: string): string;
  red(text: string): string;
  yellow(text: string): string;
  grey(text: string): string;
}

const OPEN = '\uE000CXI';
const CLOSE = '\uE001';
const issuedMarkerIds = new Set<string>();
const STYLE_CODES: Record<string, string> = {
  '0': '\u001B[0m',
  '1': '\u001B[1m',
  '2': '\u001B[2m',
  '31': '\u001B[31m',
  '32': '\u001B[32m',
  '33': '\u001B[33m',
  '36': '\u001B[36m',
  '90': '\u001B[90m',
};

const isSet = (value: string | undefined): value is string =>
  typeof value === 'string' && value !== '';

export const colorEnabled = (
  stream: Pick<NodeJS.WriteStream, 'isTTY'> = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (isSet(env.FORCE_COLOR) && env.FORCE_COLOR !== '0') return true;
  if (isSet(env.NO_COLOR)) return false;
  return stream.isTTY === true;
};

const paint = (open: number, text: string, color: boolean, markerId: string): string =>
  color ? `${OPEN}${markerId}:${open}${CLOSE}${text}${OPEN}${markerId}:0${CLOSE}` : text;

export const createTheme = (color: boolean = colorEnabled()): Theme => {
  const markerId = randomUUID();
  issuedMarkerIds.add(markerId);
  return {
    color,
    bold: (text) => paint(1, text, color, markerId),
    dim: (text) => paint(2, text, color, markerId),
    cyan: (text) => paint(36, text, color, markerId),
    green: (text) => paint(32, text, color, markerId),
    red: (text) => paint(31, text, color, markerId),
    yellow: (text) => paint(33, text, color, markerId),
    grey: (text) => paint(90, text, color, markerId),
  };
};

/** Restore only unguessable markers created by this module; forged marker-like text is discarded. */
export const renderThemeStyles = (text: string): string =>
  text.replace(
    /\uE000CXI([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(0|1|2|31|32|33|36|90)\uE001/gi,
    (marker, markerId: string, code: string) =>
      issuedMarkerIds.has(markerId.toLowerCase()) ? (STYLE_CODES[code] ?? '') : '',
  );
