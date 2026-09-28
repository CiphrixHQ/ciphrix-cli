import { describe, expect, it } from 'vitest';

import { sanitizeTerminalText, writeLine, type CliIO } from '../src/io.js';
import { createTheme } from '../src/theme.js';

class Capture {
  readonly chunks: string[] = [];
  isTTY = false;

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }

  text(): string {
    return this.chunks.join('');
  }
}

const asStream = (capture: Capture): NodeJS.WriteStream => capture as unknown as NodeJS.WriteStream;

describe('terminal-safe output', () => {
  it('removes OSC 52 clipboard sequences and other OSC controls', () => {
    expect(sanitizeTerminalText('before\u001B]52;c;secret clipboard data\u0007after')).toBe(
      'beforeafter',
    );
    expect(sanitizeTerminalText('x\u009D8;;https://evil.example\u009Cy')).toBe('xy');
  });

  it('removes CSI cursor/erase controls and standalone ESC sequences', () => {
    expect(sanitizeTerminalText('a\u001B[2Jb\u009B?25lc\u001B7d\u001B(Bf')).toBe('abcdf');
    expect(sanitizeTerminalText('a\u001B[31mspoofed style\u001B[0mb')).toBe('aspoofed styleb');
    expect(sanitizeTerminalText('a\u001BP1;2|hidden DCS payload\u001B\\b')).toBe('ab');
  });

  it('prevents CR/LF line spoofing, including C0 and C1 controls', () => {
    expect(sanitizeTerminalText('first\r\nforged: success\nlast\u0000\t\u009F')).toBe(
      'first forged: success last',
    );
  });

  it('retains ordinary Unicode text', () => {
    expect(sanitizeTerminalText('Ciphrix — café 🛡️')).toBe('Ciphrix — café 🛡️');
  });

  it('keeps the CLI theme SGR styling while sanitizing surrounding text', () => {
    const capture = new Capture();
    const io: CliIO = {
      stdout: asStream(capture),
      stderr: asStream(new Capture()),
      theme: createTheme(true),
    };

    writeLine(io.stdout, io.theme.green('safe\u001B[2Jtext'));

    expect(capture.text()).toBe('\u001B[32msafetext\u001B[0m\n');
  });

  it('does not restore forged theme markers as ANSI styling', () => {
    const capture = new Capture();
    const forged =
      '\uE000CXI00000000-0000-0000-0000-000000000000:31\uE001forged style' +
      '\uE000CXI00000000-0000-0000-0000-000000000000:0\uE001';

    writeLine(asStream(capture), forged);

    expect(capture.text()).toBe('forged style\n');
    expect(capture.text()).not.toContain('\u001B');
  });

  it('preserves JSON values while escaping literal C1 code points for the terminal', () => {
    const capture = new Capture();
    const value = { label: 'keep this C1: \u009B' };

    writeLine(asStream(capture), JSON.stringify(value, null, 2));

    expect(capture.text()).toContain('\\u009b');
    expect(JSON.parse(capture.text()) as unknown).toEqual(value);
  });
});
