import type { Theme } from './theme.js';
import { renderTerminalText } from './io.js';

/**
 * A small, honest status vocabulary shared by every command. `unknown` exists
 * so a check that cannot be determined is never reported as success.
 */
export const STATUSES = ['ok', 'fail', 'caution', 'unknown'] as const;
export type Status = (typeof STATUSES)[number];

const LABELS: Record<Status, string> = {
  ok: 'ok',
  fail: 'fail',
  caution: 'caution',
  unknown: 'unknown',
};

export interface Output {
  line(text?: string): void;
  status(status: Status, label?: string): void;
  row(name: string, detail: string, status: Status): void;
  detail(text: string): void;
}

export const createOutput = (theme: Theme, stream: NodeJS.WriteStream = process.stdout): Output => {
  const write = (text: string): void => {
    stream.write(`${renderTerminalText(text)}\n`);
  };

  const paint = (status: Status, label: string): string => {
    switch (status) {
      case 'ok':
        return theme.green(label);
      case 'fail':
        return theme.red(label);
      case 'caution':
        return theme.yellow(label);
      case 'unknown':
        return theme.grey(label);
    }
  };

  return {
    line: (text = '') => write(text),
    status: (status, label = LABELS[status]) => write(paint(status, label)),
    row: (name, detail, status) => {
      write(`${theme.bold(name)}\n  ${theme.dim(detail)}  ${paint(status, LABELS[status])}`);
    },
    detail: (text) => write(`  ${theme.dim(`↳ ${text}`)}`),
  };
};
