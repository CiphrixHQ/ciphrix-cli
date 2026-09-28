import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLI_NAME, CLI_TAGLINE, CLI_VERSION } from '../src/constants.js';
import { createProgram, main, type CliIO } from '../src/cli.js';
import { formatBanner } from '../src/banner.js';
import { colorEnabled, createTheme } from '../src/theme.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
  bin: Record<string, string>;
};
const originalInsecureHttpOptIn = process.env.CIPHRIX_ALLOW_INSECURE_HTTP;

class Capture {
  private readonly chunks: string[] = [];
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

const captureIO = (): { io: CliIO; out: Capture; err: Capture } => {
  const out = new Capture();
  const err = new Capture();
  return {
    io: { stdout: asStream(out), stderr: asStream(err), theme: createTheme(false) },
    out,
    err,
  };
};

describe('package', () => {
  it('exposes the ciphrix binary', () => {
    expect(CLI_NAME).toBe('ciphrix');
    expect(pkg.bin[CLI_NAME]).toBe('dist/index.js');
  });

  it('keeps the reported version in sync with package.json', () => {
    expect(CLI_VERSION).toBe(pkg.version);
  });
});

describe('program', () => {
  it('reports its name and description', () => {
    const { io } = captureIO();
    const program = createProgram(io);
    expect(program.name()).toBe(CLI_NAME);
    expect(program.description()).toBe(CLI_TAGLINE);
  });

  it('renders the banner with the version', () => {
    const banner = formatBanner(createTheme(false));
    expect(banner).toContain('██████');
    expect(banner).toContain(`v${CLI_VERSION}`);
  });

  it('prints the banner and help when no command is given', async () => {
    const { io, out } = captureIO();
    const code = await main(['node', CLI_NAME], io);
    expect(code).toBe(0);
    expect(out.text()).toContain('██████');
    expect(out.text()).toContain(CLI_TAGLINE);
  });

  it('prints the version and exits 0 for --version', async () => {
    const { io, out } = captureIO();
    const code = await main(['node', CLI_NAME, '--version'], io);
    expect(code).toBe(0);
    expect(out.text().trim()).toBe(CLI_VERSION);
  });

  it('fails with a non-zero code for an unknown command', async () => {
    const { io, err } = captureIO();
    const code = await main(['node', CLI_NAME, 'definitely-not-a-command'], io);
    expect(code).not.toBe(0);
    expect(err.text()).toContain('error:');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalInsecureHttpOptIn === undefined) delete process.env.CIPHRIX_ALLOW_INSECURE_HTTP;
    else process.env.CIPHRIX_ALLOW_INSECURE_HTTP = originalInsecureHttpOptIn;
  });

  it.each([
    ['before the command', ['--allow-insecure-http', 'login', '--api-url', 'http://localhost/api']],
    ['after the command', ['login', '--api-url', 'http://localhost/api', '--allow-insecure-http']],
  ])('applies the HTTP opt-in consistently when specified %s', async (_position, args) => {
    const { io, err } = captureIO();
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 400 })));
    vi.stubGlobal('fetch', fetchMock);

    const code = await main(['node', CLI_NAME, ...args], io);

    expect(code).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      'http://localhost/api/auth/device/code',
    );
    expect(err.text()).not.toContain('Refusing to send credentials or data over HTTP');
  });

  it('rejects HTTP before making a request when the CLI opt-in is absent', async () => {
    const { io, err } = captureIO();
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 400 })));
    vi.stubGlobal('fetch', fetchMock);

    const code = await main(['node', CLI_NAME, 'login', '--api-url', 'http://localhost/api'], io);

    expect(code).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(err.text()).toContain('Refusing to send credentials or data over HTTP');
  });

  it('honours the environment opt-in for headless commands', async () => {
    const { io, err } = captureIO();
    process.env.CIPHRIX_ALLOW_INSECURE_HTTP = 'true';
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 400 })));
    vi.stubGlobal('fetch', fetchMock);

    const code = await main(['node', CLI_NAME, 'login', '--api-url', 'http://localhost/api'], io);

    expect(code).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.text()).not.toContain('Refusing to send credentials or data over HTTP');
  });

  it('applies the root opt-in to nested resource commands', async () => {
    const { io, err } = captureIO();
    const configHome = await mkdtemp(join(tmpdir(), 'ciphrix-cli-test-'));
    const previousCredentialStore = process.env.CIPHRIX_CREDENTIAL_STORE;
    const previousConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.CIPHRIX_CREDENTIAL_STORE = 'file';
    process.env.XDG_CONFIG_HOME = configHome;

    try {
      const code = await main(
        [
          'node',
          CLI_NAME,
          'context',
          'status',
          'business',
          '--api-url',
          'http://localhost/api',
          '--allow-insecure-http',
        ],
        io,
      );

      expect(code).toBe(1);
      expect(err.text()).toContain('Not signed in');
      expect(err.text()).not.toContain('Refusing to send credentials or data over HTTP');
    } finally {
      if (previousCredentialStore === undefined) delete process.env.CIPHRIX_CREDENTIAL_STORE;
      else process.env.CIPHRIX_CREDENTIAL_STORE = previousCredentialStore;
      if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousConfigHome;
      await rm(configHome, { recursive: true, force: true });
    }
  });
});

describe('theme', () => {
  it('honours NO_COLOR', () => {
    expect(colorEnabled({ isTTY: true }, { NO_COLOR: '1' })).toBe(false);
  });

  it('honours FORCE_COLOR even when not a TTY', () => {
    expect(colorEnabled({ isTTY: false }, { FORCE_COLOR: '1' })).toBe(true);
  });

  it('enables colour only for a TTY by default', () => {
    expect(colorEnabled({ isTTY: false }, {})).toBe(false);
    expect(colorEnabled({ isTTY: true }, {})).toBe(true);
  });
});
