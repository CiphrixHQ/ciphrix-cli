import { spawn } from 'node:child_process';

/** Opens an HTTP(S) URL in the user's default browser without invoking a shell. */
export const openInBrowser = (
  value: string,
  platform: NodeJS.Platform = process.platform,
): Promise<boolean> => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return Promise.resolve(false);
  }
  const isLoopback =
    url.hostname === 'localhost' ||
    url.hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
    url.username ||
    url.password
  ) {
    return Promise.resolve(false);
  }

  const commands: Record<string, [string, string[]]> = {
    darwin: ['open', [url.href]],
    linux: ['xdg-open', [url.href]],
    win32: ['rundll32.exe', ['url.dll,FileProtocolHandler', url.href]],
  };
  const command = commands[platform];
  if (!command) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      const child = spawn(command[0], command[1], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.once('error', () => resolve(false));
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
};
